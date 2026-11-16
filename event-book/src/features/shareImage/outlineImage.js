// ===========================================
// SHARE IMAGE - The outline as a picture (SV: Outline Image)
// The model as a table of contents: chapters, each slice as a card with its
// kind, its flow (screen → command → event), its note, and — with Scenarios —
// its Given / When / Then. For the whole model, one chapter or one slice.
// ===========================================

import { shotOf } from './shotOf.js';
import { DISPLAY, BODY, MONO, notes, themes, sliceAccent, wrap, roundRect, drawGrain, MAX_SIDE } from './render.js';

const W = 1080;
const PAD = 64;
const CARD_PAD = 22;
const FOLDED_H = 74;                               // a folded chapter: name, then count and squares
const INNER = W - 2 * PAD - 2 * CARD_PAD - 10;    // text width inside a card (past its colour bar)
// One slice with its scenarios, in two columns (when that's squarer): the slice on the left, Given / When / Then on the right
const GAP = 28;
const LEFT_W = 300;
const RIGHT_W = INNER - LEFT_W - GAP;
const KIND_ROOM = 24;
const kindLabel = { SC: 'Change', SV: 'View', AU: 'Automation' };

// Every block is measured first (the canvas height follows), then drawn
function layoutSlice(ctx, slice, opts, columns = false) {
  const blocks = [];
  const left = columns ? LEFT_W : INNER, right = columns ? RIGHT_W : INNER;
  ctx.font = `700 28px ${DISPLAY}`;
  blocks.push({ kind: 'name', lines: wrap(ctx, slice.title, columns ? LEFT_W : INNER - 150, columns ? 4 : 2), lh: 34 });
  const flow = slice.flow.join('  →  ');
  if (flow) { ctx.font = `500 20px ${BODY}`; blocks.push({ kind: 'flow', lines: wrap(ctx, flow, left, columns ? 6 : 3), lh: 27 }); }
  // Usage (the book's app's use, from the nightly job): how much, and where it stands
  const used = slice.usageText;
  if (used) { ctx.font = `600 19px ${BODY}`; blocks.push({ kind: 'usage', lines: wrap(ctx, used, left, columns ? 5 : 3), lh: 26 }); }
  if (slice.note) {
    ctx.font = `italic 400 19px ${BODY}`;
    blocks.push({ kind: 'note', lines: wrap(ctx, slice.note, left, columns ? 8 : 4), lh: 26 });
  }
  slice.scenarios.forEach(scn => {
    ctx.font = `700 19px ${BODY}`;
    const name = wrap(ctx, scn.name, right - 20, 2);
    ctx.font = `500 18px ${BODY}`;
    const lines = scn.lines.map(l => ({ ...l, wrapped: wrap(ctx, l.text, right - 20 - 92 - 18, opts.showValues ? 6 : 2) }));
    blocks.push({ kind: 'gwt', name, lines });
  });
  const sum = list => list.reduce((h, b) => h + blockHeight(b) + 6, 0);
  // In two columns the scenarios start below the kind label (CHANGE, VIEW…) in the card's corner
  const height = CARD_PAD * 2 + (columns ? Math.max(sum(blocks.filter(b => b.kind !== 'gwt')), KIND_ROOM + sum(blocks.filter(b => b.kind === 'gwt'))) : sum(blocks));
  return { slice, blocks, height, columns, gwtWidth: right };
}

function blockHeight(b) {
  if (b.kind === 'gwt') return 14 + b.name.length * 25 + b.lines.reduce((h, l) => h + l.wrapped.length * 24 + 2, 0) + 12;
  return b.lines.length * b.lh;
}

