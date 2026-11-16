// ===========================================
// OUTLINE ADD HINT (SV) - the line under the kinds in the "Add a step" sheet: what the step will add, from
// what's filled in so far. Only an automation's changes as it is typed (a new read model gets its own view).
// form: Outline Add Form; typed: { when, using, external } (the values in the sheet)
// ===========================================

const HINTS = {
  SC: 'A state change: what someone does, and what happened',
  SV: 'A state view: what someone sees',
  AU: 'An automation: the system reacts and sends a command'
};

export function outlineAddHint(form, { when = '', using = '', external = false } = {}) {
  if (form.kind !== 'AU') return HINTS[form.kind] || HINTS.SC;
  if (using && !form.known.readModel?.[using.trim().toLowerCase()]) return `Adds 2 slices: the view of ${using}, then what it does`;
  if (when && external) return `Adds 1 slice: it translates ${when} into a command of your own`;
  if (when) return `Adds 1 slice: it reacts to ${when} and sends the command`;
  return HINTS.AU;
}
