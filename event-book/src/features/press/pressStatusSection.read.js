// ===========================================
// PRESS - Press Status Section: what a book's details say about its press: where the plan is (Plan Status) and,
// once it's back, what came back with the build (Build Summary), the app's build book being the one on this device.
// ===========================================

import { projectState } from '../../core/projections.js';
import { readModelEvents, listModels } from '../../core/eventStore.js';
import { planStatus, buildSummary } from './command.js';
import { buildBookName } from '../buildVersions/rules.js';

// The app's build book on this device, for the summary
function buildBookOf(app) {
  const found = app && listModels().map(m => projectState(readModelEvents(m.id))).find(st => st.modelName === buildBookName(app));
  return found || null;
}

const list = items => items.length ? items.join(', ') : 'none';

// -> null for a book never sent to press, else { id, stage, status, summary: null | { edition, build, commit, done, todo, extra, scenarios } }
export function pressStatusSection(state, id) {
  const status = planStatus(state);
  if (!status) return null;
  const s = buildSummary(state, buildBookOf(state.press.app));
  return {
    id, stage: state.press.stage, status,
    summary: !s ? null : {
      build: `edition ${s.edition ?? '?'}${s.build ? ` · build ${s.build}` : ''}${s.commit ? ` · ${String(s.commit).slice(0, 7)}` : ''}`,
      done: `${s.slicesDone} ${s.slicesDone === 1 ? 'slice' : 'slices'}`,
      todo: list(s.slicesStillToBuild), extra: list(s.slicesBuiltButNotPlanned),
      scenarios: s.scenariosPassing != null ? `${s.scenariosPassing} passing` : null
    }
  };
}
