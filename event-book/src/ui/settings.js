// ===========================================
// SETTINGS - ☰ → Settings…: how this device shows a book. Kept on the device, not in a book.
// Notes: Sketchy (stickies sit slightly askew, the default) or Neat (all straight, in line).
// Open books in: the Board (the default) or the Outline: the plotter / pantser choice a new model asks
//   (feed.js getStartIn); a story always opens on Read.
// Fonts: a pack sets the titles', the text's and the labels' fonts together. Default (Fraunces titles, Atkinson
//   Hyperlegible text, IBM Plex Mono labels), Formal (no serifs: IBM Plex Sans with Plex Mono), OpenDyslexic. A pack's
//   fonts load only when it's picked (Jocelyn, 2026-11-07).
// Help make Event Book better: off by default (features/productUsage).
// ===========================================

import { productUsageSettings } from '../features/productUsage/view.js';
import { getStartIn, setStartIn } from './feed.js';

const NEAT_KEY = 'eventpad_neat';
const FONT_KEY = 'eventpad_font_pack';
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* just this time */ } };

let neat = read(NEAT_KEY, '0') === '1';
export const isNeat = () => neat;

export const FONT_PACKS = {
  default: { label: 'Default', desc: 'Fraunces titles, Atkinson Hyperlegible text, IBM Plex Mono labels' },
  formal: { label: 'Formal', desc: 'No serifs: IBM Plex Sans throughout, IBM Plex Mono labels',
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
    display: "'IBM Plex Sans', system-ui, sans-serif", body: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, Menlo, monospace" },
  opendyslexic: { label: 'OpenDyslexic', desc: 'OpenDyslexic throughout: letters weighted at the bottom, for dyslexic readers',
    href: 'https://fonts.cdnfonts.com/css/opendyslexic',
    display: "'OpenDyslexic', system-ui, sans-serif", body: "'OpenDyslexic', system-ui, sans-serif", mono: "'OpenDyslexicMono', 'OpenDyslexic', ui-monospace, monospace" }
};
let fontPack = FONT_PACKS[read(FONT_KEY, 'default')] ? read(FONT_KEY, 'default') : 'default';
export const getFontPack = () => fontPack;

// A pack's stylesheet, once
function loadPack(pack) {
  const href = FONT_PACKS[pack]?.href;
  if (!href || document.querySelector(`link[data-font-pack="${pack}"]`)) return;
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
  link.dataset.fontPack = pack;
  document.head.append(link);
}

function apply() {
  document.body?.classList.toggle('neat', neat);
  // On the root, so Neat (on the body) still makes titles and labels the text's font
  const root = document.documentElement.style, p = FONT_PACKS[fontPack];
  for (const [prop, key] of [['--font-display', 'display'], ['--font-body', 'body'], ['--font-mono', 'mono']]) {
    if (p[key]) root.setProperty(prop, p[key]); else root.removeProperty(prop);
  }
  loadPack(fontPack);
}

export function setNeat(on) {
  neat = !!on;
  write(NEAT_KEY, neat ? '1' : '0');
  apply();
}

export function setFontPack(pack) {
  if (!FONT_PACKS[pack]) return;
  fontPack = pack;
  write(FONT_KEY, pack);
  apply();
}

export function settingsHtml() {
  const chip = (on, label, desc) => `<button class="cm-chip ${neat === on ? 'on' : ''}" data-settings-neat="${on ? 1 : 0}" aria-pressed="${neat === on}" title="${desc}">${label}</button>`;
  const start = getStartIn();
  const startChip = (where, label, desc) => `<button class="cm-chip ${start === where ? 'on' : ''}" data-settings-start="${where}" aria-pressed="${start === where}" title="${desc}">${label}</button>`;
  const fontChip = key => `<button class="cm-chip ${fontPack === key ? 'on' : ''}" data-settings-font="${key}" aria-pressed="${fontPack === key}" title="${FONT_PACKS[key].desc}">${FONT_PACKS[key].label}</button>`;
  return `
    <div class="sheet-title">Settings <span class="bd-sheet-sub">on this device</span></div>
    <div class="bd-sheet-label">Notes</div>
    <div class="cm-parts">${chip(false, 'Sketchy', 'Stickies sit slightly askew, like paper')}${chip(true, 'Neat', 'Every sticky straight and in line, in one plain font')}</div>
    <p class="cm-note">${neat ? 'Neat: every sticky straight and in line, in one plain font, for a calmer board.' : 'Sketchy: stickies sit slightly askew, like paper on a wall, with serif titles and typewriter labels.'}</p>
    <div class="bd-sheet-label">Open books in</div>
    <div class="cm-parts">${startChip('board', '🌀 Board', 'Straight onto the board')}${startChip('outline', '📋 Outline', 'The outline first')}</div>
    <p class="cm-note">A story always opens on Read.</p>
    <div class="bd-sheet-label">Fonts</div>
    <div class="cm-parts">${Object.keys(FONT_PACKS).map(fontChip).join('')}</div>
    <p class="cm-note">${FONT_PACKS[fontPack].desc}.</p>
    ${productUsageSettings()}`;
}

export function initSettings({ openSheet, render }) {
  apply();
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-settings-neat], [data-settings-start], [data-settings-font]');
    if (!t) return;
    if (t.dataset.settingsNeat != null) setNeat(t.dataset.settingsNeat === '1');
    else if (t.dataset.settingsStart) setStartIn(t.dataset.settingsStart);
    else setFontPack(t.dataset.settingsFont);
    openSheet(settingsHtml());
    render();
  });
}
