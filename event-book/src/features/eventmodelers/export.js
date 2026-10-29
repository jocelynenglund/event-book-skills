// ===========================================
// EXPORT FOR EVENTMODELERS (Nebulit canvas JSON)
// ===========================================
// One way: the board as a file app.eventmodelers.ai can import. Each chapter
// becomes a timeline; each slice one or more columns with a slice border.
// Nebulit holds one sticky per cell, so a slice's stickies spread over extra
// columns (top and middle lanes) and up to three event rows.

import { projectState, getBoardGroups, sliceTitle, sliceFlow, getScenariosForSlice } from '../../core/projections.js';
import { showToast } from '../../ui/toast.js';
import { sliceComments } from '../comments/read.js';
import { sourceUrl } from '../../core/source.js';
import { getEventStream } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';

// Chapters sit side by side, left to right like the model reads, with a gap between
const ROW_H = 320, COL_W = 450, TIMELINE_X = 562, TIMELINE_Y = 393, CHAPTER_GAP = 400;
const EVENT_ROWS_MAX = 3;
const EDGE = '#7291aa';
// Nebulit's own placeholder pictures for screens and automations
const SCREEN_IMG = 'https://i.ibb.co/87MRc1f/image.png';
const AUTOMATION_IMG = 'https://cdn.pixabay.com/photo/2016/01/03/11/24/gear-1119298_1280.png';
const STAMP = '2026-01-01T00:00:00.000Z';

const META_TYPE = { screen: 'SCREEN', processor: 'AUTOMATION', command: 'COMMAND', readModel: 'READMODEL', event: 'EVENT' };
const CELL_TYPE = { screen: 'screen', processor: 'automation', command: 'command', readModel: 'readmodel', event: 'event' };
const FIELD_TYPE = { string: 'String', number: 'Int', decimal: 'Double', boolean: 'Boolean', date: 'Date', guid: 'UUID', object: 'Custom' };
const LANE = { screen: 0, processor: 0, command: 1, readModel: 1, event: 2 };
// Arrow direction between neighbouring lanes, as on the board
const FLOW = { SC: [null, 'down', 'down'], SV: [null, 'up', 'up'], AU: [null, 'down', 'down'] };

// A slice's note: its description, then its open comments as a list (eventmodelers.ai notes are markdown)
const PART = { given: 'Given', when: 'When', then: 'Then' };
const NOTE_YELLOW = '#f1c40f';
// In a build book (it knows its repo and commit): "Code: file:line" links to the code, and a Spec
// line links the first scenario's test. Links only, never the code: the repo may be private.
const md = (file, line, url) => `[\`${file}${line ? `:${line}` : ''}\`](${url})`;
function withCode(slice, state) {
  let linked = false;
  const text = (slice.description || '').replace(/(^|\n)Code: ([^\s:]+)(?::(\d+))?/g, (m, pre, file, line) => {
    const url = sourceUrl(state, file, line);
    if (!url) return m;
    linked = true;
    return `${pre}**Code:** ${md(file, line, url)}`;
  });
  if (!linked) return text;
  const specs = getScenariosForSlice(slice.id, state).map(s => s.source).filter(src => src?.file);
  const url = specs[0] && sourceUrl(state, specs[0].file, specs[0].line);
  return url ? `${text}\n**Spec:** ${md(specs[0].file, specs[0].line, url)}${specs.length > 1 ? ` and ${specs.length - 1} more` : ''}` : text;
}
// A build book carries its code links, not its comments: the conversation goes on in eventmodelers.ai
function noteFor(slice, state, build = false) {
  const open = build ? [] : sliceComments(state, slice.id).threads.filter(t => !t.resolved);
  const comments = open.map(t => `- **${t.nickname}**${[t.scenarioName, PART[t.part]].filter(Boolean).map(x => ` · ${x}`).join('')}: ${t.text}`);
  const about = withCode(slice, state);
  const text = [about, comments.length ? `${about ? '\n' : ''}### 💬 Comments\n${comments.join('\n')}` : ''].filter(Boolean).join('\n');
  return text ? { description: text, ...(comments.length ? { backgroundColor: NOTE_YELLOW } : {}) } : null;
}

