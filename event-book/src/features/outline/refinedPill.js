// The Outline's Refined pill on a slice's open row, from its view alone ({ sliceId, refined }).
// Drawing it and tapping it touch nothing else: a tap says which command it means, and the
// outline runs it (so a component test can check the button and the command it starts).
export function refinedPill(view) {
  const on = !!view?.refined;
  return `<button data-component="Outline Refined pill" data-key="${view.sliceId}" class="ol-gwt-toggle ol-refined-pill ${on ? 'on' : ''}" data-outline-action="refined" data-slice="${view.sliceId}" aria-pressed="${on}"
    aria-label="${on ? 'Refined: tap to take it back' : 'Mark refined'}"><span class="ol-tick" aria-hidden="true"></span>Refined</button>`;
}

// Refined: tapping takes it back. Not refined: tapping marks it (the command may refuse).
export function refinedPillTap(view) {
  return view.refined
    ? { command: 'clearSliceRefined', args: [view.sliceId] }
    : { command: 'markSliceRefined', args: [view.sliceId] };
}
