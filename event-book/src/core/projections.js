// ===========================================
// PROJECTIONS (Read Models)
// ===========================================

import { getEventStream, EventTypes } from './eventStore.js';
import { byName } from './constants.js';
import { editionOf } from '../features/editions/rules.js';

// Element ordering hierarchy (top to bottom)
// Screens/Processors → Commands/ReadModels → Events
function getElementOrder(elementType) {
  const order = {
    'screen': 1,
    'processor': 1,
    'command': 2,
    'readModel': 3,
    'event': 4
  };
  return order[elementType] || 5;
}

export function sortSliceElements(elements, state) {
  return [...elements].sort((a, b) => {
    const typeA = state.elements[a]?.type;
    const typeB = state.elements[b]?.type;
    return getElementOrder(typeA) - getElementOrder(typeB);
  });
}

// The open model by default; the library passes other models' events
export function projectState(eventStream = getEventStream()) {
  
  const state = {
    elements: {},      // id -> element
    slices: {},        // id -> slice
    connections: [],   // { from, to, relation }
    scenarios: {},     // id -> scenario
    sliceOrder: [],    // slice ids, left to right on the board
    chapters: {},      // id -> { id, name }
    chapterOrder: [],  // chapter ids, left to right
    flows: {},         // id -> { id, chapterId, name }
    modelName: null,
    modelDescription: null,
    updateRoles: {},   // 'eventId>readModelId' -> 'adds' | 'completes' (to-do lists)
    modelSource: null, // built from code: { repo, commit, createdAt, build } (a test export)
    sliceDecisions: [], // compare: { sliceId, otherShelf, otherSliceName, same } (possible renames answered)
    edition: null,     // { published, edition, draft, commit, lastBuild } (features/editions/rules.js)
    follow: null,      // { app, followedBy }: the app whose build book this plan follows (features/buildVersions)
    comments: {},      // id -> { id, sliceId, scenarioId, part, text, nickname, deviceId, at, resolved, resolvedBy, deleted }
    verdicts: {},      // edition -> scenarioId -> { verdict: works | fails, note, testedBy, at, sliceId } (the latest counts)
    pendingSlice: null
  };

  // Elements that have ever sat in a slice: a processor whose slices were
  // deleted shouldn't come back as an inferred automation column
  const everSliced = new Set();

  for (const event of eventStream) {
    switch (event.type) {
      // The model as it stood, in one go (a copy: later events change it)
      case EventTypes.ModelSnapshot: {
        const snap = JSON.parse(JSON.stringify(event.data.state || {}));
        Object.keys(state).forEach(k => { if (k in snap) state[k] = snap[k]; });
        state.pendingSlice = null;
        Object.values(state.slices).forEach(s => s.elements.forEach(id => everSliced.add(id)));
        break;
      }

      case EventTypes.ElementCreated:
        state.elements[event.data.elementId] = {
          id: event.data.elementId,
          type: event.data.elementType,
          name: event.data.name,
          properties: []
        };
        break;
        
      case EventTypes.ElementDeleted:
        delete state.elements[event.data.elementId];
        break;

      case EventTypes.ElementListSet:
        if (state.elements[event.data.elementId]) state.elements[event.data.elementId].list = !!event.data.list;
        break;

      case EventTypes.ElementTodoSet:
        if (state.elements[event.data.elementId]) state.elements[event.data.elementId].todo = !!event.data.todo;
        break;

      case EventTypes.UpdateRoleSet:
        state.updateRoles[`${event.data.eventId}>${event.data.readModelId}`] = event.data.role;
        break;

      case EventTypes.ConnectionRemoved:
        state.connections = state.connections.filter(c =>
          !(c.from === event.data.fromId && c.to === event.data.toId && c.relation === event.data.relation));
        break;

      case EventTypes.ElementExternalSet:
        if (state.elements[event.data.elementId]) {
          state.elements[event.data.elementId].external = !!event.data.external;
        }
        break;
        
      case EventTypes.PropertyAdded:
        if (state.elements[event.data.elementId]) {
          state.elements[event.data.elementId].properties.push({
            id: event.data.propertyId,
            name: event.data.name,
            type: event.data.propertyType,
            ...(event.data.items ? { items: event.data.items } : {})
          });
        }
        break;
      
      case 'PropertyUpdated':
        if (state.elements[event.data.elementId]) {
          const props = state.elements[event.data.elementId].properties;
          const idx = props.findIndex(p => p.id === event.data.propertyId);
          if (idx >= 0) {
            props[idx] = {
              ...props[idx],
              id: event.data.propertyId,
              name: event.data.name,
              type: event.data.propertyType,
              ...(event.data.items !== undefined ? { items: event.data.items } : {})
            };
          }
        }
        break;
        
      case EventTypes.PropertyGeneratedSet: {
        const prop = state.elements[event.data.elementId]?.properties.find(p => p.id === event.data.propertyId);
        if (prop) prop.generated = !!event.data.generated;
        break;
      }

      case EventTypes.PropertyRemoved:
        if (state.elements[event.data.elementId]) {
          state.elements[event.data.elementId].properties = 
            state.elements[event.data.elementId].properties.filter(
              p => p.id !== event.data.propertyId
            );
        }
        break;
        
      case 'ElementRenamed':
        if (state.elements[event.data.elementId]) {
          state.elements[event.data.elementId].name = event.data.name;
        }
        break;
        
      case EventTypes.ProducerSet:
      case EventTypes.ConsumerAdded:
      case EventTypes.TriggerSet:
      case EventTypes.ProcessorOutputSet:
      case EventTypes.InputScreenSet:
      case EventTypes.DisplayScreenSet:
        state.connections.push({
          from: event.data.fromId,
          to: event.data.toId,
          relation: event.data.relation
        });
        break;
        
      case EventTypes.SliceCreated:
        state.slices[event.data.sliceId] = {
          id: event.data.sliceId,
          type: event.data.sliceType,
          elements: [],
          name: event.data.name || null,
          complete: true,
          created: true,
          actor: event.data.actor || 'screen',   // who drives the top lane: a screen or a processor
          pairWith: event.data.pairWith || null, // automation: the SV/SC slice on the other side of the processor
          chapterId: event.data.chapterId || null
        };
        state.sliceOrder.push(event.data.sliceId);
        break;

      case EventTypes.SliceMoved: {
        const from = state.sliceOrder.indexOf(event.data.sliceId);
        if (from >= 0) {
          state.sliceOrder.splice(from, 1);
          const to = Math.max(0, Math.min(event.data.toIndex, state.sliceOrder.length));
          state.sliceOrder.splice(to, 0, event.data.sliceId);
        }
        break;
      }

      case EventTypes.CommentAdded: {
        const d = event.data;
        state.comments[d.commentId] = { id: d.commentId, sliceId: d.sliceId, scenarioId: d.scenarioId || null, part: d.part || null,
          text: d.text, nickname: d.nickname, deviceId: d.deviceId, at: d.at || event.timestamp, resolved: false, resolvedBy: null, deleted: false };
        break;
      }

      case EventTypes.ScenarioTested: {
        const d = event.data;
        (state.verdicts[d.edition ?? 0] ||= {})[d.scenarioId] = { verdict: d.verdict, note: d.note || null, testedBy: d.testedBy, at: d.at || event.timestamp, sliceId: d.sliceId };
        break;
      }

      case EventTypes.CommentResolved:
        if (state.comments[event.data.commentId]) Object.assign(state.comments[event.data.commentId], { resolved: true, resolvedBy: event.data.resolvedBy || null });
        break;

      case EventTypes.CommentDeleted:
        if (state.comments[event.data.commentId]) state.comments[event.data.commentId].deleted = true;
        break;

      case EventTypes.ModelNamed:
        state.modelName = event.data.name;
        break;

      case EventTypes.ModelDescribed:
        state.modelDescription = event.data.description || null;
        break;

      case EventTypes.ChapterCreated:
        state.chapters[event.data.chapterId] = { id: event.data.chapterId, name: event.data.name };
        state.chapterOrder.push(event.data.chapterId);
        break;

      case EventTypes.FlowCreated:
        state.flows[event.data.flowId] = { id: event.data.flowId, chapterId: event.data.chapterId, name: event.data.name };
        break;

      case EventTypes.FlowRenamed:
        if (state.flows[event.data.flowId]) state.flows[event.data.flowId].name = event.data.name;
        break;

      case EventTypes.FlowDeleted:
        delete state.flows[event.data.flowId];
        // Its slices go back to the chapter's main line
        Object.values(state.slices).forEach(s => { if (s.flowId === event.data.flowId) s.flowId = null; });
        Object.values(state.elements).forEach(e => { if (e.flowId === event.data.flowId) e.flowId = null; });
        break;

      case EventTypes.ElementFlowSet:
        if (state.elements[event.data.elementId]) state.elements[event.data.elementId].flowId = event.data.flowId || null;
        break;

      case EventTypes.SliceFlowSet:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].flowId = event.data.flowId || null;
        break;

      case EventTypes.ChapterRenamed:
        if (state.chapters[event.data.chapterId]) state.chapters[event.data.chapterId].name = event.data.name;
        break;

      case EventTypes.ChapterMoved: {
        const from = state.chapterOrder.indexOf(event.data.chapterId);
        if (from >= 0) {
          state.chapterOrder.splice(from, 1);
          const to = Math.max(0, Math.min(event.data.toIndex, state.chapterOrder.length));
          state.chapterOrder.splice(to, 0, event.data.chapterId);
        }
        break;
      }

      case EventTypes.ChapterDeleted:
        delete state.chapters[event.data.chapterId];
        state.chapterOrder = state.chapterOrder.filter(id => id !== event.data.chapterId);
        // Its slices stay in the model, just without a chapter
        Object.values(state.slices).forEach(s => {
          if (s.chapterId === event.data.chapterId) s.chapterId = null;
        });
        break;

      // Two existing slices become an automation's halves (a read view beside its change)
      case EventTypes.SlicesPaired: {
        const a = state.slices[event.data.sliceId], b = state.slices[event.data.pairWith];
        if (a && b) { a.pairWith = b.id; b.pairWith = a.id; }
        break;
      }

      case EventTypes.SliceChapterSet:
        if (state.slices[event.data.sliceId]) {
          state.slices[event.data.sliceId].chapterId =
            state.chapters[event.data.chapterId] ? event.data.chapterId : null;
        }
        break;

      case EventTypes.SliceInferred:
        if (!state.sliceOrder.includes(event.data.sliceId)) state.sliceOrder.push(event.data.sliceId);
        state.slices[event.data.sliceId] = {
          id: event.data.sliceId,
          type: event.data.sliceType,
          elements: sortSliceElements(event.data.elements, state),
          name: null,
          complete: event.data.complete
        };
        if (!event.data.complete || !state.slices[event.data.sliceId].name) {
          state.pendingSlice = event.data.sliceId;
        }
        break;
        
      // What a slice is about, in a sentence or two (shown behind its ⓘ)
      case EventTypes.SliceDescribed:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].description = event.data.description || '';
        break;

      case EventTypes.SliceNamed:
        if (state.slices[event.data.sliceId]) {
          state.slices[event.data.sliceId].name = event.data.name;
          if (state.pendingSlice === event.data.sliceId) {
            state.pendingSlice = null;
          }
        }
        break;
      
      case EventTypes.SliceElementAdded:
      case 'SliceElementAdded':
        if (state.slices[event.data.sliceId]) {
          const slice = state.slices[event.data.sliceId];
          if (slice.elements.includes(event.data.elementId)) break;
          everSliced.add(event.data.elementId);
          slice.elements.push(event.data.elementId);
          slice.elements = sortSliceElements(slice.elements, state);
        }
        break;
        
      case EventTypes.SliceElementRemoved:
        if (state.slices[event.data.sliceId]) {
          const slice = state.slices[event.data.sliceId];
          slice.elements = slice.elements.filter(id => id !== event.data.elementId);
          // Taking out its last processor makes an automation's view or change an
          // ordinary one again (a screen on top), rather than an empty automation
          if (slice.actor === 'processor' && state.elements[event.data.elementId]?.type === 'processor' &&
              !slice.elements.some(id => state.elements[id]?.type === 'processor')) {
            slice.actor = null;
          }
        }
        break;

      case EventTypes.SliceDeleted:
        delete state.slices[event.data.sliceId];
        state.sliceOrder = state.sliceOrder.filter(id => id !== event.data.sliceId);
        break;
      
      // Explicitly refined (planning); any edit to the slice records SliceRefinedCleared after it.
      // Older models said ready for refined.
      case EventTypes.SliceMarkedRefined:
      case EventTypes.SliceMarkedReady:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].refined = true;
        break;

      case EventTypes.SliceRefinedCleared:
      case EventTypes.SliceReadyCleared:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].refined = false;
        break;

      // Done: confirmed against a model built from the tests, at its commit
      case EventTypes.SliceMarkedBuilt:
        if (state.slices[event.data.sliceId]) Object.assign(state.slices[event.data.sliceId], { built: true, builtCommit: event.data.commit || null });
        break;

      // Compare: a possible rename answered, against the other shelf
      case EventTypes.SlicesMatched:
      case EventTypes.SlicesKeptApart:
        state.sliceDecisions = [...(state.sliceDecisions || []), { sliceId: event.data.sliceId, otherShelf: event.data.otherShelf,
          otherSliceName: event.data.otherSliceName, same: event.type === EventTypes.SlicesMatched }];
        break;

      case EventTypes.BuildFollowed:
        state.follow = { app: event.data.app, followedBy: event.data.followedBy || null };
        break;
      case EventTypes.BuildUnfollowed:
        state.follow = null;
        break;

      case EventTypes.SliceBuiltCleared:
        if (state.slices[event.data.sliceId]) Object.assign(state.slices[event.data.sliceId], { built: false, builtCommit: null });
        break;

      case EventTypes.SliceCompleted:
      case 'SliceCompleted':
        if (state.slices[event.data.sliceId]) {
          state.slices[event.data.sliceId].complete = true;
        }
        break;
        
      // Scenario events
      case EventTypes.ModelSourceSet:
        state.modelSource = { repo: event.data.repo || null, commit: event.data.commit || null,
          createdAt: event.data.createdAt || null, build: event.data.build || null };
        break;

      case EventTypes.ScenarioMustHaveSet:
        if (state.scenarios[event.data.scenarioId]) state.scenarios[event.data.scenarioId].mustHave = !!event.data.mustHave;
        break;

      case EventTypes.ScenarioMoved:
        if (state.scenarios[event.data.scenarioId]) state.scenarios[event.data.scenarioId].sliceId = event.data.sliceId;
        break;

      case EventTypes.ScenarioRenamed:
        if (state.scenarios[event.data.scenarioId]) state.scenarios[event.data.scenarioId].name = event.data.name;
        break;

      case EventTypes.ScenarioAdded:
        state.scenarios[event.data.scenarioId] = {
          id: event.data.scenarioId,
          sliceId: event.data.sliceId,
          name: event.data.name,
          type: event.data.scenarioType,
          source: event.data.source || null,   // where its test is: { file, line }
          given: [],
          when: null,
          then: null
        };
        break;
        
      case EventTypes.ScenarioDeleted:
        delete state.scenarios[event.data.scenarioId];
        break;
        
      case EventTypes.GivenSet:
        if (state.scenarios[event.data.scenarioId]) {
          state.scenarios[event.data.scenarioId].given = event.data.events;
        }
        break;
        
      case EventTypes.WhenSet:
        if (state.scenarios[event.data.scenarioId]) {
          state.scenarios[event.data.scenarioId].when = {
            commandId: event.data.commandId,
            values: event.data.values
          };
        }
        break;
        
      case EventTypes.ThenEventSet:
        if (state.scenarios[event.data.scenarioId]) {
          state.scenarios[event.data.scenarioId].then = {
            type: 'event',
            eventId: event.data.eventId,
            values: event.data.values
          };
        }
        break;
        
      case EventTypes.ThenRejectionSet:
        if (state.scenarios[event.data.scenarioId]) {
          state.scenarios[event.data.scenarioId].then = {
            type: 'rejection',
            reason: event.data.reason
          };
        }
        break;
        
      case EventTypes.ThenReadModelSet:
        if (state.scenarios[event.data.scenarioId]) {
          state.scenarios[event.data.scenarioId].then = {
            type: 'readModel',
            readModelId: event.data.readModelId,
            values: event.data.values,
            ...(event.data.rows ? { rows: event.data.rows } : {})
          };
        }
        break;
    }
  }

  // Auto-infer AU slices for processors from older models: connected, but never
  // placed in a slice
  Object.values(state.elements)
    .filter(el => el.type === 'processor' && !everSliced.has(el.id))
    .forEach(processor => {
      const triggerConn = state.connections.find(c => c.to === processor.id && c.relation === 'trigger');
      const invokesConn = state.connections.find(c => c.from === processor.id && c.relation === 'invokes');
      if (!triggerConn && !invokesConn) return;

      // Just the automation itself: trigger event → processor → command
      // (the feed's AU card finds the surrounding SV/SC slices via connections)
      const elements = [triggerConn?.from, processor.id, invokesConn?.to].filter(Boolean);

      const syntheticSliceId = 'au_inferred_' + processor.id;
      state.slices[syntheticSliceId] = {
        id: syntheticSliceId,
        type: 'AU',
        elements,
        name: processor.name + ' (auto)',
        complete: !!(triggerConn && invokesConn)
      };
    });

  // Properties read A to Z everywhere: cards, pictures, sheets, scenarios
  Object.values(state.elements).forEach(el => { if (el.properties?.length > 1) el.properties.sort(byName); });

  state.edition = editionOf(eventStream);

  return state;
}

