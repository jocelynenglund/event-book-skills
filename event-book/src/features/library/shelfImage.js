// ===========================================
// LIBRARY - Shelf picture: one model's shelf as a square image to share
// The same photo pieces as the library (img/shelf-rail, -bay, -plank), the
// model's name on the brass label and its chapters as books.
// ===========================================

import { readModelEvents } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { shelfBooks } from './books.js';

const SIZE = 1080;
const M = 54;
const PAPER = '#f6f1e7';
const INK = '#2b241c';
const MUTED = '#75675a';
const BLOCK = { SC: '#5b9be6', SV: '#6cbf5a', AU: '#a58be0' };
// The label's blank card in the rail photo (fractions of its 1024 x 108)
const LABEL = { x: 0.1582, w: 0.6807, y: 0.3611, h: 0.426 };

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function ready() {
  if (document.fonts?.load) {
    await Promise.all(['700 30px Fraunces', '700 30px "Courier Prime"', '700 20px "IBM Plex Mono"', '500 20px "Atkinson Hyperlegible"']
      .map(f => document.fonts.load(f).catch(() => null)));
  }
  const [rail, bay, plank, icon] = await Promise.all(
    ['img/shelf-rail.webp', 'img/shelf-bay.webp', 'img/shelf-plank.webp', 'icons/icon-192.png'].map(loadImage));
  return { rail, bay, plank, icon };
}

// Words onto lines no wider than maxW (at most maxLines; the last ends in … if cut)
function wrap(ctx, text, maxW, maxLines) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBook(ctx, b, x, base, s) {
  const w = b.width * s, h = b.height * s, y = base - h;
  const cloth = ctx.createLinearGradient(x, 0, x + w, 0);
  cloth.addColorStop(0, b.dark); cloth.addColorStop(0.3, b.light); cloth.addColorStop(0.65, b.light); cloth.addColorStop(1, b.dark);
  ctx.save();
  ctx.shadowColor = 'rgba(20, 10, 2, 0.5)'; ctx.shadowBlur = 8 * s; ctx.shadowOffsetX = 2 * s;
  roundRect(ctx, x, y, w, h, 4 * s); ctx.fillStyle = cloth; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(80, 55, 20, 0.3)'; ctx.lineWidth = s * 0.8; ctx.stroke();
  // Gilt bands at the head and foot
  ctx.strokeStyle = 'rgba(120, 90, 40, 0.55)'; ctx.lineWidth = s * 0.7;
  [[y + 5 * s], [y + 8 * s], [base - 5 * s], [base - 8 * s]].forEach(([ly]) => {
    ctx.beginPath(); ctx.moveTo(x + 5 * s, ly); ctx.lineTo(x + w - 5 * s, ly); ctx.stroke();
  });
  // A block per slice, three to a row, near the foot
  const rows = Math.ceil(b.blocks.length / 3);
  const bs = 5 * s, gap = 2 * s;
  const gridW = Math.min(b.blocks.length, 3) * bs + (Math.min(b.blocks.length, 3) - 1) * gap;
  const gx = x + (w - gridW) / 2, gy = base - 13 * s - rows * (bs + gap);
  b.blocks.forEach((t, i) => {
    roundRect(ctx, gx + (i % 3) * (bs + gap), gy + Math.floor(i / 3) * (bs + gap), bs, bs, s);
    ctx.fillStyle = BLOCK[t] || MUTED; ctx.fill();
  });
  // The title up the spine, reading bottom to top, in up to three columns
  const titleH = (b.blocks.length ? gy - 6 * s : base - 14 * s) - (y + 14 * s);
  ctx.save();
  ctx.translate(x + w / 2, y + 14 * s + titleH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = INK;
  let size = 14 * s;
  let lines;
  do {
    ctx.font = `700 ${size}px Fraunces, Georgia, serif`;
    lines = wrap(ctx, b.title, titleH, 3);
    size -= s;
  } while (lines.length * size * 1.05 > w - 8 * s && size > 8 * s);
  const lh = (size + s) * 1.05;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lh));
  ctx.restore();
}

