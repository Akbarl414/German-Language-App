// The app's notion of "today": a local-time YYYY-MM-DD key where the day
// rolls over at DAY_START_HOUR (04:00 local) rather than midnight, so a
// late-night session still counts toward the day it started in. Used for
// stats.history keys, the streak, daily snapshots, and backup filenames.
// Full ISO timestamps (createdAt, lastExportAt, ids) are NOT day keys and
// stay as toISOString().

export const DAY_START_HOUR = 4;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-time 'YYYY-MM-DD' for `date`, treating anything before 04:00 as the previous day. */
export function localDayKey(date = new Date()) {
  const d = new Date(date);
  if (d.getHours() < DAY_START_HOUR) {
    // Calendar-day arithmetic (not ms) so DST transitions can't skew it; noon avoids nonexistent local midnights.
    return formatLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12));
  }
  return formatLocal(d);
}

/** The day key one calendar day before `key` ('YYYY-MM-DD'), independent of DST and timezone. */
export function previousDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return formatLocal(new Date(y, m - 1, d - 1, 12));
}
