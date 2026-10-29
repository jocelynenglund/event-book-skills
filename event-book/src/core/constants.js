// Event Types
export const EventTypes = {
  // Element events
  ElementCreated: 'ElementCreated',
  ElementDeleted: 'ElementDeleted',
  ElementExternalSet: 'ElementExternalSet', // an event that comes from another system
  ElementTableSet: 'ElementTableSet',       // an event that is really a legacy table (read as events), shadowy orange { elementId, table }
  ConnectionRemoved: 'ConnectionRemoved',
  ElementRenamed: 'ElementRenamed',
  ElementTodoSet: 'ElementTodoSet',
  ElementListSet: 'ElementListSet',   // a read model that is a list of rows   // a read model that's a saga's to-do list
  UpdateRoleSet: 'UpdateRoleSet',     // an event adds to a to-do list, or ticks an item off
  PropertyAdded: 'PropertyAdded',
  PropertyRemoved: 'PropertyRemoved',
  PropertyGeneratedSet: 'PropertyGeneratedSet', // made by the system, not carried from events

  
  // Connection events
  ProducerSet: 'ProducerSet',
  ConsumerAdded: 'ConsumerAdded',
  TriggerSet: 'TriggerSet',
  ProcessorOutputSet: 'ProcessorOutputSet',
  InputScreenSet: 'InputScreenSet',
  DisplayScreenSet: 'DisplayScreenSet',
  
  // Slice events
  SliceInferred: 'SliceInferred',
  SliceCreated: 'SliceCreated',
  SliceMoved: 'SliceMoved',
  SliceNamed: 'SliceNamed',
  SliceDescribed: 'SliceDescribed',
  SliceDeleted: 'SliceDeleted',
  SliceElementAdded: 'SliceElementAdded',
  SliceElementRemoved: 'SliceElementRemoved',
  SliceCompleted: 'SliceCompleted',
  SliceMarkedRefined: 'SliceMarkedRefined',   // explicitly refined (it has scenarios); any edit to it clears it
  SliceRefinedCleared: 'SliceRefinedCleared',
  SliceMarkedBuilt: 'SliceMarkedBuilt',       // done: confirmed against a model built from the tests { sliceId, commit }
  SliceBuiltCleared: 'SliceBuiltCleared',
  PlanSentToPress: 'PlanSentToPress',         // the owner's final go: its refined slices are to be built { app, slices: [sliceId], sentBy }
  PressStopped: 'PressStopped',               // taken back from the press before a builder took it {}
  PlanCheckedOutForBuild: 'PlanCheckedOutForBuild', // a builder took it { app, builder, fromCommit }
  BuildAttached: 'BuildAttached',             // the deploy's build edition, attached to the plan being built { app, edition, commit, build, scenarios, repo, workflow }
  PlanCheckedInWithBuild: 'PlanCheckedInWithBuild', // back with its build: built slices Done { edition, commit, done, missing }
  SpecsGenerated: 'SpecsGenerated',          // refined slices written as pending specs in the app's repo { app, repo, language, slices: [sliceId], files: [{ path, hash }] }
  SpecsRegenerated: 'SpecsRegenerated',       // the same, again after the slices changed: untouched files rewritten, hand-edited ones proposed
  SliceMarkedReady: 'SliceMarkedReady',       // older models: read as SliceMarkedRefined
  SliceReadyCleared: 'SliceReadyCleared',     // older models: read as SliceRefinedCleared
  EditionPublished: 'EditionPublished',       // the whole book, every slice done and a build compared: frozen { edition, commit }
  NextDraftStarted: 'NextDraftStarted',       // a copy of a published book, to change { fromEdition, edition, draft, fromModel }
  BookReplacedFromImport: 'BookReplacedFromImport', // an import of the same book took its place; the snapshot before it holds the import, the history the old content { fileName, from, matchedBy }
  UsageImported: 'UsageImported',             // a build book gets an app's usage for a window (features/usage); the book stays published { app, at, since, days, total, counts, unmatched }
  BuildFollowed:'BuildFollowed',             // a plan follows an app's build book: its newest edition marks Done { app, followedBy }
  BuildUnfollowed: 'BuildUnfollowed',         // it stops; Done stays { app }
  CompareSettled: 'CompareSettled',           // a compare confirmed or rejected: the draft goes up { draft }
  SliceAdopted: 'SliceAdopted',               // compare: the built slice took the planned one's place { sliceId, commit }
  SliceKeptAsPlanned: 'SliceKeptAsPlanned',   // compare: a difference rejected, the slice stays ready { sliceId, commit }
  SlicesMatched: 'SlicesMatched',             // compare: this slice is the other shelf's slice of another name { sliceId, otherShelf, otherSliceName }
  SlicesKeptApart: 'SlicesKeptApart',         // compare: not that slice, don't suggest it again { sliceId, otherShelf, otherSliceName }
  
  // Scenario events
  ScenarioAdded: 'ScenarioAdded',
  ScenarioDeleted: 'ScenarioDeleted',
  ScenarioRenamed: 'ScenarioRenamed',
  ScenarioMoved: 'ScenarioMoved',
  ScenarioMustHaveSet: 'ScenarioMustHaveSet',
  ModelSourceSet: 'ModelSourceSet',       // the code it was built from: repo and commit (a test export) // an acceptance criterion (must have) or not (nice to have)       // onto another slice (e.g. one whose own slice was deleted)
  GivenSet: 'GivenSet',
  WhenSet: 'WhenSet',
  ThenEventSet: 'ThenEventSet',
  ThenRejectionSet: 'ThenRejectionSet',
  ThenReadModelSet: 'ThenReadModelSet',

  // Model events
  ModelNamed: 'ModelNamed',
  ModelDescribed: 'ModelDescribed',
  // A whole model's state in one event, with no history (share links, Export without history)
  ModelSnapshot: 'ModelSnapshot',

  // Chapter events (named groups of slices, e.g. "MVP", "Additional features")
  ChapterCreated: 'ChapterCreated',
  ChapterRenamed: 'ChapterRenamed',
  ChapterMoved: 'ChapterMoved',
  ChapterDeleted: 'ChapterDeleted',
  SliceChapterSet: 'SliceChapterSet',
  // Flows: named ways through a chapter (e.g. "Capture failed"); a slice is on
  // the chapter's main line (in every flow) or in one flow
  FlowCreated: 'FlowCreated',
  FlowRenamed: 'FlowRenamed',
  FlowDeleted: 'FlowDeleted',
  SliceFlowSet: 'SliceFlowSet',
  ElementFlowSet: 'ElementFlowSet', // an outcome event that belongs to a flow (e.g. Capture failed)
  SlicesPaired: 'SlicesPaired',

  // Comments: talk about the model, not the model. Allowed on read-only and published
  // books, sent from any device, and they never clear Refined or Done.
  CommentAdded: 'CommentAdded',       // on a slice, or on one of its scenarios (part: given | when | then)
  CommentResolved: 'CommentResolved',
  CommentDeleted: 'CommentDeleted',
  // Verifying a shipped edition: a scenario tried in the app { scenarioId, sliceId, edition, verdict: works | fails, note, testedBy, at }
  ScenarioTested: 'ScenarioTested'
};

