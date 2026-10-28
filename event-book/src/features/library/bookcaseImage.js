// ===========================================
// LIBRARY - Bookcase picture: the bookshelves as one image to share
// The same look as the shelves in the app (wooden case, cloth and kraft spines with their
// rules, page edges, loose sheets, brass plaque), drawn on a canvas 1080 wide. Everything is
// drawn in the app's CSS pixels under a scale, so the numbers below match styles.css.
// ===========================================

import { fitSpine } from './books.js';
import { layoutRows } from './bookcaseLayout.js';

const W = 1080;
const M = 48;
const PAPER = '#f6f1e7';
const INK = '#2b241c';
const MUTED = '#75675a';
const FRAME = 9, TOP = 36, PLANK = 34, GAP = 4, LEDGE = 30, MAX_H = 3600;
const DISPLAY = 'Fraunces, Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function ready() {
  if (document.fonts?.load) {
    await Promise.all(['700 30px Fraunces', '500 20px "IBM Plex Mono"', '700 20px "IBM Plex Mono"']
      .map(f => document.fonts.load(f).catch(() => null)));
  }
  return loadImage('icons/icon-192.png');
}

function stops(g, list) { list.forEach(([at, c]) => g.addColorStop(at, c)); return g; }

// One spine, in CSS pixels, its top-left at (0, 0)
function drawSpine(ctx, b, fit, w, s) {
  const h = b.height, kraft = !b.published;
  const body = () => ctx.roundRect(0, 0, w, h, [6, 6, 1, 1]);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 8 * s; ctx.shadowOffsetX = 3 * s;
  ctx.beginPath(); body(); ctx.fillStyle = kraft ? '#d2b283' : b.cloth; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); body(); ctx.clip();
  const sheen = kraft
    ? [[0, 'rgba(70, 40, 10, 0.36)'], [0.33, 'rgba(255, 255, 255, 0.22)'], [0.7, 'rgba(70, 40, 10, 0.08)'], [1, 'rgba(70, 40, 10, 0.34)']]
    : [[0, 'rgba(0, 0, 0, 0.36)'], [0.33, 'rgba(255, 255, 255, 0.14)'], [0.7, 'rgba(0, 0, 0, 0.12)'], [1, 'rgba(0, 0, 0, 0.38)']];
  ctx.fillStyle = stops(ctx.createLinearGradient(0, 0, w, 0), sheen); ctx.fillRect(0, 0, w, h);
  // The weave of the cloth, the grain of the paper
  ctx.fillStyle = kraft ? 'rgba(120, 80, 35, 0.08)' : 'rgba(255, 255, 255, 0.04)';
  if (kraft) for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
  else for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  // Rules at head and foot: gold on cloth, brown ink on kraft
  ctx.fillStyle = kraft ? '#6e4a22' : '#e1b84e';
  [11, 16, h - 52, h - 47].forEach(y => ctx.fillRect(5, y, w - 10, 1.5));
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'; ctx.lineWidth = 1; ctx.beginPath(); body(); ctx.stroke();
  if (kraft) {
    ctx.save();
    ctx.strokeStyle = 'rgba(94, 62, 28, 0.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.roundRect(2.5, 7.5, w - 5, h - 11, [3, 3, 0, 0]); ctx.stroke();
    ctx.restore();
  }
  // Page edges
  ctx.save();
  ctx.beginPath(); ctx.roundRect(2, 0, w - 4, 5, [4, 4, 0, 0]); ctx.clip();
  ctx.fillStyle = stops(ctx.createLinearGradient(2, 0, w - 2, 0), [[0, '#cdbf9a'], [0.4, '#f3e8c8'], [1, '#d8c9a1']]); ctx.fillRect(2, 0, w - 4, 5);
  ctx.fillStyle = 'rgba(120, 100, 60, 0.18)'; for (let x = 5; x < w - 2; x += 4) ctx.fillRect(x - 1, 0, 1, 5);
  ctx.restore();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(2, 5, w - 4, 1);
  // Loose sheets for the slices that are refined but not built yet
  for (let i = 0; i < (kraft ? b.ready : 0); i++) {
    ctx.save();
    ctx.translate(3 + i * 7 + 13, 8 - 11); ctx.rotate((i * 7 - 6) * Math.PI / 180);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; ctx.shadowBlur = 2 * s; ctx.shadowOffsetY = s;
    ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#c9bfa8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-13, -11, 26, 22, 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Title and small print, side by side, both reading bottom to top
  const lineH = fit.size * 1.05, block = fit.lines.length * lineH + 3 + 8;
  const x0 = (w - block) / 2, len = h - 80;
  ctx.font = `700 ${fit.size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fit.lines.forEach((line, i) => {
    ctx.save();
    ctx.translate(x0 + (i + 0.5) * lineH, 24 + len / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = kraft ? 'rgba(255, 240, 210, 0.45)' : 'rgba(0, 0, 0, 0.35)'; ctx.fillText(line, 0, 1);
    ctx.fillStyle = kraft ? '#3b2a14' : '#f6e6bd'; ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  ctx.save();
  ctx.translate(x0 + fit.lines.length * lineH + 3 + 4, h - 56); ctx.rotate(-Math.PI / 2);
  ctx.font = `500 8px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = kraft ? 'rgba(59, 42, 20, 0.7)' : 'rgba(244, 226, 184, 0.62)';
  let meta = b.meta;
  while (meta.length > 1 && ctx.measureText(meta).width > len) meta = meta.slice(0, -1);
  ctx.fillText(meta, 0, 0);
  ctx.restore();
  // Foot: the icon of where the book is (no device names), and the ⋯ of the app's spine
  if (b.mark) {
    ctx.fillStyle = 'rgba(255, 246, 224, 0.9)'; ctx.beginPath(); ctx.roundRect(w / 2 - 9, h - 40, 18, 16, 4); ctx.fill();
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3b2a14';
    ctx.fillText(b.mark, w / 2, h - 31.5);
  }
  ctx.fillStyle = kraft ? 'rgba(59, 42, 20, 0.5)' : 'rgba(244, 226, 184, 0.5)';
  [-4, 0, 4].forEach(dx => { ctx.beginPath(); ctx.arc(w / 2 + dx, h - 8, 1.2, 0, 2 * Math.PI); ctx.fill(); });
}