// shot: what to draw (ModelDetailShareShot, as an outline). A chapter folded on screen is one line here
// too (its name, slice count and a square per slice).
export function renderOutlineImage(args = {}) {
  const { shot = shotOf({ ...args, outline: true }), theme = 'light', scale = 1.5, columns = null } = args;
  const t = themes[theme] || themes.light;
  const opts = { showValues: shot.values };
  const groups = shot.chapters.map(g => ({ ...g, chapter: g.chapterId ? { id: g.chapterId, name: g.name } : null }));
  const only = shot.scope.slices;

  const measure = document.createElement('canvas').getContext('2d');
  // Head: the model's name, its description, what's in it
  measure.font = `700 56px ${DISPLAY}`;
  const title = wrap(measure, shot.title, W - 2 * PAD, 2);
  measure.font = `400 24px ${BODY}`;
  const desc = shot.description ? wrap(measure, shot.description, W - 2 * PAD, 6) : [];
  const total = groups.reduce((n, g) => n + g.slices.length, 0);
  let y = PAD + title.length * 64 + (desc.length ? 14 + desc.length * 33 : 0) + 56;

  // Sections, until the picture would get too tall to draw
  const maxH = Math.floor(MAX_SIDE / scale) - 160;
  const sections = [];
  let shown = 0;
  for (const g of groups) {
    const head = g.chapter ? 74 : (shot.chaptersInBook ? 60 : 0);
    if (g.folded) {
      // A folded chapter is one compact entry: its name, then its count and squares
      if (y + FOLDED_H > maxH) break;
      sections.push({ g, head: 0, cards: [], folded: true });
      y += FOLDED_H;
      shown += g.slices.length;
      continue;
    }
    const cards = [];
    let below = y + head;               // where the next card would start
    for (const s of g.slices) {
      let card = layoutSlice(measure, s, opts);
      // One slice with its scenarios: two columns when that makes the picture squarer (columns: false keeps one)
      if (only.length === 1 && columns !== false && card.blocks.some(b => b.kind === 'gwt')) {
        const two = layoutSlice(measure, s, opts, true);
        const ratio = c => (below + c.height + 16 + 18 + 90) / W;
        if (Math.abs(ratio(two) - 1) < Math.abs(ratio(card) - 1)) card = two;
      }
      if (below + card.height + 16 > maxH) break;
      cards.push(card);
      below += card.height + 16;
    }
    if (!cards.length) break;
    sections.push({ g, head, cards });
    y += head + cards.reduce((h, c) => h + c.height + 16, 0) + 18;
    shown += cards.length;
    if (cards.length < g.slices.length) break;
  }
  const more = total - shown;
  const height = Math.ceil(y + (more ? 50 : 0) + 90);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, height);
  drawGrain(ctx, W, height, t.grain);
  ctx.textBaseline = 'top';

  y = PAD;
  ctx.fillStyle = t.text; ctx.font = `700 56px ${DISPLAY}`;
  title.forEach(l => { ctx.fillText(l, PAD, y); y += 64; });
  if (desc.length) {
    y += 14; ctx.fillStyle = t.text; ctx.font = `400 24px ${BODY}`;
    desc.forEach(l => { ctx.fillText(l, PAD, y); y += 33; });
  }
  y += 16;
  ctx.fillStyle = t.muted; ctx.font = `700 15px ${MONO}`;
  const chapters = groups.filter(g => g.chapter).length;
  ctx.fillText(`${total} ${total === 1 ? 'SLICE' : 'SLICES'}${chapters ? ` · ${chapters} ${chapters === 1 ? 'CHAPTER' : 'CHAPTERS'}` : ''} · OUTLINE`.toUpperCase(), PAD, y);
  y += 40;

  for (const { g, head, cards, folded } of sections) {
    if (head) {
      ctx.fillStyle = g.chapter ? t.text : t.muted;
      ctx.font = g.chapter ? `700 36px ${DISPLAY}` : `700 26px ${DISPLAY}`;
      ctx.fillText(g.chapter ? g.chapter.name : 'Not in a chapter', PAD, y + 4);
      ctx.fillStyle = t.text;
      ctx.fillRect(PAD, y + head - 14, W - 2 * PAD, g.chapter ? 2.5 : 1);
      y += head;
    }
    if (folded) {
      // Folded on the board: its name, then how many slices and a square per slice in its colour
      ctx.fillStyle = t.text; ctx.font = `700 26px ${DISPLAY}`;
      ctx.fillText(g.chapter.name, PAD, y);
      ctx.fillStyle = t.muted; ctx.font = `700 13px ${MONO}`;
      const count = `${g.slices.length} ${g.slices.length === 1 ? 'SLICE' : 'SLICES'}`;
      ctx.fillText(count, PAD, y + 38);
      let sx = PAD + ctx.measureText(count).width + 14;
      g.slices.forEach(s => {
        if (sx > W - PAD - 12) return;
        ctx.fillStyle = s.actor === 'processor' ? sliceAccent.AU : (sliceAccent[s.type] || t.muted);
        roundRect(ctx, sx, y + 37, 12, 12, 3); ctx.fill();
        sx += 16;
      });
      ctx.fillStyle = t.line; ctx.fillRect(PAD, y + FOLDED_H - 12, W - 2 * PAD, 1);
      y += FOLDED_H;
      continue;
    }
    for (const card of cards) { drawSliceCard(ctx, card, PAD, y, t); y += card.height + 16; }
    y += 18;
  }
  if (more) {
    ctx.fillStyle = t.muted; ctx.font = `600 20px ${BODY}`;
    ctx.fillText(`…and ${more} more ${more === 1 ? 'slice' : 'slices'}: share ${shot.scope.chapters.length ? 'them one slice at a time' : 'a chapter for the rest'}`, PAD, y);
  }
  ctx.fillStyle = t.text; ctx.font = `700 16px ${MONO}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Made with Event Book · eventbook.itsybit.se', W - PAD, height - PAD + 20);
  return canvas;
}

function drawSliceCard(ctx, card, x, y, t) {
  const w = W - 2 * PAD;
  const { slice } = card;
  const actor = slice.actor;
  ctx.fillStyle = t === themes.dark ? '#2b2620' : '#fffdf8';
  ctx.save(); ctx.shadowColor = t.shadow; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, card.height, 12); ctx.fill();
  ctx.restore();
  ctx.fillStyle = actor === 'processor' ? sliceAccent.AU : (sliceAccent[slice.type] || t.muted);
  roundRect(ctx, x + 10, y + 12, 6, card.height - 24, 3); ctx.fill();

  const tx = x + CARD_PAD + 10;
  let ty = y + CARD_PAD;
  ctx.fillStyle = t.muted; ctx.font = `700 13px ${MONO}`; ctx.textAlign = 'right';
  ctx.fillText(((actor === 'processor' && slice.type !== 'AU' ? '⚙ ' : '') + (kindLabel[slice.type] || slice.type)).toUpperCase(), x + w - CARD_PAD, ty + 6);
  ctx.textAlign = 'left';
  // Two columns: the slice's own blocks on the left; the scenarios from the top of the right column
  const gx = card.columns ? tx + LEFT_W + GAP : tx;
  const gw = card.columns ? card.gwtWidth : INNER;
  let gy = card.columns ? ty + KIND_ROOM : null;
  if (card.columns) { ctx.fillStyle = t.line; ctx.fillRect(gx - GAP / 2, ty, 1, card.height - 2 * CARD_PAD); }
  for (const b of card.blocks) {
    if (b.kind === 'name') { ctx.fillStyle = t.text; ctx.font = `700 28px ${DISPLAY}`; }
    else if (b.kind === 'flow') { ctx.fillStyle = t.muted; ctx.font = `500 20px ${BODY}`; }
    else if (b.kind === 'usage') { ctx.fillStyle = t.text; ctx.font = `600 19px ${BODY}`; }
    else if (b.kind === 'note') { ctx.fillStyle = t.text; ctx.font = `italic 400 19px ${BODY}`; }
    if (b.kind !== 'gwt') { b.lines.forEach(l => { ctx.fillText(l, tx, ty); ty += b.lh; }); ty += 6; continue; }
    // A scenario: a thin rule, its name, then Given / When / Then with a swatch per sticky
    if (card.columns) { [ty, gy] = [gy, ty]; }   // draw in the right column, from where its last scenario ended
    const cx = gx;
    ty += 6;
    ctx.fillStyle = t.line; ctx.fillRect(cx, ty, gw, 1); ty += 8;
    ctx.fillStyle = t.text; ctx.font = `700 19px ${BODY}`;
    b.name.forEach(l => { ctx.fillText(l, cx, ty); ty += 25; });
    for (const line of b.lines) {
      ctx.fillStyle = t.muted; ctx.font = `700 13px ${MONO}`;
      ctx.fillText(line.kw.toUpperCase(), cx + 4, ty + 3);
      const sx = cx + 96;
      const note = line.type ? (line.external ? notes.external : notes[line.type]) : null;
      if (note) { ctx.fillStyle = note.fill; roundRect(ctx, sx, ty + 4, 12, 12, 2); ctx.fill(); }
      ctx.fillStyle = line.reject ? '#c0392b' : t.text; ctx.font = `500 18px ${BODY}`;
      line.wrapped.forEach((l, i) => { ctx.fillText(l, sx + 18, ty + i * 24); });
      ty += line.wrapped.length * 24 + 2;
    }
    ty += 12;
    if (card.columns) { [ty, gy] = [gy, ty]; }   // back to the left column
  }
}
