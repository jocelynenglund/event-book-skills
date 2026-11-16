// ===========================================
// PROJECTIONS (Read Models)
// ===========================================

import { getEventStream, EventTypes, storedEvents, readModelEvents } from './eventStore.js';
import { byName } from './constants.js';
import { isSliceEdit, editedSlices } from './sliceEdits.js';
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
// What changes a book's structure: its chapters and slices (Approve Structure is taken back by them)
const STRUCTURAL = new Set([EventTypes.SliceCreated, EventTypes.SliceDeleted, EventTypes.SliceNamed, EventTypes.SliceMoved, EventTypes.SliceChapterSet,
  EventTypes.ChapterCreated, EventTypes.ChapterRenamed, EventTypes.ChapterMoved, EventTypes.ChapterDeleted]);

// A book's state for the shelves (read only: don't change what it gives back), projected once
// and remembered until its events change: appended or undone in place (length, last event),
// or replaced (a new array)
const booksSeen = new WeakMap();   // stored events → { length, last, state }
export function bookState(id) {
  const stored = storedEvents(id);
  if (!stored) return projectState(readModelEvents(id));
  const last = stored[stored.length - 1]?.id;
  const seen = booksSeen.get(stored);
  if (seen && seen.length === stored.length && seen.last === last) return seen.state;
  const state = projectState([...stored]);
  booksSeen.set(stored, { length: stored.length, last, state });
  return state;
}

// SV: Board Build Chip — the chip on a slice's header on the Board: nothing until it's refined, Ready once
// refined, Done once confirmed built from the tests. The Board's own view (it replaced the generic SliceView).
export function boardBuildChip(state, sliceId) {
  const s = state.slices[sliceId];
  if (!s) return null;
  return { sliceId, chip: !s.refined ? 'none' : s.built ? 'done' : 'ready' };
}

// Refined State: is this slice planned out (marked refined, and not edited since)? The Outline's
// Refined pill and its ✓ badge read it, and only it (a view of its own, not SliceView's).
export function refinedState(state, sliceId) {
  const s = state.slices[sliceId];
  return s ? { sliceId, refined: !!s.refined } : null;
}

