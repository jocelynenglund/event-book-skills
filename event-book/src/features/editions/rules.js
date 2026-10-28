// ===========================================
// EDITIONS - What a model's history says about its edition (pure, over its events)
// A book is the whole model. It's a draft until every slice is Done and the user
// publishes; a published book is frozen. NextDraftStarted (in a copy of it) makes
// it a draft again, of the next edition.
// ===========================================

import { commentEventTypes } from '../../core/constants.js';

const PUBLISHED = 'EditionPublished', NEXT = 'NextDraftStarted', SETTLED = 'CompareSettled', BUILT = 'SliceMarkedBuilt', SNAPSHOT = 'ModelSnapshot';

// { published, edition (n or null), draft, commit (of the edition), lastBuild (latest slice built) }
export function editionOf(events) {
  let e = { published: false, edition: null, draft: 1, commit: null, lastBuild: null };
  for (const ev of events) {
    const d = ev.data || {};
    if (ev.type === SNAPSHOT && d.state?.edition) e = { ...e, ...d.state.edition };
    else if (ev.type === PUBLISHED) e = { ...e, published: true, edition: d.edition, commit: d.commit || null };
    else if (ev.type === NEXT) e = { ...e, published: false, edition: d.edition, draft: d.draft ?? 1 };
    else if (ev.type === SETTLED) e.draft = d.draft;
    else if (ev.type === BUILT && d.commit) e.lastBuild = d.commit;
  }
  return e;
}

// Frozen: the latest of EditionPublished and NextDraftStarted is EditionPublished
export function isFrozen(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const t = events[i].type;
    if (t === PUBLISHED) return true;
    if (t === NEXT) return false;
    if (t === SNAPSHOT) return !!events[i].data?.state?.edition?.published;
  }
  return false;
}

// Has anything changed since the last EditionPublished (leaving out the bookkeeping events)?
export function changedSincePublished(events) {
  const at = events.map(e => e.type).lastIndexOf(PUBLISHED);
  if (at < 0) return true;
  return events.slice(at + 1).some(e => e.type !== NEXT && e.type !== SETTLED && !commentEventTypes.has(e.type));
}

export const ordinal = n => {
  const v = n % 100;
  return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
};

// Why a book can't be published yet (or null): the same rules as the Publish Edition command.
// state: the book projected.
export function publishRefusal(events, state) {
  if (isFrozen(events) || !changedSincePublished(events)) return 'Already published: change something first';
  if (!state.edition.lastBuild) return 'No build compared yet';
  const slices = Object.values(state.slices);
  if (!slices.length || slices.some(s => !s.built)) return 'Not every slice is done';
  return null;
}
