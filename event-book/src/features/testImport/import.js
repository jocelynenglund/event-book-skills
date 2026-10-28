// ===========================================
// TEST IMPORT - ☰ → Import, for whatever was picked (SC: Import)
// One or more files: eventPAD models (each a new shelf, as before), test exports (a
// pipeline's combined latest-built.json, or raw .test.json files: together they build one
// model, as tools/model-from-code/eventpad.mjs does) and a plan (docs/slices.json:
// beside a test export it's compared with the model; on its own it becomes a skeleton).
// ===========================================

import * as es from '../../core/eventStore.js';
import * as c from '../board/command.js';
import * as sc from '../scenarios/command.js';
import { kindOf, planVsModel, label } from './spec.js';
import { buildModel as buildWith, modelFromTests, specFromPlan } from './fromExport.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { escapeHtml } from '../board/view.js';
import { showToast } from '../../ui/toast.js';
import { render, showOutline } from '../../ui/feed.js';
import { projectState, getOrderedSlices } from '../../core/projections.js';
import { suggestCompareShelf, compareModels } from '../compare/diff.js';

const readJson = async file => {
  try { return { name: file.name, json: JSON.parse(await file.text()), size: file.size }; } catch (e) { return { name: file.name, json: null, size: file.size }; }
};

const buildModel = (spec, opts) => buildWith(spec, { es, c, sc }, opts);

const list = (items, render) => items.length ? `<ul class="ti-list">${items.map(x => `<li>${render(x)}</li>`).join('')}</ul>` : '';

