// ===========================================
// SHARE IMAGE - The outline as a picture (SV: Outline Image)
// The model as a table of contents: chapters, each slice as a card with its
// kind, its flow (screen → command → event), its note, and — with Scenarios —
// its Given / When / Then. For the whole model, one chapter or one slice.
// ===========================================

import { projectState, getBoardGroups, sliceTitle, getScenariosForSlice } from '../../core/projections.js';
import { sliceActor } from '../board/command.js';
import { isChapterFolded } from '../board/view.js';
import { DISPLAY, BODY, MONO, notes, themes, sliceAccent, wrap, gwtLines, roundRect, drawGrain, MAX_SIDE } from './render.js';

const W = 1080;
const PAD = 64;
const CARD_PAD = 22;
const FOLDED_H = 74;                               // a folded chapter: name, then count and squares
const INNER = W - 2 * PAD - 2 * CARD_PAD - 10;    // text width inside a card (past its colour bar)
const kindLabel = { SC: 'Change', SV: 'View', AU: 'Automation' };
// Read order of a slice's stickies: the way its story flows through the lanes
const laneFlow = { SC: [0, 1, 2], SV: [2, 1, 0], AU: [2, 0, 1] };
const laneOf = { screen: 0, processor: 0, command: 1, readModel: 1, event: 2 };

function flowText(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  return (laneFlow[slice.type] || [0, 1, 2]).flatMap(l => els.filter(e => laneOf[e.type] === l)).map(e => e.name).join('  →  ');
}

// Every block is measured first (the canvas height follows), then drawn
function layoutSlice(ctx, slice, state, opts) {
  const blocks = [];
  ctx.font = `700 28px ${DISPLAY}`;
  blocks.push({ kind: 'name', lines: wrap(ctx, sliceTitle(slice, state), INNER - 150, 2), lh: 34 });
  const flow = flowText(slice, state);
  if (flow) { ctx.font = `500 20px ${BODY}`; blocks.push({ kind: 'flow', lines: wrap(ctx, flow, INNER, 3), lh: 27 }); }
  if (opts.showSliceNotes && slice.description) {
    ctx.font = `italic 400 19px ${BODY}`;
    blocks.push({ kind: 'note', lines: wrap(ctx, slice.description, INNER, 4), lh: 26 });
  }
  if (opts.showScenarios) {
    getScenariosForSlice(slice.id, state).forEach(scn => {
      ctx.font = `700 19px ${BODY}`;
      const name = wrap(ctx, scn.name || 'Scenario', INNER - 20, 2);
      ctx.font = `500 18px ${BODY}`;
      const lines = gwtLines(scn, state).map(l => ({ ...l, wrapped: wrap(ctx, l.text, INNER - 20 - 92 - 18, 2) }));
      blocks.push({ kind: 'gwt', name, lines });
    });
  }
  const height = CARD_PAD * 2 + blocks.reduce((h, b) => h + blockHeight(b) + 6, 0);
  return { slice, blocks, height };
}

function blockHeight(b) {
  if (b.kind === 'gwt') return 14 + b.name.length * 25 + b.lines.reduce((h, l) => h + l.wrapped.length * 24 + 2, 0) + 12;
  return b.lines.length * b.lh;
}