// The shelf picture for a model, as a canvas
export async function renderShelfImage(modelId) {
  const { rail, bay, plank, icon } = await ready();
  const state = projectState(readModelEvents(modelId));
  const name = state.modelName || 'Untitled model';
  const books = shelfBooks(state, modelId);
  const sliceCount = Object.keys(state.slices).length;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(120, 90, 40, 0.10)';
  for (let y = 9; y < SIZE; y += 18) for (let x = 9; x < SIZE; x += 18) ctx.fillRect(x, y, 2.4, 2.4);

  // Brand: the icon and Event Book
  ctx.drawImage(icon, M, M, 84, 84);
  ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 50px Fraunces, Georgia, serif';
  ctx.fillText('Event Book', M + 104, M + 60);

  // The shelf: rail with the name on its label, then one bay and plank per row of books.
  // A big model's books go on several rows, as many as makes them biggest while it all fits.
  const SW = SIZE - 2 * M, k = SW / 1024;
  const railH = 108 * k, plankH = 35 * k;
  // The text below gets its room first: the counts, the whole description (up to six lines), the footer
  ctx.font = '500 28px "Atkinson Hyperlegible", sans-serif';
  const descLines = state.modelDescription ? wrap(ctx, state.modelDescription, SIZE - 2 * M, 6) : [];
  const room = SIZE - (M + 120) - (30 + 40 + descLines.length * 38 + 70);
  const rowWidth = SW * 0.84;
  const widthOf = row => row.reduce((t, b) => t + b.width + 4, 0);
  let layout = null;
  for (let n = 1; n <= Math.min(6, Math.max(1, books.length)); n++) {
    // Split in reading order into n rows of about equal width
    const target = widthOf(books) / n;
    const rows = [[]];
    books.forEach(b => {
      const row = rows[rows.length - 1];
      if (row.length && widthOf(row) + (b.width + 4) / 2 > target && rows.length < n) rows.push([b]); else row.push(b);
    });
    const scale = Math.min(2.4, rowWidth / Math.max(1, ...rows.map(widthOf)));
    const tallest = books.length ? Math.max(...books.map(b => b.height)) * scale : 120;
    const height = railH + rows.length * (tallest + 46 + plankH);
    if (height <= room && (!layout || scale > layout.scale)) layout = { rows, scale, bayH: tallest + 46, height };
    if (layout && layout.scale >= 1.2) break;       // big enough to read: fewer rows look calmer
  }
  if (!layout) {
    const scale = rowWidth / Math.max(1, widthOf(books));
    const tallest = books.length ? Math.max(...books.map(b => b.height)) * scale : 120;
    layout = { rows: [books], scale, bayH: tallest + 46, height: railH + tallest + 46 + plankH };
  }
  const { rows, scale: bookScale, bayH } = layout;
  const shelfH = layout.height;
  const top = M + 120 + Math.max(0, (room - shelfH) / 2);

  ctx.save(); ctx.shadowColor = 'rgba(40, 22, 8, 0.4)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#3a2412'; ctx.fillRect(M, top, SW, shelfH);
  ctx.restore();
  rows.forEach((row, r) => {
    const y0 = top + railH + r * (bayH + plankH);
    for (let y = y0; y < y0 + bayH; y += bay.height * k) {
      ctx.drawImage(bay, 0, 0, bay.width, Math.min(bay.height, (y0 + bayH - y) / k), M, y, SW, Math.min(bay.height * k, y0 + bayH - y));
    }
    ctx.drawImage(plank, M, y0 + bayH, SW, plankH);
  });
  ctx.drawImage(rail, M, top, SW, railH);

  // The name on the brass label, in typewriter capitals, as big as fits
  const lx = M + LABEL.x * SW, lw = LABEL.w * SW, ly = top + LABEL.y * railH, lh = LABEL.h * railH;
  let size = 30;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  do { ctx.font = `700 ${size}px "Courier Prime", "Courier New", monospace`; size--; }
  while (ctx.measureText(name.toUpperCase()).width > lw - 24 && size > 12);
  ctx.fillStyle = 'rgba(255, 248, 225, 0.6)'; ctx.fillText(name.toUpperCase(), lx + lw / 2, ly + lh / 2 + 1);
  ctx.fillStyle = '#3b2a14'; ctx.fillText(name.toUpperCase(), lx + lw / 2, ly + lh / 2);

  // The books, standing on each row's plank
  if (books.length) {
    rows.forEach((row, r) => {
      const base = top + railH + r * (bayH + plankH) + bayH - 4;
      let x = M + SW * 0.08;
      row.forEach(b => { drawBook(ctx, b, x, base, bookScale); x += (b.width + 4) * bookScale; });
    });
  } else {
    ctx.font = '700 30px Fraunces, Georgia, serif'; ctx.fillStyle = '#e8d5b5';
    ctx.fillText('No slices yet', M + SW / 2, top + railH + bayH / 2);
  }

  // Under the shelf: what's in it, the description, where it was made
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let y = top + shelfH + 30;
  const chapters = state.chapterOrder.length;
  ctx.font = '700 22px "IBM Plex Mono", monospace'; ctx.fillStyle = MUTED;
  ctx.fillText(`${sliceCount} ${sliceCount === 1 ? 'SLICE' : 'SLICES'}${chapters ? ` · ${chapters} ${chapters === 1 ? 'CHAPTER' : 'CHAPTERS'}` : ''}`, M, y);
  y += 40;
  if (state.modelDescription) {
    ctx.font = '500 28px "Atkinson Hyperlegible", sans-serif'; ctx.fillStyle = INK;
    descLines.forEach(line => { ctx.fillText(line, M, y); y += 38; });
  }
  ctx.font = '700 22px "IBM Plex Mono", monospace'; ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillText('Made with Event Book · eventpad.itsybit.se', SIZE - M, SIZE - M + 10);
  return canvas;
}
