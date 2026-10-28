// ===========================================
// BOARD - Commands
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState, getOrderedSlices } from '../../core/projections.js';
// Refined slices (and the rule that an edit clears refined and built) load with the board's commands
export { markSliceRefined, clearSliceRefined } from '../sliceRefined/command.js';

// Lane a type lives in: 0 = UI / automation, 1 = commands & views, 2 = events
export const laneOf = {
  screen: 0,
  processor: 0,
  command: 1,
  readModel: 1,
  event: 2
};

// What each lane holds per slice type
export const laneTypes = {
  SC: ['screen', 'command', 'event'],
  SV: ['screen', 'readModel', 'event'],
  AU: ['processor', 'command', 'event']
};

// Who drives a slice's top lane. An automation is a state view whose reader is a
// processor (events → to-do read model → ⚙️) plus a state change it drives
// (⚙️ → command → event), so SV and SC slices can have a processor instead of a screen.
export function sliceActor(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  if (els.some(e => e.type === 'processor')) return 'processor';
  if (els.some(e => e.type === 'screen')) return 'screen';
  return slice.actor || (slice.type === 'AU' ? 'processor' : 'screen');
}

export function laneTypeFor(slice, lane, state) {
  if (lane === 0 && slice.type !== 'AU') return sliceActor(slice, state);
  return laneTypes[slice.type]?.[lane];
}

export function newId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

export function createSlice(sliceType, name, { actor, pairWith, chapterId = null, sliceId = newId('slice') } = {}) {
  appendEvent(EventTypes.SliceCreated, { sliceId, sliceType, name, actor, pairWith, chapterId });
  return sliceId;
}

// "The system reacts": a state view the processor reads, then the state change it drives
// (viewName: the view's own name, e.g. the read model it shows)
export function createAutomation(name, chapterId = null, viewName = name ? `${name}: to do` : null) {
  const svId = newId('slice');
  const scId = newId('slice');
  createSlice('SV', viewName, { actor: 'processor', pairWith: scId, chapterId, sliceId: svId });
  createSlice('SC', name, { actor: 'processor', pairWith: svId, chapterId, sliceId: scId });
  return svId;
}

// ---------- Chapters ----------

export function createChapter(name) {
  const chapterId = newId('chapter');
  appendEvent(EventTypes.ChapterCreated, { chapterId, name });
  return chapterId;
}

export function renameChapter(chapterId, name) {
  appendEvent(EventTypes.ChapterRenamed, { chapterId, name });
}

export function moveChapter(chapterId, toIndex) {
  const state = projectState();
  const from = state.chapterOrder.indexOf(chapterId);
  if (from < 0 || toIndex < 0 || toIndex >= state.chapterOrder.length || toIndex === from) return false;
  appendEvent(EventTypes.ChapterMoved, { chapterId, toIndex });
  return true;
}

export function deleteChapter(chapterId) {
  appendEvent(EventTypes.ChapterDeleted, { chapterId });
}

// Move a slice into a chapter (null = no chapter); an automation's two halves move together
export function setSliceChapter(sliceId, chapterId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  [slice, state.slices[slice.pairWith]].filter(Boolean).forEach(s => {
    if (s.chapterId !== chapterId) appendEvent(EventTypes.SliceChapterSet, { sliceId: s.id, chapterId });
  });
}

// ---------- Flows (named ways through a chapter) ----------

export function createFlow(chapterId, name) {
  const flowId = newId('flow');
  appendEvent(EventTypes.FlowCreated, { flowId, chapterId, name });
  return flowId;
}

export function renameFlow(flowId, name) {
  appendEvent(EventTypes.FlowRenamed, { flowId, name });
}

export function deleteFlow(flowId) {
  appendEvent(EventTypes.FlowDeleted, { flowId });
}

// flowId null: back on the chapter's main line. An automation's two halves move together.
export function setSliceFlow(sliceId, flowId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  [slice, state.slices[slice.pairWith]].filter(Boolean).forEach(s => {
    if ((s.flowId || null) !== (flowId || null)) appendEvent(EventTypes.SliceFlowSet, { sliceId: s.id, flowId: flowId || null });
  });
}

// An outcome event belongs to a flow (null: the main line)
export function setElementFlow(elementId, flowId) {
  appendEvent(EventTypes.ElementFlowSet, { elementId, flowId: flowId || null });
}

export function nameSlice(sliceId, name) {
  appendEvent(EventTypes.SliceNamed, { sliceId, name });
}

export function describeSlice(sliceId, description) {
  appendEvent(EventTypes.SliceDescribed, { sliceId, description });
}

