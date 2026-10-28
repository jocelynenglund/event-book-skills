// ===========================================
// BOARD SHEETS - Shared bits for the board's sheets
// ===========================================

import { showSheet } from '../../../ui/sheets.js';

export const sliceTypeHelp = {
  SC: { icon: '🟦', title: 'A user does something', desc: 'State change · Screen → Command → Event' },
  SV: { icon: '🟩', title: 'A user sees something', desc: 'State view · Events → Read model → Screen' },
  // An automation is a to-do state view the processor reads, plus the state change it drives
  AUTO: { icon: '⚙️', title: 'The system reacts', desc: 'Adds 2 slices · To-do read model → ⚙️ → Command' }
};

export const placeholders = {
  screen: 'e.g. Checkout',
  command: 'e.g. PlaceOrder',
  event: 'e.g. OrderPlaced',
  readModel: 'e.g. OrderHistory',
  processor: 'e.g. Ship paid orders'
};

export function openBoardSheet(html, focusId) {
  document.getElementById('boardSheetContent').innerHTML = html;
  showSheet('boardSheet');
  if (focusId) setTimeout(() => document.getElementById(focusId)?.focus(), 300);
}

export function scrollToSlice(sliceId) {
  requestAnimationFrame(() => {
    document.querySelector(`.bd-head-name[data-slice="${sliceId}"]`)
      ?.closest('.bd-head')
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
}

export function onEnter(id, fn) {
  const input = document.getElementById(id);
  if (input) input.onkeydown = e => { if (e.key === 'Enter') fn(); };
}


// Search ignores case, spaces, dashes and underscores
export const searchKey = s => String(s).toLowerCase().replace(/[\s_\-]+/g, '');
