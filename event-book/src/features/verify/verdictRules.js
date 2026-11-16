// ===========================================
// VERDICT RULES - who tried a scenario, and what that adds up to (pure, over a projected book)
// Each tester's (nickname) own newest verdict counts; a tester changing their mind replaces only their own.
// Overall: ✗ when any tester's current verdict is ✗, else ✓ when any says ✓, else untried.
// A verdict from an earlier edition counts in the edition being verified while the scenario hasn't changed
// since (its shape when that edition was published is the same as the one being verified); a changed
// scenario starts untried. A tester's verdict in the edition itself replaces their carried one.
// ===========================================

import { scenarioShape } from '../../core/projections.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = n => String(n).padStart(2, '0');
export function whenLabel(at) {
  const d = new Date(at);
  return isNaN(d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// Every tester's current verdict on a scenario in an edition: fails first, then works, newest first
export function testersOf(state, edition, scenarioId) {
  const verdicts = state.verdicts || {}, shapes = state.verdictShapes || {};
  const scn = state.scenarios?.[scenarioId];
  const target = shapes[edition]?.[scenarioId] ?? (scn ? scenarioShape(scn, state) : null);
  const editions = Object.keys(verdicts).map(Number).filter(e => e <= edition && verdicts[e]?.[scenarioId]).sort((a, b) => b - a);
  const names = new Set(editions.flatMap(e => Object.keys(verdicts[e][scenarioId])));
  const out = [];
  names.forEach(name => {
    const e = editions.find(x => verdicts[x][scenarioId][name]);
    if (e == null) return;
    if (e !== edition && (target == null || shapes[e]?.[scenarioId] !== target)) return;
    const v = verdicts[e][scenarioId][name];
    out.push({ nickname: name, verdict: v.verdict, note: v.note || null, at: v.at, label: whenLabel(v.at), fromEdition: e === edition ? null : e });
  });
  const rank = t => t.verdict === 'fails' ? 0 : 1;
  return out.sort((a, b) => rank(a) - rank(b) || String(b.at).localeCompare(String(a.at)));
}

// 'fails' | 'works' | null (untried)
export function overallOf(testers) {
  return testers.some(t => t.verdict === 'fails') ? 'fails' : testers.length ? 'works' : null;
}

export const overallVerdictOf = (state, edition, scenarioId) => overallOf(testersOf(state, edition, scenarioId));
