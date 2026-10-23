(() => {
  const root = document.querySelector('[data-tool-id="kilauea-episode-watch"]');
  if (!root) return;
  const TZ = 'Pacific/Honolulu';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const event = (name, d = {}) => { try { window.va?.('event', { name, data: d }); window.gtag?.('event', name, d); } catch {} };
  const stamp = (iso) => iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)) : 'unavailable';
  const dlab = (ymd) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
  const STATE = { GO: 'go', SOON: 'verify', OVERDUE: 'verify', NO_WINDOW: 'verify', WAIT: 'verify', NO_DATA: 'verify' };
  let data = null, loadSeq = 0, lastLoaded = 0;

  const dayNum = (ymd) => Math.floor(Date.parse(`${ymd}T12:00:00Z`) / 86400000);
  function chance(starts, len) {
    const s = starts.map(dayNum); const a = s[0], b = s[s.length - 1];
    let hit = 0, total = 0;
    for (let d = a - len + 1; d <= b; d++) { total++; if (s.some((x) => x >= d && x <= d + len - 1)) hit++; }
    return { hit, total };
  }

  function renderCalc() {
    const from = $('#kvFrom').value, to = $('#kvTo').value;
    const A = $('#kvChanceAnswer'), B = $('#kvChanceHvo');
    if (!from || !to || to < from) { A.textContent = 'Pick a first and last day.'; B.textContent = ''; return; }
    const len = Math.min(dayNum(to) - dayNum(from) + 1, 60);
    const c = chance(data.history.stats.starts, len);
    const pct = Math.round((c.hit / c.total) * 100);
    A.textContent = `In 2026, ${pct}% of ${len}-day windows (${c.hit} of ${c.total}) had an episode start in them.`;
    const w = data.hvo && data.hvo.window;
    if (!w) B.textContent = 'The USGS has not published a forecast window right now.';
    else if (w.end < from) B.textContent = `The USGS window (${dlab(w.start)} to ${dlab(w.end)}) ends before your dates, so the next episode after that is the one that matters.`;
    else if (w.start > to) B.textContent = `The USGS window (${dlab(w.start)} to ${dlab(w.end)}) opens after your dates.`;
    else B.textContent = `The USGS window (${dlab(w.start)} to ${dlab(w.end)}) overlaps your dates. That raises the odds, but the start can fall anywhere in the window.`;
    event('kilauea_dates_checked', { days: len, share: pct });
  }

  function render() {
    const c = data.call, hvo = data.hvo, h = data.history, st = h.stats;
    $('.live-card').setAttribute('data-state', STATE[c.state] || 'verify');
    $('#kvEyebrow').textContent = `${c.label} · ${stamp(data.updated)}`;
    $('#kvHeadline').textContent = c.headline;
    $('#kvPlain').textContent = c.plain;
    $('#kvReasons').innerHTML = (c.reasons || []).map((r) => `<li>${esc(r)}</li>`).join('');
    $('#kvMeta').innerHTML = hvo ? `${hvo.alertLevel ? `<span class="kv-pill" data-c="${esc(hvo.colorCode)}">Alert level ${esc(hvo.alertLevel)}</span>` : ''}<span>Issued ${esc(stamp(hvo.issued))}</span><a href="${esc(hvo.noticeUrl)}" rel="noopener">Full USGS notice</a>` : '';
    $('#kvQuote').textContent = hvo ? hvo.summary : 'The USGS update could not be read right now. See the USGS Kilauea page.';
    $('#kvHvoNote').textContent = hvo && h.historyStale ? 'The USGS is now past episode 55, which is the last episode in the record below.' : '';

    const cond = data.conditions, HC = window.HawaiiCharts;
    if (HC) {
      $('#kvStrip').innerHTML = cond ? HC.strip(cond.hours) : '<p class="method-note">Summit weather could not be read right now.</p>';
      $('#kvGaps').innerHTML = HC.bars(st.intervals.map((i) => i.days), st.intervals.map((i) => String(i.to)), { label: 'Days between Kilauea episodes', unit: ' days', highlight: st.intervals.length - 1, line: h.daysSinceLast, lineLabel: h.daysSinceLast != null ? `${Math.round(h.daysSinceLast)} days so far` : '' });
      $('#kvHours').innerHTML = HC.bars(st.startHour, st.startHour.map((_, i) => (i % 6 === 0 ? (i === 0 ? '12a' : i === 12 ? '12p' : i < 12 ? `${i}a` : `${i - 12}p`) : '')), { label: 'Episode start hour', unit: ' episodes' });
    }
    $('#kvWxLine').textContent = cond ? `${cond.goodHours} of the next ${cond.hours.length} hours rate clear.${cond.nowGas ? ' Wind right now is from the south or southeast: check the park air quality page.' : ''}` : '';
    $('#kvStats').innerHTML = [[`${st.count}`, 'episodes this year'], [`${st.medianIntervalDays} days`, 'median gap'], [`${st.longestIntervalDays} days`, 'longest gap'], [`${st.minDurationHours} to ${st.maxDurationHours} h`, 'how long each lasted']].map(([b, s]) => `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
    $('#kvMiss').innerHTML = h.knownMisses.map((m) => `<li><b>Episode ${m.episode}.</b> Window ${esc(m.window)}; it began ${esc(m.began)}, ${esc(m.note)}.</li>`).join('');
    const t = data.thresholds || {};
    const set = (id, v) => { const el = $(id); if (el && v != null) el.textContent = v; };
    set('#kvSoon', t.soonDays); set('#kvSoon2', t.soonDays); set('#kvCloudPoor', t.lowCloudPoor);
    $('#kvSources').innerHTML = (data.sources || []).map((s) => `<li><strong>${esc(s.name)}</strong><span>${esc(s.note || (s.asOf ? `As of ${stamp(s.asOf)}` : ''))}</span><em>${s.ok ? 'OK' : 'DOWN'}</em></li>`).join('');
    $('#kvFresh').textContent = `Updated ${stamp(data.updated)}. Checked again automatically while this page is open.`;
    const fromEl = $('#kvFrom'), toEl = $('#kvTo');
    if (!fromEl.value) { fromEl.value = data.today; const d = new Date(`${data.today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); toEl.value = d.toISOString().slice(0, 10); }
    renderCalc();
  }

  // Everything is read in this browser straight from USGS and Open-Meteo: no server function. A 5-minute
  // per-tab cache keeps repeat opens from re-calling them.
  const CACHE = 'kv-watch-v1';
  const cached = () => { try { const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); return c && Date.now() - c.at < 300000 ? c.data : null; } catch { return null; } };
  const keep = (d) => { try { sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), data: d })); } catch {} };
  async function load(bust) {
    const seq = ++loadSeq;
    try {
      const hit = bust ? null : cached();
      const json = hit || await window.KilaueaEngine.buildEpisodeWatch(Date.now());
      if (seq !== loadSeq) return;
      if (!json || json.ok === false) throw new Error('Live source unavailable');
      if (!hit) keep(json);
      data = json; lastLoaded = Date.now();
      $('#kvError').hidden = true;
      render();
      event('kilauea_watch_loaded', { state: json.call.state });
    } catch (e) {
      if (seq !== loadSeq) return;
      $('#kvError').hidden = false;
      $('#kvError').textContent = `Could not load the live read (${e.message}). Check the USGS Kilauea page directly.`;
      $('#kvHeadline').textContent = 'Live read unavailable.';
    }
  }

  $('#kvRefresh').addEventListener('click', () => { event('kilauea_refresh'); load(true); });
  $('#kvFrom').addEventListener('change', () => data && renderCalc());
  $('#kvTo').addEventListener('change', () => data && renderCalc());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastLoaded > 15 * 60000) load(true); });
  setInterval(() => { if (!document.hidden && Date.now() - lastLoaded > 10 * 60000) load(true); }, 600000);
  load(false);
})();
