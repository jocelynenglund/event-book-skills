// ===========================================
// TEXT NOTATION - The model as v3 prefix notation (event-model-notation/notation/v3-prefix.md):
// one line per sticky, chapters in order, then the tests.
//   S,C: PlaceOrder(orderId, size)        a change: its command (S screen, A automation) …
//     E: OrderPlaced(orderId, at:Date)    … and the events it records
//   R: Menu(items[]) [OrderPlaced]        a view: its read model and the events it reads
//   test PlaceOrder "Order a footlong"    given / do / emit, or !err "why"
// Names become identifiers (Place order → PlaceOrder); a field is name, name:Type or name[].
// ===========================================

import { getBoardGroups, getScenariosForSlice, sliceTitle, projectState } from '../../core/projections.js';
import { getEventStream } from '../../core/eventStore.js';
import { showToast } from '../../ui/toast.js';

export const ident = s => String(s || '').replace(/[^\p{L}\p{N}]+(.)?/gu, (m, c) => (c ? c.toUpperCase() : ''))
  .replace(/^./, c => c.toUpperCase()) || 'Unnamed';

const typeName = { number: 'Number', boolean: 'Bool', datetime: 'DateTime', date: 'Date', guid: 'Guid' };
function field(p) {
  if (p.type === 'array') return `${p.name}[]${p.items?.length ? `{${p.items.join(', ')}}` : ''}`;
  return typeName[p.type] ? `${p.name}:${typeName[p.type]}` : p.name;
}
const sticky = el => `${ident(el.name)}(${(el.properties || []).map(field).join(', ')})`;

// A long value (a whole document) is cut short: the notation is for reading
const short = s => (s.length > 40 ? `${s.slice(0, 37)}…` : s);
const value = v => typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : JSON.stringify(short(typeof v === 'string' ? v : JSON.stringify(v)));
const filled = v => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length);
const withValues = (el, values) => `${ident(el?.name || 'Removed')}(${Object.entries(values || {}).filter(([, v]) => filled(v)).map(([k, v]) => `${k}=${value(v)}`).join(', ')})`;

function sliceLines(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const of = type => els.filter(e => e.type === type);
  const events = of('event'), commands = of('command'), views = of('readModel');
  const processor = of('processor')[0], screen = of('screen')[0];
  const out = [];
  if (slice.type === 'SV') {
    // A view: its read model and the events that feed it
    views.forEach(v => out.push(`R: ${sticky(v)}${events.length ? ` [${events.map(e => ident(e.name)).join(', ')}]` : ''}${v.todo ? '  {todo}' : ''}`));
    if (!views.length) events.forEach(e => out.push(`E: ${sticky(e)}`));
    return out;
  }
  // A change: who does it (a screen, an automation), the command, the events it records
  const actor = processor ? 'A' : screen ? 'S' : '';
  // An automation: the read models it reads, the events that trigger it (from the model, not the board)
  const linked = (rel, mine, other) => !processor ? [] : state.connections
    .filter(c => c.relation === rel && c[mine] === processor.id && state.elements[c[other]]).map(c => ident(state.elements[c[other]].name));
  const reads = linked('context', 'from', 'to'), on = linked('trigger', 'to', 'from');
  const note = [screen ? `screen: ${screen.name}` : '', processor ? `automation: ${processor.name}` : '', on.length ? `on ${on.join(', ')}` : ''].filter(Boolean).join(' · ');
  commands.forEach(c => out.push(`${actor ? `${actor},` : ''}C: ${sticky(c)}${reads.length ? ` [${reads.join(', ')}]` : ''}${note ? `  # ${note}` : ''}`));
  events.forEach(e => out.push(`${commands.length ? '  ' : ''}E: ${sticky(e)}${e.external ? '  # external' : ''}${e.table ? '  # legacy table' : ''}`));
  return out;
}

function testLines(slice, state) {
  return getScenariosForSlice(slice.id, state).flatMap(scn => {
    const subject = scn.when?.commandId ? state.elements[scn.when.commandId]
      : scn.then?.readModelId ? state.elements[scn.then.readModelId]
      : slice.elements.map(id => state.elements[id]).find(e => e?.type === (slice.type === 'SV' ? 'readModel' : 'command')) || { name: sliceTitle(slice, state) };
    const then = scn.then;
    const lines = [`test ${ident(subject.name)} ${JSON.stringify(scn.name || 'Untitled')}${then?.type === 'rejection' ? ` !err ${JSON.stringify(then.reason || 'rejected')}` : ''}${scn.mustHave ? '  # must have' : ''}`];
    if (scn.given?.length) lines.push(`  given ${scn.given.map(g => withValues(state.elements[g.elementId], g.values)).join(', ')}`);
    if (scn.when?.commandId) lines.push(`  do    ${withValues(state.elements[scn.when.commandId], scn.when.values)}`);
    if (then?.type === 'event') lines.push(`  emit  ${withValues(state.elements[then.eventId], then.values)}`);
    if (then?.type === 'readModel') {
      const rm = state.elements[then.readModelId];
      if (then.rows?.length) then.rows.forEach(r => lines.push(`  expect ${withValues(rm, r)}`));
      else lines.push(`  expect ${withValues(rm, then.values)}`);
    }
    return lines;
  });
}

export function modelToNotation(state) {
  const out = [`# ${state.modelName || 'Untitled model'}`];
  if (state.modelDescription) state.modelDescription.split('\n').forEach(l => out.push(`# ${l}`));
  const groups = getBoardGroups(state).filter(g => g.slices.length);
  groups.forEach(g => {
    out.push('', g.chapter ? `chapter ${g.chapter.name}` : (state.chapterOrder.length ? '# ── not in a chapter ──' : ''));
    g.slices.forEach(s => {
      const lines = sliceLines(s, state);
      if (lines.length) out.push('', `# ${sliceTitle(s, state)}`, ...lines);
    });
  });
  const tests = groups.flatMap(g => g.slices.flatMap(s => testLines(s, state)));
  if (tests.length) out.push('', '# ── tests ──', ...tests);
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').replace(/^\n+/, '') + '\n';
}

// ☰ → Export… → As text: a .em file named after the model
export function exportNotation() {
  if (!getEventStream().length) { showToast('Nothing to export yet'); return; }
  const state = projectState();
  const blob = new Blob([modelToNotation(state)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(state.modelName || 'model').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'model'}.em`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported as text');
}
