// ===========================================
// EVENTPAD - Main Entry Point
// ===========================================

import { initStore, loadEventStream, getCurrentModelId, storageUsage } from './core/eventStore.js';
import { formatBytes } from './ui/bytes.js';
import { initSheets, showSheet, hideAllSheets } from './ui/sheets.js';
import { initReferences } from './features/references/sheet.js';
import { render as renderFeed, toggleDetailsView, setOverviewTab, showSliceOnBoard, getView, showLibrary, showBoard, showOutline, showStart, showSlicePage, leaveSlicePage, wasInLibrary, isNewVisit, onRender } from './ui/feed.js';

// Features
import { showActions } from './features/connect/actionSheet.js';
import { dispatchConnection } from './features/connect/command.js';
import { showPicker, pickElement, showSVPicker, pickSVTrigger, showMultiPicker, toggleMultiPickerItem, confirmMultiPick, createNewFromPicker, createNewProducerEvent, showSCPicker, createNewSCCommand, pickSCSlice, showDirectPicker, pickScreenForSlice, createScreenForSlice } from './features/connect/pickers.js';
import { initBoard, openChapterPicker, toggleFabMenu, openUpdatedByPicker, openProcessorInputs } from './features/board/sheets.js';
import { initDetails } from './features/details/view.js';
import { initOutline } from './features/outline/view.js';
import { initComments } from './features/comments/sheet.js';
import { initReviewClient } from './features/review/client.js';
import { initReviewView, updateReviewChip } from './features/review/view.js';
import { initSharedClient, sharedOf } from './features/shared/client.js';
import { initStatusFilter } from './features/filter/status.js';
import { initUsageStats } from './features/usage/view.js';
import { initSettings, settingsHtml } from './ui/settings.js';
import { exportNotation } from './features/export/notation.js';
import { reviewOf, canAddScenariosHere } from './features/review/client.js';
import { readyToChange } from './features/sync/client.js';
import { openModelNameSheet } from './features/board/sheets.js';
import { showToast as toastTitle } from './ui/toast.js';
import { account, isKept, isReviewerAccount, keepOnServer } from './features/sync/client.js';

