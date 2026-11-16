// ===========================================
// PACKED SNAPSHOTS - A big ModelSnapshot goes to the server gzipped
// The server takes 1 MB a request and keeps 5 MB of events a book. A build book's edition holds
// the whole built model as one ModelSnapshot event (barrio's was over 1 MB), and every edition
// holds one. So on the way up such an event keeps its id, batch, type and timestamp, and its
// data becomes { gz: '<base64 of the gzipped JSON of the original data>' }; wherever events come
// down from the server they are unpacked again, so what is stored on a device (IndexedDB,
// localStorage, the MCP's store) and everything that projects it keeps the plain form.
// Pure: the codec is passed in (the browser's below, or node's zlib in tools/snapshotCodec.mjs);
// both functions await it, so a sync codec works too. A plain snapshot (an old edition) passes through.
// ===========================================

// A snapshot is packed past this much JSON. Small ones stay plain (readable on the server, and
// gzip saves little); a built model is hundreds of KB and shrinks about 10-20 times.
export const PACK_OVER = 200_000;

const isPacked = e => e?.type === 'ModelSnapshot' && typeof e.data?.gz === 'string' && Object.keys(e.data).length === 1;

// gzipToBase64: async or sync (text) → base64 of its gzip
export async function packSnapshot(event, gzipToBase64, over = PACK_OVER) {
  if (event?.type !== 'ModelSnapshot' || isPacked(event) || !event.data) return event;
  const json = JSON.stringify(event.data);
  if (json.length <= over) return event;
  return { ...event, data: { gz: await gzipToBase64(json) } };
}

export const packSnapshots = (events, gzipToBase64, over) =>
  Promise.all((events || []).map(e => packSnapshot(e, gzipToBase64, over)));

// gunzipFromBase64: async or sync (base64) → the text. Other events are returned as they are.
export const unpackSnapshots = (events, gunzipFromBase64) =>
  Promise.all((events || []).map(async e => (isPacked(e) ? { ...e, data: JSON.parse(await gunzipFromBase64(e.data.gz)) } : e)));

// ---------- The browser's codec (CompressionStream; node has it too) ----------

export async function gzipToBase64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function gunzipFromBase64(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export const unpackSnapshotsInBrowser = events => (events?.some(isPacked) ? unpackSnapshots(events, gunzipFromBase64) : events);
export const packSnapshotsInBrowser = events =>
  (typeof CompressionStream === 'undefined' || !events?.some(e => e?.type === 'ModelSnapshot') ? events : packSnapshots(events, gzipToBase64));
