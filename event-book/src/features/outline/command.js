// ===========================================
// OUTLINE - Commands
// SC: Add Outline Properties — the properties typed while adding a step in the
// outline go on that step's command and event (a view's read model). Names
// only; a type is optional ("amount:decimal"), text otherwise.
// SC: Reoutline Slice — a slice edited from the outline, starting from how it
// is on the board: its stickies renamed, swapped, added or taken out, its
// properties brought in line with the list, its description.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { parsePropertyText } from '../../core/constants.js';
import { addToSlice, removeFromSlice, describeSlice } from '../board/command.js';

// Which stickies of a step carry its properties
const carriers = ['command', 'event', 'readModel'];

const newPropertyId = i => `prop_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;

// An element of this type with this name (any case), if the model has one
export function findByName(type, name, state) {
  const key = name.trim().toLowerCase();
  return key ? Object.values(state.elements).find(e => e.type === type && e.name.trim().toLowerCase() === key) : null;
}

// A view's fields are its read model's: the events feeding it keep their own
function sliceCarriers(sliceId, state) {
  const slice = state.slices[sliceId];
  const own = slice?.type === 'SV' ? ['readModel'] : carriers;
  return (slice?.elements || []).map(id => state.elements[id]).filter(el => el && own.includes(el.type));
}

export function addOutlineProperties(sliceId, text) {
  const state = projectState();
  if (!state.slices[sliceId] || !text?.trim()) return 0;
  let added = 0;
  sliceCarriers(sliceId, state).forEach(el => {
    const { parsed } = parsePropertyText(text, 'string', el.properties.map(p => p.name));
    parsed.forEach(({ name, type, items }, i) => appendEvent(EventTypes.PropertyAdded, {
      elementId: el.id, propertyId: newPropertyId(i), name, propertyType: type, ...(items ? { items } : {})
    }));
    added += parsed.length;
  });
  return added;
}

// The step's properties as one list, the way the outline shows them:
// text names bare, other types as name:type, lists as name[] or name[]{fields}
export function outlinePropertiesText(sliceId, state = projectState()) {
  const seen = new Map();
  sliceCarriers(sliceId, state).forEach(el => el.properties.forEach(p => {
    if (!seen.has(p.name.toLowerCase())) seen.set(p.name.toLowerCase(), p);
  }));
  return [...seen.values()].map(p =>
    p.type === 'array' ? `${p.name}[]${p.items?.length ? `{${p.items.join(', ')}}` : ''}`
      : !p.type || p.type === 'string' ? p.name
      : `${p.name}:${p.type}`).join(', ');
}

// Every carrier ends up with exactly the listed names: missing ones added, unlisted
// ones removed, a type written out (or a changed list's fields) updated
function syncProperties(sliceId, text) {
  sliceCarriers(sliceId, projectState()).forEach(el => setElementProperties(el.id, text));
}

// One sticky ends up with exactly the listed names (shared by every slice it's on)
export function setElementProperties(elementId, text) {
  const el = projectState().elements[elementId];
  if (!el) return 0;
  const wanted = new Map(parsePropertyText(text, null, []).parsed.map(p => [p.name.toLowerCase(), p]));
  let changed = 0;
  el.properties.forEach(p => {
    const w = wanted.get(p.name.toLowerCase());
    if (!w) { appendEvent(EventTypes.PropertyRemoved, { elementId: el.id, propertyId: p.id }); changed++; return; }
    const type = w.type || p.type;
    const items = w.items || (type === 'array' ? p.items : null) || null;
    if (type !== p.type || (items || []).join('|') !== (p.items || []).join('|')) {
      appendEvent('PropertyUpdated', { elementId: el.id, propertyId: p.id, name: p.name, propertyType: type, items });
      changed++;
    }
  });
  const have = new Set(el.properties.map(p => p.name.toLowerCase()));
  [...wanted.values()].filter(w => !have.has(w.name.toLowerCase())).forEach((w, i) => {
    appendEvent(EventTypes.PropertyAdded, {
      elementId: el.id, propertyId: newPropertyId(i), name: w.name, propertyType: w.type || 'string', ...(w.items ? { items: w.items } : {})
    });
    changed++;
  });
  return changed;
}

// fields: [{ type, elementId (what's there now, or null), value (what's typed) }]
// props: { before, after } the property lists as text; description: the new one
export function reoutlineSlice(sliceId, { fields = [], props = null, description = null } = {}) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  fields.forEach(({ type, elementId, value }) => {
    const el = elementId && state.elements[elementId];
    const name = (value || '').trim();
    if (el && !name) { removeFromSlice(sliceId, el.id); return; }
    if (!name || (el && el.name === name)) return;
    // Another sticky by that name: swap to it. Otherwise a new name for this one.
    const other = findByName(type, name, state);
    if (el && other?.id === el.id) appendEvent(EventTypes.ElementRenamed, { elementId: el.id, name });
    else if (other) { if (el) removeFromSlice(sliceId, el.id); addToSlice(sliceId, type, { elementId: other.id }); }
    else if (el) appendEvent(EventTypes.ElementRenamed, { elementId: el.id, name });
    else addToSlice(sliceId, type, { name });
  });
  if (props && props.after.trim() !== props.before.trim()) syncProperties(sliceId, props.after);
  if (description !== null && description.trim() !== (slice.description || '')) describeSlice(sliceId, description.trim());
}