// Slices in board order (left to right); inferred AU slices that were never
// placed explicitly trail at the end
export function getOrderedSlices(state = null) {
  return getBoardGroups(state).flatMap(g => g.slices);
}

// Board layout: slices without a chapter first (no header), then each chapter in
// order with its slices — empty chapters included so they can receive slices
// What to call a slice: its own name, else what it's about (a state change's
// command, a state view's read model), else its first element
export function sliceTitle(slice, state) {
  if (slice?.name) return slice.name;
  const els = (slice?.elements || []).map(id => state.elements[id]).filter(Boolean);
  const key = els.find(e => e.type === (slice?.type === 'SV' ? 'readModel' : 'command')) || els.find(e => e.type !== 'screen') || els[0];
  return key?.name || 'Untitled slice';
}

// The flow a slice is in (null: the chapter's main line, shown in every flow)
export function sliceFlow(slice, state) {
  const flow = slice?.flowId && state.flows?.[slice.flowId];
  return flow && flow.chapterId === slice.chapterId ? flow : null;
}

// An outcome event's flow, as seen in a slice (only flows of that slice's chapter count)
// In a flow's own slices every outcome shows, so this only applies on the main line.
// flowId 'main': the happy case, hidden while a flow is shown.
export const MAIN_OUTCOME = { id: 'main', name: 'Main line' };
export function elementFlow(el, slice, state) {
  if (!el?.flowId || !slice?.chapterId || sliceFlow(slice, state)) return null;
  if (el.flowId === 'main') return Object.values(state.flows || {}).some(f => f.chapterId === slice.chapterId) ? MAIN_OUTCOME : null;
  const flow = state.flows?.[el.flowId];
  return flow && flow.chapterId === slice.chapterId ? flow : null;
}

