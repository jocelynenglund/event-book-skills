// ===========================================
// TEST IMPORT - Building a model from a file (pure: no sheets, no toasts)
// A test export (a pipeline's combined latest-built.json, or raw .test.json scenarios) builds
// one model, folded into a snapshot with where it came from (repo, commit, build); a plan
// (docs/slices.json) builds its skeleton. Used by ☰ → Import and by the MCP's import_file.
// ===========================================

import { specFromScenarios, scenariosOf } from './spec.js';
import { buildFromSpec } from './build.js';
import { snapshotEvents } from '../snapshot/command.js';

// A model on its own shelf, from its outline: built with eventPAD's own commands (so it's
// wired as the app wires it), then, for a test export, folded into one snapshot: the
// build's history means nothing, the code at that commit is the point
export function buildModel(spec, { es, c, sc }, { snapshot = false } = {}) {
  es.createModel();
  const built = es.withoutSaving(() => buildFromSpec(spec, { es, c, sc }));
  if (snapshot) es.replaceModelEvents(es.getCurrentModelId(), snapshotEvents(es.getEventStream()));
  return built;
}

// tests: [{ name, json, kind: 'export' | 'scenarios' }] → the model built from them, opened.
// Returns { id, name, spec, report }.
export function modelFromTests(tests, mods) {
  const combined = tests.find(f => f.kind === 'export')?.json;
  const scenarios = tests.flatMap(f => f.kind === 'export' ? scenariosOf(f.json) : f.json);
  const name = combined?.app || tests[0].name.replace(/(\.test)?\.json$/i, '') || 'From tests';
  const when = combined?.createdAt ? new Date(combined.createdAt) : null;
  const description = `${name}'s event model, built from its Given / When / Then tests${combined?.commit ? ` at ${String(combined.commit).slice(0, 7)}` : ''}${when && !isNaN(when) ? ` (${when.toLocaleDateString()})` : ''}: the commands and read models they run, with the events they really recorded.`;
  // The build's reference, where the pipeline gives one
  const build = combined?.build ?? combined?.buildNumber ?? combined?.runNumber ?? null;
  const { spec, report } = specFromScenarios(scenarios, { name, description, repo: combined?.repo || null, commit: combined?.commit || null,
    createdAt: combined?.createdAt || null, build, catalog: combined?.events && typeof combined.events === 'object' && !Array.isArray(combined.events) ? combined.events : null });
  buildModel(spec, mods, { snapshot: true });
  return { id: mods.es.getCurrentModelId(), name, spec, report };
}

// A plan alone: its chapters and slices, named as the tests will name them
export function specFromPlan(plan, name) {
  const chapters = [];
  (plan.slices || plan).filter(s => s?.kind === 'slice' && s.name).forEach(s => {
    let ch = chapters.find(x => x.title === (s.chapter || 'Plan'));
    if (!ch) chapters.push(ch = { title: s.chapter || 'Plan', slices: [] });
    const base = { fields: [], events: [], scenarios: [], description: s.description || '' };
    ch.slices.push(s.type === 'view' ? { ...base, kind: 'SV', readModel: s.name }
      : s.type === 'automation' ? { ...base, kind: 'AU', processor: s.name }
      : { ...base, kind: 'SC', command: s.name, screen: null });
  });
  return { name, description: 'The plan (docs/slices.json): its slices, before any tests.', chapters, events: {} };
}
