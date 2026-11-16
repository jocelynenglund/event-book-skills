// ===========================================
// OUTLINE AUTOMATION PARTNER (SV) - the slice on the other side of an automation's processor: the one
// that does what the view feeds (null when the slice has no partner)
// ===========================================

export function outlineAutomationPartner(state, sliceId) {
  return state.slices[sliceId]?.pairWith || null;
}