// A chapter's flows, in the order they were made
export function chapterFlows(chapterId, state) {
  return Object.values(state.flows || {}).filter(f => f.chapterId === chapterId);
}

export function getBoardGroups(state = null) {
  state = state || projectState();
  const ordered = state.sliceOrder.map(id => state.slices[id]).filter(Boolean);
  const rest = Object.values(state.slices).filter(s => !state.sliceOrder.includes(s.id));
  const all = [...ordered, ...rest];

  const groups = [];
  const loose = all.filter(s => !s.chapterId);
  if (loose.length || !state.chapterOrder.length) groups.push({ chapter: null, slices: loose });
  state.chapterOrder.forEach(id => {
    groups.push({ chapter: state.chapters[id], slices: all.filter(s => s.chapterId === id) });
  });
  return groups;
}

// The outline read model: chapters (null: not in a chapter) with their slices, which
// of them are refined (and built), and "N of M refined". Automations inferred from older models are left out.
export const refinedLabel = (refined, total) => `${refined} of ${total} refined`;
export function getOutline(state = null) {
  state = state || projectState();
  return getBoardGroups(state).map(g => {
    const slices = g.slices.filter(s => state.sliceOrder.includes(s.id))
      .map(s => ({ sliceId: s.id, title: sliceTitle(s, state), refined: !!s.refined, built: !!s.built }));
    const refined = slices.filter(s => s.refined).length;
    return { chapter: g.chapter?.name ?? null, refined, total: slices.length, label: refinedLabel(refined, slices.length), slices };
  }).filter(g => g.chapter !== null || g.total);
}

