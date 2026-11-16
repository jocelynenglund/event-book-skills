// ===========================================
// LITERATURE - Vote on chapters (plan "Event Book · plan: Vote on chapters", 2026-11-06)
// A literature book's chapter (a door, a challenge) has its story and a requirement block, and readers
// vote on which chapters make it. The voters are her reviewers (a "Review the plan" link: their votes go
// to her book like their comments, signed with the link's reviewerId) and herself (this device's id).
// SC: Set Requirement — the owner writes a chapter's requirement; '' takes it away. (Import Draft sets
//     it from a "> **Requirement:** …" blockquote.)
// SC: Cast Vote / Withdraw Vote — one 👍 per reader per chapter, while voting is open.
// SC: Open Voting (maybe until a time) / Close Voting — the owner's.
// SV: Chapter Page — the chapter as one story, its requirement, its votes and yours, ‹ › its neighbours.
// SV: Vote Tally — the chapters by votes (ties in the book's order), with the whys; Parked left out.
// SV: Tally Markdown — the same as Markdown.
// Owner-only commands need nothing here: on a reviewer's book the review link allows only comments
// and votes (features/review), so anything else is "Read only".
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState, getBoardGroups } from '../../core/projections.js';
import { pointText } from './rules.js';

const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const iso = t => (t ? new Date(t).toISOString() : new Date().toISOString());

// The chapters a reader can vote on: the book's, in order, Parked left out
const chapters = state => getBoardGroups(state).map(g => g.chapter).filter(c => c && !c.parked);
const chapterOf = (state, chapterId) => chapters(state).find(c => c.id === chapterId) || null;

// Open unless she closed it, or the time it was open until has passed
export function votingOpen(state, now) {
  const v = state.voting || {};
  return !v.closed && !(v.until && iso(now) > v.until);
}

const votesOn = (state, chapterId) => state.votes?.[chapterId] || {};

// Who votes from this device: on a review link, its reviewer; else this device (her own book)
export const voterOf = (review, deviceId) => review?.reviewerId || deviceId();

export function setRequirement({ chapterId, text, by = null, state = projectState() } = {}) {
  if (!state.chapters?.[chapterId] || state.chapters[chapterId].parked) return 'No such chapter';
  const t = String(text || '').trim();
  if (t === (state.requirements?.[chapterId] || '')) return 'Already says that';
  return record(EventTypes.RequirementSet, { chapterId, text: t, by });
}

export function castVote({ chapterId, voterId, nickname = '', why = '', now = null, state = projectState() } = {}) {
  if (!chapterOf(state, chapterId)) return 'No such chapter';
  if (!votingOpen(state, now)) return 'Voting is closed';
  if (votesOn(state, chapterId)[voterId]) return 'Already voted for it';
  return record(EventTypes.VoteCast, { chapterId, voterId, nickname: String(nickname || ''), why: String(why || '').trim() });
}

export function withdrawVote({ chapterId, voterId, now = null, state = projectState() } = {}) {
  if (!votingOpen(state, now)) return 'Voting is closed';
  if (!votesOn(state, chapterId)[voterId]) return 'You haven\'t voted for it';
  return record(EventTypes.VoteWithdrawn, { chapterId, voterId });
}

export function openVoting({ until = null, by = null, now = null, state = projectState() } = {}) {
  const end = until ? iso(until) : null;
  if (end && end <= iso(now)) return 'That time has passed';
  if (!end && votingOpen(state, now) && !state.voting?.until) return 'Voting is already open';
  return record(EventTypes.VotingOpened, { by, until: end });
}

export function closeVoting({ by = null, state = projectState() } = {}) {
  if (state.voting?.closed) return 'Voting is already closed';
  return record(EventTypes.VotingClosed, { by });
}

// ---------- Views ----------

export function chapterPage(state, chapterId, me, now = null) {
  const list = chapters(state);
  const at = list.findIndex(c => c.id === chapterId);
  if (at < 0) return null;
  const c = list[at];
  const group = getBoardGroups(state).find(g => g.chapter?.id === chapterId);
  const votes = votesOn(state, chapterId);
  return {
    chapterId, name: c.name,
    paragraphs: (group?.slices || []).map(s => pointText(state, s.id)).filter(Boolean),
    requirement: state.requirements?.[chapterId] || null,
    votes: Object.keys(votes).length, myVote: !!votes[me], votingOpen: votingOpen(state, now),
    prev: list[at - 1]?.id || null, next: list[at + 1]?.id || null
  };
}

export function voteTally(state, now = null) {
  const list = chapters(state).map((c, i) => {
    const votes = votesOn(state, c.id);
    return { i, chapterId: c.id, name: c.name, votes: Object.keys(votes).length,
      whys: Object.values(votes).filter(v => v.why).map(v => ({ nickname: v.nickname, why: v.why })) };
  });
  const voters = new Set(Object.values(state.votes || {}).flatMap(v => Object.keys(v)));
  return {
    open: votingOpen(state, now), until: state.voting?.until || null, voters: voters.size,
    chapters: list.sort((a, b) => b.votes - a.votes || a.i - b.i).map(({ i, ...c }) => c)
  };
}

export function tallyMarkdown(state, now = null) {
  const t = voteTally(state, now);
  const lines = t.chapters.flatMap((c, n) => [`${n + 1}. ${c.name} — ${plural(c.votes, 'vote', 'votes')}`, ...c.whys.map(w => `   - ${w.nickname}: ${w.why}`)]);
  return `# ${state.modelName || 'Untitled'}: votes\n\n${lines.join('\n')}\n`;
}
