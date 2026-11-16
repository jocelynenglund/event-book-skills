// ===========================================
// COMMENTS - Comment To Reveal: the open comment a tap on the board chat's Outstanding list means, to take
// the reader to where it is. Null when it was resolved meanwhile. Replays the book once.
// ===========================================

import { projectState } from '../../core/projections.js';
import { openComments } from './read.js';

export const openCommentNamed = commentId => openComments(projectState()).find(x => x.commentId === commentId) || null;
