// BOARD SHEETS - Slice Scenarios Drawer (SV): a slice's scenarios, each folded to its name and opened to its Given / When / Then
// lines (Scenario Lines), with how many open comments each has and whether any of them carries ids to hide. readOnly: not
// checked out here, so no Edit and no + Scenario. null when the slice is gone.
import { sliceTitle, getScenariosForSlice } from '../../../core/projections.js';
import { idsHidden, scenarioHasIds } from '../../scenarios/ids.js';
import { scenarioLines } from '../../scenarios/scenarioLines.read.js';
import { commentsOn } from '../../comments/read.js';

export function sliceScenariosDrawer(book, sliceId, { readOnly = false } = {}) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  const openOn = scenarioId => commentsOn(book, sliceId, scenarioId).filter(c => !c.resolved).length;
  const scenarios = getScenariosForSlice(sliceId, book);
  const onSlice = openOn(null);
  return {
    sliceId, sub: sliceTitle(slice, book), readOnly,
    hasIds: scenarios.some(s => scenarioHasIds(s, book)), idsHidden: idsHidden(),
    sliceComment: onSlice ? `${onSlice} open on the slice` : 'Comment on the slice',
    scenarios: scenarios.map(scn => {
      const open = openOn(scn.id);
      return { id: scn.id, sliceId, readOnly, name: scn.name || 'Scenario', mustHave: !!scn.mustHave, openComments: open, commentLabel: open ? `${open} open` : 'Comment', lines: scenarioLines(book, scn) };
    })
  };
}
