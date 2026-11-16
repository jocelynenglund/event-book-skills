// ===========================================
// LITERATURE - The Read screen's parts, each drawn from its piece of the Reading Page view alone
// readTitle, readStandfirst, readTopRow, readParagraph, readSection, readPlan, readEmpty, readFooter,
// readArticle (the whole page). Nothing here reads the book. A root carries data-component and data-key.
// ===========================================

import { plural, paragraphRuns, commentMark, acceptSkip, roundsBanner, unsentNote, suggestionsBar } from './marks.parts.js';
import { votesChip, requirementBlock } from './votes.parts.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The title: a tap opens the book's menu
export function readTitle(page) {
  return `<h1 class="lt-title" data-component="Read title" data-key="title"><button class="lt-title-btn" data-book-title title="This book: approve structure, name, preface, book id…">${esc(page.title)}</button></h1>`;
}

export function readStandfirst(page) {
  return page.standfirst ? `<p class="lt-standfirst" data-component="Read standfirst" data-key="standfirst">${esc(page.standfirst)}</p>` : '';
}

// 💬 N open comments, and 👍 Votes when there are several chapters
export function readTopRow(top) {
  if (!top) return '';
  return `<div class="lt-top-row" data-component="Read top row" data-key="top">${top.comments ? `<button class="lt-cm-top" data-lit-action="next-comment">💬 ${plural(top.comments, 'open comment', 'open comments')}</button>` : ''}${top.votes ? '<button class="lt-cm-top vt-top" data-vote-action="votes">👍 Votes</button>' : ''}</div>`;
}

// One paragraph of the story: a heading, an asked gap (a quiet question), or the words with their marks; each a tap to its page
export function readParagraph(p) {
  const open = `role="button" tabindex="0" data-lit-action="open" data-slice="${p.sliceId}"`;
  if (p.kind === 'heading') return `<h2 class="lt-h2 lt-pointhead" data-component="Read paragraph" data-key="${p.sliceId}" ${open}>${esc(p.text)}</h2>`;
  if (p.kind === 'gap') return `<p class="lt-gap" data-component="Read paragraph" data-key="${p.sliceId}" ${open}>[${esc(p.gap)}]</p>`;
  return `<p class="lt-p" data-component="Read paragraph" data-key="${p.sliceId}" ${open}>${paragraphRuns(p.runs, true)}${commentMark(p.mark)}</p>${acceptSkip(p.fixes)}`;
}

// A chapter: its heading (a button to its page, with its votes), its paragraphs, its requirement
export function readSection(s) {
  const heading = !s.heading ? '' : s.chapterId
    ? `<h2 class="lt-h2"><button class="lt-chapter-btn" data-vote-action="go" data-chapter="${s.chapterId}">${esc(s.heading)}</button>${votesChip(s.votes)}</h2>`
    : `<h2 class="lt-h2">${esc(s.heading)}</h2>`;
  return `
    <section class="lt-section" data-component="Read section" data-key="${s.chapterId || 'story'}">
      ${heading}
      ${s.paragraphs.map(readParagraph).join('')}
      ${s.requirement ? requirementBlock(s.requirement) : ''}
    </section>`;
}

// An outline nobody has written yet: what the piece will say, and what waits on her
export function readPlan(plan) {
  return `<p class="lt-empty lt-outline-note" data-component="Read plan" data-key="plan">${esc(plan.note)}</p>
    ${plan.groups.map(g => `
    <section class="lt-section lt-outline">
      ${g.heading ? `<h2 class="lt-h2">${esc(g.heading)}</h2>` : ''}
      ${g.points.map(p => `<div class="lt-point-plan" role="button" tabindex="0" data-lit-action="open" data-slice="${p.sliceId}">
        <b>${esc(p.title)}</b>${p.description ? `<span>${esc(p.description)}</span>` : ''}</div>`).join('')}
    </section>`).join('')}`;
}

// A book with nothing in it: take a draft in
export function readEmpty(empty) {
  return `<p class="lt-empty" data-component="Read empty" data-key="empty">Nothing to read yet. ☰ → Import… brings in a Markdown draft${empty.canPaste ? ', or <button class="lt-link" data-lit-action="paste">paste one</button>' : ''}.</p>`;
}

// Paragraphs, words, what is still to fill and open
export function readFooter(foot) {
  return `<footer class="lt-foot" data-component="Read footer" data-key="foot">${plural(foot.paragraphs, 'paragraph', 'paragraphs')} · ${plural(foot.words, 'word', 'words')}${foot.gaps ? ` · ${plural(foot.gaps, 'gap', 'gaps')} to fill` : ''}${foot.emptyPoints ? ` · ${plural(foot.emptyPoints, 'empty point', 'empty points')}` : ''}${foot.comments ? ` · <button class="lt-link" data-lit-action="next-comment">💬 ${foot.comments} open</button>` : ''}</footer>`;
}

// The whole Read page
export function readArticle(page) {
  const body = page.sections.map(readSection).join('') || (page.plan ? readPlan(page.plan) : '') || (page.empty ? readEmpty(page.empty) : '');
  return `
    <article class="lt-read">
      ${readTitle(page)}
      ${roundsBanner(page.rounds)}
      ${unsentNote(page.unsent)}
      ${readStandfirst(page)}
      ${suggestionsBar(page.suggestions)}
      ${readTopRow(page.top)}
      ${body}
      ${readFooter(page.foot)}
    </article>`;
}
