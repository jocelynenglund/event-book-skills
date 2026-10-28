// ===========================================
// SHEET HELPERS
// ===========================================

// Description boxes grow with what's written in them (CSS caps them at half the screen)
export function growToFit(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}
document.addEventListener('input', e => {
  if (e.target.matches?.('.ol-add-desc, .bd-slice-desc')) growToFit(e.target);
});
// Sized when a sheet opens: after it's laid out
new MutationObserver(() => requestAnimationFrame(() => document.querySelectorAll('.sheet-overlay.active .ol-add-desc, .sheet-overlay.active .bd-slice-desc').forEach(growToFit)))
  .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });

export function showSheet(idOrContent) {
  // If it looks like HTML content, use dynamic sheet
  if (idOrContent.includes('<')) {
    const overlay = document.getElementById('dynamicSheet');
    const content = document.getElementById('dynamicSheetContent');
    content.innerHTML = idOrContent;
    overlay.classList.add('active');
  } else {
    // Static sheet by ID
    document.getElementById(idOrContent).classList.add('active');
  }
}

export function hideSheet(id) {
  if (id) {
    document.getElementById(id).classList.remove('active');
  } else {
    // Hide dynamic sheet
    document.getElementById('dynamicSheet').classList.remove('active');
  }
}

export function hideAllSheets() {
  document.querySelectorAll('.sheet-overlay').forEach(s => s.classList.remove('active'));
}

// Swipe a sheet down to close it. The sheet follows the finger; past the
// threshold (or a quick flick) it closes exactly like tapping outside, so
// sheets that act on close (properties → copy to events) still do.
// Only starts when the sheet is scrolled to its top, so long sheets scroll.
const SWIPE_CLOSE_PX = 90;
const FLICK_PX_PER_MS = 0.6;

function enableSwipeToClose(overlay) {
  const sheet = overlay.querySelector('.sheet');
  if (!sheet) return;
  let startY = null, startT = 0, dy = 0;

  sheet.addEventListener('touchstart', e => {
    if (sheet.scrollTop > 0 || e.touches.length !== 1) { startY = null; return; }
    startY = e.touches[0].clientY;
    startT = Date.now();
    dy = 0;
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (startY === null) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { sheet.style.transform = ''; return; }
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (startY === null) return;
    const flick = dy > 30 && dy / Math.max(Date.now() - startT, 1) > FLICK_PX_PER_MS;
    sheet.style.transition = '';
    sheet.style.transform = '';
    startY = null;
    if (dy > SWIPE_CLOSE_PX || flick) {
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
}

// The on-screen keyboard covers the bottom of the page on some phones (iPhone
// Safari never shrinks the page). Track the part of the screen that's still
// visible, so sheets sit above the keyboard and scroll within what's left.
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const update = () => {
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty('--kb', `${Math.round(covered)}px`);
    root.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

// A field tapped in a sheet (or the outline's add form) stays in sight once the keyboard is up
function keepFieldInView(e) {
  const field = e.target;
  if (!field.matches?.('input, textarea, select') || !field.closest('.sheet, .ol-add')) return;
  setTimeout(() => field.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
}

// Initialize sheet click-outside-to-close and swipe-down-to-close
export function initSheets() {
  document.querySelectorAll('.sheet-overlay').forEach(overlay => {
    overlay.onclick = (e) => {
      if (e.target === overlay) hideAllSheets();
    };
    enableSwipeToClose(overlay);
  });
  trackKeyboard();
  document.addEventListener('focusin', keepFieldInView);
}
