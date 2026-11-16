// ===========================================
// REVIEW LINKS - Review Link Form: what the owner's "Review & verify" sheet offers for a book: who it is for
// (the plan, or the shipped app once published), what they can do and for how long. Replays the book once.
// ===========================================

import { projectState } from '../../core/projections.js';
import { readModelEvents } from '../../core/eventStore.js';

export const REVIEW_PURPOSE_TEXT = { feedback: 'Review the plan', test: 'Verify the shipped app' };
const DAYS = [7, 14, 30, 90];

// form: { purpose, canAddScenarios, days } as chosen so far.
// -> { name, purpose (the choice that stands: verifying needs a published book), edition (what a verification is for),
//      addsScenarios, purposes / scenarios / days: [{ attr, value, label, on }] }
export function reviewLinkForm(modelId, form) {
  const state = projectState(readModelEvents(modelId));
  const published = !!state.edition?.published;
  const purpose = !published && form.purpose === 'test' ? 'feedback' : form.purpose;
  const chip = (attr, value, label, on) => ({ attr, value: String(value), label, on });
  return {
    name: state.modelName || 'Untitled model', purpose, edition: state.edition?.edition ?? null, addsScenarios: form.canAddScenarios,
    purposes: [chip('purpose', 'feedback', REVIEW_PURPOSE_TEXT.feedback, purpose === 'feedback'),
      ...(published ? [chip('purpose', 'test', `Verify ${state.edition.edition ? `edition ${state.edition.edition}` : 'the shipped app'}`, purpose === 'test')] : [])],
    scenarios: [chip('scenarios', '0', 'Comment', !form.canAddScenarios), chip('scenarios', '1', 'Comment and add scenarios', form.canAddScenarios)],
    days: DAYS.map(d => chip('days', d, `${d} days`, form.days === d))
  };
}
