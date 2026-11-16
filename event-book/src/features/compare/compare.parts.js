// ===========================================
// COMPARE - Parts of the "Plan vs built" page, each drawn from its piece of Compare Page alone (or, for the
// picker's choices, Compare Picker). A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A line of the compare, as the outline reads: − only on the left (planned, not built),
// + only on the right, nothing for what both have. Muted red and green, no other marks.
const mark = t => t === '−' ? 'minus' : t === '+' ? 'plus' : t === '⏳' ? 'pending' : '';
const line = (t, html, extra = '') => `<div class="cp-line ${mark(t)}${extra}"><i>${t === '=' ? '' : t}</i><span>${html}</span></div>`;

// The title and the summary under it
export function compareHeading(page) {
  const { labels } = page;
  return `
      <div data-component="Compare heading" data-key="heading">
      <div class="sp-kicker">Compare</div>
      <h1 class="cp-h1">${escapeHtml(labels.a)}${page.hint ? ' <small class="cp-hint">this one</small>' : ''} <span>↔</span> ${escapeHtml(labels.b)}</h1>
      ${labels.books || labels.detail ? `<p class="cp-books">${escapeHtml(labels.books)}${labels.books && labels.detail ? ' · ' : ''}${labels.detail ? `<span>${escapeHtml(labels.detail)}</span>` : ''}</p>` : ''}
      <p class="cp-sum">${escapeHtml(page.summaryLine)}</p>
      </div>`;
}

// A filter chip (a chip of Compare Page): tap to show only those slices, again to show all
export function compareChip(chip) {
  return `<button class="cp-chip ${chip.on ? 'on' : ''}" data-component="Compare chip" data-key="${chip.key}" data-compare-filter="${chip.key}" ${chip.disabled ? 'disabled' : ''}>${escapeHtml(chip.text)}</button>`;
}

// The refined slices the other shelf has, offered as done to confirm (null: nothing to confirm)
export function compareConfirmDone(confirm) {
  if (!confirm) return '';
  return `
      <div class="cp-done" data-component="Compare confirm done" data-key="confirm">
        <p class="cp-done-note">${escapeHtml(confirm.note)}</p>
        <ul class="cp-done-list">${confirm.titles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        ${confirm.publishLabel ? `<label class="cp-publish"><input type="checkbox" id="cpPublish"> ${escapeHtml(confirm.publishLabel)}</label>` : ''}
        <button class="cp-done-btn" data-compare-action="confirm-done">${escapeHtml(confirm.confirmLabel)}</button>
        <button class="cp-keep-btn" data-compare-action="keep-planned">Keep as planned</button>
      </div>`;
}

// Integration events whose contract changed between the two books (Compare Contract; null: none)
export function compareContractWarning(contract) {
  if (!contract) return '';
  return `
      <div class="cp-contract" data-component="Compare contract warning" data-key="contract" role="alert">
        <div class="cp-contract-title">${escapeHtml(contract.title)}</div>
        <ul class="cp-contract-list">${contract.lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
      </div>`;
}

export const compareChangeButton = () => `<button class="cp-change" data-component="Compare change button" data-key="change" data-compare-action="change">Compare with another book…</button>`;

// A possible rename: the same slice under another name? Answered on the open shelf only
function maybe(m) {
  const data = `data-slice="${escapeHtml(m.slice)}" data-other-shelf="${escapeHtml(m.otherShelf)}" data-other-name="${escapeHtml(m.otherName)}"`;
  return `
    <p class="cp-note cp-maybe-note">Maybe renamed: <b>${escapeHtml(m.from)}</b> → <b>${escapeHtml(m.to)}</b>${m.inChapter ? ` <span>(in ${escapeHtml(m.inChapter)})</span>` : ''}</p>
    <div class="cp-scns">${line('−', escapeHtml(m.from))}${line('+', escapeHtml(m.to))}</div>
    <div class="cp-maybe-actions">
      <button class="cp-maybe-btn same" data-compare-action="same" ${data} ${m.decidable ? '' : 'disabled'}>Same slice</button>
      <button class="cp-maybe-btn" data-compare-action="apart" ${data} ${m.decidable ? '' : 'disabled'}>Different</button>
    </div>
    ${m.readOnlyNote ? `<p class="cp-note">${escapeHtml(m.readOnlyNote)}</p>` : ''}`;
}

