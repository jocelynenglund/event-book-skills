// The small, quiet mark on a slice whose scenarios are waived (board header, outline row, slice
// page); the reason is its title. Empty when the slice isn't waived.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function waivedMark(slice) {
  if (!slice?.waived) return '';
  return `<span class="no-scn" title="${esc(slice.waived.reason || 'No scenario needed')}">no scenario · waived</span>`;
}
