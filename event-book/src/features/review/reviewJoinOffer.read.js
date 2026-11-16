// ===========================================
// REVIEW LINKS - Review Join Offer: what a reviewer is told when they open a link: what it is, until when,
// and a nickname to start with.
// ===========================================

import { reviewDay } from './reviewLinkList.read.js';

// info: what the server says about the link; nick: the nickname this device already has
export function reviewJoinOffer(info, nick) {
  return {
    title: info.name || 'An event model', sub: info.purpose === 'test' ? 'verification' : 'review',
    text: `${info.purpose === 'test'
      ? `You’ve been asked to verify the shipped app${info.edition ? ` (edition ${info.edition})` : ''}: go through its scenarios, mark each one works or doesn’t, and comment.`
      : `You’ve been asked to review this plan: are the Given / When / Then scenarios enough? Comment on any of them${info.canAddScenarios ? ', and add the ones that are missing' : ''}.`} Open until ${reviewDay(info.expiresAt)}. No account needed.`,
    nick: nick || ''
  };
}
