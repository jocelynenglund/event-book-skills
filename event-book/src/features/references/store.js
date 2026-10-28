// ===========================================
// REFERENCES - The reference shelf
// Chapters saved for reuse, on this device: each a small event stream holding
// one chapter. Adding one to a model plays a fresh copy into it.
// ===========================================

import { appendEvent } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { chapterEvents } from './copy.js';

const KEY = 'eventpad_references';

export function listReferences() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}

function save(refs) {
  localStorage.setItem(KEY, JSON.stringify(refs));
}

// The reference's chapter, projected
export function referenceState(ref) {
  const state = projectState(ref.events.map((e, i) => ({ id: 'r' + i, timestamp: ref.savedAt, ...e })));
  return { state, chapterId: state.chapterOrder[0] };
}

// Copy a chapter of the open model onto the reference shelf
export function saveReference(chapterId) {
  const state = projectState();
  const chapter = state.chapters[chapterId];
  if (!chapter) return null;
  const ref = {
    id: 'ref_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: chapter.name,
    from: state.modelName || null,
    savedAt: new Date().toISOString(),
    events: chapterEvents(state, chapterId)
  };
  save([...listReferences(), ref]);
  return ref;
}

export function renameReference(id, name) {
  save(listReferences().map(r => (r.id === id ? { ...r, name } : r)));
}

export function deleteReference(id) {
  save(listReferences().filter(r => r.id !== id));
}

// Add a reference to the open model as a new chapter (one undo takes it back)
export function insertReference(id) {
  const ref = listReferences().find(r => r.id === id);
  if (!ref) return 0;
  const { state, chapterId } = referenceState(ref);
  const events = chapterEvents(state, chapterId, { target: projectState(), name: ref.name });
  events.forEach(e => appendEvent(e.type, e.data));
  return Object.values(state.slices).length;
}