// A slice's scenarios' Givens, as one stack: each distinct event they start from, in the
// order they first appear, with how many of the slice's scenarios use it
export function givenEventsOf(sliceId, state = null) {
  state = state || projectState();
  const seen = new Map();
  getScenariosForSlice(sliceId, state).forEach(scn => {
    new Set((scn.given || []).map(g => g.elementId)).forEach(id => {
      const el = state.elements[id];
      if (!el) return;
      seen.set(id, { element: el, scenarios: (seen.get(id)?.scenarios || 0) + 1 });
    });
  });
  return [...seen.values()];
}

// A slice's own events that no scenario starts from yet (no Given uses them): what a view
// reads without a scenario to show for it. Once a Given uses one, it moves to the given stack.
export function eventsWithoutScenario(sliceId, state = null) {
  state = state || projectState();
  const slice = state.slices[sliceId];
  if (!slice) return [];
  const used = new Set(givenEventsOf(sliceId, state).map(g => g.element.id));
  return slice.elements.map(id => state.elements[id]).filter(el => el?.type === 'event' && !used.has(el.id));
}

// The events that update a to-do list, and whether each adds an item or ticks one off
export function getTodoUpdates(readModelId, state = null) {
  state = state || projectState();
  const seen = new Set();
  return state.connections
    .filter(c => c.to === readModelId && c.relation === 'consumer' && state.elements[c.from]?.type === 'event')
    .filter(c => !seen.has(c.from) && seen.add(c.from))
    .map(c => ({ event: state.elements[c.from], role: state.updateRoles[`${c.from}>${readModelId}`] || 'adds' }));
}

