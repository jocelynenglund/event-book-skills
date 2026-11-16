// ===========================================
// LIBRARY - Parts of the Bookshelves, drawn from the Library screen's objects alone
// Each takes one part of libraryScreen (a book, a section, the chips…) and ui, the device's local
// state (what is folded, the foot mark, how a title fits); every part has a default, so each draws
// on its own. Nothing here reads the books. A root carries data-component and data-key.
// ===========================================

import { planBuildProgressLine } from '../buildProgress/progress.parts.js';
import { fitSpine, bookSpecOf } from './books.js';
import { sectionHead, sectionBody, isFolded } from './folds.js';
import { spineMeta } from './screen.js';
import { noteTilt } from '../board/board.parts.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The little computer (in the header, so folding a shelf never hides it): beige case, a green
// screen with a blinking cursor, a keyboard in front
const terminal = `<button class="lb-terminal" data-library-action="catalog" aria-label="Look up a book (card catalog)" title="Look up a book (/)">
  <svg viewBox="0 0 64 60" width="40" height="38" aria-hidden="true">
    <rect x="6" y="2" width="52" height="40" rx="5" fill="#e3d6b8" stroke="#8a7550" stroke-width="1.5"/>
    <rect x="12" y="7" width="40" height="27" rx="3" fill="#13261a" stroke="#5b4a2c" stroke-width="1"/>
    <text x="16" y="19" font-family="monospace" font-size="7" font-weight="700" fill="#5cff8a">CATALOG</text>
    <text x="16" y="29" font-family="monospace" font-size="8" font-weight="700" fill="#5cff8a">&gt;<tspan class="lb-term-cursor">_</tspan></text>
    <rect x="22" y="42" width="20" height="5" fill="#cdbf9e" stroke="#8a7550" stroke-width="1"/>
    <rect x="4" y="47" width="56" height="11" rx="2.5" fill="#e3d6b8" stroke="#8a7550" stroke-width="1.5"/>
    <path d="M9 51h46M9 54.5h46" stroke="#a8946c" stroke-width="1" stroke-dasharray="3 1.5"/>
  </svg>
</button>`;

// The header: the title and its buttons. screen: { signedIn }. ui.reviewer: a reviewer can't start books.
export function libraryHeader(screen, ui = {}) {
  return `
    <div class="lb-head" data-component="Library header" data-key="header">
      <span class="lb-title">Bookshelves</span>
      <span class="lb-head-actions">
        ${terminal}
        ${screen.signedIn ? '<button class="lb-sharebtn lb-syncbtn" data-sync-action="sync" aria-label="Sync with your library" title="Sync with your library"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : ''}
        <button class="lb-sharebtn" data-library-action="share-bookcase" aria-label="Share the bookshelves" title="Share the bookshelves"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        ${ui.reviewer ? '' : '<button class="lb-compare lb-newbtn" data-library-action="new">＋ New</button>'}
      </span>
    </div>`;
}

// Bars as inline SVG, tallest bar full height; a day with nothing is a thin stub
function sparkline(counts) {
  const w = 5, gap = 2, h = 18, top = Math.max(1, ...counts);
  const bars = counts.map((n, i) => {
    const bh = n ? Math.max(3, Math.round(n / top * h)) : 1;
    return `<rect x="${i * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="1"${n ? '' : ' class="vl-zero"'}/>`;
  }).join('');
  return `<svg class="vl-spark" viewBox="0 0 ${counts.length * (w + gap) - gap} ${h}" width="${counts.length * (w + gap) - gap}" height="${h}" aria-hidden="true">${bars}</svg>`;
}

// The velocity line under the header: "🚀 0.9 slices/day · last 7 days" with a bar per day. Tap for the
// last 30 days and each app's share. Hidden (but in place) until there is something to say.
export function libraryVelocity(v) {
  const hidden = '<div data-component="Library velocity" data-key="velocity" data-velocity hidden></div>';
  if (v.pending || !v.line) return hidden;
  const { line, open } = v;
  return `<div class="vl${open ? ' open' : ''}" data-component="Library velocity" data-key="velocity" data-velocity>
    <button class="vl-line" data-library-action="velocity" aria-expanded="${open}" title="${open ? 'Show the last 7 days' : 'Show the last 30 days'}">
      <span class="vl-text">${escapeHtml(line.text)}</span>${sparkline(line.sparkline)}</button>
    ${open ? `<ul class="vl-apps">${line.byApp.length
      ? line.byApp.map(a => `<li><span>${escapeHtml(a.app)}</span><b>${a.count}</b></li>`).join('')
      : '<li class="vl-none">No slices built in these 30 days</li>'}</ul>` : ''}
  </div>`;
}

