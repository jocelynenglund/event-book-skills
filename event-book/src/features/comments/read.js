// ===========================================
// COMMENTS - Read models (pure, over a projected state)
// SV: Comments in the outline — per slice: open count and its threads, oldest first.
// SV: Comments on the board — the comment lane: one row per slice with open comments.
// SV: Slice Page Threads — a slice's whole conversation for its page: its own threads and its scenarios'
// (or sentences'), oldest first, each with the Given/When/Then line it is about; resolved ones counted to fold away
export function sliceThreads(state, sliceId) {
  const all = sliceComments(state, sliceId).threads.map(t => ({ ...t, line: lineOf(state, t) }));
  return { sliceId, open: all.filter(t => !t.resolved).length, resolved: all.filter(t => t.resolved).length, threads: all };
}

// The words of the line a thread is about: what's given, the command, or what comes of it
function lineOf(state, t) {
  const scn = t.scenarioId && state.scenarios[t.scenarioId];
  if (!scn || !t.part) return null;
  const name = id => state.elements[id]?.name;
  if (t.part === 'given') return (scn.given || []).map(g => name(g.elementId)).filter(Boolean).join(', ') || 'Nothing happened yet';
  if (t.part === 'when') return name(scn.when?.commandId) || null;
  const x = scn.then;
  return x?.type === 'event' ? name(x.eventId) || null : x?.type === 'rejection' ? `Refused${x.reason ? `: ${x.reason}` : ''}` : x?.type === 'readModel' ? name(x.readModelId) || null : null;
}

// SV: Board Chat — the board's own threads (comments with no slice), and every thread still
// open elsewhere in the book, to go to.
// A comment with no parent is a thread; its replies (threadId) hang under it, oldest first.
// Threads are what get resolved, and what's counted.
// ===========================================

import { getOrderedSlices, sliceTitle } from '../../core/projections.js';

const live = state => Object.values(state.comments || {}).filter(c => !c.deleted);
const byTime = (a, b) => String(a.at).localeCompare(String(b.at));
const reply = c => ({ commentId: c.id, nickname: c.nickname, text: c.text, at: c.at, deviceId: c.deviceId });
const repliesOf = (state, id) => live(state).filter(c => c.threadId === id).sort(byTime).map(reply);
const thread = (c, state) => ({ commentId: c.id, scenarioId: c.scenarioId, scenarioName: c.scenarioId ? state.scenarios[c.scenarioId]?.name || state.sentences?.[c.scenarioId]?.text || null : null,
  part: c.part, nickname: c.nickname, text: c.text, at: c.at, resolved: c.resolved, deviceId: c.deviceId, replies: repliesOf(state, c.id) });
const threads = state => live(state).filter(c => !c.threadId);

// One slice: its open threads' count, and every thread (resolved ones too, to fold away), each with its replies
export function sliceComments(state, sliceId) {
  const all = threads(state).filter(c => c.sliceId === sliceId).sort(byTime);
  return { sliceId, open: all.filter(c => !c.resolved).length, threads: all.map(c => thread(c, state)) };
}

// One scenario's comments (or the slice's own, scenarioId null)
export const commentsOn = (state, sliceId, scenarioId = null) =>
  sliceComments(state, sliceId).threads.filter(t => (t.scenarioId || null) === (scenarioId || null));

// The comment lane: slices with open comments, in board order
export function commentLane(state) {
  return getOrderedSlices(state)
    .map(s => sliceComments(state, s.id))
    .filter(r => r.open)
    .map(r => ({ ...r, threads: r.threads.filter(t => !t.resolved) }));
}

// Every open comment in board order (the "next open comment" jump)
export const openComments = state => commentLane(state).flatMap(r => r.threads.map(t => ({ sliceId: r.sliceId, ...t })));

// SV: Board Chat — messages: the board's own threads, oldest first, with their replies;
// outstanding: every thread still open on a slice, in board order, to go to; open: all open threads
export function boardChat(state) {
  const messages = threads(state).filter(c => !c.sliceId).sort(byTime).map(c => thread(c, state));
  const outstanding = openComments(state).map(t => ({
    commentId: t.commentId, sliceId: t.sliceId, sliceTitle: state.slices[t.sliceId] ? sliceTitle(state.slices[t.sliceId], state) : '',
    scenarioName: t.scenarioName, part: t.part, nickname: t.nickname, text: t.text, replies: t.replies.length,
    lastAt: t.replies.length ? t.replies[t.replies.length - 1].at : t.at }));
  return { messages, outstanding, open: outstanding.length + messages.filter(m => !m.resolved).length };
}