// chapterId: one chapter or several (an array). foldChapters: for the whole model, a chapter
// folded on screen is one line here too (its name, slice count and a square per slice).
export function renderOutlineImage({ theme = 'light', showDescription = true, showSliceNotes = false, showScenarios = false,
  foldChapters = true, scale = 1.5, events = null, chapterId = null, onlySlices = null } = {}) {
  const t = themes[theme] || themes.light;
  const state = events ? projectState(events) : projectState();
  const opts = { showSliceNotes, showScenarios };
  const groups = getBoardGroups(state)
    .filter(g => !chapterId || [].concat(chapterId).includes(g.chapter?.id))
    .map(g => ({ ...g, slices: g.slices.filter(s => !onlySlices || onlySlices.includes(s.id)) }))
    .filter(g => g.slices.length);

  const measure = document.createElement('canvas').getContext('2d');
  // Head: the model's name, its description, what's in it
  measure.font = `700 56px ${DISPLAY}`;
  const title = wrap(measure, state.modelName || 'Event model', W - 2 * PAD, 2);
  measure.font = `400 24px ${BODY}`;
  const desc = showDescription && state.modelDescription && !onlySlices ? wrap(measure, state.modelDescription, W - 2 * PAD, 6) : [];
  const total = groups.reduce((n, g) => n + g.slices.length, 0);
  let y = PAD + title.length * 64 + (desc.length ? 14 + desc.length * 33 : 0) + 56;

  // Sections, until the picture would get too tall to draw
  const maxH = Math.floor(MAX_SIDE / scale) - 160;
  const sections = [];
  let shown = 0;
  for (const g of groups) {
    const head = g.chapter ? 74 : (state.chapterOrder.length ? 60 : 0);
    if (foldChapters && !chapterId && !onlySlices && g.chapter && isChapterFolded(g.chapter.id)) {
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
      const card = layoutSlice(measure, s, state, opts);
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
        ctx.fillStyle = sliceActor(s, state) === 'processor' ? sliceAccent.AU : (sliceAccent[s.type] || t.muted);
        roundRect(ctx, sx, y + 37, 12, 12, 3); ctx.fill();
        sx += 16;
      });
      ctx.fillStyle = t.line; ctx.fillRect(PAD, y + FOLDED_H - 12, W - 2 * PAD, 1);
      y += FOLDED_H;
      continue;
    }
    for (const card of cards) { drawSliceCard(ctx, card, PAD, y, t, state); y += card.height + 16; }
    y += 18;
  }
  if (more) {
    ctx.fillStyle = t.muted; ctx.font = `600 20px ${BODY}`;
    ctx.fillText(`…and ${more} more ${more === 1 ? 'slice' : 'slices'}: share ${chapterId ? 'them one slice at a time' : 'a chapter for the rest'}`, PAD, y);
  }
  ctx.fillStyle = t.text; ctx.font = `700 16px ${MONO}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Made with Event Book · eventpad.itsybit.se', W - PAD, height - PAD + 20);
  return canvas;
}

function drawSliceCard(ctx, card, x, y, t, state) {
  const w = W - 2 * PAD;
  const { slice } = card;
  const actor = sliceActor(slice, state);
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
  for (const b of card.blocks) {
    if (b.kind === 'name') { ctx.fillStyle = t.text; ctx.font = `700 28px ${DISPLAY}`; }
    else if (b.kind === 'flow') { ctx.fillStyle = t.muted; ctx.font = `500 20px ${BODY}`; }
    else if (b.kind === 'note') { ctx.fillStyle = t.text; ctx.font = `italic 400 19px ${BODY}`; }
    if (b.kind !== 'gwt') { b.lines.forEach(l => { ctx.fillText(l, tx, ty); ty += b.lh; }); ty += 6; continue; }
    // A scenario: a thin rule, its name, then Given / When / Then with a swatch per sticky
    ty += 6;
    ctx.fillStyle = t.line; ctx.fillRect(tx, ty, INNER, 1); ty += 8;
    ctx.fillStyle = t.text; ctx.font = `700 19px ${BODY}`;
    b.name.forEach(l => { ctx.fillText(l, tx, ty); ty += 25; });
    for (const line of b.lines) {
      ctx.fillStyle = t.muted; ctx.font = `700 13px ${MONO}`;
      ctx.fillText(line.kw.toUpperCase(), tx + 4, ty + 3);
      const sx = tx + 96;
      const note = line.type ? (line.external ? notes.external : notes[line.type]) : null;
      if (note) { ctx.fillStyle = note.fill; roundRect(ctx, sx, ty + 4, 12, 12, 2); ctx.fill(); }
      ctx.fillStyle = line.reject ? '#c0392b' : t.text; ctx.font = `500 18px ${BODY}`;
      line.wrapped.forEach((l, i) => { ctx.fillText(l, sx + 18, ty + i * 24); });
      ty += line.wrapped.length * 24 + 2;
    }
    ty += 12;
  }
}
