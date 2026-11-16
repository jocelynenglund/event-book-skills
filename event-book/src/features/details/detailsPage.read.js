// ===========================================
// DETAILS - Details Page: every element of the book grouped by type, each with its properties, the slices
// it's in and what it's linked to, and the scenarios by slice (and the ones whose slice was deleted).
// The data-carrying types come first: they're what people come here to read. Replays the book once.
// ===========================================

import { projectState, getOrderedSlices, getScenariosForSlice, getScenariosWithoutSlice, sliceTitle } from '../../core/projections.js';
import { renderGwt } from '../scenarios/view.js';
import { elementLabel, externalAttr, connectionLabels, reverseConnectionLabels, propLabel } from '../../core/constants.js';

export const DETAIL_SECTIONS = [
  { type: 'command', title: 'Commands' },
  { type: 'event', title: 'Events' },
  { type: 'readModel', title: 'Read models' },
  { type: 'screen', title: 'Screens' },
  { type: 'processor', title: 'Automations' }
];

// What an element is linked to: the other end, once for each way it is linked
function linksOf(el, state) {
  const seen = new Set();
  const links = [];
  state.connections.forEach(c => {
    const out = c.from === el.id;
    if (!out && c.to !== el.id) return;
    const other = state.elements[out ? c.to : c.from];
    if (!other) return;
    const label = out ? (connectionLabels[c.relation] || c.relation) : (reverseConnectionLabels[c.relation] || 'from');
    const key = label + other.id;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, id: other.id, type: other.type, name: other.name, attrs: externalAttr(other) });
  });
  return links;
}

// filter: all, scenarios or an element type (one with nothing left falls back to All).
// -> { filter, chips: [{ type, title, count, active }], sections: [{ title, count, cards }], orphans, scenarios, empty }
export function detailsPage(filter = 'all') {
  const state = projectState();

  // Slices each element appears in, in board order; elements sort by first appearance
  const ordered = getOrderedSlices(state);
  const slicesByElement = new Map();
  ordered.forEach(s => s.elements.forEach(id => {
    if (!slicesByElement.has(id)) slicesByElement.set(id, []);
    slicesByElement.get(id).push(s);
  }));
  const position = id => {
    const first = slicesByElement.get(id)?.[0];
    return first ? ordered.indexOf(first) : Infinity;
  };
  const byType = Object.fromEntries(DETAIL_SECTIONS.map(({ type }) => [type,
    Object.values(state.elements)
      .filter(e => e.type === type)
      .sort((a, b) => position(a.id) - position(b.id) || a.name.localeCompare(b.name))
  ]));

  // Scenarios whose slice was deleted: listed first, each with Move to slice…
  const orphans = getScenariosWithoutSlice(state);
  // Scenarios (Given/When/Then), grouped by slice in board order
  const groups = ordered.map(slice => ({ slice, scenarios: getScenariosForSlice(slice.id, state) })).filter(g => g.scenarios.length);
  const scenarioCount = groups.reduce((n, g) => n + g.scenarios.length, 0) + orphans.length;
  const total = Object.values(byType).reduce((n, list) => n + list.length, 0);

  const counts = { ...Object.fromEntries(DETAIL_SECTIONS.map(s => [s.type, byType[s.type].length])), scenarios: scenarioCount };
  // A filtered type whose last element was deleted falls back to All
  if (filter !== 'all' && !counts[filter]) filter = 'all';
  const chips = [
    { type: 'all', title: 'All', count: total + scenarioCount },
    ...DETAIL_SECTIONS.map(s => ({ type: s.type, title: s.title, count: byType[s.type].length })),
    { type: 'scenarios', title: 'Scenarios', count: scenarioCount }
  ].filter(c => c.type === 'all' || c.count).map(c => ({ ...c, active: filter === c.type }));

  const card = el => ({
    id: el.id, type: el.type, attrs: externalAttr(el), label: elementLabel(el), name: el.name,
    slices: (slicesByElement.get(el.id) || []).map(s => sliceTitle(s, state)),
    props: el.properties.map(p => ({ id: p.id, label: propLabel(p), type: p.type || 'string' })),
    links: linksOf(el, state)
  });
  const sections = DETAIL_SECTIONS.filter(({ type }) => byType[type].length && (filter === 'all' || filter === type))
    .map(({ type, title }) => ({ type, title, count: byType[type].length, cards: byType[type].map(card) }));

  const showScenarios = filter === 'all' || filter === 'scenarios';
  const placed = scenarioCount - orphans.length;
  return {
    filter, chips, sections,
    orphans: orphans.length && showScenarios ? { count: orphans.length, scenarios: orphans.map(scn => ({ id: scn.id, name: scn.name, gwt: renderGwt(scn, state) })) } : null,
    scenarios: placed && showScenarios ? { count: placed, groups: groups.map(({ slice, scenarios }) => ({ sliceId: slice.id, title: sliceTitle(slice, state),
      scenarios: scenarios.map(scn => ({ id: scn.id, name: scn.name, gwt: renderGwt(scn, state) })) })) } : null,
    empty: !sections.length && !(orphans.length && showScenarios) && !(placed && showScenarios)
  };
}
