// ===========================================
// SPECS - Board to failing specs, shown: a refined slice's spec trail (planned → specs written
// → passing → built) on its slice page, and in Compare which generated slices were built as
// planned. Passing needs the app's build book on this device ("<app> · built").
// ===========================================

import { listModels, readModelEvents } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { buildBookName } from '../buildVersions/rules.js';
import { appOfPlan } from '../buildVersions/follow.js';
import { specStatus, builtAsPlanned } from './generate.js';
import { escapeHtml } from '../board/view.js';

const STEPS = ['planned', 'specs written', 'passing', 'built'];

// The plan's app's build book, when it's on this device
export function localBuildBook(state) {
  const name = buildBookName(state.follow?.app || appOfPlan(state));
  const m = listModels().find(x => projectState(readModelEvents(x.id)).modelName === name);
  return m ? projectState(readModelEvents(m.id)) : null;
}

// The trail on a refined slice's page; nothing for a slice that isn't refined
export function specTrail(slice, state) {
  if (!slice?.refined) return '';
  const row = specStatus(state, localBuildBook(state)).find(r => r.sliceId === slice.id);
  if (!row) return '';
  const at = STEPS.indexOf(row.status);
  return `<p class="sp-specs" aria-label="Spec status: ${escapeHtml(row.status)}">${STEPS.map((s, i) =>
    `<span class="sp-spec-step${i < at ? ' past' : i === at ? ' now' : ''}">${escapeHtml(s)}</span>`).join('<span class="sp-spec-arrow" aria-hidden="true">→</span>')}</p>`;
}

// Compare: the generated slices this build has, built as planned or what drifted
export function builtAsPlannedSection(plan, built) {
  const rows = builtAsPlanned(plan, built);
  if (!rows.length) return '';
  const ok = rows.filter(r => r.result === 'built as planned').length;
  return `<details class="cp-planned"${ok < rows.length ? ' open' : ''}><summary>🧪 ${ok} of ${rows.length} generated ${rows.length === 1 ? 'slice' : 'slices'} built as planned</summary>
    ${rows.map(r => `<p class="cp-planned-row ${r.result === 'built as planned' ? 'ok' : 'drift'}"><b>${escapeHtml(r.slice)}</b> ${escapeHtml(r.result)}</p>`).join('')}</details>`;
}
