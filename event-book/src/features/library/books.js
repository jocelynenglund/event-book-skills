// ===========================================
// LIBRARY - Books: a model's chapters as books on its shelf
// Shared by the library (HTML) and the shelf picture (canvas).
// ===========================================

import { getBoardGroups } from '../../core/projections.js';
import { sliceActor } from '../board/command.js';

// Cloth colours for the books, picked per chapter so a book keeps its colour
const cloths = [
  ['#d6c3a2', '#ead9bb'], ['#b9cbb0', '#d3e0cb'], ['#b5c4dc', '#d2ddec'],
  ['#dcb9a8', '#ecd2c4'], ['#cbbfe0', '#e0d7ef'], ['#e2cf9a', '#f0e2b9']
];
const hash = (key, m) => Math.abs([...key].reduce((h, c) => (h * m + c.charCodeAt(0)) | 0, 0));
export const clothFor = key => cloths[hash(key, 31) % cloths.length];

// Title text measured as it's drawn up the spine (Fraunces, bold)
let measurer = null;
function textWidth(text, size) {
  measurer ||= document.createElement('canvas').getContext('2d');
  measurer.font = `700 ${size}px Fraunces, Georgia, serif`;
  return measurer.measureText(text).width;
}

// Words into lines no longer than `length` (a lone long word keeps its own line)
function wrapTitle(title, size, length) {
  const lines = [];
  let line = '';
  for (const word of String(title).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || textWidth(next, size) <= length) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

// A long title is set smaller, the way a publisher would; a very long one also
// gets a slightly wider book, and only past 9px is it cut short with "…"
const SPINE_LINE = 1.05;
export function fitSpine(title, width, length, largest = 14) {
  for (let size = largest; size >= 9; size--) {
    const lines = wrapTitle(title, size, length);
    const fits = lines.every(l => textWidth(l, size) <= length);
    const needed = Math.ceil(lines.length * size * SPINE_LINE + 10);
    if (fits && needed <= width) return { size, lines, width };
    if (fits && size <= 12 && needed <= 76) return { size, lines, width: Math.max(width, needed) };
  }
  const size = 9;
  const max = Math.max(1, Math.floor((76 - 10) / (size * SPINE_LINE)));
  let lines = wrapTitle(title, size, length);
  if (lines.length > max) {
    lines = lines.slice(0, max);
    let last = lines[max - 1];
    while (last.length > 1 && textWidth(last + '…', size) > length) last = last.slice(0, -1);
    lines[max - 1] = last.trimEnd() + '…';
  }
  lines = lines.map(l => { while (l.length > 1 && textWidth(l, size) > length) l = l.slice(0, -2) + '…'; return l; });
  return { size, lines, width: Math.max(width, Math.min(76, Math.ceil(lines.length * size * SPINE_LINE + 10))) };
}

// One book: its size (in CSS pixels), cloth, a block per slice (up to 12), and its
// title fitted to the spine (font size and lines)
export function bookSpec(title, slices, key, state) {
  const [dark, light] = clothFor(key);
  // Thicker for more slices, a little taller or shorter so the shelf looks lived in
  const baseWidth = Math.min(30 + slices.length * 5, 64);
  // ...and tall enough that the longest word of the title isn't cut
  const longestWord = Math.max(...String(title).split(/\s+/).map(w => w.length));
  const blockRows = Math.ceil(Math.min(slices.length, 12) / 3);
  const height = Math.min(Math.max(112 + (hash(key, 17) % 4) * 9, Math.ceil(longestWord * 8.8) + blockRows * 7 + 44), 176);
  const blocks = slices.slice(0, 12).map(s => (sliceActor(s, state) === 'processor' ? 'AU' : s.type));
  // The spine's room for the title: its height less padding and the slice blocks
  const { size, lines, width } = fitSpine(title, baseWidth, height - 41 - blockRows * 7);
  return { title, key, width, height, dark, light, blocks, titleSize: size, titleLines: lines };
}

// The books on a model's shelf: one per chapter, or one for a model without chapters
export function shelfBooks(state, modelId) {
  const groups = getBoardGroups(state).filter(g => g.slices.length);
  const sliceCount = groups.reduce((n, g) => n + g.slices.length, 0);
  if (!sliceCount) return [];
  if (!state.chapterOrder.length) return [bookSpec(state.modelName || 'Untitled model', groups[0].slices, modelId, state)];
  return groups.map(g => bookSpec(g.chapter ? g.chapter.name : 'Loose slices', g.slices, modelId + (g.chapter?.id || 'loose'), state));
}
