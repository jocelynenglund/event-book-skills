// ===========================================
// TEST IMPORT - Build a model from its outline (the spec from spec.js, or an agent's)
// With eventPAD's own commands, so slices, arrows and scenarios are wired as the app
// does: one sticky per name, a command's fields on its command, an event's on its event.
// The modules are passed in: the app passes its own, tools/model-from-code/build.cjs
// the page's. Builds into the open model.
// ===========================================

export function buildFromSpec(spec, { es, c, sc }) {
  c.nameModel(spec.name);
  if (spec.description) c.describeModel(spec.description);
  if (spec.source && c.setModelSource) c.setModelSource(spec.source.repo, spec.source.commit, { createdAt: spec.source.createdAt, build: spec.source.build });

  const ids = new Map();                          // "type|name" → element id: one sticky per name
  const key = (type, name) => `${type}|${String(name).toLowerCase()}`;
  let n = 0;
  const addProps = (id, fields) => (fields || []).filter(f => f && f.name).forEach(f => es.appendEvent('PropertyAdded', {
    elementId: id, propertyId: `p${Date.now().toString(36)}_${++n}`, name: f.name, propertyType: f.type || 'string', ...(f.items?.length ? { items: f.items } : {})
  }));
  const place = (sliceId, type, name, fields) => {
    const k = key(type, name);
    if (ids.has(k)) { c.addToSlice(sliceId, type, { elementId: ids.get(k) }); return ids.get(k); }
    const id = c.addToSlice(sliceId, type, { name });
    ids.set(k, id); addProps(id, fields);
    return id;
  };
  const ensure = (type, name, fields) => {
    const k = key(type, name);
    if (ids.has(k)) return ids.get(k);
    const id = c.newId('el');
    es.appendEvent('ElementCreated', { elementId: id, elementType: type, name });
    ids.set(k, id); addProps(id, fields);
    return id;
  };
  const ev = name => spec.events[name];
  const fieldsOf = lbl => (Object.values(spec.events).find(e => e.label === lbl) || {}).fields;
  let slices = 0, scenarios = 0;
  for (const ch of spec.chapters) {
    const chapterId = c.createChapter(ch.title);
    for (const s of ch.slices) {
      let sliceId;
      if (s.kind === 'SV') {
        sliceId = c.createSlice('SV', null, { chapterId });
        place(sliceId, 'readModel', s.readModel, s.fields);
        s.events.forEach(e => ev(e) && place(sliceId, 'event', ev(e).label, ev(e).fields));
      } else if (s.kind === 'AU') {
        sliceId = c.createSlice('SC', null, { chapterId, actor: 'processor' });
        const proc = place(sliceId, 'processor', s.processor, []);
        if (s.command) place(sliceId, 'command', s.command, s.fields);
        s.events.forEach(e => ev(e) && place(sliceId, 'event', ev(e).label, ev(e).fields));
        (s.trigger || []).forEach(e => ev(e) && c.setTrigger(ensure('event', ev(e).label, ev(e).fields), proc, true));
        (s.reads || []).forEach(r => c.linkReads(proc, ensure('readModel', r, [])));
      } else {
        sliceId = c.createSlice('SC', null, { chapterId });
        if (s.screen) place(sliceId, 'screen', s.screen, []);
        place(sliceId, 'command', s.command, s.fields);
        s.events.forEach(e => ev(e) && place(sliceId, 'event', ev(e).label, ev(e).fields));
      }
      if (s.description) c.describeSlice(sliceId, s.description);
      // Scenarios: Given events → When command → Then event / rejection / view
      for (const g of s.scenarios || []) {
        const id = sc.addScenario(sliceId, g.title, g.type, g.source || null);
        if (g.given?.length) sc.setGiven(id, g.given.map(x => ({ elementId: ensure('event', x.event, fieldsOf(x.event)), values: x.values })));
        if (g.when) sc.setWhen(id, ensure('command', g.when.command, []), g.when.values);
        if (g.then?.kind === 'event') sc.setThenEvent(id, ensure('event', g.then.event, fieldsOf(g.then.event)), g.then.values);
        else if (g.then?.kind === 'reject') sc.setThenRejection(id, g.then.reason);
        else if (g.then?.kind === 'readModel') sc.setThenReadModel(id, ensure('readModel', g.then.name, []), g.then.values);
        scenarios++;
      }
      slices++;
    }
  }
  return { slices, scenarios, elements: ids.size };
}
