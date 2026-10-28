// ===========================================
// CLIPBOARD - copy that says whether it worked
// ===========================================

// The clipboard API first; some browsers refuse it (no focus, permissions,
// big texts), so fall back to the old select-and-copy on a hidden text box
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) { /* fall back */ }
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0;';
  document.body.appendChild(box);
  box.focus();
  box.select();
  box.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  box.remove();
  return ok;
}
