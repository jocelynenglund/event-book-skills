// ===========================================
// LIBRARY - Which shelf goes where on the bookshelves screen
// Your private collection: only on this device. Your library books: kept on the
// server, each borrowed here (checked out here), checked in, or on loan to
// another device, or to an agent (Claude, through the eventPAD MCP server: the holder's
// deviceKind is "agent"). Pure: the models and the sync bookkeeping (kept) come in.
// ===========================================

// A holder that's an agent working for her, not one of her devices
export const isAgent = holder => holder?.deviceKind === 'agent';

export function bookshelfSections(models, kept = {}) {
  const out = { private: [], library: [] };
  for (const m of models) {
    const k = kept[m.id];
    if (!k) { out.private.push(m.id); continue; }
    const h = k.holder;
    out.library.push(!h ? { id: m.id, status: 'checked-in' }
      : h.you ? { id: m.id, status: 'borrowed' }
      : { id: m.id, status: isAgent(h) ? 'on-loan-agent' : 'on-loan', device: h.deviceName || (isAgent(h) ? 'an agent' : 'another device') });
  }
  return out;
}

// Keeping a book on the server checks it out to this device (the server does so on
// the first push): it joins your library as borrowed here straight away
export function keptAfterKeep(kept, modelId, serverId = modelId) {
  return { ...kept, [modelId]: { serverId, position: 0, synced: [], holder: { you: true, deviceName: 'this device' } } };
}
