// ===========================================
// USAGE - Views
// SV: Slice Usage — a book that has an app's usage shows, on each slice (the board's header, the
// outline's row), how many of its events happened in the window: a badge, shaded by how busy it is
// next to the busiest slice; a slice with none says "unused in 30 days" (dashed).
// SV: Usage Insight — a build book's details sheet: "Built · Used" (what was built, the window, the
// busiest and the unused slices, the usage keys no event matches).
// ===========================================

import { getEventStream } from '../../core/eventStore.js';
import { latestUsage, sliceUsage, chapterUsage, heatOf, usageInsight, eventUsage, viewFedBy } from './rules.js';
import { escapeHtml } from '../board/view.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';

const cache = new WeakMap(); // projected state → its usage { usage, n, max } (one projection per render)
function usageOf(state) {
  if (!cache.has(state)) {
    const usage = latestUsage(getEventStream());
    const n = sliceUsage(state, usage);
    const chapters = chapterUsage(state, n);
    cache.set(state, { usage, n, max: Math.max(0, ...Object.values(n)), chapters, chapterMax: Math.max(0, ...Object.values(chapters)) });
  }
  return cache.get(state);
}

const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// The slice page: how much it was used, and where it stands among the slices ('' without usage)
export function sliceUsageLine(slice, state) {
  const { usage, n } = usageOf(state);
  if (usage && slice.type === 'SV') {
    const fed = viewFedBy(state, usage, slice.id);
    return fed.length ? `<p class="sp-usage fed">📊 A view counts nothing itself. Fed by ${fed.map(f => f.sliceId
      ? `<button class="sp-fed" data-slice-page="open" data-slice="${f.sliceId}">${escapeHtml(f.title)}</button> (${f.n})` : `${escapeHtml(f.title)} (${f.n})`).join(', ')} in the last ${usage.days || 30} days</p>` : '';
  }
  if (!usage || !(slice.id in n)) return '';
  const count = n[slice.id], days = usage.days || 30;
  if (!count) return `<p class="sp-usage unused">📊 Unused in the last ${days} days</p>`;
  const ranked = Object.values(n).filter(x => x > 0).sort((a, b) => b - a);
  const rank = ranked.indexOf(count) + 1;
  return `<p class="sp-usage">📊 <b>${count}</b> in the last ${days} days · ${rank === 1 ? 'the busiest' : `${ordinal(rank)} busiest`} of ${Object.keys(n).length} slices</p>`;
}

// An event sticky on the slice page: how many times it happened ('' without usage)
export function eventUsageChip(el, state) {
  const { usage } = usageOf(state);
  if (!usage || el.type !== 'event') return '';
  const count = eventUsage(usage, el.name);
  return `<span class="sp-used ${count ? '' : 'unused'}">${count ? `${count}× in ${usage.days || 30}d` : `none in ${usage.days || 30}d`}</span>`;
}

// A view has no count of its own: what feeds it ("fed by Add Wish (48), Create Party (130)")
const fedText = fed => fed.map(f => `${f.title} (${f.n})`).join(', ');
function fedBadge(slice, state, usage) {
  const fed = viewFedBy(state, usage, slice.id);
  if (!fed.length) return '';
  return `<span class="us-badge fed" title="Fed by ${escapeHtml(fedText(fed))} in the last ${usage.days || 30} days">fed by ${escapeHtml(fed[0].title)} ${fed[0].n}${fed.length > 1 ? ` +${fed.length - 1}` : ''}</span>`;
}

// A slice's badge ('' when the book has no usage)
export function usageBadge(slice, state) {
  const { usage, n, max } = usageOf(state);
  if (usage && slice.type === 'SV') return fedBadge(slice, state, usage);
  if (!usage || !(slice.id in n)) return '';
  const count = n[slice.id], days = usage.days || 30;
  const heat = heatOf(count, max);
  const title = `${count} ${count === 1 ? 'event' : 'events'} in the last ${days} days`;
  return count
    ? `<span class="us-badge" data-heat="${heat}" style="--heat: ${(heat / 4).toFixed(2)}; --fill: ${Math.max(6, Math.round(100 * count / max))}%" title="${title} · ${Math.round(100 * count / max)}% of the busiest slice">${count} in ${days}d</span>`
    : `<span class="us-badge unused" data-heat="0" title="${title}">unused in ${days} days</span>`;
}

const date = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString([], { day: 'numeric', month: 'short' }); };

// A book with usage: 📊 Used in the board's and the outline's bottom bar opens its stats
export const usageButton = events => latestUsage(events) ? '<button class="bd-fold-all" data-usage-stats>📊 Used</button>' : '';
export function initUsageStats() {
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-usage-stats]')) return;
    openBoardSheet(`<div class="sheet-title">Used</div>${usageFanfare(getEventStream())}`);
  });
  // A bar opens its slice's page
  document.addEventListener('click', async e => {
    const bar = e.target.closest('.uf-bar[data-slice]');
    if (!bar) return;
    hideAllSheets();
    (await import('../../ui/feed.js')).showSlicePage(bar.dataset.slice);
  });
}

