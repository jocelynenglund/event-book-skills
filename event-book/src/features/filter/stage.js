// ===========================================
// STAGE FILTER - Show only the slices at one stage: To refine (not ticked Refined), Ready
// (refined, not built yet) or Done (built), or the ones with an open comment (💬 Open: on the
// slice or one of its scenarios). While verifying an edition (a build book, a test review) the
// stages are its verdicts instead: To try, ✓ Works, ✗ Doesn't. One choice for the board and the
// outline, kept on this device; display only, so it works on a read-only book too.
// This file holds the choice and which stage each slice is at; what the chips answer is Stage Filter
// Counts (stageFilterCounts.read.js), the chips are the Stage chips component (filter.parts.js).
// ===========================================

import { verifyingEdition } from '../verify/command.js';
import { sliceVerdict } from '../verify/sliceVerdict.read.js';
import { sliceComments } from '../comments/read.js';

const KEY = 'eventpad_status_filter';
const PLAN = [['all', 'All'], ['refine', 'To refine'], ['ready', 'Ready'], ['done', 'Done'], ['talk', '💬 Open']];
const VERIFY = [['all', 'All'], ['untried', 'To try'], ['works', '✓ Works'], ['fails', '✗ Doesn’t']];

let current = (() => { try { return localStorage.getItem(KEY) || 'all'; } catch (e) { return 'all'; } })();
let verify = null;   // { state, edition } while verifying
let book = null;     // the state being drawn: for the open comments

// Which stages this book has: call before drawing (board, outline)
export function filterFor(state) {
  book = state;
  const edition = verifyingEdition(state);
  verify = edition == null ? null : { state, edition };
}
export const stages = () => verify ? VERIFY : PLAN;
// A choice made in the other mode reads as All here
export const active = () => stages().some(([k]) => k === current) ? current : 'all';

// A slice's verdict (each scenario's overall one, over its testers): ✗ when any scenario doesn't work,
// to try while any is untried, ✓ when all work
const verdictStage = slice => sliceVerdict(verify.state, verify.edition, slice.id).overall;
export const stageOf = slice => verify ? verdictStage(slice) : slice.built ? 'done' : slice.refined ? 'ready' : 'refine';
// An open thread on the slice itself or one of its scenarios
const talkedAbout = slice => !!book && sliceComments(book, slice.id).open > 0;
export const isIn = (slice, k) => k === 'talk' ? talkedAbout(slice) : stageOf(slice) === k;
export const statusFilter = () => active();
export const filtering = () => active() !== 'all';
export const shows = slice => active() === 'all' || isIn(slice, active());

export const emptyText = () => ({ refine: 'Everything is refined ☑', ready: 'Nothing refined and waiting to be built', done: 'Nothing built yet',
  talk: 'No open comments',
  untried: 'Every scenario has been tried', works: 'Nothing confirmed working yet', fails: 'Nothing failing ✓' })[active()] || '';

// A chip tapped: tapping the one that's on goes back to All
export function chooseStage(k) {
  current = k === active() ? 'all' : k;
  try { localStorage.setItem(KEY, current); } catch (err) { /* just this time */ }
}
