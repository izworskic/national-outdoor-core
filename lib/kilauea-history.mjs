// Kīlauea summit eruption, episodes 40 to 55 (Jan to Oct 2026): start and end times in HST,
// read from the USGS Hawaiian Volcano Observatory notices (HANS). Only episodes whose start AND end were
// stated with a clock time are listed; nothing is estimated. Earlier episodes are left out, not guessed.
export const EPISODES = [
  [40, '2026-01-12T08:22', '2026-01-12T18:04'], [41, '2026-01-24T11:10', '2026-01-24T19:29'],
  [42, '2026-02-15T13:50', '2026-02-15T23:38'], [43, '2026-03-10T09:17', '2026-03-10T18:21'],
  [44, '2026-04-09T11:10', '2026-04-09T19:41'], [45, '2026-04-23T01:34', '2026-04-23T10:01'],
  [46, '2026-05-05T08:17', '2026-05-05T17:22'], [47, '2026-05-14T15:27', '2026-05-15T00:27'],
  [48, '2026-06-01T04:40', '2026-06-01T13:37'], [49, '2026-06-14T09:32', '2026-06-14T17:05'],
  [50, '2026-06-27T10:10', '2026-06-27T17:10'], [51, '2026-07-15T08:30', '2026-07-15T16:46'],
  [52, '2026-07-28T19:10', '2026-07-29T02:36'], [53, '2026-08-12T15:45', '2026-08-13T01:23'],
  [54, '2026-08-25T10:30', '2026-08-25T19:33'], [55, '2026-10-17T03:19', '2026-10-17T09:03']
].map(([n, s, e]) => ({ n, start: `${s}:00-10:00`, end: `${e}:00-10:00` }));

/** Windows HVO published that were checked by hand against the start that followed. Misses only; this is not a hit rate. */
export const KNOWN_MISSES = [
  { episode: 48, window: 'May 24 to 27', began: 'June 1', note: '5 days after the window closed' },
  { episode: 55, window: 'Sept 7 to 13', began: 'October 17', note: 'about 5 weeks after the window closed; the pause after episode 54 lasted 53 days' }
];

/** From the USGS Volcano Watch of July 2, 2026 (first 50 episodes). */
export const LONG_RUN = { episodes: 50, days: 551, meanIntervalDays: 11, longestPauseDays: 30, source: 'USGS HVO Volcano Watch, July 2, 2026' };

const MS_H = 3600000, MS_D = 86400000;
export function stats(eps = EPISODES) {
  const starts = eps.map((e) => Date.parse(e.start));
  const ends = eps.map((e) => Date.parse(e.end));
  const intervals = starts.slice(1).map((s, i) => ({ from: eps[i].n, to: eps[i + 1].n, days: Math.round(((s - starts[i]) / MS_D) * 10) / 10 }));
  const durations = eps.map((e, i) => ({ n: e.n, hours: Math.round(((ends[i] - starts[i]) / MS_H) * 10) / 10 }));
  const startHour = Array(24).fill(0);
  starts.forEach((ms) => { startHour[new Date(ms - 10 * MS_H).getUTCHours()]++; });
  const sorted = (a) => [...a].sort((x, y) => x - y);
  const med = (a) => { const s = sorted(a); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const iv = intervals.map((i) => i.days), du = durations.map((d) => d.hours);
  return {
    count: eps.length, intervals, durations, startHour,
    medianIntervalDays: Math.round(med(iv) * 10) / 10, longestIntervalDays: Math.max(...iv), shortestIntervalDays: Math.min(...iv),
    medianDurationHours: Math.round(med(du) * 10) / 10, minDurationHours: Math.min(...du), maxDurationHours: Math.max(...du),
    starts: eps.map((e) => e.start.slice(0, 10)), lastEnd: ends[ends.length - 1]
  };
}

/** Share of all N-day windows between the first and last start that contained at least one episode start (HST dates). */
export function chanceInWindow(lenDays, eps = EPISODES) {
  const day = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') / MS_D);
  const starts = eps.map((e) => day(e.start));
  const a = starts[0], b = starts[starts.length - 1];
  let hit = 0, total = 0;
  for (let d = a - lenDays + 1; d <= b; d++) {
    total++;
    if (starts.some((s) => s >= d && s <= d + lenDays - 1)) hit++;
  }
  return { windows: total, hit, share: total ? hit / total : null };
}