// The chips at the top: hop to a section (and open it)
export function libraryChips(chips) {
  return `<nav class="lb-jump" aria-label="Sections" data-component="Library chips" data-key="sections">${chips.map(s =>
    `<button class="lb-jump-chip${s.count ? '' : ' empty'}" data-library-action="jump" data-section="${s.section}" ${s.count ? '' : 'disabled'}>${s.label} <span data-jump-count="${s.section}">${s.count}</span></button>`).join('')}</nav>`;
}

// The tag chips: filter the shelves by a tag
export function libraryTags(tags) {
  if (!tags.length) return '';
  return `<nav class="lb-tags" aria-label="Tags" data-component="Library tags" data-key="tags">${tags.map(x =>
    `<button class="lb-tag-chip${x.on ? ' on' : ''}" data-library-action="tag" data-tag="${escapeHtml(x.tag)}" aria-pressed="${x.on}">${escapeHtml(x.tag)} <span>${x.count}</span></button>`).join('')}</nav>`;
}

// A loose sheet sticking out for each slice that is refined but not built yet (up to 3); none on a published book
const sheetsOf = b => b.published || !b.ready ? '' : `<span class="ed-sheets" aria-hidden="true">${Array.from({ length: b.ready }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;

const detailsButton = b => `<button class="ed-spine-more" aria-label="${escapeHtml(b.title)}: details and actions" data-library-action="details" data-model="${b.id}">⋯</button>`;

// One book on a wooden shelf. Standing: ONE spine with a vertical title and its small print. Published:
// cloth with a sheen and double gold rules; drafts: stitched kraft paper with a loose sheet for each refined
// slice. Propped up: turned cover out on a little brass stand, its title across. Flat (one of the last few
// opened): its title across. ⋯ opens its details. ui.foot(id): the foot mark (who has it); ui.fit: title fit.
export function librarySpine(book, ui = {}) {
  const foot = (ui.foot || (() => ''))(book.id);
  const loan = book.loan ? ` data-loan="${book.loan}"` : '';
  const mark = `data-component="Library spine" data-key="${book.id}"`;
  const label = escapeHtml(book.title), editionLabel = escapeHtml(book.edition.text);
  const hover = `title="${label} · ${editionLabel}"`;
  const kind = book.published ? 'cloth' : 'kraft';
  const footSpan = `<span class="ed-foot" data-sync-shelf="${book.id}">${foot}</span>`;
  if (book.layout === 'propped') {
    return `
    <span class="ed-book propped" ${mark}>
    <button class="ed-cover ${kind}"${loan} data-library-action="open" data-model="${book.id}" ${hover}
      style="--cloth:${book.cloth}" aria-label="${label}, ${editionLabel}, propped up">
      ${sheetsOf(book)}
      <span class="ed-title">${label}</span>
      <span class="ed-m" aria-hidden="true">${spineMeta(book)}</span>
      ${planBuildProgressLine(book.progress)}
      ${footSpan}
    </button>
    ${detailsButton(book)}
    </span>`;
  }
  if (book.layout === 'flat') {
    return `
    <span class="ed-book flat" ${mark} style="--shift:${[0, 10, 4][(book.slot || 0) % 3]}px">
    <button class="ed-spine flat ${kind}"${loan} data-library-action="open" data-model="${book.id}" ${hover}
      style="--cloth:${book.cloth}" aria-label="${label}, ${editionLabel}, opened recently">
      ${sheetsOf(book)}
      <span class="ed-title">${label}</span>
      ${planBuildProgressLine(book.progress)}
      ${footSpan}
    </button>
    ${detailsButton(book)}
    </span>`;
  }
  const fit = (ui.fit || fitSpine)(book.title, 36, book.height - 84, 17);
  return `
    <span class="ed-book" ${mark} style="--w:${fit.width + 13}px">
    <button class="ed-spine ${kind}"${loan} data-library-action="open" data-model="${book.id}" ${hover}
      style="--h:${book.height}px; --cloth:${book.cloth}" aria-label="${label}, ${editionLabel}">
      <span class="ed-pg" aria-hidden="true"></span>
      ${sheetsOf(book)}
      <span class="ed-title" style="font-size:${fit.size}px">${label}</span>
      <span class="ed-m" aria-hidden="true">${spineMeta(book)}</span>
      ${planBuildProgressLine(book.progress)}
      ${footSpan}
    </button>
    ${detailsButton(book)}
    </span>`;
}

// A section's shelf: the stack of recent books on top, the shelf, and the plank with its plaque
export function libraryShelf(section, ui = {}) {
  const stack = section.recent.length ? `<span class="ed-stack" aria-label="Opened recently">${section.recent.map(b => librarySpine(b, ui)).join('')}</span>` : '';
  const books = [...section.propped, ...section.standing].map(b => librarySpine(b, ui));
  return `<div class="ed-case ed-${section.key}" data-component="Library shelf" data-key="${section.key}">${stack ? `<div class="ed-top">${stack}</div>` : ''}<div class="ed-shelf">${books.join('')}</div><div class="ed-plank"><span class="ed-plate" aria-hidden="true"><b>${section.title}</b><i>${section.count}</i></span></div></div>`;
}

// A section's header (tap to fold; an empty one is a greyed header only, with its note if it has one) and
// what it holds, which folds away to a slim row. section: { key, title, count, countText?, note? }.
// body: what it holds (its shelf, by default). ui.folded(section, count): is it folded (a device setting).
export function librarySection(section, ui = {}, body = null) {
  const folded = ui.folded || isFolded;
  const attrs = `data-component="Library section" data-key="${section.key}"`;
  const head = sectionHead(section.key, section.title, section.countText ?? String(section.count), section.count, folded, attrs);
  const note = !section.count && section.note ? `<p class="lb-section-note">${section.note}</p>` : '';
  return `${head}
    ${note}${section.count ? sectionBody(section.key, section.count, body ?? libraryShelf(section, ui), section.noun || 'book', folded, attrs) : ''}`;
}

// A saved chapter on the reference shelf: a book of its own. ui.spec: how it is set (cloth, size, title fit).
function libraryReferenceBook(b, ui) {
  const spec = (ui.spec || bookSpecOf)({ title: b.title, key: b.key, slices: b.slices, blocks: b.blocks });
  const bands = spec.blocks.map(t => `<span class="bd-spine-band" data-slice-type="${t}"></span>`).join('');
  return `
    <span class="lb-book" data-component="Library reference book" data-key="${b.id}" data-library-action="reference" data-ref="${b.id}" role="button" aria-label="${escapeHtml(b.title)}" style="width: ${spec.width}px; height: ${spec.height}px; --cloth-dark: ${spec.dark}; --cloth-light: ${spec.light}; --tilt: ${noteTilt(spec.key) * 0.6}deg">
      <span class="lb-book-title" style="font-size: ${spec.titleSize}px" title="${escapeHtml(spec.title)}">${spec.titleLines.map(escapeHtml).join('<br>')}</span>
      <span class="lb-book-bands">${bands}</span>
    </span>`;
}

// Chapters saved for reuse: one book each, on a shelf of their own
export function libraryReferenceShelf(reference, ui = {}) {
  const books = reference.books.map(b => libraryReferenceBook(b, ui)).join('');
  const shelf = `<div class="lb-case lb-ref-case">
      <section class="lb-shelf${reference.count ? '' : ' empty'}">
        <div class="lb-rail"><span class="lb-label"><span>Reference shelf</span></span></div>
        <div class="lb-bay">
          <div class="lb-books lb-ref-books">${books || '<span class="lb-empty">Save a chapter here from its menu, then add it to any model</span>'}</div>
        </div>
        <div class="lb-plank"></div>
      </section>
    </div>`;
  return librarySection({ key: 'reference', title: 'Reference shelf', countText: `${reference.count} saved`, count: reference.count,
    note: 'Save a chapter here from its menu, then add it to any model.' }, ui, shelf);
}
