// ===========================================
// REFERENCES - Copy a chapter as events
// A chapter (its slices, cards, properties, connections, to-do tags, flows and
// scenarios) becomes a list of events with fresh ids. Played into an empty
// stream it's a reference; played into a model it adds the chapter there.
// Cards that already exist in the target (same type and name) are reused.
// ===========================================

import { EventTypes } from '../../core/constants.js';

const fresh = prefix => prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
const keyOf = el => el.type + '|' + String(el.name).trim().toLowerCase();

// state: where the chapter is. target: the model it goes into (null: an empty one).
// Returns [{ type, data }] to append in order.
export function chapterEvents(state, chapterId, { target = null, name = null } = {}) {
  const chapter = state.chapters[chapterId];
  if (!chapter) return [];
  const out = [];
  const add = (type, data) => out.push({ type, data });

  const slices = state.sliceOrder.map(id => state.slices[id]).filter(s => s?.chapterId === chapterId);
  const sliceIds = new Set(slices.map(s => s.id));
  const scenarios = Object.values(state.scenarios).filter(sc => sliceIds.has(sc.sliceId));

  // Every card the chapter uses: in its slices, or named by its scenarios
  const elementIds = new Set(slices.flatMap(s => s.elements));
  scenarios.forEach(sc => {
    (sc.given || []).forEach(g => elementIds.add(g.elementId));
    if (sc.when?.commandId) elementIds.add(sc.when.commandId);
    if (sc.then?.eventId) elementIds.add(sc.then.eventId);
    if (sc.then?.readModelId) elementIds.add(sc.then.readModelId);
  });

  // Cards: reuse the target's same-named one (adding properties it lacks), or make one
  const existing = new Map(Object.values(target?.elements || {}).map(e => [keyOf(e), e]));
  const elMap = {};
  [...elementIds].map(id => state.elements[id]).filter(Boolean).forEach(el => {
    const same = existing.get(keyOf(el));
    const id = same ? same.id : fresh('el');
    elMap[el.id] = id;
    if (!same) {
      add(EventTypes.ElementCreated, { elementId: id, elementType: el.type, name: el.name });
      if (el.external) add(EventTypes.ElementExternalSet, { elementId: id, external: true });
      if (el.table) add(EventTypes.ElementTableSet, { elementId: id, table: true });
      if (el.todo) add(EventTypes.ElementTodoSet, { elementId: id, todo: true });
      if (el.list) add(EventTypes.ElementListSet, { elementId: id, list: true });
    }
    const have = new Set((same?.properties || []).map(p => p.name.toLowerCase()));
    (el.properties || []).filter(p => !have.has(p.name.toLowerCase())).forEach(p => {
      const propertyId = fresh('prop');
      add(EventTypes.PropertyAdded, { elementId: id, propertyId, name: p.name, propertyType: p.type || 'string', ...(p.items ? { items: p.items } : {}) });
      if (p.generated) add(EventTypes.PropertyGeneratedSet, { elementId: id, propertyId, generated: true });
    });
  });

  // The chapter and its flows
  const newChapterId = fresh('chapter');
  add(EventTypes.ChapterCreated, { chapterId: newChapterId, name: name || chapter.name });
  const flowMap = {};
  Object.values(state.flows || {}).filter(f => f.chapterId === chapterId).forEach(f => {
    flowMap[f.id] = fresh('flow');
    add(EventTypes.FlowCreated, { flowId: flowMap[f.id], chapterId: newChapterId, name: f.name });
  });

  // Slices, in board order, with their cards and descriptions
  const sliceMap = Object.fromEntries(slices.map(s => [s.id, fresh('slice')]));
  slices.forEach(s => {
    add(EventTypes.SliceCreated, {
      sliceId: sliceMap[s.id], sliceType: s.type, name: s.name, actor: s.actor,
      pairWith: s.pairWith && sliceMap[s.pairWith] ? sliceMap[s.pairWith] : undefined, chapterId: newChapterId
    });
    s.elements.forEach(id => elMap[id] && add(EventTypes.SliceElementAdded, { sliceId: sliceMap[s.id], elementId: elMap[id], position: 'end' }));
    if (s.description) add(EventTypes.SliceDescribed, { sliceId: sliceMap[s.id], description: s.description });
    if (s.flowId && flowMap[s.flowId]) add(EventTypes.SliceFlowSet, { sliceId: sliceMap[s.id], flowId: flowMap[s.flowId] });
  });

  // Which outcomes belong to which flow
  Object.keys(elMap).forEach(id => {
    const f = state.elements[id]?.flowId;
    if (f === 'main' || flowMap[f]) add(EventTypes.ElementFlowSet, { elementId: elMap[id], flowId: f === 'main' ? 'main' : flowMap[f] });
  });

  // Connections and to-do tags between the copied cards (the target's own aren't repeated)
  const linked = new Set((target?.connections || []).map(c => `${c.from}>${c.to}>${c.relation}`));
  state.connections.forEach(c => {
    const from = elMap[c.from], to = elMap[c.to];
    if (!from || !to || linked.has(`${from}>${to}>${c.relation}`)) return;
    linked.add(`${from}>${to}>${c.relation}`);
    add(EventTypes.ProducerSet, { fromId: from, toId: to, relation: c.relation });
  });
  Object.entries(state.updateRoles || {}).forEach(([k, role]) => {
    const [ev, rm] = k.split('>');
    if (elMap[ev] && elMap[rm]) add(EventTypes.UpdateRoleSet, { eventId: elMap[ev], readModelId: elMap[rm], role });
  });

  // Scenarios, with their example values
  const mapValues = list => (list || []).map(g => ({ elementId: elMap[g.elementId], values: g.values || {} })).filter(g => g.elementId);
  scenarios.forEach(sc => {
    const scenarioId = fresh('scn');
    add(EventTypes.ScenarioAdded, { sliceId: sliceMap[sc.sliceId], scenarioId, name: sc.name, scenarioType: sc.type });
    if (sc.given?.length) add(EventTypes.GivenSet, { scenarioId, events: mapValues(sc.given) });
    if (sc.when?.commandId && elMap[sc.when.commandId]) add(EventTypes.WhenSet, { scenarioId, commandId: elMap[sc.when.commandId], values: sc.when.values || {} });
    const th = sc.then;
    if (th?.type === 'event' && elMap[th.eventId]) add(EventTypes.ThenEventSet, { scenarioId, eventId: elMap[th.eventId], values: th.values || {} });
    else if (th?.type === 'readModel' && elMap[th.readModelId]) add(EventTypes.ThenReadModelSet, { scenarioId, readModelId: elMap[th.readModelId], values: th.values || {}, ...(th.rows ? { rows: th.rows } : {}) });
    else if (th?.type === 'rejection') add(EventTypes.ThenRejectionSet, { scenarioId, reason: th.reason });
  });

  return out;
}
