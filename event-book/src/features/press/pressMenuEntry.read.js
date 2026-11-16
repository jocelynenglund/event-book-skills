// ===========================================
// PRESS - Press Menu Entry: what the plan's ⋮ menu offers about the press: stop it at the press (before a
// builder takes it), or send the refined slices (how many, and why not when it can't be sent). Nothing while
// it is being built.
// ===========================================

import { projectState, getOrderedSlices } from '../../core/projections.js';
import { sendRefusal } from './command.js';

// -> null while being built; { stop: true } at the press; else { count, refused }
export function pressMenu(state = projectState()) {
  const p = state.press;
  if (p?.stage === 'building') return null;
  if (p?.stage === 'press') return { stop: true };
  return { count: getOrderedSlices(state).filter(s => s.refined).length, refused: sendRefusal(state) };
}
