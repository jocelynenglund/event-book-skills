// ===========================================
// The itsyBIT mark: Jocelyn's logo shape only (a tall rounded rect, a ring over a bar,
// from itsybit-studio/itsybit-logo.svg, viewBox 0 0 100 120). The rect takes the text
// colour (currentColor); the ring and bar are cut out in the background behind it
// (--itsybit-mark-cut, set where it sits). No brand colour: the old red isn't hers.
// Marks an agent working for her (Claude, through the eventPAD MCP server).
// ===========================================

export function itsybitMark({ size = 14, label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="itsybit-mark" viewBox="0 0 100 120" width="${Math.round(size * 100 / 120)}" height="${size}" ${a11y} focusable="false">`
    + '<rect x="5" y="5" width="90" height="110" rx="16" fill="currentColor"/>'
    + '<circle class="im-cut" cx="50" cy="42" r="22" fill="none" stroke-width="8"/>'
    + '<line class="im-cut" x1="30" y1="92" x2="70" y2="92" stroke-width="8" stroke-linecap="round"/>'
    + '</svg>';
}