// A scenario in words that can be compared (name, Given events, When command, Then): what a verdict is about
export function scenarioShape(scn, state) {
  const name = id => state.elements[id]?.name || '';
  const t = scn.then;
  return JSON.stringify([scn.name, (scn.given || []).map(g => name(g.elementId)).filter(Boolean), scn.when?.commandId ? name(scn.when.commandId) : '',
    t?.type === 'event' ? name(t.eventId) : t?.type === 'rejection' ? 'rejected' : t?.type === 'readModel' ? name(t.readModelId) : '']);
}

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
    tags: [],
    preface: null,     // why the book is being written (the first page); the description says what it is
    updateRoles: {},   // 'eventId>readModelId' -> 'adds' | 'completes' (to-do lists)
    modelSource: null, // built from code: { repo, commit, createdAt, build } (a test export)
    sliceDecisions: [], // compare: { sliceId, otherShelf, otherSliceName, same } (possible renames answered)
    edition: null,     // { published, edition, draft, commit, lastBuild } (features/editions/rules.js)
    retired: null,     // { app, edition, retiredAt }: the plan was built and put away (features/retire)
    follow: null,      // { app, followedBy }: the app whose build book this plan follows (features/buildVersions)
    specs: {},         // sliceId → { app, at }: its refined scenarios written as pending specs (features/specs)
    progress: {},      // sliceId → { step, note, pr, tests, by, at, history: [{ step, note, pr, tests, by, at }] }: a builder's reports on a slice, newest last (features/buildProgress)
    press: null,       // { stage: press | building | built, app, slices, sentBy, builder, fromCommit, build, back } (features/press)
    structure: null,   // { approved, by, at, changed }: round one, the chapters and slices approved (features/article)
    bookKind: null,    // 'fact' | 'literature' as chosen when the book was made (features/literature); kind below is what it reads as
    kind: 'fact',
    author: null,      // who wrote a literature book's text: who imported it (features/literature)
    suggestions: {},   // suggestionId -> { id, n, sliceId, sentenceId, find, replace, why, by, status: open | accepted | skipped }
    sentences: {},     // sentenceId -> { id, sliceId, text, by, at }: a literature point's sentences, in order (features/literature)
    requirements: {},  // chapterId -> text: a literature chapter's requirement block (features/literature/votes.js)
    votes: {},         // chapterId -> voterId -> { nickname, why, at }: who backs which chapter
    voting: { closed: false, until: null },   // open unless she closed it (or its until has passed)
    paragraphs: {},    // paragraphId → { id, sliceId, text, by, at }: an article point's text (features/article)
    comments: {},      // id -> { id, sliceId, scenarioId, part, text, nickname, deviceId, at, resolved, resolvedBy, deleted }
    verdicts: {},      // edition -> scenarioId -> tester (nickname) -> { verdict: works | fails, note, testedBy, at, sliceId } (each tester's latest counts)
    verdictShapes: {}, // edition -> scenarioId -> the scenario as it was when that edition was published (so a verdict can carry over while it's unchanged)
    pendingSlice: null
  };

  // Elements that have ever sat in a slice: a processor whose slices were
  // deleted shouldn't come back as an inferred automation column
  const everSliced = new Set();

  for (const event of eventStream) {
    // A change to the chapters or slices takes back the structure's approval (round one)
    if (state.structure?.approved && STRUCTURAL.has(event.type)) state.structure = { ...state.structure, approved: false, changed: true };
    // An edit to a refined slice makes it not refined (derived: no event is recorded for it)
    if (isSliceEdit(event)) {
      for (const id of editedSlices(event, state)) if (id && state.slices[id]?.refined) state.slices[id].refined = false;
    }
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

      case EventTypes.ElementPublishedSet:
        if (state.elements[event.data.elementId]) {
          const el = state.elements[event.data.elementId];
          el.published = !!event.data.published;
          const to = Array.isArray(event.data.to) ? event.data.to.filter(Boolean) : [];
          if (el.published && to.length) el.to = to; else delete el.to;
        }
        break;

      case EventTypes.ElementTableSet:
        if (state.elements[event.data.elementId]) {
          // the table's name when the event has one (plan files), else just a mark
          const t = event.data.table;
          state.elements[event.data.elementId].table = typeof t === 'string' && t ? t : !!t;
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
          chapterId: event.data.chapterId || null,
          waived: null                           // { reason } once its scenarios are waived
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
        state.comments[d.commentId] = { id: d.commentId, sliceId: d.sliceId || null, scenarioId: d.scenarioId || null, part: d.part || null, threadId: d.threadId || null,
          text: d.text, nickname: d.nickname, deviceId: d.deviceId, at: d.at || event.timestamp, resolved: false, resolvedBy: null, deleted: false };
        // A reply to a resolved thread opens it again
        if (d.reopens && state.comments[d.reopens]) Object.assign(state.comments[d.reopens], { resolved: false, resolvedBy: null });
        break;
      }

      case EventTypes.ScenarioTested: {
        const d = event.data;
        ((state.verdicts[d.edition ?? 0] ||= {})[d.scenarioId] ||= {})[d.testedBy || ''] = { verdict: d.verdict, note: d.note || null, testedBy: d.testedBy, at: d.at || event.timestamp, sliceId: d.sliceId };
        break;
      }

      case EventTypes.EditionPublished:
        state.verdictShapes[event.data.edition ?? 0] = Object.fromEntries(Object.values(state.scenarios).map(s => [s.id, scenarioShape(s, state)]));
        break;

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

      case EventTypes.BookPrefaceWritten:
        state.preface = event.data.preface || null;
        break;

      case EventTypes.BookTagged:
        state.tags = Array.isArray(event.data.tags) ? event.data.tags : [];
        break;

      case EventTypes.ChapterCreated:
        state.chapters[event.data.chapterId] = { id: event.data.chapterId, name: event.data.name, ...(event.data.parked ? { parked: true } : {}) };
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
      case EventTypes.SlicesUnpaired: {
        const a = state.slices[event.data.sliceId], b = a && state.slices[a.pairWith];
        if (a) a.pairWith = null;
        if (b) b.pairWith = null;
        break;
      }
      case EventTypes.SliceActorSet:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].actor = event.data.actor;
        break;

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
      
      // Explicitly refined (planning); any edit to the slice clears it (above); taking it back by hand records SliceRefinedCleared.
      // Older models said ready for refined.
      case EventTypes.SliceMarkedRefined:
      case EventTypes.SliceMarkedReady:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].refined = true;
        break;

      case EventTypes.SliceRefinedCleared:
      case EventTypes.SliceReadyCleared:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].refined = false;
        break;

      // Nothing to test here: refined without scenarios, no spec expected
      case EventTypes.ScenariosWaived:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].waived = { reason: event.data.reason || '' };
        break;

      case EventTypes.ScenarioWaiverLifted:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].waived = null;
        break;

      // Done: confirmed against a model built from the tests, at its commit
      case EventTypes.SliceMarkedBuilt:
        if (state.slices[event.data.sliceId]) Object.assign(state.slices[event.data.sliceId], { built: true, builtCommit: event.data.commit || null, builtEdition: event.data.edition ?? null });
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
      case EventTypes.PlanRetired:
        state.retired = { app: event.data.app || null, edition: event.data.edition ?? null, retiredAt: event.data.retiredAt || event.timestamp || null };
        break;

      case EventTypes.StructureApproved:
        state.structure = { approved: true, by: event.data.approvedBy || null, at: event.timestamp || null, changed: false };
        break;

      case EventTypes.ParagraphWritten:
        (state.paragraphs ||= {})[event.data.paragraphId] = { id: event.data.paragraphId, sliceId: event.data.sliceId, text: event.data.text, by: event.data.by || null, at: event.timestamp || null };
        break;

      case EventTypes.BookKindChosen:
        if (event.data.kind === 'fact' || event.data.kind === 'literature') state.bookKind = event.data.kind;
        break;

      case EventTypes.SentenceAdded:
        (state.sentences ||= {})[event.data.sentenceId] = { id: event.data.sentenceId, sliceId: event.data.sliceId, text: event.data.text, by: event.data.by || null, at: event.timestamp || null };
        break;

      case EventTypes.DraftImported:
        state.author = event.data.author || null;
        break;

      case EventTypes.GapAdded:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].gap = { question: event.data.question, by: event.data.by || null, filled: false };
        break;

      case EventTypes.GapFilled:
        if (state.slices[event.data.sliceId]?.gap) state.slices[event.data.sliceId].gap.filled = true;
        (event.data.sentences || []).forEach(x => {
          (state.sentences ||= {})[x.sentenceId] = { id: x.sentenceId, sliceId: event.data.sliceId, text: x.text, by: event.data.by || null, at: event.timestamp || null };
        });
        break;

      case EventTypes.EditSuggested:
        (state.suggestions ||= {})[event.data.suggestionId] = { id: event.data.suggestionId, n: event.data.n, sliceId: event.data.sliceId, sentenceId: event.data.sentenceId,
          find: event.data.find, replace: event.data.replace || '', why: event.data.why || '', by: event.data.by || null, status: 'open' };
        break;

      case EventTypes.SuggestionsAccepted:
        (event.data.edits || []).forEach(x => { if (state.sentences?.[x.sentenceId]) state.sentences[x.sentenceId].text = x.text; });
        (event.data.accepted || []).forEach(id => { if (state.suggestions?.[id]) state.suggestions[id].status = 'accepted'; });
        (event.data.skipped || []).forEach(id => { if (state.suggestions?.[id]) state.suggestions[id].status = 'skipped'; });
        break;

      // Where a parked paragraph came from, to put it back (the Parked chapter itself says it is parked)
      case EventTypes.PointParked:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].parkedFrom = { chapterId: event.data.from || null, afterSliceId: event.data.after || null };
        break;

      case EventTypes.PointUnparked:
        if (state.slices[event.data.sliceId]) state.slices[event.data.sliceId].parkedFrom = null;
        break;

      case EventTypes.RequirementSet:
        if (event.data.text) (state.requirements ||= {})[event.data.chapterId] = event.data.text;
        else if (state.requirements) delete state.requirements[event.data.chapterId];
        break;

      // A vote counts while voting is open when it comes in (a reviewer's can arrive late): once per reader per chapter
      case EventTypes.VoteCast: {
        const v = state.voting || {};
        if (v.closed || (v.until && event.timestamp && event.timestamp > v.until)) break;
        const on = ((state.votes ||= {})[event.data.chapterId] ||= {});
        if (!on[event.data.voterId]) on[event.data.voterId] = { nickname: event.data.nickname || '', why: event.data.why || '', at: event.timestamp || null };
        break;
      }

      case EventTypes.VoteWithdrawn:
        if (!state.voting?.closed && state.votes?.[event.data.chapterId]) delete state.votes[event.data.chapterId][event.data.voterId];
        break;

      case EventTypes.VotingOpened:
        state.voting = { closed: false, until: event.data.until || null };
        break;

      case EventTypes.VotingClosed:
        state.voting = { closed: true, until: null };
        break;

      case EventTypes.ParagraphEdited:
        if (state.paragraphs?.[event.data.paragraphId]) state.paragraphs[event.data.paragraphId].text = event.data.text;
        break;

      case EventTypes.PlanSentToPress:
        state.press = { stage: 'press', app: event.data.app || null, slices: event.data.slices || [], sentBy: event.data.sentBy || null,
          at: event.timestamp || null, builder: null, fromCommit: null, build: null, back: null };
        break;

      case EventTypes.PressStopped:
        state.press = null;
        break;

      case EventTypes.PlanCheckedOutForBuild:
        if (state.press) Object.assign(state.press, { stage: 'building', builder: event.data.builder || null, fromCommit: event.data.fromCommit || null, since: event.timestamp || null });
        break;

      case EventTypes.BuildAttached:
        if (state.press) state.press.build = { ...event.data };
        break;

      case EventTypes.PlanCheckedInWithBuild:
        if (state.press) Object.assign(state.press, { stage: 'built', back: { ...event.data } });
        break;

      case EventTypes.SliceProgressReported: {
        const d = event.data;
        const entry = { step: d.step, note: d.note || null, pr: d.pr || null, tests: d.tests || null, by: d.by || null, at: d.at || event.timestamp || null };
        const was = state.progress[d.sliceId];
        state.progress[d.sliceId] = { ...entry, history: [...(was?.history || []), entry] };
        break;
      }

      case EventTypes.SpecsGenerated:
      case EventTypes.SpecsRegenerated:
        (event.data.slices || []).forEach(id => { (state.specs ||= {})[id] = { app: event.data.app || null, at: event.timestamp || null }; });
        break;

      case EventTypes.SliceBuiltCleared:
        if (state.slices[event.data.sliceId]) Object.assign(state.slices[event.data.sliceId], { built: false, builtCommit: null, builtEdition: null });
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
          createdAt: event.data.createdAt || null, build: event.data.build || null, ...(event.data.description ? { description: event.data.description } : {}) };
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
          pending: event.data.pending || null, // a generated spec not built yet: 'not passing yet' | 'passing'
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

  // What the book reads as: the kind she chose, else by a rule (no migration): points that already
  // have paragraphs (an article outline in its second round) read as literature, the rest as fact books
  state.kind = state.bookKind || (Object.keys(state.paragraphs || {}).length ? 'literature' : 'fact');
  return state;
}

// Slices in board order (left to right); inferred AU slices that were never
// placed explicitly trail at the end
// A slice's number, S1, S2… in board order: the same numbers the agents' outline uses, so she can
// say "S3" to an agent and both mean the same slice (one count per projected state)
const refsCache = new WeakMap();
export function sliceRef(state, sliceId) {
  if (!refsCache.has(state)) refsCache.set(state, new Map(getOrderedSlices(state).map((s, i) => [s.id, `S${i + 1}`])));
  return refsCache.get(state).get(sliceId) || null;
}

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

// SV: Spec Expectations — whether a spec is expected for a slice: not when its scenarios are waived
export function specExpectation(sliceId, state = null) {
  const waived = (state || projectState()).slices[sliceId]?.waived;
  return { specExpected: !waived, waivedReason: waived ? waived.reason : '' };
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
