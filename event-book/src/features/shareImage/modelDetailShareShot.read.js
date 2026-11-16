// ===========================================
// SHARE IMAGE - Views behind "Share as image"
// (Share Scopes, the scope picker's view, is in shareScopes.read.js)
// SV: ModelDetailShareShot  exactly what the share picture draws (Picture, Slides, Outline) for the chosen
//                           scope. Only the share picture renderers read it; no other component does.
// Jocelyn, 2026-11-08: "if it gets to a number of x slices maybe 20, we don't offer the whole model as an
// option. Also, we need a separate ViewModel feature slice to feed this ModelDetails snapshot" ...
// "ModelDetailShareShot ... we should not reuse it for any other component."
// ===========================================

import { getBoardGroups, getScenariosForSlice, givenEventsOf, sliceTitle, sliceRef } from '../../core/projections.js';
import { elementLabel, propLabel } from '../../core/constants.js';
import { laneOf, sliceActor, sliceProcessor, isTrigger } from '../board/command.js';
import { fieldsFolded, foldedLabel } from '../board/foldedFields.js';
import { latestUsage, sliceUsage } from '../usage/rules.js';
import { sliceUsageText } from '../usage/view.js';
import { isChapterFolded, firstAppearances, cardTags, applyFlows, otherFlowOutcome } from '../board/view.js';
import { scopeOf } from './scope.js';
import { gwtLines } from './lines.js';

// One sticky of a slice, as the picture draws it
function cardOf(el, slice, state, { showProps, first, trigger }) {
  const todo = el.type === 'readModel' && !!el.todo;
  const base = { id: el.id, kind: el.type, label: elementLabel(el), name: el.name, external: !!el.external, table: !!el.table, published: el.type === 'event' && !!el.published && !el.external, todo };
  // A to-do list seen again: a slim reference, not a second full card
  if (todo && !first) return { ...base, slim: true, tags: [], fields: [], list: false, trigger: false };
  const props = !showProps ? [] : el.properties?.length && fieldsFolded(el.id) ? [foldedLabel(el.properties.length)] : (el.properties || []).map(propLabel);
  return { ...base, slim: false, list: el.type === 'readModel' && !!el.list && !todo, trigger: !!trigger, fields: props, tags: cardTags(el, slice, state) };
}

const scenarioOf = (scn, state, showValues) => ({ name: scn.name || 'Scenario', lines: gwtLines(scn, state, showValues) });

// scope: see scopeOf. options: the share sheet's (theme and the like are the renderer's own):
//   showProps, showDescription, showScenarios, showValues, showSliceNotes, showUsage, foldChapters, slides, outline
// folded(chapterId): whether the board has the chapter folded. events: the book's, for its usage.
export function modelDetailShareShot(state, { scope = null, options = {}, folded = isChapterFolded, events = null } = {}) {
  const { showProps = true, showDescription = true, showScenarios = false, showValues = false, showSliceNotes = false, showUsage = false, foldChapters = true, outline = false } = options;
  const wanted = scopeOf(scope);
  const whole = !wanted.chapters && !wanted.slices;
  const { slides = false } = options;
  // The picture follows the flow shown on the board (a chosen slice is shown whatever flow); the outline lists every slice
  const all = getBoardGroups(state);
  const groups = (outline || wanted.slices ? all : applyFlows(all, state))
    .filter(g => !wanted.chapters || wanted.chapters.includes(g.chapter?.id))
    .map(g => ({ ...g, slices: g.slices.filter(s => !wanted.slices || wanted.slices.includes(s.id)) }))
    .filter(g => g.slices.length)
    .map(g => ({ ...g, folded: !!(foldChapters && !slides && whole && g.chapter && folded(g.chapter.id)) }));
  const usage = events ? latestUsage(events) : null;
  const used = usage ? sliceUsage(state, usage) : {};
  const first = outline ? {} : firstAppearances(groups.filter(g => !g.folded), state);

  const sliceOf = slice => {
    const base = { sliceId: slice.id, type: slice.type, actor: sliceActor(slice, state) };
    const count = getScenariosForSlice(slice.id, state).length;
    return {
      ...base, ref: sliceRef(state, slice.id), title: sliceTitle(slice, state),
      note: showSliceNotes && slice.description ? slice.description : null,
      scenarios: showScenarios ? getScenariosForSlice(slice.id, state).map(s => scenarioOf(s, state, showValues)) : [],
      scenarioCount: count,
      ...(outline ? {
        // The way its story flows through the lanes: screen → command → event for a change, event → view → screen for a view
        flow: flowNames(slice, state),
        usageText: showUsage && events ? sliceUsageText(slice, state, events) : ''
      } : {
        used: usage && slice.id in used ? used[slice.id] : null,
        givens: count && !showScenarios ? givenEventsOf(slice.id, state).map(g => g.element.name) : [],
        lanes: lanesOf(slice, state, { showProps, first, processor: sliceProcessor(slice, state) })
      })
    };
  };

  return {
    title: state.modelName || 'Event model',
    description: showDescription && state.modelDescription && !(outline && wanted.slices) ? state.modelDescription : null,
    scope: { whole, chapters: wanted.chapters || [], slices: wanted.slices || [] },
    values: showValues,   // the scenarios carry their example values
    chaptersInBook: state.chapterOrder.length,
    usage: usage ? { days: usage.days || 30, total: usage.total, max: Math.max(0, ...Object.values(used)) } : null,
    chapters: groups.map(g => ({
      chapterId: g.chapter?.id || null, name: g.chapter?.name || null, flow: g.flow?.name || null, folded: g.folded,
      // A folded chapter is a spine: only each slice's kind
      slices: g.slices.map(s => g.folded ? { sliceId: s.id, type: s.type, actor: sliceActor(s, state) } : sliceOf(s))
    }))
  };
}

// The three lanes of cards (screen/automation, command/view, event), as the board lays them out
function lanesOf(slice, state, { showProps, first, processor }) {
  // Another flow's outcome (e.g. Capture failed on the main line) stays out of the picture
  const els = slice.elements.map(id => state.elements[id]).filter(el => el && !(el.type === 'event' && otherFlowOutcome(el, slice, state)));
  return [0, 1, 2].map(l => els.filter(e => laneOf[e.type] === l).map(el =>
    cardOf(el, slice, state, { showProps, first: first[el.id] === slice.id, trigger: el.type === 'event' && processor && isTrigger(el.id, processor.id, state) })));
}

const outlineLane = { screen: 0, processor: 0, command: 1, readModel: 1, event: 2 };
const laneFlow = { SC: [0, 1, 2], SV: [2, 1, 0], AU: [2, 0, 1] };
function flowNames(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  return (laneFlow[slice.type] || [0, 1, 2]).flatMap(l => els.filter(e => outlineLane[e.type] === l)).map(e => e.name);
}
