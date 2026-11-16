// ===========================================
// REVIEW LINKS - Review About Link: what the reviewer's sheet says about the review they are in: what it is, what
// they can do, when it ends, and whether anything can be sent now.
// ===========================================

import { REVIEW_PURPOSE_TEXT } from './reviewLinkForm.read.js';
import { reviewDay } from './reviewLinkList.read.js';

// r: the review (from reviewOf)
export function reviewAboutLink(r) {
  return {
    title: r.purpose === 'test' ? 'Verifying' : 'Reviewing', name: r.name || '', ended: !!r.ended,
    text: r.ended ? 'This review has ended: what you sent is with the owner.'
      : `${REVIEW_PURPOSE_TEXT[r.purpose]} · ${r.canAddScenarios ? 'comments and scenarios' : 'comments'} · open until ${reviewDay(r.expiresAt)}. What you write goes to the owner a moment later.`
  };
}
