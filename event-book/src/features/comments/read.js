// ===========================================
// COMMENTS - Read models (pure, over a projected state)
// SV: Comments in the outline — per slice: open count and its threads, oldest first.
// SV: Comments on the board — the comment lane: one row per slice with open comments.
// ===========================================

import { getOrderedSlices } from '../../core/projections.js';

const live = state => Object.values(state.comments || {}).filter(c => !c.deleted);
const byTime = (a, b) => String(a.at).localeCompare(String(b.at));
const thread = (c, state) => ({ commentId: c.id, scenarioId: c.scenarioId, scenarioName: c.scenarioId ? state.scenarios[c.scenarioId]?.name || null : null,
  part: c.part, nickname: c.nickname, text: c.text, at: c.at, resolved: c.resolved, deviceId: c.deviceId });

// One slice: its open comments' count, and every comment (resolved ones too, to fold away)
export function sliceComments(state, sliceId) {
  const all = live(state).filter(c => c.sliceId === sliceId).sort(byTime);
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
