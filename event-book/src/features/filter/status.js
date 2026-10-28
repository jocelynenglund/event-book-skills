// ===========================================
// STATUS FILTER - Show only the slices at one stage: To refine (not ticked Refined), Ready
// (refined, not built yet) or Done (built). While verifying an edition (a build book, a test
// review) the stages are its verdicts instead: To try, ✓ Works, ✗ Doesn't. One choice for the
// board and the outline, kept on this device; display only, so it works on a read-only book too.
// ===========================================

import { getScenariosForSlice } from '../../core/projections.js';
import { verifyingEdition, verdictOf } from '../verify/command.js';

const KEY = 'eventpad_status_filter';
const PLAN = [['all', 'All'], ['refine', 'To refine'], ['ready', 'Ready'], ['done', 'Done']];
const VERIFY = [['all', 'All'], ['untried', 'To try'], ['works', '✓ Works'], ['fails', '✗ Doesn’t']];

let current = (() => { try { return localStorage.getItem(KEY) || 'all'; } catch (e) { return 'all'; } })();
let verify = null;   // { state, edition } while verifying

// Which stages this book has: call before drawing (board, outline)
export function filterFor(state) {
  const edition = verifyingEdition(state);
  verify = edition == null ? null : { state, edition };
}
const stages = () => verify ? VERIFY : PLAN;
// A choice made in the other mode reads as All here
const active = () => stages().some(([k]) => k === current) ? current : 'all';

// A slice's verdict: ✗ when any scenario doesn't work, to try while any is untried, ✓ when all work
function verdictStage(slice) {
  const vs = getScenariosForSlice(slice.id, verify.state).map(s => verdictOf(verify.state, verify.edition, s.id)?.verdict);
  return vs.includes('fails') ? 'fails' : !vs.length || vs.some(v => !v) ? 'untried' : 'works';
}
export const stageOf = slice => verify ? verdictStage(slice) : slice.built ? 'done' : slice.refined ? 'ready' : 'refine';
export const statusFilter = () => active();
export const filtering = () => active() !== 'all';
export const shows = slice => active() === 'all' || stageOf(slice) === active();

// The chips, with how many slices are at each stage
export function statusChips(slices) {
  if (!slices.length) return '';
  const count = k => k === 'all' ? slices.length : slices.filter(s => stageOf(s) === k).length;
  const on = active();
  return `<span class="st-filter" role="group" aria-label="Show slices">${stages().map(([k, label]) => `
    <button class="st-chip ${on === k ? 'on' : ''}" data-status-filter="${k}" aria-pressed="${on === k}">${label}${k === 'all' ? '' : ` <span class="st-n">${count(k)}</span>`}</button>`).join('')}</span>`;
}

export const emptyText = () => ({ refine: 'Everything is refined ☑', ready: 'Nothing refined and waiting to be built', done: 'Nothing built yet',
  untried: 'Every scenario has been tried', works: 'Nothing confirmed working yet', fails: 'Nothing failing ✓' })[active()] || '';

export function initStatusFilter(render) {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-status-filter]');
    if (!t) return;
    // Tapping the one that's on goes back to All
    current = t.dataset.statusFilter === active() ? 'all' : t.dataset.statusFilter;
    try { localStorage.setItem(KEY, current); } catch (err) { /* just this time */ }
    render();
  });
}
