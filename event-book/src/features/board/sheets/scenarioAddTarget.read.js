// BOARD SHEETS - Scenario Add Target (SV): the slice a new scenario goes to, with its kind (null when the slice is gone)
export function scenarioAddTarget(book, sliceId) {
  const slice = book.slices[sliceId];
  return slice ? { sliceId: slice.id, type: slice.type } : null;
}
