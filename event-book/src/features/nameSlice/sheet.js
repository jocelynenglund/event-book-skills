// ===========================================
// NAME SLICE - Sheet
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';

let pendingSliceId = null;

export function promptSliceNaming(sliceId, patternDesc) {
  pendingSliceId = sliceId;
  document.getElementById('slicePatternDesc').textContent = patternDesc;
  document.getElementById('sliceNameInput').value = '';
  
  setTimeout(() => {
    showSheet('sliceNameSheet');
    setTimeout(() => document.getElementById('sliceNameInput').focus(), 300);
  }, 300);
}

export function promptSliceName(sliceId, currentName) {
  pendingSliceId = sliceId;
  document.getElementById('slicePatternDesc').textContent = 'Name this slice';
  document.getElementById('sliceNameInput').value = currentName || '';
  document.getElementById('sliceNameInput').placeholder = 'Enter slice name';
  showSheet('sliceNameSheet');
  setTimeout(() => document.getElementById('sliceNameInput').focus(), 300);
}

export function dispatchNameSlice() {
  const name = document.getElementById('sliceNameInput').value.trim();
  if (!name || !pendingSliceId) return;

  appendEvent(EventTypes.SliceNamed, {
    sliceId: pendingSliceId,
    name
  });

  pendingSliceId = null;
  hideAllSheets();
  showToast('Slice saved! 🎉');
  render();
}

export function dismissSlicePrompt() {
  pendingSliceId = null;
  hideAllSheets();
}

// Initialize
export function initNameSlice() {
  document.getElementById('sliceNameInput').onkeydown = (e) => {
    if (e.key === 'Enter') dispatchNameSlice();
  };
}