const uid = () => crypto.randomUUID();
const hash = () => uid().replace(/-/g, '').slice(0, 6);

// "price:decimal" → { name, type }
function itemField(text) {
  const [name, type] = String(text).split(':').map(s => s.trim());
  return { name, type: FIELD_TYPE[type?.toLowerCase()] || 'String', cardinality: 'Single' };
}

function field(p) {
  const base = { name: p.name, optional: false, generated: !!p.generated, idAttribute: false };
  if (p.type === 'array' && p.items?.length) {
    return { ...base, type: 'Custom', cardinality: 'List', showAttributes: true, subfields: p.items.map(itemField) };
  }
  if (p.type === 'array') return { ...base, type: 'String', cardinality: 'List', subfields: [] };
  return { ...base, type: FIELD_TYPE[p.type] || 'String', cardinality: 'Single', subfields: [] };
}

function elementMeta(el) {
  const meta = {
    type: META_TYPE[el.type],
    title: el.name || 'Untitled',
    context: el.external ? 'EXTERNAL' : 'INTERNAL',
    compact: true,
    fields: (el.properties || []).map(field),
    createsAggregate: false,
    listElement: !!el.list,
    todoListElement: !!el.todo
  };
  if (el.type === 'screen') meta.sketched = false;
  return meta;
}

// An example value as Nebulit shows it: text
const exampleText = v => v == null ? undefined : typeof v === 'object' ? JSON.stringify(v) : String(v);

