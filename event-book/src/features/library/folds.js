// ===========================================
// LIBRARY - Folding the bookshelves' sections, to hop between them
// Published, Drafts, Not on this device and the
// Reference shelf each fold under their header; per device. All open at first,
// except a long list of books not on this device.
// ===========================================

const KEY = 'eventpad_shelf_folds';
const LONG = 6;

// v3: Published and Drafts replace Private collection and Library books: they open once for
// everyone (a folded one hid a phone's own shelves), then remember again
const VERSION_KEY = 'eventpad_shelf_folds_v';
function folds() {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    if (localStorage.getItem(VERSION_KEY) !== '3') {
      delete f.private; delete f.library; delete f.published; delete f.drafts;
      localStorage.setItem(KEY, JSON.stringify(f));
      localStorage.setItem(VERSION_KEY, '3');
    }
    return f;
  } catch (e) { return {}; }
}

export function isFolded(section, count) {
  const f = folds();
  return section in f ? !!f[section] : section === 'missing' && count > LONG;
}

export function setFolded(section, folded) {
  const f = folds();
  f[section] = folded;
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) { /* just this time */ }
}

// The header: tap to fold; an empty section is a greyed header only
export function sectionHead(section, title, countText, count) {
  const folded = count > 0 && isFolded(section, count);
  return `<button class="lb-section-head${count ? '' : ' empty'}" id="lbSec-${section}" data-library-action="fold" data-section="${section}" data-count="${count}"
    aria-expanded="${count > 0 && !folded}" ${count ? '' : 'disabled'}>
    <span class="lb-chev" aria-hidden="true">${folded ? '▸' : '▾'}</span><span class="lb-section">${title}</span><span class="lb-count">${countText}</span></button>`;
}

// A slim row for a folded section (its book edges and what's inside) that opens it
const edges = n => Array.from({ length: Math.min(n, 6) }, (_, i) => `<i style="--h:${54 + ((i * 37) % 28)}%; --hue:${(i * 47) % 360}"></i>`).join('');
export function sectionBody(section, count, html, noun = 'book') {
  if (!count) return '';
  const folded = isFolded(section, count);
  return `<button class="lb-folded-row" data-library-action="fold" data-section="${section}" data-folded-row="${section}" ${folded ? '' : 'hidden'}>
      <span class="lb-edges" aria-hidden="true">${edges(count)}</span>
      <span class="lb-folded-text">${count} ${count === 1 ? noun : noun + 's'} · tap to open</span></button>
    <div class="lb-section-body" data-section-body="${section}" ${folded ? 'hidden' : ''}>${html}</div>`;
}

// Fold or open in place (no redraw)
export function toggleSection(section, open = null) {
  const head = document.getElementById(`lbSec-${section}`);
  const body = document.querySelector(`[data-section-body="${section}"]`);
  const row = document.querySelector(`[data-folded-row="${section}"]`);
  if (!head || !body) return;
  const folded = open === null ? !body.hidden : !open;
  body.hidden = folded;
  if (row) row.hidden = !folded;
  head.setAttribute('aria-expanded', String(!folded));
  head.querySelector('.lb-chev').textContent = folded ? '▸' : '▾';
  setFolded(section, folded);
}

// The chips at the top: hop to a section (and open it)
export function jumpChips(sections) {
  return `<nav class="lb-jump" aria-label="Sections">${sections.map(s =>
    `<button class="lb-jump-chip${s.count ? '' : ' empty'}" data-library-action="jump" data-section="${s.section}" ${s.count ? '' : 'disabled'}>${s.label} <span data-jump-count="${s.section}">${s.count}</span></button>`).join('')}</nav>`;
}

export function jumpTo(section) {
  toggleSection(section, true);
  document.getElementById(`lbSec-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
