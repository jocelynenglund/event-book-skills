// ===========================================
// EDITIONS - THE SEAM: how a built slice takes a planned slice's place
// Today it REPLACES: the planned slice keeps its id, name and chapter but takes the built
// slice's stickies, their fields and its scenarios. If this becomes "supersede, don't
// replace" (a new slice that supersedes the old, event versions v2), change only this file:
// adoptBuiltSlice (editions/command.js) calls adoptBuiltContent and nothing else.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';

const T = EventTypes;
const fresh = prefix => prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
const keyOf = el => el.type + '|' + String(el.name).trim().toLowerCase();

// Records the events that make planSliceId (in the open model) look like builtSliceId (in builtState)
export function adoptBuiltContent(planSliceId, builtState, builtSliceId) {
  const plan = projectState();
  const slice = plan.slices[planSliceId];
  const from = builtState.slices[builtSliceId];
  if (!slice || !from) return;

  const scenarios = Object.values(builtState.scenarios).filter(sc => sc.sliceId === builtSliceId);
  const ids = new Set(from.elements);
  scenarios.forEach(sc => {
    (sc.given || []).forEach(g => ids.add(g.elementId));
    if (sc.when?.commandId) ids.add(sc.when.commandId);
    if (sc.then?.eventId) ids.add(sc.then.eventId);
    if (sc.then?.readModelId) ids.add(sc.then.readModelId);
  });

  // Cards: the plan's same-named card (given the fields it lacks), or a new one
  const existing = new Map(Object.values(plan.elements).map(e => [keyOf(e), e]));
  const map = {};
  [...ids].map(id => builtState.elements[id]).filter(Boolean).forEach(el => {
    const same = existing.get(keyOf(el));
    const id = same ? same.id : fresh('el');
    map[el.id] = id;
    if (!same) {
      appendEvent(T.ElementCreated, { elementId: id, elementType: el.type, name: el.name });
      if (el.external) appendEvent(T.ElementExternalSet, { elementId: id, external: true });
      if (el.todo) appendEvent(T.ElementTodoSet, { elementId: id, todo: true });
      if (el.list) appendEvent(T.ElementListSet, { elementId: id, list: true });
    }
    const have = new Set((same?.properties || []).map(p => p.name.toLowerCase()));
    (el.properties || []).filter(p => !have.has(p.name.toLowerCase())).forEach(p => {
      const propertyId = fresh('prop');
      appendEvent(T.PropertyAdded, { elementId: id, propertyId, name: p.name, propertyType: p.type || 'string', ...(p.items ? { items: p.items } : {}) });
      if (p.generated) appendEvent(T.PropertyGeneratedSet, { elementId: id, propertyId, generated: true });
    });
  });

  // The planned slice's own scenarios and stickies go; the built slice's come in
  Object.values(plan.scenarios).filter(sc => sc.sliceId === planSliceId)
    .forEach(sc => appendEvent(T.ScenarioDeleted, { scenarioId: sc.id }));
  const keep = new Set(from.elements.map(id => map[id]));
  slice.elements.filter(id => !keep.has(id)).forEach(id => appendEvent(T.SliceElementRemoved, { sliceId: planSliceId, elementId: id }));
  from.elements.forEach(id => map[id] && !slice.elements.includes(map[id]) && appendEvent(T.SliceElementAdded, { sliceId: planSliceId, elementId: map[id], position: 'end' }));

  const linked = new Set(plan.connections.map(c => `${c.from}>${c.to}>${c.relation}`));
  builtState.connections.forEach(c => {
    const a = map[c.from], b = map[c.to];
    if (!a || !b || linked.has(`${a}>${b}>${c.relation}`)) return;
    linked.add(`${a}>${b}>${c.relation}`);
    appendEvent(T.ProducerSet, { fromId: a, toId: b, relation: c.relation });
  });

  const mapValues = list => (list || []).map(g => ({ elementId: map[g.elementId], values: g.values || {} })).filter(g => g.elementId);
  scenarios.forEach(sc => {
    const scenarioId = fresh('scn');
    appendEvent(T.ScenarioAdded, { sliceId: planSliceId, scenarioId, name: sc.name, scenarioType: sc.type });
    if (sc.mustHave) appendEvent(T.ScenarioMustHaveSet, { scenarioId, mustHave: true });
    if (sc.given?.length) appendEvent(T.GivenSet, { scenarioId, events: mapValues(sc.given) });
    if (sc.when?.commandId && map[sc.when.commandId]) appendEvent(T.WhenSet, { scenarioId, commandId: map[sc.when.commandId], values: sc.when.values || {} });
    const th = sc.then;
    if (th?.type === 'event' && map[th.eventId]) appendEvent(T.ThenEventSet, { scenarioId, eventId: map[th.eventId], values: th.values || {} });
    else if (th?.type === 'readModel' && map[th.readModelId]) appendEvent(T.ThenReadModelSet, { scenarioId, readModelId: map[th.readModelId], values: th.values || {}, ...(th.rows ? { rows: th.rows } : {}) });
    else if (th?.type === 'rejection') appendEvent(T.ThenRejectionSet, { scenarioId, reason: th.reason });
  });
}
