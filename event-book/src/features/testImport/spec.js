// ===========================================
// TEST IMPORT - The model's outline from Given / When / Then test exports
// The export is what tests/gwt (and ItsyBIT.EventStore.Testing) write with GWT_EXPORT:
// per test file, a list of scenarios
//   { chapter, title, given: [{ type, data }], when, whenData?,
//     then: { events } | { rejected } | { nothing } | { view, value } }
// Pipelines combine an app's files into one: { app, commit, createdAt, files: [[…], …] }.
// Each command a scenario runs is a state change (with the events it really recorded),
// each read model it reads is a state view (with the events it was given).
// Pure: no browser, no files. Used by ☰ → Import and tools/model-from-code/eventpad.mjs.
// ===========================================

export const label = cls => String(cls).replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ');

const fieldType = (k, v) => Array.isArray(v) ? 'array' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean'
  : v && typeof v === 'object' ? 'object' : /Id$/.test(k) ? 'guid' : 'string';
const text = v => (typeof v === 'string' ? v : JSON.stringify(v));

// A combined export's scenarios: files are { file, scenarios } (0.5.0) or bare lists (older)
export function scenariosOf(exp) {
  return (exp?.files || []).flatMap(f => Array.isArray(f) ? f : (f?.scenarios || []));
}
const codeOf = s => s.slice?.file ? `${s.slice.file}${s.slice.line ? `:${s.slice.line}` : ''}` : null;
const values = data => Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, text(v)]));

// name, description: the model's; eventTypes: the app's event catalog (default: every
// event the export mentions); codeFile(kind, name): where a command / view lives, for the
// slice's note; order: chapter titles in the order they should come
export function specFromScenarios(scenarios, { name, description, eventTypes, codeFile, order = [], repo = null, commit = null, createdAt = null, build = null } = {}) {
  const types = eventTypes || [...new Set(scenarios.flatMap(s => [...(s.given || []), ...(s.then?.events || [])].map(e => e.type)))];

  // Fields: every key the tests recorded for an event type
  const fields = {};
  const seen = (type, data) => Object.entries(data || {}).forEach(([k, v]) => {
    fields[type] ||= {};
    fields[type][k] ||= fieldType(k, v);
  });
  scenarios.forEach(s => { (s.given || []).forEach(e => seen(e.type, e.data)); (s.then?.events || []).forEach(e => seen(e.type, e.data)); });

  const chapters = [];
  const chapterOf = title => {
    let ch = chapters.find(c => c.title === title);
    if (!ch) chapters.push(ch = { title, feature: title, slices: [] });
    return ch;
  };
  const recorded = new Set();
  // A slice's own fields: what a view's tests say it shows (its rows' fields, for a list),
  // what a command's tests sent it
  const own = (slice, data) => {
    const rows = Array.isArray(data) ? data.filter(r => r && typeof r === 'object' && !Array.isArray(r)) : [data];
    rows.forEach(row => Object.entries(row && typeof row === 'object' ? row : {}).forEach(([k, v]) => {
      const field = slice.fields.find(f => f.name === k);
      // A null says nothing about the type: a later value does
      if (!field) slice.fields.push({ name: k, type: fieldType(k, v), ...(v === null ? { unsure: true } : {}) });
      else if (field.unsure && v !== null) { field.type = fieldType(k, v); delete field.unsure; }
    }));
  };
  for (const s of scenarios) {
    const then = s.then || {};
    const ch = chapterOf(s.chapter || 'Other');
    const isView = !!then.view;
    const sliceName = isView ? then.view : s.when;
    if (!sliceName) continue;
    let slice = ch.slices.find(x => (isView ? x.readModel : x.command) === sliceName);
    if (!slice) {
      slice = isView ? { kind: 'SV', readModel: sliceName, fields: [], events: [] } : { kind: 'SC', command: sliceName, screen: null, fields: [], events: [] };
      slice.description = '';
      slice.scenarios = [];
      ch.slices.push(slice);
    }
    // Its code: where the test says the deciding code is; else found by name (when a codeFile is given)
    if (!slice.code) {
      slice.code = codeOf(s) || null;
      if (slice.code) slice.description = `Code: ${slice.code}`;
    }
    if (!slice.code && !slice.description && codeFile) {
      const file = codeFile(isView ? 'view' : 'command', sliceName);
      if (file) slice.description = `Code: ${file}`;
    }
    const add = t => { if (!slice.events.includes(t)) slice.events.push(t); };
    if (isView) (s.given || []).forEach(e => add(e.type));
    else (then.events || []).forEach(e => { add(e.type); recorded.add(e.type); });
    own(slice, isView ? then.value : s.whenData);

    const given = (s.given || []).map(e => ({ event: label(e.type), values: values(e.data) }));
    let thenSpec = null, title = s.title || sliceName;
    if (then.events?.length) {
      thenSpec = { kind: 'event', event: label(then.events[0].type), values: values(then.events[0].data) };
      if (then.events.length > 1) title += ' · then also ' + then.events.slice(1).map(e => label(e.type)).join(', ');
    } else if (then.rejected) thenSpec = { kind: 'reject', reason: then.rejected };
    else if (then.nothing) title += ' · records nothing';   // accepted, no change: eventPAD has no Then for it
    else if (isView) thenSpec = { kind: 'readModel', name: then.view,
      values: then.value && typeof then.value === 'object' && !Array.isArray(then.value) ? values(then.value) : { shows: text(then.value) } };
    slice.scenarios.push({ title, type: isView ? 'SV' : 'SC', given, when: isView ? null : { command: sliceName, values: values(s.whenData) }, then: thenSpec,
      ...(s.spec?.file ? { source: { file: s.spec.file, line: s.spec.line || null } } : {}) });
  }
  chapters.forEach(c => c.slices.forEach(sl => sl.fields.forEach(f => delete f.unsure)));
  if (order.length) chapters.sort((a, b) => (order.indexOf(a.title) + 1 || 99) - (order.indexOf(b.title) + 1 || 99));

  const spec = {
    name: name || 'Untitled model',
    description: description ?? `${name || 'This app'}'s event model, built from its Given / When / Then tests: the commands and read models they run, with the events they really recorded.`,
    chapters,
    ...(repo || commit ? { source: { repo, commit, createdAt, build } } : {}),
    events: Object.fromEntries(types.map(t => [t, { label: label(t), fields: Object.entries(fields[t] || {}).map(([n, type]) => ({ name: n, type })) }]))
  };
  const mentioned = new Set(scenarios.flatMap(s => [...(s.given || []), ...(s.then?.events || [])].map(e => e.type)));
  const report = {
    chapters: chapters.length,
    slices: chapters.reduce((n, c) => n + c.slices.length, 0),
    scenarios: scenarios.length,
    events: types.length,
    events_no_test_records: types.filter(t => !recorded.has(t)),
    events_in_no_scenario: types.filter(t => !mentioned.has(t)),
    commands_without_refusal: [...new Set(scenarios.filter(s => !s.then?.view && s.when).map(s => s.when))]
      .filter(cmd => !scenarios.some(s => s.when === cmd && s.then?.rejected)),
    records_nothing: scenarios.filter(s => s.then?.nothing).length
  };
  return { spec, report };
}

