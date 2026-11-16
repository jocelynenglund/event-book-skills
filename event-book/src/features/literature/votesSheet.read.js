// ===========================================
// LITERATURE - Votes Sheet (SV: Votes Sheet)
// What the votes sheet shows: whether voting is open (until when) and how many voted, the chapters by
// votes, and, for the owner, the open / close tools.
// ===========================================

import { voteTally } from './votes.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const day = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

export function votesSheet(state, { owner = false } = {}) {
  const t = voteTally(state);
  return {
    status: t.open ? `Voting is open${t.until ? ` until ${day(t.until)}` : ''} · ${plural(t.voters, 'voter', 'voters')}` : `Voting is closed · ${plural(t.voters, 'voter', 'voters')}`,
    rows: t.chapters.map((c, i) => ({ chapterId: c.chapterId, rank: i + 1, name: c.name, votes: c.votes })),
    tools: owner ? { open: t.open } : null
  };
}
