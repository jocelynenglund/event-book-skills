// ===========================================
// LITERATURE - The literature Outline's parts, each drawn from its piece of the Literature Outline view alone
// outlineToolbar, outlineChapter, outlineCard, outlineEmpty, literatureOutlineHtml (the whole Outline).
// Nothing here reads the book. A root carries data-component and data-key.
// ===========================================

import { plural, commentMark, commentButton, commentLines, sentenceList, roundsBanner, unsentNote, suggestionsBar } from './marks.parts.js';
import { votesChip } from './votes.parts.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The book's title (its menu), the totals, the open comments and 👍 Votes
export function outlineToolbar(o) {
  return `<div class="ol-toolbar" data-component="Outline toolbar" data-key="toolbar">
        <button class="bd-book-title lt-book-title" data-book-title title="This book: approve structure, name, preface, book id…"><span aria-hidden="true">⋮</span> ${esc(o.title)}</button>
        <span class="ol-total">${plural(o.total.paragraphs, 'paragraph', 'paragraphs')} · ${plural(o.total.sentences, 'sentence', 'sentences')}</span>
        ${o.openComments ? `<button class="ol-select ol-cm-next" data-lit-action="next-comment">💬 ${o.openComments} open</button>` : ''}
        ${o.votes ? '<button class="ol-select vt-top" data-vote-action="votes">👍 Votes</button>' : ''}
      </div>`;
}

// A paragraph's card: its number (a tap opens it), comment mark, move / gap / park tools, its sentences, refined, comments
export function outlineCard(c) {
  const tools = c.parked
    ? `<button class="lt-tool" data-lit-action="unpark" data-slice="${c.sliceId}">↩ Unpark</button>`
    : `<button class="lt-tool" aria-label="Move up" data-lit-action="up" data-slice="${c.sliceId}" ${c.first ? 'disabled' : ''}>↑</button>
       <button class="lt-tool" aria-label="Move down" data-lit-action="down" data-slice="${c.sliceId}" ${c.last ? 'disabled' : ''}>↓</button>
       <button class="lt-tool" data-lit-action="gap" data-slice="${c.sliceId}">＋ Gap</button>
       <button class="lt-tool" data-lit-action="park" data-slice="${c.sliceId}">Park</button>`;
  const refined = `<button class="ol-gwt-toggle ol-refined-pill lt-refined ${c.refined ? 'on' : ''}" data-lit-action="refined" data-slice="${c.sliceId}" aria-pressed="${c.refined}"
    aria-label="${c.refined ? 'Refined: tap to take it back' : 'Mark refined'}"><span class="ol-tick" aria-hidden="true"></span>Refined</button>`;
  return `
    <article class="lt-point ${c.parked ? 'parked' : ''}" data-component="Outline card" data-key="${c.sliceId}" data-slice="${c.sliceId}">
      <div class="lt-point-head">
        <button class="lt-point-open" data-lit-action="open" data-slice="${c.sliceId}" aria-label="Open this paragraph">${c.parked ? 'Parked' : `¶ ${c.n}`}${c.name ? ` · ${esc(c.name)}` : ''} ↗</button>
        ${c.parked ? '' : commentMark(c.mark)}
        <span class="lt-tools">${tools}</span>
      </div>
      ${c.parked ? `<p class="lt-snippet">${esc(c.snippet)}</p>` : sentenceList(c.body)}
      ${c.parked ? '' : `<div class="lt-point-foot">${refined}${commentButton(c.comment)}</div>${commentLines(c.comment)}`}
    </article>`;
}

// A chapter: its row (name a button to its page, votes, requirement mark, count) and its cards
export function outlineChapter(ch) {
  const row = ch.name === null ? '' : `<div class="ol-chapter">${ch.parked ? `<span class="ol-chapter-name">${esc(ch.name)}</span>` : `<button class="ol-chapter-name lt-chapter-btn" data-vote-action="go" data-chapter="${ch.chapterId}">${esc(ch.name)}</button>${votesChip(ch.votes)}`}${ch.hasRequirement ? '<span class="vt-has-req" title="Has a requirement">◆ requirement</span>' : ''}<span class="ol-count">${plural(ch.count, 'paragraph', 'paragraphs')}</span></div>`;
  return `<section class="ol-section lt-outline-section" data-component="Outline chapter" data-key="${ch.chapterId || 'story'}">
      ${row}
      ${ch.points.map(outlineCard).join('')}
      ${ch.points.length ? '' : '<div class="ol-empty">Nothing here</div>'}
    </section>`;
}

// A book with nothing in it: take a draft in
export function outlineEmpty(empty) {
  return `<div class="ol-empty" data-component="Outline empty" data-key="empty">Nothing here yet. ☰ → Import… brings in a Markdown draft${empty.canPaste ? ', or <button class="lt-link" data-lit-action="paste">paste one</button>' : ''}.</div>`;
}

// The whole Outline
export function literatureOutlineHtml(o) {
  return `
    <div class="lt-outline">
      ${outlineToolbar(o)}
      ${suggestionsBar(o.suggestions)}
      ${roundsBanner(o.rounds)}
      ${unsentNote(o.unsent)}
      ${o.chapters.map(outlineChapter).join('') || (o.empty ? outlineEmpty(o.empty) : '')}
    </div>`;
}