// Find slice containing an element
export function findSliceForElement(elementId, state = null) {
  state = state || projectState();
  return Object.values(state.slices).find(s => s.elements.includes(elementId));
}

// Find non-AU slice containing an element (source slice)
export function findSourceSlice(elementId, state = null) {
  state = state || projectState();
  return Object.values(state.slices).find(s => 
    s.type !== 'AU' && s.elements.includes(elementId)
  );
}

// Scenarios whose slice was deleted: they're kept, and can be moved onto another slice
export function getScenariosWithoutSlice(state = null) {
  state = state || projectState();
  return Object.values(state.scenarios).filter(s => !state.slices[s.sliceId]);
}

// Get scenarios for a slice
export function getScenariosForSlice(sliceId, state = null) {
  state = state || projectState();
  return Object.values(state.scenarios).filter(s => s.sliceId === sliceId);
}

// SV: View Slice - SliceDetail read model
// Returns slice with full element objects including properties
export function getSliceDetail(sliceId, state = null) {
  state = state || projectState();
  const slice = state.slices[sliceId];
  if (!slice) return null;
  
  // Resolve element IDs to full element objects with properties
  const elements = slice.elements
    .map(id => state.elements[id])
    .filter(Boolean)
    .map(el => ({
      id: el.id,
      type: el.type,
      name: el.name,
      properties: el.properties || []
    }));
  
  return {
    sliceId: slice.id,
    name: slice.name,
    type: slice.type,
    complete: slice.complete,
    elements
  };
}