// The book's own menu (⋮ by its title): its name and description; and, for a library book,
// who reviews it (People…) and review / verify links. A book only on this device can be kept
// in the library from here (signing in first if need be), and then those are there too.
function openTitleMenu() {
  const id = getCurrentModelId();
  const inLibrary = isKept(id) && account() && !isReviewerAccount();
  const canKeep = !isKept(id) && !isReviewerAccount();
  const follows = followMenu();
  const option = (action, icon, title, desc, attr = 'data-title-action') => `
    <div class="sheet-option" ${attr}="${action}" data-model="${id}">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">${icon}</div>
      <div class="sheet-option-text"><div class="sheet-option-title">${title}</div><div class="sheet-option-desc">${desc}</div></div>
    </div>`;
  openBoardSheet(`
    <div class="sheet-title">This book</div>
    ${option('name', '✏️', 'Name &amp; description', 'What it is called and what it is for')}
    ${inLibrary ? option('people', '👥', 'People…', 'Invite reviewers by email; who has joined; remove') : ''}
    ${inLibrary ? option('review', '↗', 'Review &amp; verify…', 'A link for someone without an account: review the plan, or verify the shipped app') : ''}
    ${!isOpenBuild() ? '' : option('plan', '📝', 'Start a plan from this build', 'A new book, its start the build’s model, that follows the app’s build')}
    ${!follows ? '' : follows.following
      ? option('unfollow', '⏹', `Stop following ${escapeHtml(follows.app)}’s build`, 'What is Done stays as it is')
      : option('follow', '🔗', `Follow ${escapeHtml(follows.app || 'an app')}’s build`, 'Each new build marks the slices it has as Done')}
    ${!canKeep ? '' : account()
      ? option('keep', '☁', 'Keep in your library', 'Saved to the server and checked out here; then invite reviewers and send review links')
      : option('keep', '☁', 'Sign in to keep it in your library', 'Then invite reviewers and send review links', 'data-sync-action')}
    ${option('close', '▤', 'Close the book', 'Back to the bookshelves')}`);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-title-action]');
  if (!t) return;
  const id = getCurrentModelId();
  const a = t.dataset.titleAction;
  hideAllSheets();
  if (a === 'close') window.EventPad.showLibrary();
  else if (a === 'name') readyToChange(id).then(why => why ? toastTitle(why) : setTimeout(() => openModelNameSheet(), 150));
  else if (a === 'people') setTimeout(() => document.dispatchEvent(new CustomEvent('eventpad:people', { detail: id })), 150);
  else if (a === 'review') setTimeout(() => document.dispatchEvent(new CustomEvent('eventpad:reviews', { detail: id })), 150);
  else if (a === 'follow' || a === 'unfollow') readyToChange(id).then(why => why ? toastTitle(why) : a === 'follow' ? followFromMenu() : stopFollowing());
  else if (a === 'plan') startPlan().then(why => why ? toastTitle(why) : window.EventPad.showOutline());
  else if (a === 'keep') keepOnServer(id)
    .then(r => { toastTitle(`Kept in your library${r?.up ? ` (${r.up} events sent)` : ''}`); setTimeout(openTitleMenu, 150); })
    .catch(err => toastTitle(err.message || 'Could not keep it: try again'));
});
import { initPeopleView } from './features/shared/view.js';
import { initSlicePage } from './features/slicePage/view.js';
import { initLive } from './features/live/live.js';
import { initCompare, openComparePicker } from './features/compare/view.js';
import { initSync } from './features/sync/client.js';
import { initSyncView, updateCheckoutBanner } from './features/sync/view.js';
import { openBoardSheet } from './features/board/sheets/shared.js';
import { showCompare } from './ui/feed.js';
import { openReplay } from './features/replay/replay.js';
import { initLibrary } from './features/library/view.js';
import { initBuildVersions } from './features/buildVersions/view.js';
import { initFollow, followMenu, followFromMenu, stopFollowing, isOpenBuild, startPlanFromThisBuild as startPlan } from './features/buildVersions/follow.js';
import { escapeHtml } from './features/board/view.js';
import { initShareImage } from './features/shareImage/sheet.js';
import { initShareLink } from './features/shareLink/link.js';
import { promptSliceName, dispatchNameSlice, dismissSlicePrompt, initNameSlice } from './features/nameSlice/sheet.js';
import { undo, clearAll } from './features/undo/command.js';
import { toggleEventLog, copyEvent, copyAllEvents, exportModel, importModel } from './features/eventLog/panel.js';
import { exportForEventmodelers } from './features/eventmodelers/export.js';
import { openPropertySheet, saveProperty, deleteProperty, initProperties, confirmPropagate, skipPropagate } from './features/properties/sheet.js';
import { deleteElement } from './features/deleteElement/command.js';
import { openElementMenu, menuRename, menuProperties, menuConnect, menuDelete, menuRemoveFromSlice, menuToggleExternal, menuToggleTrigger, menuToggleTodo, menuToggleList, menuUpdatedBy, menuProcessorInputs, menuShowElement, menuSetElementFlow } from './features/elementMenu/sheet.js';
import { 
  openAddScenarioSheet, 
  openEditScenarioSheet, 
  submitAddScenario, 
  saveScenario, 
  deleteScenario, 
  initScenarios,
  toggleGivenEvent,
  givenAdd,
  givenAgain,
  givenRemove,
  thenRowAdd,
  thenRowRemove,
  propItemAdd,
  selectWhenCommand,
  selectThenType,
  selectThenEvent,
  selectThenReadModel
} from './features/scenarios/sheet.js';
import { projectState } from './core/projections.js';
import { isReadOnly } from './features/readOnly/sheet.js';
import { openScenariosSheet } from './features/board/sheets/scenarios.js';

// ===========================================
// GLOBAL API (for onclick handlers in HTML)
// ===========================================

