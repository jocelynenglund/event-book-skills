// ===========================================
// TOAST NOTIFICATIONS
// ===========================================

let hideTimer = null;

// action / onAction: an optional button on the toast (e.g. Undo); it stays a
// little longer so there's time to reach it
export function showToast(message, { action, onAction } = {}) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action;
    btn.onclick = () => { toast.classList.remove('show'); onAction?.(); };
    toast.append(btn);
  }
  toast.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove('show'), action ? 5000 : 2500);
}
