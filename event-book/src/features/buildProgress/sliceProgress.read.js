// ===========================================
// BUILD PROGRESS - Slice Progress (SV): where a slice's build has got to, for its chip on the board and the outline.
// The builder's latest step; nothing when nothing was reported, or once the slice is Done (Done wins).
// ===========================================

const LABEL = { started: ['🔨', 'Started'], red: ['🔴', 'Spec red'], green: ['🟢', 'Green'], pr: ['🔗', 'PR'], stuck: ['⚠️', 'Stuck'] };

// "5 min ago": how long since a report (now: ms, for tests)
export function ago(at, now = Date.now()) {
  const t = Date.parse(at || '');
  if (isNaN(t)) return '';
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  return `${Math.round(min / 60 / 24)} d ago`;
}

// What a report says, e.g. "Green (12/12)" or "PR #290"
export function stepLabel(r) {
  const [, word] = LABEL[r.step] || ['', r.step];
  const tests = r.tests ? ` (${r.tests.passing}/${r.tests.total})` : '';
  if (r.step === 'pr') return `PR${r.pr?.number ? ` #${r.pr.number}` : ''}${tests}`;
  return `${word}${tests}`;
}
export const stepIcon = step => (LABEL[step] || ['•'])[0];

// -> null, or { sliceId, step, icon, label, ago, note }
export function sliceProgress(state, sliceId, now = Date.now()) {
  const slice = state.slices[sliceId];
  const p = state.progress?.[sliceId];
  if (!slice || !p || slice.built) return null;
  return { sliceId, step: p.step, icon: stepIcon(p.step), label: stepLabel(p), ago: ago(p.at, now), note: p.note };
}
