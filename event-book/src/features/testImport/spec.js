// ===========================================
// TEST IMPORT - The model's outline from Given / When / Then test exports
// The export is what tests/gwt (and ItsyBIT.EventStore.Testing) write with GWT_EXPORT:
// per test file, a list of scenarios
//   { chapter, title, given: [{ type, data }], when, whenData?,
//     then: { events } | { rejected } | { nothing } | { view, value, component?, shows? },
//     tap?, pending?, passing? }   (a generated spec "not built yet": not passing yet shows its planned Then)
// A component test's component (a view drawn on screen) and tap (the screen part a command was
// tapped on) are the slice's screen.
// Pipelines combine an app's files into one: { app, commit, createdAt, files: [[…], …] }.
// An optional events catalog says what the scenarios can't: { "<Type>": { external, table, from } }
// (external: another system records it; table: a legacy table read as events).
// Each command a scenario runs is a state change (with the events it really recorded),
// each read model it reads is a state view (with the events it was given).
// Pure: no browser, no files. Used by ☰ → Import and tools/model-from-code/eventpad.mjs.
// ===========================================

export const NO_SCREEN = 'Not on a screen';

export const label = cls => String(cls).replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ');

// A field's type from its value: an …Id is a guid only when its value is one (Secret Santa's ids are base36 strings)
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fieldType = (k, v) => Array.isArray(v) ? 'array' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean'
  : v && typeof v === 'object' ? 'object' : /Id$/.test(k) && typeof v === 'string' && GUID.test(v) ? 'guid' : 'string';
// Only a plain object has fields: a test may record a string, a list or null on purpose (a malformed payload)
const plain = d => d !== null && typeof d === 'object' && !Array.isArray(d);
const text = v => (typeof v === 'string' ? v : JSON.stringify(v));

// A combined export's scenarios: files are { file, scenarios } (0.5.0) or bare lists (older)
// With the browser pass's seenOn ({ screen: [component names] }), each component test's scenario says
// on which screens its component was seen (seenOn: [] when on none)
export function scenariosOf(exp) {
  const list = (exp?.files || []).flatMap(f => Array.isArray(f) ? f : (f?.scenarios || []));
  if (!exp?.seenOn) return list;
  const seen = name => Object.entries(exp.seenOn).filter(([, names]) => names.includes(name)).map(([screen]) => screen);
  return list.map(s => {
    const name = s.then?.componentAt ? s.then.component : s.tapAt ? s.tap : null;
    return name ? { ...s, seenOn: seen(name) } : s;
  });
}
const codeOf = s => s.slice?.file ? `${s.slice.file}${s.slice.line ? `:${s.slice.line}` : ''}` : null;
// A scenario's values: a plain object's fields; anything else (a malformed payload) whole, as one value
const values = data => plain(data) ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, text(v)])) : data == null ? {} : { payload: text(data) };

