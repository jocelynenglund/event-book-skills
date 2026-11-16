// ===========================================
// SYNC - What this device is called when it signs in: its browser and its system
// ("Chrome on Mac", "Safari on iPhone"), so "checked out on …" says which one it is.
// Pure: the user agent in, the name out.
// ===========================================

export function deviceLabel(ua = '') {
  const s = String(ua);
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android'
    : /CrOS/.test(s) ? 'ChromeOS' : /Macintosh|Mac OS X/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : null;
  const browser = /Edg(e|A|iOS)?\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\/|FxiOS\//.test(s) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : null;
  if (!os && !browser) return 'Browser';
  return browser && os ? `${browser} on ${os}` : browser || os;
}