function mismatch(m) {
  const cls = { '=': '', '−': 'minus', '+': 'plus' };
  return `<div class="cp-diff">
    <div class="cp-diff-part"><b>${m.part}</b></div>
    <ul class="cp-diff-lines">${m.lines.map(l => `<li class="${cls[l.t]}${l.none ? ' none' : ''}"><i>${l.t === '=' ? '' : l.t}</i>${escapeHtml(l.v)}</li>`).join('')}</ul>
  </div>`;
}

// One slice of the compare: its notes, its scenarios (the ones in both plain, the ones only on the left −, a
// differing one with its lines), what only the right has, and its fields
export function compareRow(r) {
  const parts = [];
  if (r.maybe) parts.push(maybe(r.maybe));
  else if (r.renamedNote) parts.push(`<p class="cp-note">${escapeHtml(r.renamedNote)}</p>`);
  if (r.chapterNote) parts.push(`<p class="cp-note">${escapeHtml(r.chapterNote)}</p>`);
  if (r.scenarios.length) parts.push(`<div class="cp-scns">${r.scenarios.map(x => `
    <div class="cp-scn ${x.kind}">
      ${line(x.sign, `${x.star} ${escapeHtml(x.name)}${x.notPassingYet ? ' <span class="cp-tag">not passing yet</span>' : ''}`)}
      ${x.mismatches.map(mismatch).join('')}
    </div>`).join('')}</div>`);
  if (r.extraFolded) parts.push(`<details class="cp-extra plus"><summary>${escapeHtml(r.extraFolded.summary)}</summary>
    ${r.extraFolded.lines.map(t => line('+', escapeHtml(t))).join('')}</details>`);
  if (r.extraLines.length) parts.push(r.extraLines.map(t => line('+', escapeHtml(t))).join(''));
  if (r.fieldsMissing) parts.push(`<p class="cp-fields minus"><span class="cp-tag">${escapeHtml(r.fieldsMissing.tag)}</span>${r.fieldsMissing.fields.map(f => `<code>${escapeHtml(f)}</code>`).join(' ')}</p>`);
  if (r.fieldsExtra) parts.push(`<p class="cp-fields plus"><span class="cp-tag">${escapeHtml(r.fieldsExtra.tag)}</span>${r.fieldsExtra.fields.map(f => `<code>${escapeHtml(f)}</code>`).join(' ')}</p>`);
  return `
    <article class="cp-row ${mark(r.sign)}" data-component="Compare row" data-key="${escapeHtml(r.key)}" data-status="${r.status}">
      <div class="cp-head"><i class="cp-sign">${r.sign}</i><span class="cp-dot" data-slice-type="${r.type}"></span>
        <span class="cp-title">${escapeHtml(r.title)}</span><span class="cp-kind">${r.kind}</span></div>
      ${parts.join('')}
    </article>`;
}

// A shelf the plan can be compared with (a choice of Compare Picker): tap to compare
export function comparePick(c) {
  return `
      <button class="share-scope-option cp-pick" data-component="Compare pick" data-key="${escapeHtml(c.id)}" data-search="${escapeHtml(c.search)}" data-compare-with="${escapeHtml(c.builtId)}" data-plan="${escapeHtml(c.planId)}"><b>${escapeHtml(c.name)}${c.last ? ' <span class="dt-move-meta">last time</span>' : ''}</b><span class="cp-pick-meta">${escapeHtml(c.meta)}</span></button>`;
}