// Where a section's books go at scale s: rows, their heights, and the case's height
function planSection(sec, s) {
  const caseW = (W - 2 * M) / s;
  const fits = sec.books.map(b => fitSpine(b.name, 36, b.height - 84, 17));
  const widths = fits.map(f => f.width + 13);
  const rows = layoutRows(widths.map(w => w + GAP), caseW - 2 * FRAME - 26);
  const rowH = rows.map(r => Math.max(...r.map(i => sec.books[i].height)));
  const inner = TOP + rowH.reduce((t, h, i) => t + h + (i < rows.length - 1 ? LEDGE : 6), 0);
  return { sec, fits, widths, rows, rowH, caseW, height: FRAME + inner + PLANK + 22 };
}

function drawCase(ctx, p, s) {
  const { sec, fits, widths, rows, rowH, caseW } = p;
  const bodyH = p.height - 22 - PLANK;
  // The wooden frame and the dark inside, lit from the top
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, caseW, bodyH + 1, [12, 12, 0, 0]);
  ctx.shadowColor = 'rgba(30, 16, 6, 0.4)'; ctx.shadowBlur = 14 * s; ctx.shadowOffsetY = 4 * s;
  ctx.fillStyle = stops(ctx.createLinearGradient(0, 0, caseW, 0), [[0, '#4a2f16'], [0.07, '#6b4624'], [0.5, '#5d3c1d'], [0.93, '#6b4624'], [1, '#4a2f16']]);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 230, 180, 0.3)'; ctx.fillRect(4, 0, caseW - 8, 1.5);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(FRAME, FRAME, caseW - 2 * FRAME, bodyH - FRAME + 1, [6, 6, 0, 0]); ctx.clip();
  ctx.fillStyle = stops(ctx.createLinearGradient(0, FRAME, 0, bodyH), [[0, '#1d1108'], [0.45, '#2c1a0d'], [1, '#261609']]);
  ctx.fillRect(0, 0, caseW, bodyH + 1);
  ctx.fillStyle = stops(ctx.createLinearGradient(0, FRAME, 0, FRAME + 90), [[0, 'rgba(255, 200, 120, 0.1)'], [1, 'rgba(255, 200, 120, 0)']]);
  ctx.fillRect(0, FRAME, caseW, 90);
  ctx.fillStyle = stops(ctx.createLinearGradient(0, FRAME, 0, FRAME + 18), [[0, 'rgba(0, 0, 0, 0.65)'], [1, 'rgba(0, 0, 0, 0)']]);
  ctx.fillRect(0, FRAME, caseW, 18);
  ctx.restore();

  // Rows: each stands on a ledge of its own, the last on the plank
  let y = FRAME + TOP;
  const left = FRAME + 4;
  rows.forEach((row, r) => {
    const base = y + rowH[r];
    const last = r === rows.length - 1;
    if (!last) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; ctx.shadowBlur = 6 * s; ctx.shadowOffsetY = 3 * s;
      ctx.fillStyle = stops(ctx.createLinearGradient(0, base - 3, 0, base + 14), [[0, '#a98456'], [0.35, '#8c6a40'], [0.36, '#5e4021'], [0.47, '#7a5a37'], [1, '#5a3a1c']]);
      ctx.fillRect(FRAME, base - 3, caseW - 2 * FRAME, 17);
      ctx.restore();
    }
    let x = left;
    row.forEach(i => {
      const b = sec.books[i];
      const lean = last && i === sec.books.length - 1 && sec.books.length > 1;
      ctx.save();
      ctx.translate(x + GAP / 2, base - b.height);
      if (lean) { ctx.translate(widths[i] / 2, b.height); ctx.rotate(2.6 * Math.PI / 180); ctx.translate(-widths[i] / 2, -b.height); }
      drawSpine(ctx, b, fits[i], widths[i], s);
      ctx.restore();
      x += widths[i] + GAP;
    });
    y = base + (last ? 6 : LEDGE);
  });

  // The plank, jutting out past the case, with the brass plaque
  const py = bodyH;
  ctx.save();
  ctx.shadowColor = 'rgba(30, 16, 6, 0.55)'; ctx.shadowBlur = 16 * s; ctx.shadowOffsetY = 12 * s;
  ctx.beginPath(); ctx.roundRect(-6, py, caseW + 12, PLANK, [3, 3, 12, 12]);
  ctx.fillStyle = stops(ctx.createLinearGradient(0, py, 0, py + PLANK), [[0, '#b79562'], [7 / PLANK, '#9a7549'], [7 / PLANK + 0.001, '#5e4021'], [9 / PLANK, '#7d5c38'], [0.58, '#6a4a28'], [1, '#4e3015']]);
  ctx.fill();
  ctx.restore();
  const title = sec.plaque, count = String(sec.books.length);
  ctx.font = `700 14px ${DISPLAY}`;
  const tw = ctx.measureText(title).width;
  const pw = tw + 8 + 14 + 14 + 8, ph = 22, px = (caseW - pw) / 2, pyy = py + 7 + (PLANK - 7 - ph) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 2 * s; ctx.shadowOffsetY = s;
  ctx.beginPath(); ctx.roundRect(px, pyy, pw, ph, 4);
  ctx.fillStyle = stops(ctx.createLinearGradient(0, pyy, 0, pyy + ph), [[0, '#ecd48e'], [1, '#c9a24c']]); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#8c6a22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(px + 0.5, pyy + 0.5, pw - 1, ph - 1, 4); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.fillRect(px + 3, pyy + 1, pw - 6, 1);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#3b2808';
  ctx.fillText(title, px + 14, pyy + 16);
  ctx.globalAlpha = 0.75; ctx.font = `600 10px ${MONO}`; ctx.fillText(count, px + 14 + tw + 8, pyy + 16);
  ctx.globalAlpha = 1;
}

