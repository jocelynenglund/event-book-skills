// ===========================================
// SHARE IMAGE - Share Sheet Controls: the format buttons and option chips the sheet shows for this book and
// these settings: which chips are there (only what the book has), which are on, and the "Options · 3 on" line.
// ===========================================

import { hasValues } from '../scenarios/view.js';
import { hasUsage } from '../usage/view.js';
import { isChapterFolded } from '../board/view.js';

// options: the sheet's (theme, showProps, showDescription, showSliceNotes, showScenarios, showValues, showUsage,
// foldChapters, slides, outline). scope: the one being shared. events: the shared book's, for its usage.
export function shareSheetControls(state, { scope = null, options = {}, events = null } = {}) {
  const format = options.outline ? 'outline' : options.slides ? 'slides' : 'board';
  const scenarios = Object.values(state.scenarios);
  const chip = (opt, label, on, off, shown = true, id = null) => ({ opt, id, label, on, off, shown, active: String(options[opt]) === on });
  const chips = [
    chip('theme', 'Chalkboard', 'dark', 'light'),
    // The outline lists slices; their stickies' fields are the board's
    chip('showProps', 'Fields', 'true', 'false', !options.outline, 'sharePropsOpt'),
    chip('showDescription', 'Description', 'true', 'false', !!state.modelDescription, 'shareDescOpt'),
    chip('showSliceNotes', 'Slice notes', 'true', 'false', Object.values(state.slices).some(s => s.description), 'shareNotesOpt'),
    chip('showScenarios', 'Scenarios', 'true', 'false', scenarios.length > 0, 'shareGwtOpt'),
    // Values: with the scenarios, when any of them has some
    chip('showValues', 'Values', 'true', 'false', !!options.showScenarios && scenarios.some(hasValues), 'shareValuesOpt'),
    // Usage: the outline of a book with usage (a build book the nightly job gave its app's use)
    chip('showUsage', 'Usage', 'true', 'false', !!options.outline && hasUsage(state, events), 'shareUsageOpt'),
    // Folded / All open only matters for the whole model (a picture or the outline), with a chapter folded
    chip('foldChapters', 'Folded chapters', 'true', 'false', !scope && !options.slides && state.chapterOrder.some(id => isChapterFolded(id)), 'shareFoldOpt')
  ];
  return {
    format: [['board', 'Picture'], ['slides', 'Slides 4:5'], ['outline', 'Outline']].map(([value, label]) => ({ value, label, active: format === value })),
    chips,
    summary: `Options · ${chips.filter(c => c.shown && c.active).length} on`
  };
}
