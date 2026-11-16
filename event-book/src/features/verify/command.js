// ===========================================
// VERIFY - Verifying a shipped edition (commands and the results read model)
// SC: Record Test Verdict — a scenario tried in the shipped app: ✓ works or ✗ doesn't (a ✗
// says what happened, and that note becomes a comment on the scenario). On a published
// edition, or through a verification link (a review with purpose 'test'). Talk, not a
// change: allowed on a frozen book. Each tester's own latest verdict counts; the scenario's overall one is ✗ if any tester's is.
// SV: Verification Results — per edition: tried, works, fails (with notes), untested.
// ===========================================

import { appendEvent, EventTypes, getCurrentModelId } from '../../core/eventStore.js';
import { reviewOf } from '../review/client.js';
import { projectState, getScenariosForSlice, getOrderedSlices } from '../../core/projections.js';
import { nickname, addComment } from '../comments/command.js';
import { testersOf, overallOf } from './verdictRules.js';

export const VERDICTS = ['works', 'fails'];

// edition: the one being verified (a verification link names it; else the published book's)
export function recordVerdict({ sliceId, scenarioId, verdict, note = '' }, edition = null) {
  const state = projectState();
  const ed = edition ?? (state.edition?.published ? state.edition.edition : null);
  if (ed == null) return 'Verification is for a shipped (published) edition';
  if (!nickname()) return 'Pick a nickname first';
  if (!VERDICTS.includes(verdict)) return 'Works or doesn\'t';
  if (state.scenarios[scenarioId]?.sliceId !== sliceId) return 'No such scenario';
  const what = String(note || '').trim();
  if (verdict === 'fails' && !what) return 'Say what happened';
  appendEvent(EventTypes.ScenarioTested, { scenarioId, sliceId, edition: ed, verdict, ...(what ? { note: what } : {}), testedBy: nickname(), at: new Date().toISOString() });
  if (verdict === 'fails') addComment({ sliceId, scenarioId, text: what });
  return null;
}

// What was tried in an edition, and how it went; untested counts every scenario in the book. A scenario's
// verdict is its overall one (verdictRules.js): ✗ when any tester's current verdict is ✗
export function verificationResults(state, edition) {
  const all = getOrderedSlices(state).flatMap(s => getScenariosForSlice(s.id, state).map(scn => ({ sliceId: s.id, scenarioId: scn.id, name: scn.name, testers: testersOf(state, edition, scn.id) })));
  const tried = all.filter(x => x.testers.length);
  const failing = tried.filter(x => overallOf(x.testers) === 'fails').map(x => ({ sliceId: x.sliceId, scenarioId: x.scenarioId, name: x.name, note: x.testers.find(t => t.verdict === 'fails')?.note || null }));
  return { edition, tested: tried.length, works: tried.length - failing.length, fails: failing.length, untested: all.length - tried.length, failing };
}

// The edition being verified here: a test review's, or a published edition's (a build book's
// latest); null while planning
export function verifyingEdition(state) {
  const r = reviewOf(getCurrentModelId());
  if (r) return r.purpose === 'test' && !r.ended ? (r.edition ?? state.edition?.edition ?? null) : null;
  return state.edition?.published ? state.edition.edition : null;
}
