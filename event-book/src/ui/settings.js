// ===========================================
// SETTINGS - ☰ → Settings…: how this device shows a board. Kept on the device, not in a book.
// Notes: Sketchy (stickies sit slightly askew, the default) or Neat (all straight, in line).
// Help make Event Book better: off by default (features/productUsage).
// ===========================================

import { productUsageSettings } from '../features/productUsage/view.js';

const NEAT_KEY = 'eventpad_neat';
let neat = (() => { try { return localStorage.getItem(NEAT_KEY) === '1'; } catch (e) { return false; } })();

export const isNeat = () => neat;

function apply() { document.body?.classList.toggle('neat', neat); }

export function setNeat(on) {
  neat = !!on;
  try { localStorage.setItem(NEAT_KEY, neat ? '1' : '0'); } catch (e) { /* just this time */ }
  apply();
}

export function settingsHtml() {
  const chip = (on, label, desc) => `<button class="cm-chip ${neat === on ? 'on' : ''}" data-settings-neat="${on ? 1 : 0}" aria-pressed="${neat === on}" title="${desc}">${label}</button>`;
  return `
    <div class="sheet-title">Settings <span class="bd-sheet-sub">on this device</span></div>
    <div class="bd-sheet-label">Notes</div>
    <div class="cm-parts">${chip(false, 'Sketchy', 'Stickies sit slightly askew, like paper')}${chip(true, 'Neat', 'Every sticky straight and in line')}</div>
    <p class="cm-note">${neat ? 'Neat: every sticky straight and in line, for a busy board.' : 'Sketchy: stickies sit slightly askew, like paper on a wall.'}</p>
    ${productUsageSettings()}`;
}

export function initSettings({ openSheet, render }) {
  apply();
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-settings-neat]');
    if (!t) return;
    setNeat(t.dataset.settingsNeat === '1');
    openSheet(settingsHtml());
    render();
  });
}
