// ===========================================
// FEEDBACK STEPS - "what you just did", for the itsybit feedback widget's bug reports
// The widget calls window.itsybitFeedback.recentEvents() when its panel opens and sends the list with a
// bug report (only if the person leaves its toggle on). We keep the last 50 steps, and only what says
// what happened, never what anyone wrote:
//   Screen  the screen shown (board, details, slice, library, compare, preface)
//   Tap     what was tapped: its action (data-…-action), its id, its scope, its component; never its text
//   Error   a crash: its message, cut to 64 characters (so it's kept: the widget keeps short strings)
//   <Type>  each event the open book recorded, by type only (SliceDescribed), never its data
// The widget's own rule (and the server's) drops names, emails, tokens and long text again on top.
// Jocelyn, 2026-11-07: "can we add record steps in the feedback widget for event book?"
// ===========================================

const KEEP = 50;
const steps = [];
const short = v => String(v ?? '').slice(0, 64);

function add(step) {
  steps.push({ ...step, at: new Date().toISOString() });
  if (steps.length > KEEP) steps.splice(0, steps.length - KEEP);
}

export const recentSteps = () => steps.map(s => ({ ...s }));

// What a tap was on: the nearest control's action, id and scope, and its component
export function tapStep(target) {
  const el = target?.closest?.('button, a, input, select, [role=button], [data-scope], [data-view-switch]');
  if (!el) return null;
  const step = { type: 'Tap' };
  const action = [...el.attributes].find(a => /^data-[\w-]*action$/.test(a.name));
  if (action) step.action = short(action.value);
  if (el.id) step.control = short(el.id);
  if (el.dataset.scope !== undefined) step.scope = short(el.dataset.scope || 'whole');
  if (el.dataset.viewSwitch) step.control = short('view-' + el.dataset.viewSwitch);
  const component = el.closest('[data-component]')?.dataset.component;
  if (component) step.component = short(component);
  return Object.keys(step).length > 1 ? step : null;
}

let installed = false;
// Wire it up once: taps, screens, the book's events and crashes; then hand the widget its hook
export function installSteps({ currentView, onRender, onAppend }) {
  if (installed) return;
  installed = true;
  document.addEventListener('click', e => { const s = tapStep(e.target); if (s) add(s); }, true);
  let shown = null;
  onRender(() => {
    const screen = currentView();
    if (screen && screen !== shown) { shown = screen; add({ type: 'Screen', screen: short(screen) }); }
  });
  onAppend(event => add({ type: short(event.type) }));
  window.addEventListener('error', e => add({ type: 'Error', error: short(e.message) }));
  window.addEventListener('unhandledrejection', e => add({ type: 'Error', error: short(e.reason?.message || e.reason) }));
  window.itsybitFeedback = { ...(window.itsybitFeedback || {}), recentEvents: recentSteps };
}
