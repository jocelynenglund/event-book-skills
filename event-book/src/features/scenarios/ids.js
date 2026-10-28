// ===========================================
// SCENARIOS - Ids in values
// Test runs put real GUIDs in a scenario's values. For reading they become short aliases (#1, #2),
// the same alias for the same value within a scenario, so "who's who" still reads; or they're hidden.
// Display only: the model, the exports and the editor keep the real values.
// ===========================================

const KEY = 'eventpad_hide_ids';

export function idsHidden() {
  try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
}
export function setIdsHidden(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* just this time */ }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// An id: a UUID, or any text in a field its sticky types as guid
export function isId(key, value, el = null) {
  if (typeof value !== 'string' || !value) return false;
  if (UUID.test(value)) return true;
  const prop = el?.properties?.find(p => p.name === key);
  return prop?.type === 'guid' && value.length > 6;
}

// #1, #2… in the order the ids first show up; the same value gets the same alias
export function aliaser() {
  const seen = new Map();
  return value => {
    if (!seen.has(value)) seen.set(value, '#' + (seen.size + 1));
    return seen.get(value);
  };
}

// What to show for a values object: its entries with ids as aliases, or left out when hidden.
// Entries are [key, shown, isAlias]; other values come through as they are.
export function shownEntries(entries, el, alias, hide) {
  return entries.flatMap(([k, v]) => {
    if (!isId(k, v, el)) return [[k, v, false]];
    return hide ? [] : [[k, alias(v), true]];
  });
}

// Does a scenario have any ids in its values (so a toggle would change something)?
export function scenarioHasIds(scn, state) {
  const check = (values, elId) => Object.entries(values || {}).some(([k, v]) => isId(k, v, state.elements[elId]));
  return (scn.given || []).some(g => check(g.values, g.elementId))
    || check(scn.when?.values, scn.when?.commandId)
    || check(scn.then?.values, scn.then?.eventId || scn.then?.readModelId)
    || (scn.then?.rows || []).some(r => check(r, scn.then?.readModelId));
}