// Talk about the book, not changes to it (comments, and verdicts from verifying a shipped
// edition): what any device may add to a book it can read, read-only and published ones too
export const commentEventTypes = new Set(['CommentAdded', 'CommentResolved', 'CommentDeleted', 'ScenarioTested']);

// Element type icons
export const typeIcons = {
  event: '🟧',
  command: '🟦',
  readModel: '🟩',
  screen: '⏹️',
  processor: '⚙️'
};

// Label for an element, telling external events (from another system) and legacy tables apart
export function elementLabel(el) {
  if (el.type === 'readModel' && el.list) return 'Read model · list';
  if (el.type === 'event' && el.table) return 'Legacy table';
  return el.type === 'event' && el.external ? 'External event' : typeLabels[el.type];
}

// data-external / data-table attributes: external events yellow, legacy tables a shadowy orange
export function externalAttr(el) {
  if (el.type !== 'event') return '';
  return `${el.external ? ' data-external="true"' : ''}${el.table ? ' data-table="true"' : ''}`;
}

// Element type labels
export const typeLabels = {
  event: 'Event',
  command: 'Command',
  readModel: 'Read Model',
  screen: 'Screen',
  processor: 'Processor'
};

// Element actions by type
export const elementActions = {
  event: [
    { label: 'What produces this?', target: 'command', relation: 'producer', sliceType: 'SC' },
    { label: 'What does this update?', target: 'readModel', relation: 'consumer', sliceType: 'SV' }
  ],
  command: [
    { label: 'What screen triggers this?', target: 'screen', relation: 'input' },
    { label: 'What events does this produce?', target: 'event', relation: 'produces', sliceType: 'SC' }
  ],
  readModel: [
    { label: 'Who produces this?', target: 'event', relation: 'updatedBy', sliceType: 'SV', multiPicker: true },
    { label: 'What screen displays this?', target: 'screen', relation: 'display' }
  ],
  processor: [
    { label: 'Triggered by State View', target: 'event', relation: 'trigger', svPicker: true },
    { label: 'Produces State Change', target: 'command', relation: 'invokes', scPicker: true }
  ],
  screen: [
    { label: 'Connect to command', target: 'command', relation: 'triggers', picker: true },
    { label: 'Connect to read model', target: 'readModel', relation: 'displays', picker: true }
  ]
};