// The details sheet's panel ('' for a book that isn't a build book)
export function usageSection(events) {
  const i = usageInsight(events);
  if (!i) return '';
  const u = i.usage;
  return `
    <div class="us-insight">
      <div class="ed-sheet-kicker">Built · Used</div>
      <p class="us-built"><b>Edition ${i.edition}${i.build != null ? ` · build ${escapeHtml(i.build)}` : ''} · ${escapeHtml(i.commit)}</b> <span>${i.slices} ${i.slices === 1 ? 'slice' : 'slices'} · ${i.scenarios} ${i.scenarios === 1 ? 'scenario' : 'scenarios'}</span></p>
      ${u ? `
      <p class="us-window">Used ${escapeHtml(date(u.since))} – ${escapeHtml(date(u.at))} · ${u.days} days</p>
      <p class="us-total"><b>${u.total}</b> events</p>
      ${i.busiest.length ? `<div class="us-sub">Top ${i.busiest.length}</div><ol class="us-busy">${i.busiest.map(b => `<li><span>${escapeHtml(b.title)}</span><b>${b.n}</b></li>`).join('')}</ol>` : ''}
      ${i.unused.length ? `<div class="us-sub">Unused in ${u.days} days</div><ul class="us-unused">${i.unused.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
      ${u.unmatched ? `<p class="us-unmatched">${u.unmatched} usage ${u.unmatched === 1 ? 'key matches' : 'keys match'} no event in the model.</p>` : ''}`
      : '<p class="us-none">No usage yet: the nightly job adds it.</p>'}
    </div>`;
}

// A folded chapter's spine: a little meter of its usage next to the busiest chapter's, its count under
// it; none is an empty dashed meter ('' when the book has no usage)
export function chapterMeter(chapter, state) {
  const { usage, chapters, chapterMax } = usageOf(state);
  if (!usage || !(chapter.id in chapters)) return '';
  const count = chapters[chapter.id], days = usage.days || 30;
  const title = `${count} ${count === 1 ? 'event' : 'events'} in the last ${days} days`;
  return `<span class="bd-spine-use" title="${title}"><span class="us-meter${count ? '' : ' empty'}" data-heat="${heatOf(count, chapterMax)}" style="--heat: ${(heatOf(count, chapterMax) / 4).toFixed(2)}">${count ? `<i style="height: ${Math.round(100 * count / chapterMax)}%"></i>` : ''}</span><span class="us-meter-n">${count}</span></span>`;
}

// One bar: the title over a track filled relative to the busiest, the count at its end
const bar = (title, n, max, slice = null) => {
  const heat = heatOf(n, max);
  return `<${slice ? `button data-slice="${escapeHtml(slice)}"` : 'div'} class="uf-bar${n ? '' : ' none'}" data-heat="${heat}" style="--heat: ${(heat / 4).toFixed(2)}">
    <span class="uf-label">${escapeHtml(title)}</span><span class="uf-track"><i style="width: ${max ? Math.round(100 * n / max) : 0}%"></i></span><b>${n}</b></${slice ? 'button' : 'div'}>`;
};

// 📊 Used: the window's total in big type, the busiest slices and the chapters as bars, the unused
// ones quietly, then the build ('' for a book that isn't a build book)
export function usageFanfare(events) {
  const i = usageInsight(events);
  if (!i) return '';
  const u = i.usage;
  const built = `<p class="us-built"><b>Edition ${i.edition}${i.build != null ? ` · build ${escapeHtml(i.build)}` : ''} · ${escapeHtml(i.commit)}</b> <span>${i.slices} ${i.slices === 1 ? 'slice' : 'slices'} · ${i.scenarios} ${i.scenarios === 1 ? 'scenario' : 'scenarios'}</span></p>`;
  if (!u) return `<div class="us-insight uf"><p class="us-none">No usage yet: the nightly job adds it.</p>${built}</div>`;
  const top = i.busiest[0]?.n || 0, topChapter = Math.max(0, ...i.chapters.map(c => c.n));
  return `
    <div class="us-insight uf">
      <p class="uf-total"><b>${u.total}</b> ${u.total === 1 ? 'event' : 'events'}</p>
      <p class="uf-window uf-sub-line">in the last ${u.days} days · ${escapeHtml(date(u.since))} – ${escapeHtml(date(u.at))}</p>
      ${i.busiest.length ? `<div class="us-sub uf-sub">Top ${i.busiest.length} ${i.busiest.length === 1 ? 'slice' : 'slices'}</div><div class="uf-top">${i.busiest.map(b => bar(b.title, b.n, top, b.sliceId)).join('')}</div>` : ''}
      ${i.chapters.length ? `<div class="us-sub uf-sub">By chapter</div><div class="uf-chapters">${i.chapters.map(c => bar(c.name, c.n, topChapter)).join('')}</div>` : ''}
      ${i.unused.length ? `<div class="us-sub uf-sub">Unused in ${u.days} days</div><ul class="us-unused">${i.unused.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
      ${u.unmatched ? `<p class="us-unmatched">${u.unmatched} usage ${u.unmatched === 1 ? 'key matches' : 'keys match'} no event in the model.</p>` : ''}
      ${built}
    </div>`;
}