export function deleteSlice(sliceId) {
  appendEvent(EventTypes.SliceDeleted, { sliceId });
}

// Put freshly created slices (appended at the end) right before or after a slice,
// keeping their own order — an automation's two halves stay side by side
export function placeSlices(sliceIds, { before, after }) {
  const state = projectState();
  let anchor = before;
  if (after) {
    const order = state.sliceOrder.filter(id => !sliceIds.includes(id));
    anchor = order[order.indexOf(after) + 1];
    if (!anchor) return; // after the last slice: appended slices are already there
  }
  // Each one lands just before the anchor, so they end up in sequence
  sliceIds.forEach(id => moveSlice(id, anchor));
}

// Swap places with a neighbouring slice. Taking the neighbour's position in the
// global order lands this slice just before it (moving left) or just after it
// (moving right), whatever chapters do to the order on screen.
export function moveSlice(sliceId, neighbourId) {
  const state = projectState();
  const toIndex = state.sliceOrder.indexOf(neighbourId);
  if (!state.sliceOrder.includes(sliceId) || toIndex < 0 || neighbourId === sliceId) return false;
  appendEvent(EventTypes.SliceMoved, { sliceId, toIndex });
  return true;
}

export function nameModel(name) {
  appendEvent(EventTypes.ModelNamed, { name });
}

// Built from a codebase: which repo and commit, so code and test locations can link there
export function setModelSource(repo, commit, { createdAt = null, build = null } = {}) {
  appendEvent(EventTypes.ModelSourceSet, { repo: repo || null, commit: commit || null,
    ...(createdAt ? { createdAt } : {}), ...(build ? { build: String(build) } : {}) });
}

export function describeModel(description) {
  appendEvent(EventTypes.ModelDescribed, { description });
}

export function removeFromSlice(sliceId, elementId) {
  appendEvent(EventTypes.SliceElementRemoved, { sliceId, elementId });
}

// Connections implied by placing an element in a slice:
// SC  screen/processor → command → event
// SV  event → readModel → screen/processor
// AU  event → processor → command (older single-column automations)
function impliedConnections(sliceType, el, others) {
  const of = type => others.filter(o => o.type === type);
  const links = [];
  const add = (from, to, relation) => links.push({ from, to, relation });

  if (sliceType === 'SC') {
    if (el.type === 'screen') of('command').forEach(c => add(el.id, c.id, 'triggers'));
    if (el.type === 'processor') of('command').forEach(c => add(el.id, c.id, 'invokes'));
    if (el.type === 'command') {
      of('screen').forEach(s => add(s.id, el.id, 'triggers'));
      of('processor').forEach(p => add(p.id, el.id, 'invokes'));
      of('event').forEach(e => add(el.id, e.id, 'produces'));
    }
    if (el.type === 'event') of('command').forEach(c => add(c.id, el.id, 'produces'));
  } else if (sliceType === 'SV') {
    if (el.type === 'event') of('readModel').forEach(r => add(el.id, r.id, 'consumer'));
    if (el.type === 'readModel') {
      of('event').forEach(e => add(e.id, el.id, 'consumer'));
      of('screen').forEach(s => add(el.id, s.id, 'display'));
      of('processor').forEach(p => add(p.id, el.id, 'context'));
    }
    if (el.type === 'screen') of('readModel').forEach(r => add(r.id, el.id, 'display'));
    if (el.type === 'processor') of('readModel').forEach(r => add(el.id, r.id, 'context'));
  } else if (sliceType === 'AU') {
    if (el.type === 'event') of('processor').forEach(p => add(el.id, p.id, 'trigger'));
    if (el.type === 'processor') {
      of('event').forEach(e => add(e.id, el.id, 'trigger'));
      of('command').forEach(c => add(el.id, c.id, 'invokes'));
    }
    if (el.type === 'command') of('processor').forEach(p => add(p.id, el.id, 'invokes'));
  }
  return links;
}