// Connection labels
export const connectionLabels = {
  producer: 'produces',
  consumer: 'updates',
  trigger: 'triggers',
  invokes: 'invokes',
  input: 'triggered by',
  display: 'displayed on',
  produces: 'produces',
  updatedBy: 'updated by',
  triggers: 'triggers',
  displays: 'displays',
  context: 'uses context'
};

export const reverseConnectionLabels = {
  producer: 'produced by',
  consumer: 'updated by',
  trigger: 'triggered by',
  invokes: 'invoked by',
  produces: 'produced by',
  triggers: 'triggered by',
  displays: 'displayed by',
  input: 'triggers',
  display: 'displays',
  context: 'read by'
};

// A property as written on cards and pictures: arrays get [] ("items[]")
export function propLabel(p) {
  return p.name + (p.type === 'array' ? '[]' : '') + (p.type === 'array' && p.items?.length ? `{${p.items.join(', ')}}` : '');
}

// "stuff[]{stuffId, name}" → { name: 'stuff[]', items: ['stuffId', 'name'] }: an
// array whose items have fields (one level only)
export function splitItemFields(text) {
  const m = String(text).trim().match(/^(.*?)\s*\{(.*)\}\s*$/);
  if (!m) return { text: String(text).trim(), items: null };
  return { text: m[1].trim(), items: m[2].split(',').map(s => s.trim()).filter(Boolean) };
}

export const propertyTypes = ['string', 'number', 'decimal', 'boolean', 'date', 'guid', 'array', 'object'];

// Split on commas, but not inside {…} (an array's item fields)
function splitEntries(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (!depth && /[,;\n]/.test(ch)) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

// "orderId, drink, size:number, lines[]{sku, qty}" → [{name, type, items?}]. The
// type is optional (defaultType); names in `have` (any case) are skipped.
export function parsePropertyText(text, defaultType = 'string', have = []) {
  const seen = new Set(have.map(n => n.toLowerCase()));
  const parsed = [];
  let skipped = 0;
  splitEntries(text).forEach(full => {
    // "stuff[]{stuffId, name}": an array whose items have these fields
    const { text: entry, items } = splitItemFields(full);
    const m = entry.match(/^(.*?)\s*:\s*([a-z]+)$/i);
    let type = m && propertyTypes.includes(m[2].toLowerCase()) ? m[2].toLowerCase() : null;
    // "items[]" is an array called items
    const split = splitArrayName(type ? m[1] : entry);
    const name = split.name;
    if (split.array || items) type = 'array';
    if (!name) return;
    if (seen.has(name.toLowerCase())) { skipped++; return; }
    seen.add(name.toLowerCase());
    parsed.push({ name, type: type || defaultType, ...(items ? { items } : {}) });
  });
  return { parsed, skipped };
}

// "items[]" typed as a name means an array called items
export function splitArrayName(name) {
  const m = String(name).trim().match(/^(.*?)\s*\[\s*\]$/);
  return m && m[1] ? { name: m[1], array: true } : { name: String(name).trim(), array: false };
}

// A to Z the way people read names: case doesn't matter, "item 2" before "item 10"
export function byName(a, b) {
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}
