// ===========================================
// LITERATURE - The chapter page's and the votes sheet's parts, each drawn from its own view object
// votesChip, requirementBlock, requirementEditor, chapterNav, chapterHead, chapterPoints, voteBox,
// chapterPageHtml (the Chapter Votes view), votesRows, votesTools, votesSheetHtml (the Votes Sheet view).
// Nothing here reads the book. A root carries data-component and data-key.
// ===========================================

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// A requirement's own Markdown, read as text: **bold**, `code` (escaped first, so nothing else is HTML)
const inline = t => esc(t)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\n/g, '<br>');

// 👍 N on a chapter (Read's heading, the Outline's chapter row); nothing until somebody has voted
export function votesChip(votes) {
  return votes ? `<span class="vt-chip" data-component="Votes chip" data-key="votes" aria-label="${plural(votes, 'vote', 'votes')}">👍 ${votes}</span>` : '';
}

// The requirement as a folded block (open on the chapter page) with Copy
export function requirementBlock(req) {
  return `<details class="vt-req" data-component="Requirement" data-key="requirement-${req.chapterId}"${req.open ? ' open' : ''}><summary>Requirement</summary>
    <div class="vt-req-text">${req.rule.map(x => `<p>${inline(x)}</p>`).join('')}</div>${req.fine.length ? `<div class="vt-fine"><div class="vt-fine-label">Fine print</div>${req.fine.map(x => `<p>${inline(x)}</p>`).join('')}</div>` : ''}
    <button class="lt-tool vt-copy" data-vote-action="copy" data-chapter="${req.chapterId}">Copy</button></details>`;
}

// The owner's box for a chapter's requirement
export function requirementEditor(req) {
  return `<div class="vt-req-edit" data-component="Requirement editor" data-key="requirement-edit"><div class="bd-sheet-label">Requirement</div>
        <textarea class="sheet-input cm-box" id="vtReq" rows="5" placeholder="What this chapter asks for">${esc(req.text)}</textarea>
        <div class="cm-send-row"><button class="cm-btn quiet" data-vote-action="req-cancel">Cancel</button><button class="sheet-btn" data-vote-action="req-save" data-chapter="${req.chapterId}">Save</button></div></div>`;
}

// ‹ n / N › to the chapters beside this one
export function chapterNav(page) {
  const nav = page.nav;
  return `<nav class="sp-nav" data-component="Chapter nav" data-key="nav">
      <button class="sp-nav-btn" data-vote-action="go" data-chapter="${nav.prev || ''}" ${nav.prev ? '' : 'disabled'} aria-label="Previous chapter">‹</button>
      <span class="sp-pos">${nav.n} / ${nav.of}</span>
      <button class="sp-nav-btn" data-vote-action="go" data-chapter="${nav.next || ''}" ${nav.next ? '' : 'disabled'} aria-label="Next chapter">›</button>
    </nav>`;
}

// Its kicker (with the votes), its name, and the owner's requirement button
export function chapterHead(page) {
  return `<header class="sp-head lt-head" data-component="Chapter head" data-key="head">
      <div class="sp-kicker">Chapter · ${plural(page.votes, 'vote', 'votes')}</div>
      <h1 class="sp-title vt-title">${esc(page.name)}</h1>
      ${page.editLabel ? `<div class="sp-tools"><button class="sp-tool" data-vote-action="req-edit">${page.editLabel}</button></div>` : ''}
    </header>`;
}

// The chapter's paragraphs, each a tap to its page
export function chapterPoints(points) {
  if (!points.length) return '<p class="lt-empty" data-component="Chapter paragraphs" data-key="points">Nothing written in this chapter yet</p>';
  return points.map(x => `<p class="lt-p" data-component="Chapter paragraph" data-key="${x.sliceId}" role="button" tabindex="0" data-vote-action="para" data-slice="${x.sliceId}">${esc(x.text)}</p>`).join('');
}

// Vote for it (with a why), take it back, or voting is closed
export function voteBox(vote) {
  const body = vote.kind === 'closed' ? `<p class="vt-closed">Voting is closed${vote.myVote ? ' · you voted for it' : ''}</p>`
    : vote.kind === 'withdraw' ? `<button class="sheet-btn vt-vote on" data-vote-action="withdraw" data-chapter="${vote.chapterId}" aria-pressed="true">👍 You voted for it · take it back</button>`
    : `<input type="text" class="sheet-input vt-why" id="vtWhy" maxlength="280" placeholder="Why this one? (optional)" aria-label="Why this one (optional)">
         <button class="sheet-btn vt-vote" data-vote-action="cast" data-chapter="${vote.chapterId}" aria-pressed="false">👍 Vote for it</button>`;
  return `<section class="vt-box" data-component="Vote box" data-key="vote">${body}</section>`;
}

// The chapter page: nav, head, paragraphs, requirement, vote box
export function chapterPageHtml(page) {
  const req = !page.requirement ? '' : page.requirement.kind === 'edit' ? requirementEditor(page.requirement) : requirementBlock(page.requirement);
  return `
    ${chapterNav(page)}
    ${chapterHead(page)}
    <article class="lt-page vt-page">
      ${chapterPoints(page.points)}
      ${req}
      ${voteBox(page.vote)}
    </article>`;
}

// The chapters by votes, each a tap to its page
export function votesRows(rows) {
  return `<div class="vt-list" data-component="Votes rows" data-key="rows">${rows.map(c => `<button class="cm-goto vt-row" data-vote-action="go" data-chapter="${c.chapterId}">
      <span class="vt-rank">${c.rank}</span><span class="vt-row-name">${esc(c.name)}</span><span class="vt-row-n">👍 ${c.votes}</span></button>`).join('') || '<p class="cm-note">No chapters yet</p>'}</div>`;
}

// The owner's tools: open / close voting (maybe until a time) and the tally as Markdown
export function votesTools(tools) {
  if (!tools) return '';
  return `
    <div class="vt-tools" data-component="Votes tools" data-key="tools">
      ${tools.open ? '<button class="cm-btn" data-vote-action="close">Close voting</button>' : ''}
      <label class="bd-sheet-label" for="vtUntil">${tools.open ? 'Open until' : 'Open voting, until (optional)'}</label>
      <input type="datetime-local" class="sheet-input" id="vtUntil">
      <button class="cm-btn" data-vote-action="open">${tools.open ? 'Set the end' : 'Open voting'}</button>
      <button class="cm-btn" data-vote-action="export">Download the tally (Markdown)</button>
    </div>`;
}

// The votes sheet: title, status, rows, tools
export function votesSheetHtml(sheet) {
  return `
    <div class="sheet-title">Votes</div>
    <p class="cm-note vt-status">${esc(sheet.status)}</p>
    ${votesRows(sheet.rows)}
    ${votesTools(sheet.tools)}`;
}
