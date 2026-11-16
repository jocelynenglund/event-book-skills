// The board's Ready / Done chip on a slice's header, from its view alone (nothing else of the book).
// A slice not refined yet shows nothing; refined, it's ready to build; confirmed built from the tests, done.
export function buildChip(view) {
  if (!view || view.chip === 'none') return '';
  return view.chip === 'done'
    ? '<span data-component="Board build chip" class="bd-build bd-done" aria-label="Done"><span class="ol-tick on" aria-hidden="true"></span>Done</span>'
    : '<span data-component="Board build chip" class="bd-build bd-ready" aria-label="Ready to build"><span class="ol-tick" aria-hidden="true"></span>Ready</span>';
}
