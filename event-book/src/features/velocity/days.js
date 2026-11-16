// Calendar days in the device's time zone (velocity's buckets)
const pad = n => String(n).padStart(2, '0');
export const localDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// A calendar day ("2026-10-22") in local time; a bare date is that day already
export function dayOf(when) {
  if (/^\d{4}-\d\d-\d\d$/.test(String(when))) return when;
  const d = new Date(when);
  return isNaN(d) ? null : localDay(d);
}
