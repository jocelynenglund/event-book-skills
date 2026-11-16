// ===========================================
// LITERATURE - Vote on chapters: screens (votes.js has the commands and views)
// Chapter page: a chapter (a door) as one story, its requirement (folded, Copy), its votes and your 👍,
//   ‹ › to the chapters beside it; a paragraph opens its own page (its comments). The owner edits the
//   requirement here. A reviewer sees the same page without the owner's tools.
// Votes sheet (Read and Outline, "👍 Votes"): the chapters by votes, each a tap to its page; Open / Close
//   voting (maybe until a time) and the tally as Markdown, for the owner.
// ===========================================

import { projectState } from '../../core/projections.js';
import { getCurrentModelId } from '../../core/eventStore.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { copyText } from '../../ui/clipboard.js';
import { render, showSlicePage, showChapterPage } from '../../ui/feed.js';
import { nickname, commentDeviceId } from '../comments/command.js';
import { reviewOf } from '../review/client.js';
import { isReadOnly } from '../readOnly/sheet.js';
import { setRequirement, castVote, withdrawVote, openVoting, closeVoting, voterOf } from './votes.js';
import { chapterVotes } from './chapterVotes.read.js';
import { votesSheet } from './votesSheet.read.js';
import { votesDownload } from './votesDownload.read.js';
import { chapterRequirement } from './chapterRequirement.read.js';
import { chapterPageHtml, votesSheetHtml } from './votes.parts.js';

const me = () => voterOf(reviewOf(getCurrentModelId()), commentDeviceId);
// The owner's tools: not on a reviewer's book, not read only
const owner = () => !reviewOf(getCurrentModelId()) && !isReadOnly();
let editing = false;   // the requirement being edited on the chapter page

export function renderChapterPage(chapterId) {
  const root = document.getElementById('sliceView');
  if (!root) return;
  const page = chapterVotes(projectState(), chapterId, { me: me(), owner: owner(), editing });
  root.innerHTML = page ? chapterPageHtml(page) : '<p class="sp-none sp-gone">This chapter is gone.</p>';
}

export function openVotesSheet() {
  openBoardSheet(votesSheetHtml(votesSheet(projectState(), { owner: owner() })));
}

function download(state) {
  const { file, markdown } = votesDownload(state);
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  a.click();
  URL.revokeObjectURL(url);
}

const done = (why, ok) => { if (why) { showToast(why); return false; } if (ok) showToast(ok); render(); return true; };

function handle(e) {
  const t = e.target.closest('[data-vote-action]');
  if (!t || t.disabled) return;
  const a = t.dataset.voteAction, chapterId = t.dataset.chapter;
  const state = projectState();
  if (a === 'go') { if (chapterId) { hideAllSheets(); editing = false; showChapterPage(chapterId); } return; }
  if (a === 'votes') return openVotesSheet();
  if (a === 'para') return showSlicePage(t.dataset.slice);
  if (a === 'copy') { copyText(chapterRequirement(state, chapterId)?.text || ''); showToast('Requirement copied'); return; }
  if (a === 'cast') return done(castVote({ chapterId, voterId: me(), nickname: nickname() || 'Someone', why: document.getElementById('vtWhy')?.value }), 'Voted 👍');
  if (a === 'withdraw') return done(withdrawVote({ chapterId, voterId: me() }), 'Vote taken back');
  if (a === 'req-edit') { editing = true; render(); document.getElementById('vtReq')?.focus(); return; }
  if (a === 'req-cancel') { editing = false; render(); return; }
  if (a === 'req-save') { const ok = done(setRequirement({ chapterId, text: document.getElementById('vtReq')?.value, by: nickname() || null })); if (ok) { editing = false; render(); } return; }
  if (a === 'close') { if (done(closeVoting({ by: nickname() || null }), 'Voting closed')) openVotesSheet(); return; }
  if (a === 'open') {
    const v = document.getElementById('vtUntil')?.value;
    if (done(openVoting({ by: nickname() || null, until: v ? new Date(v).toISOString() : null }), 'Voting open')) openVotesSheet();
    return;
  }
  if (a === 'export') download(state);
}

export function initVotes() {
  document.addEventListener('click', handle);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.lt-p[data-vote-action]')) { e.preventDefault(); e.target.click(); } });
}