function showSummary(title, report, diff, planId = null, builtId = null) {
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const gaps = [
    report.events_in_no_scenario.length ? `<div class="ti-h">Events no scenario mentions</div>${list(report.events_in_no_scenario, t => escapeHtml(label(t)))}` : '',
    report.events_no_test_records.length ? `<div class="ti-h">Events no tested command records</div>${list(report.events_no_test_records, t => escapeHtml(label(t)))}` : '',
    report.commands_without_refusal.length ? `<div class="ti-h">Commands with no refusal case</div>${list(report.commands_without_refusal, x => escapeHtml(x))}` : ''
  ].join('');
  const plan = diff ? `
    <div class="ti-section">
      <div class="ti-title">Plan vs model</div>
      <p class="ti-line">${diff.both.length} of ${n(diff.planned, 'planned slice', 'planned slices')} have tests.</p>
      ${diff.missing.length ? `<div class="ti-h">Planned, no tests yet</div>${list(diff.missing, x => `${escapeHtml(x.name)} <span>${escapeHtml(x.chapter)}</span>`)}` : ''}
      ${diff.extra.length ? `<div class="ti-h">Tested, not in the plan</div>${list(diff.extra, x => `${escapeHtml(x.name)} <span>${escapeHtml(x.chapter)}</span>`)}` : ''}
      ${diff.moved.length ? `<div class="ti-h">In another chapter than planned</div>${list(diff.moved, x => `${escapeHtml(x.name)} <span>planned in ${escapeHtml(x.planned)}, tested in ${escapeHtml(x.tested)}</span>`)}` : ''}
    </div>` : '';
  openBoardSheet(`
    <div class="sheet-title">${escapeHtml(title)} <span class="bd-sheet-sub">built from its tests</span></div>
    <p class="ti-line">${n(report.chapters, 'chapter', 'chapters')} · ${n(report.slices, 'slice', 'slices')} · ${n(report.scenarios, 'scenario', 'scenarios')} · ${n(report.events, 'event', 'events')}${report.records_nothing ? ` · ${report.records_nothing} accepted with no change` : ''}</p>
    ${plan}
    ${gaps ? `<div class="ti-section"><div class="ti-title">What the tests don't cover</div>${gaps}</div>` : ''}
    ${planId ? `<button class="sheet-btn" data-compare-with="${builtId}" data-plan="${planId}">Open your ${escapeHtml(title)} shelf and compare</button>` : ''}
    <button class="sheet-btn ${planId ? 'secondary' : ''}" data-board-action="close">Read the model</button>`);
}

// SC: Import Test Export offers Compare — a model built from tests lands on its own shelf, then
// one sheet asks to compare it with the shelf most likely its plan (Compare Suggestion):
// Compare (the plan opens on the left), Pick another, or Not now (stay on the new shelf).
// The import's own summary folds into it. No other shelf: the summary alone.
const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
// What the last import offered: { planId, builtId, why } (null: nothing to compare with)
let offer = null;
export const compareOffer = () => offer;
function offerCompare(builtId, previousId, { report = null } = {}) {
  offer = null;
  const shelves = es.listModels().map(m => ({ id: m.id, state: projectState(es.readModelEvents(m.id)) }));
  const imported = shelves.find(x => x.id === builtId);
  const pick = imported && suggestCompareShelf(imported, shelves, previousId);
  if (!pick) return false;
  offer = { planId: pick.id, builtId, why: pick.why };
  const plan = shelves.find(x => x.id === pick.id).state;
  const name = st => st.modelName || 'Untitled model';
  const { summary } = compareModels(plan, imported.state);
  const why = pick.why === 'name' ? 'Named like it'
    : pick.why === 'matches' ? `${n(summary.built + summary.maybe, 'slice', 'slices')} in common`
    : 'The board you had open';
  const what = report
    ? `${n(report.chapters, 'chapter', 'chapters')} · ${n(report.slices, 'slice', 'slices')} · ${n(report.scenarios, 'scenario', 'scenarios')} · ${n(report.events, 'event', 'events')}`
    : n(getOrderedSlices(imported.state).length, 'slice', 'slices');
  const gaps = report && [
    report.events_in_no_scenario.length ? `<div class="ti-h">Events no scenario mentions</div>${list(report.events_in_no_scenario, t => escapeHtml(label(t)))}` : '',
    report.events_no_test_records.length ? `<div class="ti-h">Events no tested command records</div>${list(report.events_no_test_records, t => escapeHtml(label(t)))}` : '',
    report.commands_without_refusal.length ? `<div class="ti-h">Commands with no refusal case</div>${list(report.commands_without_refusal, x => escapeHtml(x))}` : ''
  ].join('');
  openBoardSheet(`
    <div class="sheet-title ti-compare-title">Compare ${escapeHtml(name(imported.state))} with ${escapeHtml(name(plan))}?</div>
    <p class="ti-line">Imported, built from its tests: ${what}.</p>
    <p class="ti-line ti-why">${escapeHtml(why)} · ${escapeHtml(name(plan))} opens on the left, the tests on the right.</p>
    ${gaps ? `<details class="ti-gaps"><summary>What the tests don't cover</summary>${gaps}</details>` : ''}
    <button class="sheet-btn" data-compare-with="${builtId}" data-plan="${pick.id}">Compare</button>
    <button class="sheet-btn secondary" data-compare-pick-plan="${builtId}">Pick another…</button>
    <button class="sheet-btn secondary" data-board-action="close">Not now</button>`);
  return true;
}

// Built from tests and not touched since: an eventPAD export of one (<date>-<app>-<sha>-built.json)
const isBuiltExport = events => Array.isArray(events) && events[events.length - 1]?.type === 'ModelSnapshot'
  && !!projectState(events).modelSource?.commit;

export async function importFiles(fileList) {
  offer = null;
  const previousId = es.getCurrentModelId();
  const files = await Promise.all([...fileList].map(readJson));
  const kinds = files.map(f => ({ ...f, kind: f.json ? kindOf(f.json) : 'unknown' }));
  const models = kinds.filter(f => f.kind === 'events');
  const tests = kinds.filter(f => f.kind === 'export' || f.kind === 'scenarios');
  const plan = kinds.find(f => f.kind === 'plan');
  const unknown = kinds.filter(f => f.kind === 'unknown');

  try {
    // eventPAD models: each on its own shelf
    models.forEach(m => es.createModel(m.json));

    if (tests.length) {
      const before = new Set(es.listModels().map(m => m.id));
      const { id: builtId, name, spec, report } = modelFromTests(tests, { es, c, sc });
      render();
      showOutline();
      // With docs/slices.json beside it: the plan-vs-model summary, as before
      if (plan) {
        // An outlined model of the same name is likely its plan
        const planModel = es.listModels().find(m => before.has(m.id)
          && (projectState(es.readModelEvents(m.id)).modelName || '').trim().toLowerCase() === name.trim().toLowerCase());
        showSummary(name, report, planVsModel(plan.json, spec), planModel?.id || null, builtId);
      } else if (!offerCompare(builtId, previousId, { report })) showSummary(name, report, null);
    } else if (plan) {
      const name = plan.json.name || plan.json.project || 'Plan';
      const spec = specFromPlan(plan.json, name);
      const built = buildModel(spec);
      render();
      showOutline();
      showToast(`Built the plan: ${built.slices} ${built.slices === 1 ? 'slice' : 'slices'}, no tests yet`);
    } else if (models.length === 1 && isBuiltExport(models[0].json)) {
      render();
      if (!offerCompare(es.getCurrentModelId(), previousId)) showToast('Imported as a new model (without history)');
    } else if (models.length) {
      render();
      const one = models[0].json;
      showToast(models.length > 1 ? `Imported ${models.length} models`
        : one.length === 1 && one[0].type === 'ModelSnapshot' ? 'Imported as a new model (without history)' : `Imported as a new model (${one.length} events)`);
    }
    if (unknown.length) showToast(`${unknown.map(f => f.name).join(', ')}: not an Event Book model, test export or plan`);
  } catch (err) {
    const mb = (files.reduce((s, f) => s + (f.size || 0), 0) / 1e6).toFixed(1);
    showToast(err instanceof es.StorageFullError
      ? `No room on this device for this ${mb} MB model. Delete a model from your bookshelves (an older copy?) and import again.`
      : "Couldn't import that");
  }
}
