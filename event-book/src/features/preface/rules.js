// ===========================================
// PREFACE - Read model: the book's preface as its first page
// Shown the first time a book is opened on a device (a page before the board, with Start
// reading), then only from ☰ / ⋮ → Preface. The preface is its own text (why the book is being
// written); a book with none shows its description, as before; with neither, there's no page.
// ===========================================

export function prefaceOf(state, seenOnThisDevice) {
  const preface = (state.preface || state.modelDescription || '').trim();
  const shown = !preface ? 'never' : seenOnThisDevice ? 'only from ☰ ⋮ → Preface' : 'first time';
  return { title: state.modelName || 'Untitled model', preface, tags: state.tags || [], seenOnThisDevice: !!seenOnThisDevice, shown };
}

// Seen on this device: a convenience per device (never an event)
const SEEN_KEY = 'eventpad_preface_seen';
const seenMap = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { return {}; } };
export const prefaceSeen = id => !!seenMap()[id];
export function markPrefaceSeen(id) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seenMap(), [id]: 1 })); } catch (e) { /* private mode: just this time */ }
}
