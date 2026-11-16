// ===========================================
// PRESS - A plan being built, in the app: the plan's ⋮ menu sends it to press (or stops the
// press before a builder takes it); the book's details say where it is (Plan Status) and,
// once it's back, what came back with the build (Build Summary) with Compare.
// ===========================================

import { sendToPress, stopPress } from './command.js';
import { account } from '../sync/client.js';
import { nickname } from '../comments/command.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { pressMenu } from './pressMenuEntry.read.js';
import { pressSentToast } from './pressSentToast.read.js';
import { pressStatusSection } from './pressStatusSection.read.js';
import { pressStatus } from './press.parts.js';

export { pressMenu };

export function pressFromMenu(send) {
  const why = send ? sendToPress({ by: nickname() || account()?.email || null }) : stopPress();
  if (why) { showToast(why); return; }
  showToast(pressSentToast(send));
  render();
}

// The book's details: its status, and what came back
export const pressSection = (state, id) => pressStatus(pressStatusSection(state, id));
