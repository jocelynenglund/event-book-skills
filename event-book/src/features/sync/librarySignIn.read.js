// ===========================================
// SYNC - Library Sign In: what the line under "Bookshelves" says about the library: who is signed in (tap for
// their account), or the offer to sign in to the library.
// ===========================================

import { account } from './client.js';

// signedIn: whether an account is signed in on this device; email: whose; label: what the button says; action: what it does
export function librarySignIn(who = account()) {
  return who
    ? { signedIn: true, email: who.email, label: `☁ ${who.email}`, action: 'account' }
    : { signedIn: false, email: null, label: '☁ Sign in to your library', action: 'signin' };
}
