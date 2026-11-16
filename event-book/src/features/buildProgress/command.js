// ===========================================
// BUILD PROGRESS - A builder says where each slice of the plan it is building has got to
// SC: Report Progress — the builder (the agent the plan is checked out to) reports a slice's step:
//     started, red (its spec fails for the right reason), green (its scenarios pass), pr (a pull
//     request is open) or stuck (with what is in the way). Plain events in the plan's book: the
//     slice, the spine and the MCP outline show the latest, and the history is kept.
//     Refused: not checked out to you (start_building first); no such slice; an unknown step; stuck
//     without a note; pr without its number or url; tests that pass more than there are; and a step
//     back from green (or pr): only stuck, or started (a new round), may.
// The command returns null when it recorded its event, else why it was refused.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';

export const STEPS = ['started', 'red', 'green', 'pr', 'stuck'];
// How far along each step is (stuck has no place: it can be said at any time)
const RANK = { started: 1, red: 2, green: 3, pr: 4 };

// ---------- Rule (pure: the plan's state in, the refusal or null out) ----------

export function progressRefusal(state, { sliceId, step, note = null, pr = null, tests = null, by = null } = {}) {
  const p = state.press;
  if (p?.stage !== 'building' || !by || p.builder !== by) return 'Check the plan out first (start_building)';
  if (!state.slices[sliceId]) return 'No such slice';
  if (!STEPS.includes(step)) return `Step is one of ${STEPS.join(', ')}`;
  if (step === 'stuck' && !String(note || '').trim()) return 'Say what you are stuck on (note)';
  if (step === 'pr' && !(pr && (pr.number || pr.url))) return 'Give the pull request: its number or url';
  if (tests && !(Number.isInteger(tests.passing) && Number.isInteger(tests.total) && tests.passing >= 0 && tests.passing <= tests.total)) return 'Tests: passing is a count up to the total';
  const now = state.progress?.[sliceId]?.step;
  if (RANK[now] >= RANK.green && RANK[step] < RANK[now] && step !== 'started') return 'It is green already: only stuck, or started for a new round, can step back';
  return null;
}

// ---------- Command (on the open plan) ----------

export function reportProgress({ sliceId, step, note = null, pr = null, tests = null, by = null, at = new Date().toISOString(), state = projectState() } = {}) {
  const refused = progressRefusal(state, { sliceId, step, note, pr, tests, by });
  if (refused) return refused;
  const data = { sliceId, step, by, at };
  if (note && String(note).trim()) data.note = String(note).trim();
  if (pr) data.pr = { ...(pr.number ? { number: Number(pr.number) } : {}), ...(pr.url ? { url: String(pr.url) } : {}) };
  if (tests) data.tests = { passing: tests.passing, total: tests.total };
  return appendEvent(EventTypes.SliceProgressReported, data) ? null : 'Read only';
}
