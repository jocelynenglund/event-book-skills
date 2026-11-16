// ===========================================
// SHARE IMAGE - Canvas poster of the board
// Same layout as the board: slices left → right, three swimlanes.
// Workshop paper look: paper wall, tilted sticky notes, handwritten names.
// ===========================================

import { heatOf } from '../usage/rules.js';
import { shotOf } from './shotOf.js';
import { sliceTypeLabels, laneLabels, noteTilt } from '../board/view.js';

export const DISPLAY = '"Fraunces", Georgia, serif';
export const BODY = '"Atkinson Hyperlegible", system-ui, -apple-system, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

// Canvas only uses webfonts that are already loaded — call before rendering
export async function ensureFonts() {
  if (!document.fonts?.load) return;
  await Promise.all([
    `700 20px ${DISPLAY}`, `400 20px ${DISPLAY}`,
    `500 16px ${BODY}`, `700 16px ${BODY}`,
    `500 12px ${MONO}`, `700 12px ${MONO}`
  ].map(f => document.fonts.load(f).catch(() => null)));
}

// Sticky-note fills, shared by both themes
export const notes = {
  screen:    { fill: '#fffdf8', text: '#2b241c', stroke: '#cdbfa6' },
  processor: { fill: '#d9c8f5', text: '#2a1a4d' },
  command:   { fill: '#a9cdf5', text: '#0e2a4a' },
  readModel: { fill: '#b6e3a8', text: '#163b10' },
  event:     { fill: '#ffc58a', text: '#4a2306' },
  // Events from another system
  external:  { fill: '#fde58a', text: '#3d3005' },
  // A legacy table read as events: a shadowy orange
  table:     { fill: '#c99a6c', text: '#2a1606' },
  // One of our events published to other systems: event orange, a dark right edge and a ↗ tab (legend only)
  published: { fill: '#ffc58a', text: '#4a2306' }
};

export const themes = {
  // Paper wall
  light: {
    bg: '#f6f1e7', grain: 'rgba(120, 90, 40, 0.10)', text: '#2b241c', muted: '#75675a',
    line: '#d9ccb6', arrow: '#6e6050', shadow: 'rgba(80, 55, 20, 0.30)',
    lanes: ['#efe7d8', '#e8e6dc', '#f3e2cd', '#ebe6dc']
  },
  // Chalkboard: same notes pinned to a warm dark board
  dark: {
    bg: '#211d18', grain: 'rgba(255, 240, 210, 0.05)', text: '#f6f1e7', muted: '#b3a693',
    line: '#3d362c', arrow: '#cbbfa9', shadow: 'rgba(0, 0, 0, 0.45)',
    lanes: ['#2a251f', '#272620', '#33271b', '#25221d']
  }
};

export const sliceAccent = { SC: '#5b9be6', SV: '#6cbf5a', AU: '#a58be0' };

// Arrow direction between lane n-1 and n (see board/view.js);
// AU's trigger event → processor arrow is drawn separately, around the command
const flows = { SC: [null, 'down', 'down'], SV: [null, 'up', 'up'], AU: [null, 'down', null] };

// What phones can hold: a picture past about 16M pixels (or two of them, preview and full) crashed a
// phone sharing a 255-slice book (2026-11-08). Bigger books come out a little less sharp, never blank.
export const MAX_PIXELS = 8_000_000;
export const MAX_SIDE = 8_192;

const L = {
  pad: 56, labelW: 34, colW: 252, cardW: 208,
  titleH: 128, headH: 76, footH: 72, minW: 760, spineW: 84,
  cellPadY: 26, cardGap: 14, minLaneH: 150,
  nameSize: 19, nameLine: 22, kindSize: 9.5, propSize: 11.5, propLine: 16, propGap: 9
};