// Put an element into a slice cell — either an existing element (elementId)
// or a new one (name). Wires up the connections the slice pattern implies.
export function addToSlice(sliceId, elementType, { elementId, name }) {
  // A slice deleted meanwhile (another tab, a stale sheet): no sticky left floating outside any slice
  if (!projectState().slices[sliceId]) return elementId || null;
  if (!elementId) {
    elementId = newId('el');
    appendEvent(EventTypes.ElementCreated, { elementId, elementType, name });
  }

  const state = projectState();
  const slice = state.slices[sliceId];
  if (slice.elements.includes(elementId)) return elementId;

  appendEvent(EventTypes.SliceElementAdded, { sliceId, elementId, position: 'end' });

  const others = slice.elements.map(id => state.elements[id]).filter(Boolean);
  impliedConnections(slice.type, state.elements[elementId], others)
    .filter(l => !state.connections.some(c => c.from === l.from && c.to === l.to))
    .forEach(l => appendEvent(EventTypes.ProducerSet, { fromId: l.from, toId: l.to, relation: l.relation }));

  // The same processor drives both halves of an automation
  const partner = slice.pairWith && state.slices[slice.pairWith];
  if (elementType === 'processor' && partner &&
      !partner.elements.some(id => state.elements[id]?.type === 'processor')) {
    addToSlice(partner.id, 'processor', { elementId });
  }

  return elementId;
}

// The processor driving a slice (an automation's to-do view or its state change)
export function sliceProcessor(slice, state) {
  return slice.elements.map(id => state.elements[id]).find(e => e?.type === 'processor') || null;
}

// An event that wakes the processor up, as opposed to one that only feeds its read models
export function isTrigger(eventId, processorId, state) {
  return state.connections.some(c => c.from === eventId && c.to === processorId && c.relation === 'trigger');
}

export function setTrigger(eventId, processorId, on) {
  const state = projectState();
  if (isTrigger(eventId, processorId, state) === on) return;
  appendEvent(on ? EventTypes.ProducerSet : EventTypes.ConnectionRemoved,
    { fromId: eventId, toId: processorId, relation: 'trigger' });
}

// Drop a processor's trigger and command links, e.g. to clear an inferred
// automation column left behind when its slices were deleted
export function unlinkProcessor(processorId) {
  projectState().connections
    .filter(c => (c.to === processorId && c.relation === 'trigger') || (c.from === processorId && c.relation === 'invokes'))
    .forEach(c => appendEvent(EventTypes.ConnectionRemoved, { fromId: c.from, toId: c.to, relation: c.relation }));
}

// ---------- To-do lists (a saga's work queue) ----------

export function setTodo(readModelId, todo) {
  appendEvent(EventTypes.ElementTodoSet, { elementId: readModelId, todo });
}

// Link or unlink an event as updating a read model, without placing it in a slice
export function setUpdatedBy(eventId, readModelId, on) {
  const state = projectState();
  const linked = state.connections.some(c => c.from === eventId && c.to === readModelId && c.relation === 'consumer');
  if (linked === on) return;
  appendEvent(on ? EventTypes.ProducerSet : EventTypes.ConnectionRemoved, { fromId: eventId, toId: readModelId, relation: 'consumer' });
}

// A processor reads a read model that lives in another slice: its to-do list,
// or any other view it needs to decide (e.g. an amount built up from payments)
export function readsModel(processorId, readModelId, state = projectState()) {
  return state.connections.some(c => c.from === processorId && c.to === readModelId && c.relation === 'context');
}

export function setReads(processorId, readModelId, on) {
  if (readsModel(processorId, readModelId) === on) return;
  appendEvent(on ? EventTypes.ProducerSet : EventTypes.ConnectionRemoved,
    { fromId: processorId, toId: readModelId, relation: 'context' });
}

// A new read model the processor uses gets its own state view beside the
// processor's state change, on the left: the two become an automation pair.
// Returns the view's slice id.
export function addProcessorReadModel(sliceId, processorId, name) {
  let state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return null;
  let viewId = slice.type === 'SV' ? slice.id
    : slice.pairWith && state.slices[slice.pairWith]?.type === 'SV' ? slice.pairWith : null;
  if (!viewId) {
    viewId = createSlice('SV', name, { actor: 'processor', chapterId: slice.chapterId ?? null });
    appendEvent(EventTypes.SlicesPaired, { sliceId: viewId, pairWith: slice.id });
    placeSlices([viewId], { before: slice.id });
  }
  addToSlice(viewId, 'processor', { elementId: processorId });
  // Created here rather than by name, so it stays a plain read model (not a to-do list)
  const elementId = newId('el');
  appendEvent(EventTypes.ElementCreated, { elementId, elementType: 'readModel', name });
  addToSlice(viewId, 'readModel', { elementId });
  return viewId;
}

export function linkReads(processorId, readModelId) {
  setReads(processorId, readModelId, true);
}

export function setUpdateRole(eventId, readModelId, role) {
  appendEvent(EventTypes.UpdateRoleSet, { eventId, readModelId, role });
}

export function sliceIndex(sliceId) {
  return getOrderedSlices().findIndex(s => s.id === sliceId);
}
