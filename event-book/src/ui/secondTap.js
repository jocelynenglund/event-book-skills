// ===========================================
// SECOND TAP - a delete needs two taps
// The first tap turns the button into "Tap again to delete" for a few seconds;
// only a second tap in that time goes ahead. No browser pop-up.
// ===========================================

const ARM_MS = 4000;

// True when the button was already asking (go ahead); otherwise it starts asking
export function secondTap(button, label = 'Tap again to delete') {
  if (!button) return true;
  if (button.dataset.armed === '1') return true;
  const title = button.querySelector('.sheet-option-title') || button;
  const before = title.textContent;
  button.dataset.armed = '1';
  button.classList.add('armed');
  title.textContent = label;
  setTimeout(() => {
    if (!button.isConnected) return;
    button.dataset.armed = '';
    button.classList.remove('armed');
    title.textContent = before;
  }, ARM_MS);
  return false;
}