// The feature a code file belongs to: src/features/<feature>/… the folder humanized, the MCP tools "Agent tools",
// tools/<x>.mjs the file humanized, src/core "Core"; anything else null (the slice keeps its test's chapter)
const humanize = w => { const s = w.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase(); return s[0].toUpperCase() + s.slice(1); };
export function featureOf(file) {
  const f = String(file || '').replace(/\\/g, '/').replace(/^\.\//, '');
  let m;
  if ((m = f.match(/^src\/features\/([^/]+)\//))) return humanize(m[1]);
  if (/^tools\/eventpad-mcp\//.test(f)) return 'Agent tools';
  if ((m = f.match(/^tools\/([^/]+?)\.[cm]?js$/))) return humanize(m[1]);
  if (/^src\/core\//.test(f)) return 'Core';
  return null;
}

// name, description: the model's; eventTypes: the app's event catalog (default: every
// event the export mentions); codeFile(kind, name): where a command / view lives, for the
// slice's note; order: chapter titles in the order they should come
export function specFromScenarios(scenarios, { name, description, eventTypes, codeFile, order = [], repo = null, commit = null, createdAt = null, build = null, catalog = null } = {}) {
  const types = [...new Set([...(eventTypes || scenarios.flatMap(s => [...(s.given || []), ...(s.then?.events || [])].map(e => e.type))), ...Object.keys(catalog || {})])];

  // Fields: every key the tests recorded for an event type
  const fields = {};
  const seen = (type, data) => Object.entries(plain(data) ? data : {}).forEach(([k, v]) => {
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
  // A slice's chapter: the screen it is on (the first in its Used by), "Not on a screen" when its Used by
  // is empty, else its test's chapter (rules with no UI). A slice is its test's chapter + its name, as before;
  // the chapter is a heading only (Compare, editions and plans match slices by name)
  const usedOf = s => (s.then || {}).usedBy || s.usedBy;
  const homes = new Map();
  const groupKey = s => `${s.chapter || 'Other'}\u0000${s.then?.view ? 'V' : 'C'}\u0000${s.then?.view || s.when}`;
  for (const s of scenarios) {
    const used = usedOf(s), key = groupKey(s);
    // Only a UI test (a component test or a tap) puts its slice on a screen: an API book can carry the
    // web's usedBy without them, and those slices stay in their feature's chapter
    if (!Array.isArray(used) || !(s.then?.view ? s.then.componentAt : s.tapAt)) continue;
    if (!homes.has(key)) homes.set(key, { used });
  }
  // Rules with no screen, in a UI book (some scenario is a component test or a tap): the chapter is the feature
  // their code lives in, so the book has no one-slice chapters. An API book keeps its tests' chapters
  const uiBook = scenarios.some(s => s.then?.componentAt || s.tapAt);
  const codeFiles = new Map();
  for (const s of scenarios) if (s.slice?.file && !codeFiles.has(groupKey(s))) codeFiles.set(groupKey(s), s.slice.file);
  const screenNames = new Set([NO_SCREEN]);
  homes.forEach(h => h.used.forEach(u => screenNames.add(u.screen || 'Other')));
  const homeOf = s => {
    const home = homes.get(groupKey(s));
    if (home) return home.used.length ? (home.used[0].screen || 'Other') : NO_SCREEN;
    const feature = uiBook ? featureOf(codeFiles.get(groupKey(s))) : null;
    return feature ? (screenNames.has(feature) ? `${feature} (rules)` : feature) : (s.chapter || 'Other');
  };
  for (const s of scenarios) {
    const then = s.then || {};
    const ch = chapterOf(homeOf(s));
    const isView = !!then.view;
    const sliceName = isView ? then.view : s.when;
    if (!sliceName) continue;
    let slice = ch.slices.find(x => (isView ? x.readModel : x.command) === sliceName);
    if (!slice) {
      slice = isView ? { kind: 'SV', readModel: sliceName, screen: null, fields: [], events: [] } : { kind: 'SC', command: sliceName, screen: null, fields: [], events: [] };
      slice.description = '';
      slice.scenarios = [];
      ch.slices.push(slice);
    }
    // The screen part it's drawn on (a component test), or the one a command was tapped on
    if (!slice.screen) slice.screen = (isView ? then.component : s.tap) || null;
    // Its code: where the test says the deciding code is; else found by name (when a codeFile is given)
    if (!slice.code) {
      slice.code = codeOf(s) || null;
      if (slice.code) slice.description = `Code: ${slice.code}`;
    }
    if (!slice.code && !slice.description && codeFile) {
      const file = codeFile(isView ? 'view' : 'command', sliceName);
      if (file) slice.description = `Code: ${file}`;
    }
    // Where its screen part is (a component test), and the app's screens that show it or handle the tap
    // that runs it (every slice the tests reach the code of): "⚠ no screen reaches it" when none
    const at = isView ? then.componentAt : s.tapAt, usedBy = then.usedBy || s.usedBy;
    if (at && !slice.screenAt) {
      slice.screenAt = `${at.file}:${at.line}`;
      slice.description = [slice.description, `Screen: ${slice.screenAt}`].filter(Boolean).join('\n');
    }
    if (usedBy && (!slice.usedBy || (at && !slice.usedByComponent))) {
      const used = usedBy.map(u => `${u.screen} (${u.how}: ${u.path.join(' › ')})`).join('; ') || '⚠ no screen reaches it';
      const kept = (slice.description || '').split('\n').filter(l => !/^(Used by|Seen on): /.test(l));
      slice.description = [...kept, `Used by: ${used}`, slice.seenOnLine].filter(Boolean).join('\n');
      slice.usedBy = used;
      if (at) slice.usedByComponent = true;
    }
    // Seen on: the screens the browser pass saw its component on, or the warning when the code reaches
    // a screen but no pass saw it there
    if (at && s.seenOn && !slice.seenOnLine) {
      slice.seenOnLine = `Seen on: ${s.seenOn.length ? s.seenOn.map(x => `${x} ✓`).join(', ') : '⚠ drawn by code but never seen'}`;
      slice.description = [slice.description, slice.seenOnLine].filter(Boolean).join('\n');
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
      values: { ...(then.value && typeof then.value === 'object' && !Array.isArray(then.value) ? values(then.value) : { shows: text(then.value) }),
        ...(then.component ? { [then.component]: text(then.shows) || '(nothing)' } : {}) } };
    slice.scenarios.push({ title, type: isView ? 'SV' : 'SC', given, when: isView ? null : { command: sliceName, values: values(s.whenData) }, then: thenSpec,
      ...(s.spec?.file ? { source: { file: s.spec.file, line: s.spec.line || null } } : {}),
      ...(s.pending ? { pending: s.passing ? 'passing' : 'not passing yet' } : {}) });
  }
  chapters.forEach(c => c.slices.forEach(sl => sl.fields.forEach(f => delete f.unsure)));
  if (order.length) chapters.sort((a, b) => (order.indexOf(a.title) + 1 || 99) - (order.indexOf(b.title) + 1 || 99));

  const spec = {
    name: name || 'Untitled model',
    description: description ?? `${name || 'This app'}'s event model, built from its Given / When / Then tests: the commands and read models they run, with the events they really recorded.`,
    chapters,
    ...(repo || commit ? { source: { repo, commit, createdAt, build } } : {}),
    events: Object.fromEntries(types.map(t => [t, { label: label(t), fields: Object.entries(fields[t] || {}).map(([n, type]) => ({ name: n, type })),
      ...(catalog?.[t]?.external ? { external: true } : {}), ...(catalog?.[t]?.table ? { table: true } : {}), ...(catalog?.[t]?.from ? { from: String(catalog[t].from) } : {}) }]))
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
  // An Event Book plan file (plan.schema.json): chapters of steps with their scenarios, written by hand or by an LLM
  if (json && !Array.isArray(json) && typeof json.format === 'string' && json.format.startsWith('eventbook-plan/')) return 'eventbook-plan';
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