// What kind of file this is: an eventPAD model (events), a test export (one file's
// scenarios, or a pipeline's combined file) or a plan (docs/slices.json)
export function kindOf(json) {
  if (json && !Array.isArray(json) && Array.isArray(json.files)) return 'export';
  if (json && !Array.isArray(json) && Array.isArray(json.slices) && json.slices.some(s => s?.kind)) return 'plan';
  if (Array.isArray(json)) {
    if (!json.length) return 'unknown';
    if (json.every(x => x && typeof x === 'object' && 'given' in x && 'then' in x)) return 'scenarios';
    if (json.every(x => x && typeof x === 'object' && typeof x.type === 'string' && ('data' in x || 'id' in x))) return 'events';
    if (json.some(x => x?.kind === 'slice')) return 'plan';
  }
  return 'unknown';
}

// The plan's model slices beside the model's: in both, planned but not tested yet, tested
// but not planned, and ones the tests put in another chapter. Names match exactly as the
// tests use them (any case); foundation / integration / chore entries never count.
export function planVsModel(plan, spec) {
  const planned = (Array.isArray(plan) ? plan : plan.slices || []).filter(s => s?.kind === 'slice' && s.name);
  const norm = s => String(s).trim().toLowerCase();
  const built = spec.chapters.flatMap(ch => ch.slices.map(s => ({ name: s.command || s.readModel || s.processor, chapter: ch.title, type: s.kind === 'SV' ? 'view' : s.kind === 'AU' ? 'automation' : 'command' })));
  const byName = new Map(built.map(b => [norm(b.name), b]));
  const plannedNames = new Set(planned.map(p => norm(p.name)));
  const both = [], missing = [], moved = [];
  planned.forEach(p => {
    const b = byName.get(norm(p.name));
    if (!b) missing.push({ name: p.name, chapter: p.chapter || '', type: p.type || '' });
    else {
      both.push(p.name);
      if (p.chapter && norm(p.chapter) !== norm(b.chapter)) moved.push({ name: p.name, planned: p.chapter, tested: b.chapter });
    }
  });
  const extra = built.filter(b => !plannedNames.has(norm(b.name)));
  return { planned: planned.length, both, missing, extra, moved };
}