window.EventPad = {
  // connect
  showActions,
  dispatchConnection,
  showPicker,
  pickElement,
  showSVPicker,
  pickSVTrigger,
  showMultiPicker,
  toggleMultiPickerItem,
  confirmMultiPick,
  createNewFromPicker,
  createNewProducerEvent,
  showSCPicker,
  createNewSCCommand,
  pickSCSlice,
  newChapter: () => openChapterPicker(null),
  showSliceOnBoard,
  openUpdatedByPicker,
  openProcessorInputs,
  showLibrary,
  showBoard,
  showOutline,
  showStart,
  showDirectPicker,
  
  // nameSlice
  promptSliceName,
  dispatchNameSlice,
  dismissSlicePrompt,
  
  // undo
  undo,
  clearAll,
  
  // eventLog
  toggleEventLog,
  copyEvent,
  copyAllEvents,
  exportModel,
  exportForEventmodelers,
  importModel,
  
  // feed
  
  // properties
  openPropertySheet,
  saveProperty,
  deleteProperty,
  confirmPropagate,
  skipPropagate,
  
  // deleteElement
  deleteElement,
  
  // elementMenu
  openElementMenu,
  menuRename,
  menuProperties,
  menuConnect,
  menuDelete,
  menuRemoveFromSlice,
  menuToggleExternal,
  menuToggleTrigger,
  menuToggleTodo,
  menuToggleList,
  menuUpdatedBy,
  menuProcessorInputs,
  menuShowElement,
  menuSetElementFlow,
  
  // slices
  addScreenToSlice: (sliceId) => {
    import('./features/connect/pickers.js').then(({ showAddScreenToSlice }) => {
      showAddScreenToSlice(sliceId);
    });
  },
  pickScreenForSlice,
  createScreenForSlice,

  exportNotation,
  // burger
  openSettings: () => openBoardSheet(settingsHtml()),
  showAbout: () => {
    showSheet('aboutSheet');
    const el = document.getElementById('aboutUsage');
    if (el) storageUsage().then(n => { el.textContent = `Using ${formatBytes(n)} on this device.`; }).catch(() => {});
  },
  // ☰ → Export…: the three ways, each saying what it's for
  openExport: () => openBoardSheet(`
    <div class="sheet-title">Export</div>
    <div class="sheet-options">
      <div class="sheet-option" onclick="window.EventPad.hideSheets(); window.EventPad.exportModel()">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⬇</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Model</div>
          <div class="sheet-option-desc">Everything, with its history: a backup, or to move it to another device</div></div>
      </div>
      <div class="sheet-option" onclick="window.EventPad.hideSheets(); window.EventPad.exportModel({ history: false })">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⬇</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Without history</div>
          <div class="sheet-option-desc">The model as it stands: a lighter file to share</div></div>
      </div>
      <div class="sheet-option" onclick="window.EventPad.hideSheets(); window.EventPad.exportNotation()">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">✎</div>
        <div class="sheet-option-text"><div class="sheet-option-title">As text</div>
          <div class="sheet-option-desc">Event-model notation (S,C: / E: / R: / test), one line a sticky: to read, diff or paste</div></div>
      </div>
      <div class="sheet-option" onclick="window.EventPad.hideSheets(); window.EventPad.exportForEventmodelers()">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⬇</div>
        <div class="sheet-option-text"><div class="sheet-option-title">For eventmodelers.ai</div>
          <div class="sheet-option-desc">A board file (…-emstudio.json) to import at app.eventmodelers.ai</div></div>
      </div>
    </div>`),
  hideSheets: hideAllSheets,
  toggleBurger: () => {
    const dd = document.getElementById('burgerDropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  },

  // scenarios
  addScenario: (...args) => { if (!isReadOnly()) openAddScenarioSheet(...args); },
  submitAddScenario,
  // ☰ → Compare: the open board beside a shelf you pick
  compare: () => openComparePicker(getCurrentModelId(), showCompare),
  // ☰ → Replay: on the board, whatever view you were in
  replay: () => { showBoard(); openReplay(); },
  editScenario: (scenarioId) => {
    const state = projectState();
    const scenario = state.scenarios[scenarioId];
    // Not checked out here: the slice's scenarios, to read
    if (scenario && isReadOnly()) { openScenariosSheet(scenario.sliceId, { readOnly: true }); return; }
    if (scenario) {
      const slice = state.slices[scenario.sliceId];
      if (slice) {
        openEditScenarioSheet(scenario, slice);
      }
    }
  },
  saveScenario,
  deleteScenario,
  toggleGivenEvent,
  givenAdd,
  givenAgain,
  givenRemove,
  thenRowAdd,
  thenRowRemove,
  propItemAdd,
  selectWhenCommand,
  selectThenType,
  selectThenEvent,
  selectThenReadModel,
  
  // Debug console
  toggleDebugConsole
};

// ===========================================
// DEBUG CONSOLE
// ===========================================

let debugLogs = [];
let originalConsoleLog = console.log;

function addDebugLog(message, ...args) {
  const timestamp = new Date().toLocaleTimeString();
  const logText = [message, ...args].map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  debugLogs.push({ timestamp, message: logText });
  updateDebugUI();
  
  // Call original console.log
  originalConsoleLog.apply(console, [message, ...args]);
}

function updateDebugUI() {
  const countEl = document.getElementById('debugCount');
  const logsEl = document.getElementById('debugLogs');
  
  if (countEl) countEl.textContent = debugLogs.length;
  if (logsEl) {
    logsEl.innerHTML = debugLogs.map(log => `
      <div class="debug-log-entry">
        <span class="debug-log-time">${log.timestamp}</span>
        ${log.message}
      </div>
    `).join('');
    logsEl.scrollTop = logsEl.scrollHeight;
  }
}

function toggleDebugConsole() {
  const console = document.getElementById('debugConsole');
  if (console) {
    console.classList.toggle('expanded');
  }
}

function initDebugConsole() {
  // Show debug console if ?declaw in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('declaw')) {
    document.getElementById('debugConsole').style.display = 'flex';
    // Override console.log to capture logs
    console.log = addDebugLog;
  }
}

// ===========================================
// INITIALIZATION
// ===========================================

async function init() {
  // Read before the link features take their parameter out of the address
  const openedByLink = /[?&](m=|review=|live\b)/.test(location.search);
  const newVisit = isNewVisit();
  // Models live in IndexedDB: load them all before the first render. Only a slow
  // load says anything.
  const slow = setTimeout(() => {
    const note = document.createElement('div');
    note.id = 'storeLoading';
    note.className = 'store-loading';
    note.textContent = 'Opening your models…';
    document.body.appendChild(note);
  }, 300);
  try { await initStore(); } finally {
    clearTimeout(slow);
    document.getElementById('storeLoading')?.remove();
  }

  // Load saved events
  loadEventStream();
  
  // Initialize UI components
  initSheets();
  initNameSlice();
  initProperties();
  initScenarios();
  initDebugConsole();
  initBoard();
  initDetails();
  initOutline();
  initComments();
  initSlicePage({ showSlicePage, showSliceOnBoard });
  initLibrary();
  initBuildVersions();
  initFollow();
  // "‹ Bookshelves" in the header: to the shelves, and back to the open model
  document.getElementById('libraryBtn').addEventListener('click', () => getView() === 'slice' ? leaveSlicePage() : showLibrary());
  document.getElementById('detailsBtn').addEventListener('click', e => {
    const b = e.target.closest('[data-view-switch]');
    if (b) b.dataset.viewSwitch === 'board' ? showBoard() : showOutline();
  });
  document.querySelectorAll('.ov-tab').forEach(b => b.addEventListener('click', () => setOverviewTab(b.dataset.tab)));
  initShareImage();
  initReferences();
  initShareLink();
  initLive();
  initCompare({ showCompare });
  initSyncView();
  initReviewClient();
  initSharedClient();
  initPeopleView();
  initReviewView();
  // The header's height (two rows, and taller when the title wraps or fonts load): the board fills what's left
  const header = document.querySelector('.header');
  const headerHeight = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  new ResizeObserver(headerHeight).observe(header);
  headerHeight();
  // ⤢ hides the big header in a book, so the board gets the whole screen; a slim strip with the
  // book's name brings it back. Remembered per device; the bookshelves always show the header.
  const HIDE_KEY = 'eventpad_header_hidden';
  const hideHeader = on => {
    document.body.classList.toggle('header-hidden', on);
    try { localStorage.setItem(HIDE_KEY, on ? '1' : '0'); } catch (e) { /* just this time */ }
  };
  try { if (localStorage.getItem(HIDE_KEY) === '1') document.body.classList.add('header-hidden'); } catch (e) { /* storage blocked */ }
  document.getElementById('hideHeaderBtn').addEventListener('click', () => hideHeader(true));
  document.getElementById('headerStrip').addEventListener('click', () => hideHeader(false));
  // The book's name in the bottom bar: its ⋮ (name, description, …), or naming an untitled book
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-book-title]')) return;
    const more = document.getElementById('titleMore');
    (more && !more.hidden ? more : document.getElementById('modelTitle')).click();
  });
  onRender(() => { header.querySelector('.hd-strip-title').textContent = document.getElementById('modelTitle').textContent; });
  onRender(updateCheckoutBanner);
  onRender(updateReviewChip);
  initStatusFilter(renderFeed);
  initUsageStats();
  initSettings({ openSheet: html => openBoardSheet(html), render: renderFeed });
  // A review that lets you add scenarios: the board's ＋ Scenario shows on a book that is otherwise read-only
  onRender(() => document.body.classList.toggle('can-add-scenarios', canAddScenariosHere()));
  // ⋮ by a book's title: its name and description (not on the bookshelves, nor on a book you review for someone else)
  const titleMore = document.getElementById('titleMore');
  const homeBtn = document.getElementById('homeBtn');
  homeBtn.addEventListener('click', () => window.EventPad.showLibrary());
  onRender(() => {
    const id = getCurrentModelId();
    titleMore.hidden = document.body.classList.contains('library-mode') || !!reviewOf(id) || !!sharedOf(id);
    // The eventPAD mark above a book's title: tap it to close the book (not where a back link shows)
    homeBtn.hidden = document.body.classList.contains('library-mode') || !document.querySelector('.header h1')?.hidden;
  });
  titleMore.addEventListener('click', openTitleMenu);
  initSync();
  
  // Wire up FAB: quick ＋ Slice / ＋ Chapter on the board, new element in the list
  document.getElementById('fab').onclick = () => toggleFabMenu();
  
  
  // Wire up event log toggle
  document.querySelector('.event-log-toggle').onclick = toggleEventLog;
  
  // Wire up copy all button
  document.querySelector('.event-log-header .header-btn').onclick = copyAllEvents;
  
  // Initial render: a new visit starts on the bookshelves (a link opens its book instead);
  // a reload keeps your place
  if (openedByLink) renderFeed(); else if (newVisit || wasInLibrary()) showLibrary(); else renderFeed();

  // Installable as an app, and opens offline (see sw.js)
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* not fatal */ });

  document.documentElement.dataset.ready = '1';
  console.log('🟧 EventPad initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
