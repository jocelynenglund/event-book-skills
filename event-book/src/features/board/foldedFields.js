// ===========================================
// FOLDED FIELDS - A sticky with a big payload can show just "N fields" on the board and in the
// share image. Display only: kept per book on this device, never in the model.
// ===========================================

import { getCurrentModelId } from '../../core/eventStore.js';

const KEY = 'eventpad_folded_fields';   // { modelId: [elementId] }
const all = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };

export const fieldsFolded = elementId => (all()[getCurrentModelId()] || []).includes(elementId);

export function toggleFieldsFolded(elementId) {
  const a = all();
  const id = getCurrentModelId();
  const list = new Set(a[id] || []);
  list.has(elementId) ? list.delete(elementId) : list.add(elementId);
  a[id] = [...list];
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* just this time */ }
  return list.has(elementId);
}

export const foldedLabel = n => `${n} ${n === 1 ? 'field' : 'fields'}`;
