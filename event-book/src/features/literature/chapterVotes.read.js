// ===========================================
// LITERATURE - Chapter Votes (SV: Chapter Votes)
// Everything the chapter page shows: the chapter's place and its neighbours, its votes, its paragraphs,
// its requirement (shown, or being edited by the owner), and the vote box (vote / take it back / closed).
// A chapter that is gone is null. opts: me (this device's voter id), owner, editing.
// ===========================================

import { getBoardGroups } from '../../core/projections.js';
import { pointText } from './rules.js';
import { chapterPage, voteTally } from './votes.js';
import { chapterRequirement } from './chapterRequirement.read.js';

export function chapterVotes(state, chapterId, { me, owner = false, editing = false } = {}) {
  const p = chapterPage(state, chapterId, me);
  if (!p) return null;
  const groups = getBoardGroups(state);
  const group = groups.find(g => g.chapter?.id === chapterId);
  const at = groups.map(g => g.chapter).filter(c => c && !c.parked).findIndex(c => c.id === chapterId);
  return {
    chapterId,
    nav: { prev: p.prev, next: p.next, n: at + 1, of: voteTally(state).chapters.length },
    votes: p.votes,
    name: p.name,
    editLabel: owner && !editing ? (p.requirement ? 'Edit requirement' : '＋ Requirement') : null,
    points: (group?.slices || []).map(s => ({ sliceId: s.id, text: pointText(state, s.id) })).filter(x => x.text),
    requirement: editing && owner ? { kind: 'edit', chapterId, text: p.requirement || '' } : p.requirement ? { kind: 'shown', open: true, ...chapterRequirement(state, chapterId) } : null,
    vote: p.votingOpen ? { kind: p.myVote ? 'withdraw' : 'cast', chapterId } : { kind: 'closed', chapterId, myVote: p.myVote }
  };
}
