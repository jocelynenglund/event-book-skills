// ===========================================
// EDITIONS - Which section each book is in, and a book's details (pure)
// Published: frozen editions. Drafts: everything else, including the next draft of a
// published book (a copy; the edition stays on Published).
// ===========================================

import { projectState } from '../../core/projections.js';
import { editionOf } from './rules.js';

// models: [{ id, events }] → [{ id, section, edition, draft }], in the order given
export function editionShelves(models) {
  return models.map(m => {
    const e = editionOf(m.events);
    return { id: m.id, section: e.published ? 'published' : 'drafts', edition: e.edition, draft: e.draft };
  });
}

// done = built; ready = refined, not built; sketched = the rest (automations inferred from older models left out)
export const bookDetails = events => detailsOf(projectState(events));
export function detailsOf(state) {
  const slices = state.sliceOrder.map(id => state.slices[id]).filter(Boolean);
  const done = slices.filter(s => s.built).length;
  const ready = slices.filter(s => s.refined && !s.built).length;
  return { done, ready, sketched: slices.length - done - ready, total: slices.length, lastBuild: state.edition.lastBuild };
}
