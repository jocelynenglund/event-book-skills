// ===========================================
// SHARE LINK - View behind "Copy link"
// SV: Share Link Snapshot — the book a link carries: only the chosen scope (the whole book when none is
// chosen), with the stickies, connections and scenarios those slices use. A sticky two shared slices use is
// carried once. It is its own view, not the share picture's (ModelDetailShareShot).
// ===========================================

import { projectState } from '../../core/projections.js';
import { scopeOf } from '../shareImage/scope.js';

const inferred = id => id.startsWith('au_inferred_'); // inferred again on load: never frozen in

// source: a projected state, or the book's events. scope: see scopeOf.
// -> { name, description, state } where state is what a ModelSnapshot keeps
export function shareLinkSnapshot(source, scope = null) {
  const book = Array.isArray(source) ? projectState(source) : source;
  const wanted = scopeOf(scope);
  const whole = !wanted.chapters && !wanted.slices;
  const slices = Object.fromEntries(Object.entries(book.slices).filter(([id, s]) =>
    !inferred(id) && (whole || (wanted.chapters || []).includes(s.chapterId) || (wanted.slices || []).includes(id))));
  const kept = {
    elements: book.elements, connections: book.connections, scenarios: book.scenarios, slices,
    sliceOrder: book.sliceOrder.filter(id => id in slices), chapters: book.chapters, chapterOrder: book.chapterOrder,
    flows: book.flows, modelName: book.modelName, modelDescription: book.modelDescription, preface: book.preface,
    tags: book.tags, updateRoles: book.updateRoles, modelSource: book.modelSource, sliceDecisions: book.sliceDecisions, follow: book.follow
  };
  if (!whole) {
    const scenarios = Object.fromEntries(Object.entries(book.scenarios).filter(([, s]) => s.sliceId in slices));
    // The stickies the slices hold, and the ones their scenarios name
    const used = new Set(Object.values(slices).flatMap(s => s.elements));
    Object.values(scenarios).forEach(s => {
      (s.given || []).forEach(g => used.add(g.elementId));
      [s.when?.commandId, s.then?.eventId, s.then?.readModelId].filter(Boolean).forEach(id => used.add(id));
    });
    const chapterIds = new Set(Object.values(slices).map(s => s.chapterId).filter(Boolean));
    Object.assign(kept, {
      scenarios,
      elements: Object.fromEntries(Object.entries(book.elements).filter(([id]) => used.has(id))),
      connections: book.connections.filter(c => used.has(c.from) && used.has(c.to)),
      chapters: Object.fromEntries(Object.entries(book.chapters).filter(([id]) => chapterIds.has(id))),
      chapterOrder: book.chapterOrder.filter(id => chapterIds.has(id)),
      flows: Object.fromEntries(Object.entries(book.flows || {}).filter(([, f]) => chapterIds.has(f.chapterId))),
      updateRoles: Object.fromEntries(Object.entries(book.updateRoles || {}).filter(([k]) => k.split('>').every(id => used.has(id)))),
      sliceDecisions: (book.sliceDecisions || []).filter(d => d.sliceId in slices),
      preface: null, follow: null
    });
  }
  return { name: book.modelName, description: book.modelDescription, state: kept };
}
