// ===========================================
// LITERATURE - Parts shared by Read, the Outline and the Point page, each drawn from its own view object
// commentMark(mark), commentButton(comment), commentLines(comment), acceptSkip(fixes), paragraphRuns(runs),
// sentenceList(body), roundsBanner(rounds), unsentNote(unsent), suggestionsBar(suggestions).
// Nothing here reads the book. A root carries data-component and data-key.
// ===========================================

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// A run of a paragraph: plain words, a heading, or a suggested edit (struck, inserted, numbered when it is)
const runHtml = r => r.heading !== undefined ? `<strong class="lt-headline">${esc(r.heading)}</strong>`
  : r.find !== undefined ? `<del class="lt-del">${esc(r.find)}</del>${r.replace ? `<ins class="lt-ins">${esc(r.replace)}</ins>` : ''}${r.n != null ? `<sup class="lt-sn" aria-label="Suggestion ${r.n}">${r.n}</sup>` : ''}`
  : esc(r.text);

// A paragraph's (or a sentence's) words, with its suggested edits marked
export const paragraphRuns = (runs, sentences = false) => sentences ? runs.map(s => s.map(runHtml).join('')).join(' ') : runs.map(runHtml).join('');

// A paragraph's comment mark: 💬 N open, a tap to the first open thread; 💬 N resolved when all are
export function commentMark(mark) {
  if (!mark) return '';
  if (!mark.open) return `<span class="lt-mark done" data-component="Comment mark" data-key="mark" aria-label="${plural(mark.resolved, 'resolved comment', 'resolved comments')}">💬 ${mark.resolved} resolved</span>`;
  return `<button class="lt-mark open" data-component="Comment mark" data-key="mark" data-lit-action="comment" data-slice="${mark.sliceId}"${mark.first?.sentenceId ? ` data-sentence="${mark.first.sentenceId}"` : ''}
    aria-label="${plural(mark.open, 'open comment', 'open comments')}">💬 ${mark.open}</button>`;
}

// 💬 beside a sentence (or a paragraph): its open comments' count; tap for the thread
export function commentButton(c) {
  const label = c.sentenceId ? 'Comment on this sentence' : 'Comment on this paragraph';
  return `<button class="ol-cm lt-cm ${c.open ? 'has' : ''}" data-component="Comment button" data-key="comment" data-lit-action="comment" data-slice="${c.sliceId}"${c.sentenceId ? ` data-sentence="${c.sentenceId}"` : ''}
    aria-label="${c.open ? plural(c.open, 'open comment', 'open comments') : label}">💬${c.open ? ` ${c.open}` : ''}</button>`;
}

// The open comments, one line each, right under what they are on
export function commentLines(c) {
  if (!c.lines.length) return '';
  return `<div class="ol-cm-list lt-cm-list" data-component="Comment lines" data-key="comments">${c.lines.map(l => `
    <button class="ol-cm-line" data-lit-action="comment" data-slice="${c.sliceId}"${c.sentenceId ? ` data-sentence="${c.sentenceId}"` : ''} data-cm-anchor="${l.commentId}">
      <b>${esc(l.nickname)}</b> ${esc(l.text)}
    </button>`).join('')}</div>`;
}

// Accept / Skip right where the suggestions are: numbered only when there is more than one
export function acceptSkip(fixes) {
  if (!fixes) return '';
  return `<div class="lt-sugg-here" data-component="Accept or skip" data-key="fixes-${fixes.sliceId}">${fixes.ns.map(n => {
    const label = fixes.many ? ` ${n}` : '';
    return `<button class="lt-tool lt-accept" data-lit-action="accept-one" data-n="${n}" data-slice="${fixes.sliceId}">Accept${label}</button><button class="lt-tool" data-lit-action="skip-one" data-n="${n}" data-slice="${fixes.sliceId}">Skip${label}</button>`;
  }).join('')}</div>`;
}

// A point's sentences, each with its 💬; or, with none, what the point has instead (written, a gap, a thought)
export function sentenceList(body) {
  if (body.kind === 'gap') return `<p class="lt-gap-q" data-component="Point gap question" data-key="gap">${esc(body.question)}</p>`;
  if (body.kind === 'written') return `<p class="lt-written ol-para" data-component="Point written" data-key="written">${esc(body.text)}</p>`;
  if (body.kind === 'thought') return `<p class="lt-thought" data-component="Point thought" data-key="thought">${esc(body.thought)}</p><p class="lt-empty">Not written yet</p>`;
  if (body.kind === 'empty') return '<p class="lt-empty" data-component="Point empty" data-key="empty">Nothing written here yet</p>';
  return `<ol class="lt-sentences" data-component="Point sentences" data-key="sentences">${body.sentences.map(s => `
    <li class="lt-sentence" data-sentence="${s.id}"><span class="lt-sentence-row"><span class="lt-sentence-text">${paragraphRuns(s.runs)}</span>${commentButton(s.comment)}</span>${acceptSkip(s.fixes)}${commentLines(s.comment)}</li>`).join('')}</ol>`;
}

// Where the book is in its two rounds; while the structure waits, the banner approves it
export function roundsBanner(rounds) {
  if (!rounds) return '';
  const go = rounds.approve ? ` <button class="ol-rounds-go" data-title-action="structure">Approve structure</button>` : '';
  return `<div class="ol-verify ol-rounds" data-component="Rounds banner" data-key="rounds">${esc(rounds.text)}${go}</div>`;
}

// This device's comments the server hasn't got yet, why the last send failed, and Send now
export function unsentNote(unsent) {
  if (!unsent) return '';
  const why = unsent.why ? ` <span class="lt-unsent-why">${esc(unsent.why)}</span>` : '';
  return `<div class="lt-unsent" data-component="Unsent comments" data-key="unsent" role="status">⏳ ${plural(unsent.n, 'comment', 'comments')} not sent yet${why}
    <button class="lt-link" data-lit-action="send-now">Send now</button></div>`;
}

// "3 suggestions · skip [2,5] · All in": all open ones, or all but the numbers typed (those are closed)
export function suggestionsBar(suggestions) {
  if (!suggestions) return '';
  return `<div class="lt-sugg-bar" data-component="Suggestions bar" data-key="suggestions"><span class="lt-sugg-count">${plural(suggestions.n, 'suggestion', 'suggestions')}</span>
    <input class="lt-skip" type="text" inputmode="numeric" placeholder="skip 2,5" aria-label="Numbers to skip">
    <button class="lt-allin" data-lit-action="all-in">All in</button></div>`;
}
