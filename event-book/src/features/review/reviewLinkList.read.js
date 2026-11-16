// ===========================================
// REVIEW LINKS - Review Link List: the links made for a book, newest first: what each is for, how long it
// lives, who joined and when they last sent something.
// ===========================================

import { REVIEW_PURPOSE_TEXT } from './reviewLinkForm.read.js';

export const reviewDay = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

// reviews: what the server lists -> [{ reviewId, live, url, what, when, who }]
export function reviewLinkList(reviews) {
  return [...reviews].reverse().map(r => ({
    reviewId: r.reviewId, live: !!r.live, url: r.url || null,
    what: `${REVIEW_PURPOSE_TEXT[r.purpose] || r.purpose}${r.purpose === 'test' && r.edition ? ` · edition ${r.edition}` : ''}`,
    when: `${r.live ? `until ${reviewDay(r.expiresAt)}` : r.revoked ? 'revoked' : `ended ${reviewDay(r.expiresAt)}`} · ${r.canAddScenarios ? 'comments and scenarios' : 'comments only'}`,
    who: `${r.reviewers.length ? r.reviewers.join(', ') : 'nobody has opened it yet'}${r.lastChangeAt ? ` · last change ${reviewDay(r.lastChangeAt)}` : ''}`
  }));
}
