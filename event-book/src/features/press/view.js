// ===========================================
// PRESS - A plan being built, in the app: the plan's ⋮ menu sends it to press (or stops the
// press before a builder takes it); the book's details say where it is (Plan Status) and,
// once it's back, what came back with the build (Build Summary) with Compare.
// ===========================================

import { projectState, getOrderedSlices } from '../../core/projections.js';
import { readModelEvents, listModels } from '../../core/eventStore.js';
import { sendToPress, stopPress, sendRefusal, planStatus, buildSummary } from './command.js';
import { account } from '../sync/client.js';
import { nickname } from '../comments/command.js';
import { buildBookName } from '../buildVersions/rules.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { escapeHtml } from '../board/view.js';

// The ⋮ menu's entry: { stop } at the press (not taken yet), else { count, refused }; null while being built
export function pressMenu(state = projectState()) {
  const p = state.press;
  if (p?.stage === 'building') return null;
  if (p?.stage === 'press') return { stop: true };
  return { count: getOrderedSlices(state).filter(s => s.refined).length, refused: sendRefusal(state) };
}

export function pressFromMenu(send) {
  const why = send ? sendToPress({ by: nickname() || account()?.email || null }) : stopPress();
  if (why) { showToast(why); return; }
  const p = projectState().press;
  showToast(send ? `Sent to press: ${p.slices.length} ${p.slices.length === 1 ? 'slice' : 'slices'} for a builder` : 'Stopped the press');
  render();
}

// The app's build book on this device, for the summary
function buildBookOf(app) {
  const m = app && listModels().find(x => projectState(readModelEvents(x.id)).modelName === buildBookName(app));
  return m ? projectState(readModelEvents(m.id)) : null;
}

const list = items => items.length ? items.map(escapeHtml).join(', ') : 'none';

// The book's details: its status, and what came back
export function pressSection(state, id) {
  const status = planStatus(state);
  if (!status) return '';
  const s = buildSummary(state, buildBookOf(state.press.app));
  return `<div class="ps-press" data-press-stage="${state.press.stage}">
    <p class="ps-status">🖨 ${escapeHtml(status)}</p>
    ${!s ? '' : `<dl class="ed-facts ps-summary">
      <dt>Build</dt><dd>edition ${escapeHtml(String(s.edition ?? '?'))}${s.build ? ` · build ${escapeHtml(String(s.build))}` : ''}${s.commit ? ` · ${escapeHtml(String(s.commit).slice(0, 7))}` : ''}</dd>
      <dt>Done</dt><dd class="ps-done">${s.slicesDone} ${s.slicesDone === 1 ? 'slice' : 'slices'}</dd>
      <dt>Still to build</dt><dd class="ps-todo">${list(s.slicesStillToBuild)}</dd>
      <dt>Not planned</dt><dd class="ps-extra">${list(s.slicesBuiltButNotPlanned)}</dd>
      ${s.scenariosPassing != null ? `<dt>Scenarios</dt><dd>${s.scenariosPassing} passing</dd>` : ''}
    </dl>
    <button class="ed-btn" data-library-action="compare-book" data-model="${id}">Compare with the build…</button>`}
  </div>`;
}