export function buildEventmodelersBoard(state = projectState(), { build = isBuildBook(getEventStream()) } = {}) {
  const boardId = uid();
  const boardName = state.modelName || 'EventPAD model';
  const nodes = [], edges = [], metadata = {};
  // element id → [{ nodeId, chapterIdx, row, col }] (an element can sit in several slices)
  const placed = {};

  const groups = getBoardGroups(state).filter(g => g.slices.length);
  const eventRows = Math.min(EVENT_ROWS_MAX, Math.max(1, ...Object.values(state.slices).map(s =>
    s.elements.filter(id => state.elements[id]?.type === 'event').length)));
  const hasNotes = Object.values(state.slices).some(s => noteFor(s, state, build));

  let nextX = TIMELINE_X;
  const chapters = groups.map((g, ci) => {
    const timelineId = uid();
    const rows = [
      { id: uid(), type: 'actor', label: 'Actor', height: ROW_H },
      { id: uid(), type: 'interaction', label: 'Interaction', height: ROW_H },
      ...Array.from({ length: eventRows }, (_, i) => ({ id: uid(), type: 'swimlane', ...(i ? {} : { label: 'Events' }), height: ROW_H })),
      { id: uid(), type: 'spec', label: 'Spec Lane', height: ROW_H },
      ...(hasNotes ? [{ id: uid(), type: 'feedback', label: 'Notes', height: ROW_H }] : [])
    ];
    const specRow = 2 + eventRows;
    const columns = [];
    const cellAt = {};       // 'row:col' → { nodeType, nodeId, type? }
    const sliceCols = [];    // per slice: its first column and what sits where

    const timeline = { id: timelineId, type: 'timeline', position: { x: nextX, y: TIMELINE_Y }, data: {}, modifiedAt: STAMP };
    nodes.push(timeline);

    g.slices.forEach(slice => {
      const els = slice.elements.map(id => state.elements[id]).filter(el => el && META_TYPE[el.type]);
      const byLane = [0, 1, 2].map(l => els.filter(el => LANE[el.type] === l));
      const width = Math.max(1, byLane[0].length, byLane[1].length, Math.ceil(byLane[2].length / eventRows));
      const first = columns.length;
      for (let i = 0; i < width; i++) columns.push({ id: uid(), width: COL_W });

      const spots = [[], [], []];
      const put = (el, row, col) => {
        const nodeId = uid();
        const image = el.type === 'screen' || el.type === 'processor';
        nodes.push(image
          ? { id: nodeId, type: 'image', position: { x: 0, y: 0 }, data: { url: el.type === 'screen' ? SCREEN_IMG : AUTOMATION_IMG }, parentId: timelineId, modifiedAt: STAMP }
          : { id: nodeId, type: 'sticky_note', position: { x: 0, y: 0 }, data: { metaHash: hash() }, parentId: timelineId, zIndex: 9999, modifiedAt: STAMP });
        metadata[nodeId] = { meta: elementMeta(el) };
        cellAt[`${row}:${col}`] = { nodeType: CELL_TYPE[el.type], nodeId };
        (placed[el.id] ||= []).push({ nodeId, chapter: ci, row, col, sliceId: slice.id });
        return { nodeId, row, col, el };
      };
      byLane[0].forEach((el, i) => spots[0].push(put(el, 0, first + i)));
      byLane[1].forEach((el, i) => spots[1].push(put(el, 1, first + i)));
      byLane[2].forEach((el, i) => spots[2].push(put(el, 2 + (i % eventRows), first + Math.floor(i / eventRows))));

      // Slice border over each of its columns
      const flow = sliceFlow(slice, state);
      const title = sliceTitle(slice, state) + (flow ? ` (${flow.name})` : '');
      for (let c = first; c < first + width; c++) {
        const borderId = uid();
        nodes.push({ id: borderId, type: 'slice_border', position: { x: 0, y: 0 }, data: { type: 'SLICE_BORDER', colId: columns[c].id, title }, parentId: timelineId, hidden: true, modifiedAt: STAMP });
        metadata[borderId] = { meta: { type: 'SLICE_BORDER', title } };
      }

      // What the slice is about, as a note under it
      const note = hasNotes && noteFor(slice, state, build);
      if (note) {
        const noteId = uid();
        nodes.push({ id: noteId, type: 'markdown', position: { x: 0, y: 0 }, data: {}, parentId: timelineId, modifiedAt: STAMP });
        metadata[noteId] = { meta: note };
        cellAt[`${specRow + 1}:${first}`] = { type: 'empty', nodeType: 'markdown', nodeId: noteId };
      }

      sliceCols.push({ slice, first, spots });
    });

    // Arrows inside each slice, lane to lane
    sliceCols.forEach(({ slice, spots }) => {
      const f = FLOW[slice.type] || [];
      [1, 2].forEach(l => {
        if (!f[l]) return;
        spots[l - 1].forEach(a => spots[l].forEach(b => {
          // An automation's processor invokes its command; its events don't point back up
          if (slice.type === 'AU' && l === 1 && a.el.type !== 'processor') return;
          if (slice.type === 'AU' && l === 2 && state.connections.some(c => c.from === b.el.id && c.relation === 'trigger')) return;
          if (f[l] === 'down') edges.push(edge(a, b)); else edges.push(edge(b, a));
        }));
      });
    });

    nextX += columns.length * COL_W + CHAPTER_GAP;
    return { timelineId, rows, columns, cellAt, sliceCols, specRow, title: g.chapter?.name || boardName };
  });

  // Triggers (event → processor) and what a processor reads (read model → processor),
  // between slices of the same chapter: from the nearest copy on the left
  state.connections.forEach(c => {
    if (c.relation !== 'trigger' && c.relation !== 'context') return;
    const [src, proc] = c.relation === 'trigger' ? [c.from, c.to] : [c.to, c.from];
    (placed[proc] || []).forEach(p => {
      const from = (placed[src] || []).filter(s => s.chapter === p.chapter && s.sliceId !== p.sliceId)
        .sort((a, b) => Math.abs(p.col - a.col) - Math.abs(p.col - b.col))[0];
      if (from) edges.push(edge(from, p));
    });
  });

  // Scenarios: one spec per slice, in its first column
  chapters.forEach(ch => {
    ch.sliceCols.forEach(({ slice, first }) => {
      const scenarios = getScenariosForSlice(slice.id, state);
      if (!scenarios.length) return;
      const ref = (id, values = {}) => {
        const el = state.elements[id];
        const at = placed[id]?.find(p => p.sliceId === slice.id) || placed[id]?.[0];
        if (!el || !at) return null;
        return {
          id: at.nodeId, title: el.name, type: META_TYPE[el.type],
          fields: (el.properties || []).map(p => {
            const example = exampleText(values?.[p.name]);
            return example === undefined ? { name: p.name } : { name: p.name, example };
          })
        };
      };
      const specId = uid();
      nodes.push({ id: specId, type: 'spec_node', position: { x: 0, y: 0 }, data: {}, parentId: ch.timelineId, modifiedAt: STAMP });
      metadata[specId] = { meta: { type: 'SCENARIO', givenWhenThenScenario: { scenarios: scenarios.map(s => {
        const then = s.then;
        const out = {
          id: uid(), title: s.name || 'Scenario',
          expectError: then?.type === 'rejection', expectEmptyList: false, examples: [],
          given: (s.given || []).map(gv => ref(gv.elementId, gv.values)).filter(Boolean),
          when: [s.when?.commandId && ref(s.when.commandId, s.when.values)].filter(Boolean),
          then: [then?.type === 'event' && ref(then.eventId, then.values),
                 then?.type === 'readModel' && ref(then.readModelId, then.values)].filter(Boolean)
        };
        if (then?.type === 'rejection' && then.reason) out.errorDescription = then.reason;
        return out;
      }) } } };
      ch.cellAt[`${ch.specRow}:${first}`] = { nodeType: 'spec', nodeId: specId };
    });

    // Every row × column gets a cell
    const cells = [];
    ch.rows.forEach((row, r) => ch.columns.forEach((col, c) => {
      const at = ch.cellAt[`${r}:${c}`];
      cells.push(at
        ? { id: uid(), rowId: row.id, colId: col.id, type: at.type || 'content', nodeType: at.nodeType, nodeId: at.nodeId }
        : { id: uid(), rowId: row.id, colId: col.id, type: 'empty' });
    }));
    metadata[ch.timelineId] = { meta: { title: ch.title, type: 'CHAPTER', timelineData: { rows: ch.rows, columns: ch.columns, cells } } };
  });

  return {
    boards: { [boardId]: { name: boardName } },
    nodes: { [boardId]: { nodes, edges } },
    metadata: { [boardId]: metadata },
    // Every section keyed by the board, as eventmodelers.ai's own export (its import expects comments too)
    comments: { [boardId]: {} },
    images: { [boardId]: {} },
    nodeSnapshots: { [boardId]: {} }
  };
}