// sections: [{ kind, plaque, books: [{ name, published, cloth, height, ready, meta, mark }] }], empty ones left out
// → a canvas of the bookcase to share
export async function renderBookcaseImage({ sections }) {
  const icon = await ready();
  const shown = sections.filter(sec => sec.books.length);
  const total = shown.reduce((t, sec) => t + sec.books.length, 0);
  const HEAD = 170, FOOT = 90;
  // As big as reads well; a very full bookcase is drawn smaller (more books to a row) to keep it a sane height
  let plans, s = 1.5;
  for (; s >= 0.8; s = Math.round((s - 0.1) * 10) / 10) {
    plans = shown.map(sec => planSection(sec, s));
    if (HEAD + FOOT + plans.reduce((t, p) => t + p.height * s, 0) <= MAX_H) break;
  }
  if (s < 0.8) { s = 0.8; plans = shown.map(sec => planSection(sec, s)); }
  const height = Math.ceil(HEAD + FOOT + (plans.length ? plans.reduce((t, p) => t + p.height * s, 0) : 240));

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = 'rgba(120, 90, 40, 0.10)';
  for (let y = 9; y < height; y += 18) for (let x = 9; x < W; x += 18) ctx.fillRect(x, y, 2.4, 2.4);

  // Header: the pads icon, the title, how many books
  ctx.drawImage(icon, M, 44, 84, 84);
  ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 54px ${DISPLAY}`; ctx.fillText('Bookshelves', M + 108, 90);
  ctx.font = `700 22px ${MONO}`; ctx.fillStyle = MUTED;
  ctx.fillText(`${total} ${total === 1 ? 'BOOK' : 'BOOKS'}`, M + 110, 122);

  let y = HEAD;
  plans.forEach(p => {
    ctx.save();
    ctx.translate(M, y); ctx.scale(s, s);
    drawCase(ctx, p, s);
    ctx.restore();
    y += p.height * s;
  });
  if (!plans.length) {
    ctx.fillStyle = MUTED; ctx.font = `700 30px ${DISPLAY}`; ctx.textAlign = 'center';
    ctx.fillText('No books here yet', W / 2, HEAD + 100);
  }
  ctx.fillStyle = INK; ctx.font = `700 22px ${MONO}`; ctx.textAlign = 'right';
  ctx.fillText('Made with Event Book · eventpad.itsybit.se', W - M, height - 40);
  return canvas;
}