// Wrap on spaces and camelCase boundaries; hard-break anything still too wide
export function wrap(ctx, text, maxW, maxLines) {
  const tokens = [];
  String(text).split(/\s+/).filter(Boolean).forEach((word, wi) => {
    word.split(/(?<=[a-z0-9])(?=[A-Z])/).forEach((part, pi) => {
      tokens.push({ text: part, sep: wi > 0 && pi === 0 ? ' ' : '' });
    });
  });

  const lines = [];
  let line = '';
  for (const tok of tokens) {
    const candidate = line ? line + tok.sep + tok.text : tok.text;
    if (ctx.measureText(candidate).width <= maxW) { line = candidate; continue; }
    if (line) lines.push(line);
    line = tok.text;
    while (ctx.measureText(line).width > maxW && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
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

// Field names flow inline like the board's chips: "orderId  drink  size"
function flowProps(ctx, props, maxW) {
  const lines = [];
  let line = [];
  let w = 0;
  props.forEach(p => {
    const pw = Math.min(ctx.measureText(p).width, maxW);
    if (line.length && w + L.propGap + pw > maxW) { lines.push(line); line = []; w = 0; }
    w += (line.length ? L.propGap : 0) + pw;
    line.push(p);
  });
  if (line.length) lines.push(line);
  return lines;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function arrowHead(ctx, x, y, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - dx * 9 - dy * 6, y - dy * 9 - dx * 6);
  ctx.lineTo(x - dx * 9 + dy * 6, y - dy * 9 + dx * 6);
  ctx.closePath();
  ctx.fill();
}

function arrow(ctx, x, y1, y2, color) {
  const dir = Math.sign(y2 - y1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2 - dir * 7);
  ctx.stroke();
  arrowHead(ctx, x, y2, 0, dir);
}

// Measure a card (from the shot): returns { h, nameLines, propLines, tags, slim }
function measureCard(ctx, card) {
  ctx.font = `700 ${L.nameSize}px ${DISPLAY}`;
  if (card.slim) {
    const lines = wrap(ctx, `☑ ${card.name} ↺`, L.cardW - 24, 2);
    return { h: 16 + lines.length * L.nameLine + 12, nameLines: lines, propLines: [], tags: [], slim: true };
  }
  const nameLines = wrap(ctx, card.name, L.cardW - 24, 3);
  ctx.font = `500 ${L.propSize}px ${MONO}`;
  // A long one (stuff[]{stuffId, name, price}) wraps after its commas instead of being cut
  const fitted = card.fields.flatMap(p => ctx.measureText(p).width > L.cardW - 24 ? wrap(ctx, p, L.cardW - 24, 4) : [p]);
  const propLines = fitted.length ? flowProps(ctx, fitted, L.cardW - 24) : [];
  // Tags wrap rather than truncate, so a to-do list's full name stays readable
  ctx.font = `700 11.5px ${MONO}`;
  const tags = card.tags.map(tag => ({ ...tag, lines: wrap(ctx, tag.text, L.cardW - 38, 4) }));
  const tagsH = tags.reduce((sum, tag) => sum + tag.lines.length * 14 + 6, 0);
  const h = 11 + L.kindSize + 5 + nameLines.length * L.nameLine
    + (propLines.length ? 5 + propLines.length * L.propLine : 0)
    + (tags.length ? 8 + tagsH : 0) + 12;
  return { h, nameLines, propLines, tags, slim: false, todo: card.todo, list: card.list };
}

function drawCard(ctx, card, m, x, y, tilt, t) {
  const n = (card.kind === 'event' && card.table ? notes.table : card.kind === 'event' && card.external ? notes.external : notes[card.kind]) || notes.screen;

  // A to-do list seen again: a slim dashed reference, not a second full card
  if (m.slim) {
    ctx.save();
    roundRect(ctx, x, y, L.cardW, m.h, 6);
    ctx.globalAlpha = 0.55; ctx.fillStyle = n.fill; ctx.fill(); ctx.globalAlpha = 1;
    ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(22, 59, 16, 0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = n.text; ctx.textBaseline = 'top';
    ctx.font = `700 ${L.nameSize}px ${DISPLAY}`;
    m.nameLines.forEach((line, i) => ctx.fillText(line, x + 12, y + 16 + i * L.nameLine));
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x + L.cardW / 2, y + m.h / 2);
  ctx.rotate(tilt * Math.PI / 180);
  ctx.translate(-L.cardW / 2, -m.h / 2);

  // A list of rows: two more sheets peek out behind, like a little stack
  if (m.list) {
    [[9, 9], [4.5, 4.5]].forEach(([dx, dy]) => {
      roundRect(ctx, dx, dy, L.cardW, m.h, 3);
      ctx.fillStyle = n.fill; ctx.fill();
      ctx.strokeStyle = 'rgba(22, 59, 16, 0.3)'; ctx.lineWidth = 1; ctx.stroke();
    });
  }

  ctx.save();
  ctx.shadowColor = t.shadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, 0, 0, L.cardW, m.h, 3);
  ctx.fillStyle = n.fill;
  ctx.fill();
  ctx.restore();
  // An integration event: a solid dark right edge with a ↗ tab
  if (card.kind === 'event' && card.published) {
    ctx.save();
    roundRect(ctx, 0, 0, L.cardW, m.h, 3); ctx.clip();
    ctx.fillStyle = '#3b2410'; ctx.fillRect(L.cardW - 5, 0, 5, m.h);
    roundRect(ctx, L.cardW - 24, 7, 24, 20, 4); ctx.fill();
    ctx.fillStyle = '#ffe3c2'; ctx.font = `700 14px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('\u2197', L.cardW - 12, 17.5);
    ctx.restore();
  }
  if (n.stroke) {
    roundRect(ctx, 0, 0, L.cardW, m.h, 3);
    ctx.strokeStyle = n.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Little wireframe glyph marks a screen
    ctx.globalAlpha = 0.3;
    roundRect(ctx, L.cardW - 34, 9, 24, 14, 3);
    ctx.strokeStyle = n.text;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Faint ruled lines mark a to-do list
  if (m.todo) {
    ctx.save();
    roundRect(ctx, 0, 0, L.cardW, m.h, 3); ctx.clip();
    ctx.strokeStyle = 'rgba(22, 59, 16, 0.13)'; ctx.lineWidth = 1;
    for (let ly = 22; ly < m.h; ly += 22) { ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(L.cardW, ly); ctx.stroke(); }
    ctx.restore();
  }

  ctx.fillStyle = n.text;
  ctx.textBaseline = 'top';
  let ty = 11;
  ctx.globalAlpha = 0.72;
  ctx.font = `700 ${L.kindSize}px ${MONO}`;
  ctx.letterSpacing = '1px';
  ctx.fillText(((card.trigger ? '⚡ Trigger · ' : '') + (m.todo ? '☑ To-do list' : card.label)).toUpperCase(), 12, ty);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
  ty += L.kindSize + 5;

  ctx.font = `700 ${L.nameSize}px ${DISPLAY}`;
  m.nameLines.forEach(line => { ctx.fillText(line, 12, ty); ty += L.nameLine; });

  if (m.propLines.length) {
    ty += 5;
    ctx.font = `500 ${L.propSize}px ${MONO}`;
    ctx.globalAlpha = 0.85;
    m.propLines.forEach(line => {
      let px = 12;
      line.forEach(p => {
        const [text] = wrap(ctx, p, L.cardW - 24, 1);
        ctx.fillText(text, px, ty);
        px += ctx.measureText(text).width + L.propGap;
      });
      ty += L.propLine;
    });
    ctx.globalAlpha = 1;
  }

  // Card tags (see cardTags): "+ adds" filled orange, "✓ completes" outlined,
  // "☑ reads" a to-do list in green, "⚡ on" a trigger event outlined
  if (m.tags.length) {
    ty += 8;
    ctx.font = `700 11.5px ${MONO}`;
    m.tags.forEach(tag => {
      const w = Math.max(...tag.lines.map(l => ctx.measureText(l).width)) + 14;
      const th = tag.lines.length * 14 + 3;
      roundRect(ctx, 12, ty, w, th, 4);
      const eventFill = (tag.external ? notes.external : notes.event).fill;
      if (tag.kind === 'completes' || tag.kind === 'trigger') {
        ctx.fillStyle = notes.screen.fill; ctx.fill();
        ctx.strokeStyle = '#e0a060'; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.fillStyle = tag.kind === 'reads' ? notes.readModel.fill : eventFill; ctx.fill();
      }
      ctx.fillStyle = tag.kind === 'reads' ? notes.readModel.text : notes.event.text;
      tag.lines.forEach((line, i) => ctx.fillText(line, 19, ty + 3 + i * 14));
      ty += th + 3;
    });
  }
  ctx.restore();
}

// ---------- Scenarios (Given / When / Then) ----------

export { valuesText, gwtLines } from './lines.js';

const GWT = { kwW: 50, swatch: 10, line: 17, nameLine: 19 };

// Scenarios left off the picture look as they do on the board: a "✓ N scenarios" chip,
// and below it a small stack of the events their Givens start from
const STRIP = { chip: 30, gap: 10, head: 26, line: 18, tail: 14 };
// The stack lists every given event, one a line
const stackH = n => STRIP.head + n * STRIP.line + STRIP.tail;
const stripH = (count, givens) => STRIP.chip + (givens ? STRIP.gap + stackH(givens) : 0);

function drawStrip(ctx, strip, x, y, t) {
  ctx.save();
  ctx.textBaseline = 'middle';
  // The chip
  ctx.font = `700 12px ${MONO}`;
  const label = `✓ ${strip.count} ${strip.count === 1 ? 'scenario' : 'scenarios'}`;
  const w = ctx.measureText(label).width + 24;
  roundRect(ctx, x, y, w, STRIP.chip, STRIP.chip / 2);
  ctx.fillStyle = notes.screen.fill; ctx.fill();
  ctx.strokeStyle = notes.screen.stroke; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#75675a';
  ctx.fillText(label, x + 12, y + STRIP.chip / 2 + 1);
  // The stack of given events
  if (strip.givens.length) {
    const sy = y + STRIP.chip + STRIP.gap, sw = L.cardW;
    const layers = Math.min(strip.givens.length, 3);
    const sh = stackH(strip.givens.length) - 10;
    for (let i = layers - 1; i >= 0; i--) {
      ctx.save();
      ctx.shadowColor = i === 0 ? t.shadow : 'transparent'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      roundRect(ctx, x + i * 5, sy + i * 5, sw - 10, sh, 4);
      ctx.globalAlpha = 0.55;   // faded: the stack is context, not the slice's own stickies
      ctx.fillStyle = notes.event.fill; ctx.fill();
      ctx.restore();
      if (i) { ctx.strokeStyle = 'rgba(80, 55, 20, 0.28)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.fillStyle = notes.event.text;
    ctx.globalAlpha = 0.7;
    ctx.font = `700 9.5px ${MONO}`;
    ctx.letterSpacing = '0.8px';
    ctx.fillText(`GIVEN · ${strip.givens.length} ${strip.givens.length === 1 ? 'EVENT' : 'EVENTS'} ▸`, x + 12, sy + 14);
    ctx.globalAlpha = 0.85;
    ctx.letterSpacing = '0px';
    ctx.font = `700 14px ${DISPLAY}`;
    strip.givens.forEach((g, i) => ctx.fillText(wrap(ctx, g, sw - 34, 1)[0] || '', x + 12, sy + 32 + i * STRIP.line));
  }
  ctx.restore();
}

function measureGwt(ctx, scn, showValues = false) {
  ctx.font = `700 15px ${BODY}`;
  const nameLines = wrap(ctx, scn.name, L.cardW - 24, 3);
  ctx.font = `500 13px ${BODY}`;
  const textW = L.cardW - 24 - GWT.kwW - GWT.swatch - 6;
  const lines = scn.lines.map(l => ({ ...l, wrapped: wrap(ctx, l.text, textW, showValues ? 8 : 3) }));
  const h = 12 + nameLines.length * GWT.nameLine + 6
    + lines.reduce((s, l) => s + l.wrapped.length * GWT.line + 3, 0) + 9;
  return { h, nameLines, lines };
}

// An index card: the scenario's name, then its Given / When / Then
function drawGwt(ctx, m, x, y, tilt, t) {
  ctx.save();
  ctx.translate(x + L.cardW / 2, y + m.h / 2);
  ctx.rotate(tilt * Math.PI / 180 * 0.5);
  ctx.translate(-L.cardW / 2, -m.h / 2);
  ctx.shadowColor = t.shadow; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  roundRect(ctx, 0, 0, L.cardW, m.h, 4);
  ctx.fillStyle = notes.screen.fill; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = notes.screen.stroke; ctx.lineWidth = 1; ctx.stroke();

  let ty = 12;
  ctx.fillStyle = notes.screen.text;
  ctx.font = `700 15px ${BODY}`;
  m.nameLines.forEach(line => { ctx.fillText(line, 12, ty); ty += GWT.nameLine; });
  ty += 6;
  m.lines.forEach(l => {
    ctx.fillStyle = '#75675a';
    ctx.font = `700 9.5px ${MONO}`;
    ctx.letterSpacing = '0.8px';
    ctx.fillText(l.kw.toUpperCase(), 12, ty + 3);
    ctx.letterSpacing = '0px';
    const tx = 12 + GWT.kwW;
    if (l.type) {
      roundRect(ctx, tx, ty + 3, GWT.swatch, GWT.swatch, 2);
      ctx.fillStyle = (l.external ? notes.external : notes[l.type] || notes.screen).fill; ctx.fill();
    }
    ctx.font = `${l.type ? 700 : 500} 13px ${BODY}`;
    ctx.fillStyle = l.reject ? '#b4442f' : l.type ? notes.screen.text : '#75675a';
    l.wrapped.forEach((w, i) => ctx.fillText(w, tx + GWT.swatch + 6, ty + i * GWT.line));
    ty += l.wrapped.length * GWT.line + 3;
  });
  ctx.restore();
}

// ---------- Slides: portrait pictures for feeds and carousels ----------

const SLIDE = { w: 1080, h: 1350, perSlide: 2 };

// The model (or a chapter) cut into 4:5 slides of a couple of slices each, so a
// feed shows them big instead of shrinking one long strip
export function renderSlides(args = {}) {
  const { shot = shotOf({ ...args, slides: true }), ...opts } = args;
  const ids = shot.chapters.flatMap(g => g.slices.map(s => s.sliceId));
  const pages = [];
  for (let i = 0; i < ids.length; i += SLIDE.perSlide) pages.push(ids.slice(i, i + SLIDE.perSlide));
  const t = themes[opts.theme] || themes.light;
  return pages.map((page, i) => {
    const art = renderModelImage({
      ...opts, shot: pageOf(shot, page, i === 0),
      pageNote: pages.length > 1 ? `${i + 1} / ${pages.length}` : ''
    });
    // Centre the picture on a paper (or chalkboard) slide
    const slide = document.createElement('canvas');
    slide.width = SLIDE.w;
    slide.height = SLIDE.h;
    const ctx = slide.getContext('2d');
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, SLIDE.w, SLIDE.h);
    drawGrain(ctx, SLIDE.w, SLIDE.h, t.grain);
    const fit = Math.min(SLIDE.w / art.width, SLIDE.h / art.height);
    const w = art.width * fit, h = art.height * fit;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(art, (SLIDE.w - w) / 2, (SLIDE.h - h) / 2, w, h);
    return slide;
  });
}

export function drawGrain(ctx, width, height, color) {
  ctx.fillStyle = color;
  for (let gy = 3; gy < height; gy += 7) {
    for (let gx = 3; gx < width; gx += 7) ctx.fillRect(gx, gy, 1.2, 1.2);
  }
}

const spineBand = { SC: '#5b9be6', SV: '#6cbf5a', AU: '#a58be0' };

// A folded chapter, as on the board: a paper book spine with gilt bands, its
// name reading bottom to top, a coloured band per slice and the slice count
function drawSpine(ctx, sp, x, top, bottom, t) {
  const sx = x + 10, sw = L.spineW - 20, sy = top + 4, sh = bottom - top - 8;
  ctx.save();
  ctx.shadowColor = t.shadow; ctx.shadowBlur = 12; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
  roundRect(ctx, sx, sy, sw, sh, 6);
  const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
  g.addColorStop(0, '#d6c3a2'); g.addColorStop(0.28, '#ead9bb'); g.addColorStop(0.7, '#e4d1b0'); g.addColorStop(1, '#d3bf9c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, sx, sy, sw, sh, 6);
  ctx.strokeStyle = '#c9b493'; ctx.lineWidth = 1; ctx.stroke();
  // Gilt bands
  ctx.strokeStyle = '#a88b5c'; ctx.lineWidth = 1.5;
  [sy + 12, sy + 18, sy + sh - 18, sy + sh - 12].forEach(by => {
    ctx.beginPath(); ctx.moveTo(sx + 8, by); ctx.lineTo(sx + sw - 8, by); ctx.stroke();
  });

  // Slice bands and count at the foot
  ctx.fillStyle = '#75675a';
  ctx.font = `700 12px ${MONO}`;
  ctx.textAlign = 'center';
  const countY = sy + sh - 44;
  ctx.fillText(String(sp.slices.length), sx + sw / 2, countY);
  ctx.textAlign = 'left';
  let by = countY - 12;
  [...sp.slices].reverse().forEach(s => {
    by -= 9;
    roundRect(ctx, sx + sw / 2 - 15, by, 30, 6, 2.5);
    ctx.fillStyle = spineBand[s.actor === 'processor' ? 'AU' : s.type] || '#75675a';
    ctx.fill();
  });

  // Name, reading bottom to top: shrink to fit, then wrap to a second line
  const nameTop = sy + 30, nameBottom = by - 14, avail = nameBottom - nameTop;
  let size = 30, lines;
  do {
    ctx.font = `700 ${size}px ${DISPLAY}`;
    lines = wrap(ctx, sp.name, avail, size > 20 ? 1 : 2);
    size -= 1;
  } while ((lines.some(l => l.endsWith('…')) || ctx.measureText(lines[0]).width > avail) && size > 14);
  ctx.save();
  ctx.translate(sx + sw / 2, nameBottom);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#2b241c';
  ctx.textBaseline = 'middle';
  const lh = size + 4;
  lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lh));
  ctx.restore();
}

// The shot cut to some of its slices (a slide); only the first slide carries the description
function pageOf(shot, ids, first) {
  return { ...shot, description: first ? shot.description : null,
    chapters: shot.chapters.map(g => ({ ...g, slices: g.slices.filter(sl => ids.includes(sl.sliceId)) })).filter(g => g.slices.length) };
}

// shot: what to draw (ModelDetailShareShot); pageNote: e.g. "2 / 5", next to the credit.
export function renderModelImage(args = {}) {
  const { shot = shotOf(args), theme = 'light', pageNote = '', side = null } = args;
  let scale = args.scale ?? 2;
  const t = themes[theme] || themes.light;
  // A book with usage: each slice's count beside its kind, and the window's total by the credit
  const usage = shot.usage;
  const usedMax = usage ? usage.max : 0;
  const groups = shot.chapters.map(g => ({ ...g, chapter: g.chapterId ? { id: g.chapterId, name: g.name } : null, flow: g.flow ? { name: g.flow } : null }));
  const slices = groups.filter(g => !g.folded).flatMap(g => g.slices);
  const chapterH = groups.some(g => g.chapter && !g.folded) ? 58 : 0;

  const measureCtx = document.createElement('canvas').getContext('2d');

  // Lay out columns and measure lanes so rows line up across slices
  const columns = slices.map(slice => {
    const lanes = slice.lanes.map(l => l.map(card => ({ card, m: measureCard(measureCtx, card) })));
    const gwt = slice.scenarios.map(scn => measureGwt(measureCtx, scn, shot.values));
    // Not shown in full: the board's collapsed look (count chip + the given stack)
    const count = slice.scenarios.length ? 0 : slice.scenarioCount;
    const strip = count ? { count, givens: slice.givens, h: stripH(count, slice.givens.length) } : null;
    return { slice, lanes, gwt, strip };
  });
  // A fourth lane of scenario cards (or the collapsed strip), when there are some. One slice with its scenarios
  // shown in full: they stand in a column beside the lanes instead (Jocelyn, 2026-11-07: "very vertical"); side: false keeps the lane
  const withGwt = columns.some(c => c.gwt.length || c.strip);
  const beside = side !== false && columns.length === 1 && columns[0].gwt.length > 0;
  const laneIds = withGwt && !beside ? [0, 1, 2, 3] : [0, 1, 2];

  // Left-to-right placement: a slice column, or one narrow spine per folded chapter
  let runX = 0;
  const spines = [];
  groups.forEach(g => {
    g.x0 = runX;
    if (g.folded) { spines.push({ ...g, x: runX }); runX += L.spineW; }
    else g.slices.forEach(s => { columns.find(c => c.slice === s).x = runX; runX += L.colW; });
    g.x1 = runX;
  });
  const gridW0 = Math.max(runX, L.colW);

  const laneH = laneIds.map(l => Math.max(L.minLaneH, ...columns.map(c => {
    const cards = l === 3 ? (c.strip ? [{ m: { h: c.strip.h } }] : c.gwt.map(m => ({ m }))) : c.lanes[l];
    if (!cards.length) return 0;
    return L.cellPadY * 2 + cards.reduce((s, x) => s + x.m.h, 0) + L.cardGap * (cards.length - 1);
  })));

  // The scenarios' column: its cards one under another, from the top of the lanes
  const sideGap = 22, sideColGap = 18;
  // Many scenarios flow into up to four columns (in reading order, top to bottom, then the next column):
  // the fewest that keep them no taller than the lanes, so the picture stays near square
  const lanesTotal0 = laneH.reduce((s, h) => s + h, 0);
  const stackH = list => list.reduce((s, m) => s + m.h, 0) + L.cardGap * Math.max(list.length - 1, 0);
  const splitInto = (list, k) => {
    const target = stackH(list) / k, cols = [[]];
    list.forEach(m => {
      const cur = cols[cols.length - 1];
      if (cur.length && cols.length < k && stackH([...cur, m]) > target + m.h / 2) cols.push([m]); else cur.push(m);
    });
    return cols;
  };
  let sideCols = [];
  if (beside) {
    const fits = Math.max(lanesTotal0, 700) - (L.cellPadY * 2 + 30);
    for (let k = 1; k <= 4; k++) {
      sideCols = splitInto(columns[0].gwt, k);
      if (Math.max(...sideCols.map(stackH)) <= fits || k === Math.min(4, columns[0].gwt.length)) break;
    }
  }
  const cardsW = sideCols.length * L.cardW + Math.max(sideCols.length - 1, 0) * sideColGap;
  // At least the picture's least width (the title and the credit need it); the column takes what's left
  const sideW = beside ? Math.max(cardsW + 2 * 22, L.minW - (L.pad * 2 + L.labelW + gridW0 + sideGap)) : 0;
  const sideH = beside ? L.cellPadY + 30 + Math.max(...sideCols.map(stackH)) + L.cellPadY : 0;
  const width = beside ? L.pad * 2 + L.labelW + gridW0 + sideGap + sideW : Math.max(L.pad * 2 + L.labelW + gridW0, L.minW);
  // The model's description under the title: a readable measure, up to 4 lines
  measureCtx.font = `500 19px ${BODY}`;
  const descLines = shot.description
    ? wrap(measureCtx, shot.description, Math.min(width - L.pad * 2, 820), 4) : [];
  const descH = descLines.length ? descLines.length * 27 + 12 : 0;
  const headTop = L.pad + L.titleH + descH + chapterH;
  // Slice descriptions under their names, when asked for (up to 4 lines each)
  measureCtx.font = `500 14px ${BODY}`;
  columns.forEach(c => {
    c.notes = c.slice.note ? wrap(measureCtx, c.slice.note, L.colW - 36, 4) : [];
  });
  // The header grows to fit the tallest name + note (notes sit right under the name)
  measureCtx.font = `700 21px ${DISPLAY}`;
  columns.forEach(c => { c.nameLines = wrap(measureCtx, c.slice.title, L.colW - 36, 2).length; });
  const headH = Math.max(L.headH, ...columns.map(c => c.notes.length ? 18 + c.nameLines * 24 + 8 + c.notes.length * 18 + 14 : 0));
  const lanesTop = headTop + headH;
  const lanesTotal = laneH.reduce((s, h) => s + h, 0);
  const bodyH = Math.max(lanesTotal, sideH);
  const height = lanesTop + bodyH + 8 + L.footH + L.pad / 2;

  const canvas = document.createElement('canvas');
  // iPhone Safari won't draw a canvas past ~16.7M pixels (and long sides are
  // capped too), so big models are drawn a little less sharp rather than blank
  scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (width * height)), MAX_SIDE / width, MAX_SIDE / height);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);
  drawGrain(ctx, width, height, t.grain);

  // Title
  ctx.fillStyle = t.text;
  ctx.font = `700 46px ${DISPLAY}`;
  const [title] = wrap(ctx, shot.title, width - L.pad * 2, 1);
  ctx.fillText(title, L.pad, L.pad - 6);
  if (descLines.length) {
    ctx.fillStyle = t.text;
    ctx.font = `500 19px ${BODY}`;
    descLines.forEach((line, i) => ctx.fillText(line, L.pad, L.pad + 64 + i * 27));
  }
  ctx.fillStyle = t.muted;
  ctx.font = `500 18px ${BODY}`;
  ctx.fillText('An event model — time flows left to right →', L.pad, L.pad + 62 + descH);

  // Lane bands + labels
  const gridX = L.pad + L.labelW;
  const gridW = beside ? gridW0 : width - L.pad * 2 - L.labelW;
  let y = lanesTop;
  const laneY = [];
  laneIds.forEach(l => {
    laneY.push(y);
    roundRect(ctx, L.pad, y + 4, L.labelW + gridW, laneH[l] - 8, 10);
    ctx.fillStyle = t.lanes[l];
    ctx.fill();

    ctx.save();
    ctx.translate(L.pad + L.labelW / 2 + 2, y + laneH[l] / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = t.muted;
    ctx.font = `700 11px ${MONO}`;
    ctx.letterSpacing = '1.3px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [label] = wrap(ctx, (laneLabels[l] || 'Scenarios').toUpperCase(), laneH[l] - 20, 1);
    ctx.fillText(label, 0, 0);
    ctx.restore();
    y += laneH[l];
  });
  const lanesBottom = y;

  if (!columns.length && !spines.length) {
    ctx.fillStyle = t.muted;
    ctx.font = `500 16px ${BODY}`;
    ctx.fillText('No slices yet', gridX + 20, lanesTop + 24);
  }

  // Folded chapters: a book spine from the slice headers down through the lanes
  spines.forEach(sp => drawSpine(ctx, sp, gridX + sp.x, headTop, lanesBottom, t));

  // Chapters: handwritten name on a bracket spanning the chapter's columns
  groups.forEach(({ chapter, folded, flow, x0: gx0, x1: gx1 }) => {
    if (!chapter || folded) return;
    const x0 = gridX + gx0 + 14;
    const x1 = gridX + gx1 - 14;
    const ly = L.pad + L.titleH + descH + 40;
    ctx.fillStyle = t.text;
    ctx.font = `700 26px ${DISPLAY}`;
    const [label] = wrap(ctx, flow ? `${chapter.name} · ↳ ${flow.name}` : chapter.name, x1 - x0 - 8, 1);
    ctx.fillText(label, x0 + 4, ly - 34);
    ctx.strokeStyle = t.text;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, ly + 8);
    ctx.lineTo(x0, ly);
    ctx.lineTo(x1, ly);
    ctx.lineTo(x1, ly + 8);
    ctx.stroke();
  });

  columns.forEach(col => {
    const x = gridX + col.x;
    const cx = x + L.colW / 2;

    // Column divider
    if (col.x > 0) {
      ctx.save();
      ctx.strokeStyle = t.line;
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, headTop);
      ctx.lineTo(x, lanesBottom);
      ctx.stroke();
      ctx.restore();
    }

    // Slice header: colour bar + kind kicker, handwritten name
    const hy = headTop;
    // Automation halves (a processor drives the view or change) share the automation accent
    ctx.fillStyle = (col.slice.actor === 'processor' ? sliceAccent.AU : sliceAccent[col.slice.type]) || t.muted;
    roundRect(ctx, x + 18, hy + 3, 18, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = t.muted;
    ctx.font = `700 10px ${MONO}`;
    ctx.letterSpacing = '1px';
    const kind = (sliceTypeLabels[col.slice.type] || col.slice.type).toUpperCase();
    ctx.fillText(kind, x + 42, hy);
    const kindW = ctx.measureText(kind).width;
    ctx.letterSpacing = '0px';
    if (usage && col.slice.used !== null) {
      // "40 in 30d", shaded like the board's badge; "unused" dashed
      const n = col.slice.used, days = usage.days;
      const label = n ? `${n} in ${days}d` : 'unused';
      ctx.save();
      ctx.font = `700 10px ${MONO}`;
      const bw = ctx.measureText(label).width + 12, bx = x + 42 + kindW + 10, by = hy - 2;
      roundRect(ctx, bx, by, bw, 15, 4);
      if (n) { ctx.globalAlpha = 0.25 + 0.75 * heatOf(n, usedMax) / 4; ctx.fillStyle = notes.event.fill; ctx.fill(); ctx.globalAlpha = 1; }
      else ctx.setLineDash([3, 2]);
      ctx.strokeStyle = n ? notes.event.fill : t.muted; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = n ? t.text : t.muted;
      ctx.fillText(label, bx + 6, by + 1);
      ctx.restore();
    }
    ctx.fillStyle = t.text;
    ctx.font = `700 21px ${DISPLAY}`;
    wrap(ctx, col.slice.title, L.colW - 36, 2)
      .forEach((line, li) => ctx.fillText(line, x + 18, hy + 18 + li * 24));
    if (col.notes.length) {
      ctx.fillStyle = t.muted;
      ctx.font = `500 14px ${BODY}`;
      col.notes.forEach((line, li) => ctx.fillText(line, x + 18, hy + 18 + col.nameLines * 24 + 8 + li * 18));
    }

    // Cards, vertically centred in each lane
    const placed = [0, 1, 2].map(l => {
      const cards = col.lanes[l];
      const total = cards.reduce((s, c) => s + c.m.h, 0) + L.cardGap * Math.max(cards.length - 1, 0);
      let cy = laneY[l] + (laneH[l] - total) / 2;
      return cards.map(c => {
        const box = { x: cx - L.cardW / 2, y: cy, h: c.m.h, card: c.card };
        drawCard(ctx, c.card, c.m, box.x, box.y, noteTilt(col.slice.sliceId + c.card.id), t);
        cy += c.m.h + L.cardGap;
        return box;
      });
    });

    // Scenario cards: in their own column beside the lanes (one slice), else stacked from the top of their lane
    if (beside) {
      const sx = gridX + gridW0 + sideGap;
      roundRect(ctx, sx, lanesTop + 4, sideW, Math.max(lanesTotal, sideH) - 8, 10);
      ctx.fillStyle = t.lanes[3] || t.lanes[1];
      ctx.fill();
      ctx.fillStyle = t.muted;
      ctx.font = `700 11px ${MONO}`;
      ctx.letterSpacing = '1.3px';
      ctx.fillText('SCENARIOS', sx + 22, lanesTop + 4 + L.cellPadY - 8);
      ctx.letterSpacing = '0px';
      const x0 = sx + (sideW - cardsW) / 2;
      let i = 0;
      sideCols.forEach((list, ci) => {
        let gy = lanesTop + 4 + L.cellPadY + 22;
        list.forEach(m => {
          drawGwt(ctx, m, x0 + ci * (L.cardW + sideColGap), gy, noteTilt(col.slice.sliceId + 'gwt' + i++), t);
          gy += m.h + L.cardGap;
        });
      });
    } else if (withGwt) {
      let gy = laneY[3] + L.cellPadY;
      col.gwt.forEach((m, i) => {
        drawGwt(ctx, m, cx - L.cardW / 2, gy, noteTilt(col.slice.sliceId + 'gwt' + i), t);
        gy += m.h + L.cardGap;
      });
      if (col.strip) drawStrip(ctx, col.strip, cx - L.cardW / 2, gy, t);
    }

    // Arrows between neighbouring lanes
    const f = flows[col.slice.type] || [];
    [1, 2].forEach(l => {
      const upper = placed[l - 1], lower = placed[l];
      if (!f[l] || !upper.length || !lower.length) return;
      const top = upper[upper.length - 1].y + upper[upper.length - 1].h + 6;
      const bottom = lower[0].y - 6;
      if (bottom - top < 12) return;
      if (f[l] === 'down') arrow(ctx, cx, top, bottom, t.arrow);
      else arrow(ctx, cx, bottom, top, t.arrow);
    });

    // Older single-column automations: an elbow from their first event up the
    // column's left edge into the processor. In a to-do view the "⚡ Trigger"
    // label on the event says it, so no extra arrow.
    const proc = placed[0].find(b => b.card.kind === 'processor');
    const triggers = proc && col.slice.type === 'AU' ? placed[2].slice(0, 1) : [];
    triggers.forEach((ev, i) => {
      const ex = ev.x - 12 - i * 6, ey = ev.y + Math.min(ev.h / 2, 26), py = proc.y + proc.h / 2;
      ctx.strokeStyle = t.arrow;
      ctx.fillStyle = t.arrow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ev.x - 2, ey);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex, py);
      ctx.lineTo(proc.x - 8, py);
      ctx.stroke();
      arrowHead(ctx, proc.x - 1, py, 1, 0);
    });
  });

  // Footer: legend, and the credit on the right
  const fy = lanesTop + bodyH + 26;
  // Only the kinds of sticky the picture has (yellow is explained only when there's some)
  const pictured = new Set(slices.flatMap(s => s.lanes.flat().map(c => c.kind === 'event' && c.external ? 'external' : c.kind === 'event' && c.published ? 'published' : c.kind)));
  const legend = [['command', 'Command'], ['event', 'Event'], ['external', 'External event'], ['published', 'Integration event ↗'], ['readModel', 'Read model'], ['screen', 'Screen'], ['processor', 'Automation']]
    .filter(([type]) => pictured.has(type));
  let lx = L.pad;
  ctx.font = `600 14px ${BODY}`;
  legend.forEach(([type, label]) => {
    roundRect(ctx, lx, fy, 15, 15, 3);
    ctx.fillStyle = notes[type].fill;
    ctx.fill();
    if (notes[type].stroke) { ctx.strokeStyle = notes[type].stroke; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = t.muted;
    ctx.fillText(label, lx + 22, fy);
    lx += 22 + ctx.measureText(label).width + 18;
  });
  // To-do lists in the picture: say what their tags mean
  if (slices.some(s => s.lanes.flat().some(c => c.todo))) {
    const key = '+ adds to a to-do list · ✓ ticks it off';
    ctx.fillStyle = t.muted;
    ctx.fillText(key, lx, fy);
    lx += ctx.measureText(key).width + 18;
  }
  ctx.fillStyle = t.text;
  ctx.font = `700 14px ${MONO}`;
  const usedNote = usage ? `Used: ${usage.total} events in ${usage.days} days · ` : '';
  const credit = `${usedNote}${pageNote ? `Made with Event Book · ${pageNote}` : 'Made with Event Book'}`;
  const creditW = ctx.measureText(credit).width;
  if (lx + creditW + 12 <= width - L.pad) {
    ctx.fillText(credit, width - L.pad - creditW, fy);
  } else {
    ctx.fillText(credit, L.pad, fy + 28);
  }

  return canvas;
}