function edge(a, b) {
  const [sourceHandle, targetHandle] = b.row > a.row ? ['source-bottom', 'target-top']
    : b.row < a.row ? ['source-top', 'target-bottom'] : ['source-right', 'target-left'];
  return {
    id: uid(), source: a.nodeId, target: b.nodeId, start: { item: a.nodeId }, end: { item: b.nodeId },
    sourceHandle, targetHandle, connector: true, type: 'default', animated: true,
    style: { stroke: EDGE, strokeWidth: 3, startStrokeCap: 'none', endStrokeCap: 'arrow', strokeStyle: 'normal', strokeColor: EDGE, opacity: 1 },
    markerEnd: { type: 'arrowclosed' }, zIndex: 500, data: {}, x: 0, y: 0, position: { x: 0, y: 0 },
    modifiedAt: STAMP, captions: [], selected: false
  };
}

export function exportForEventmodelers() {
  const state = projectState();
  if (!Object.keys(state.slices).length) { showToast('Nothing to export yet'); return; }
  const json = JSON.stringify(buildEventmodelersBoard(state), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const name = (state.modelName || 'event-model').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'event-model';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-emstudio.json`;   // -emstudio: not an eventPAD file, so it isn't imported back by mistake
  a.click();
  URL.revokeObjectURL(url);
  showToast('Saved: import it at app.eventmodelers.ai');
}
