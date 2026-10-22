(() => {
  const root = document.querySelector('[data-tool-id="big-island-beach-day"]');
  if (!root) return;
  const OWNER = 'https://national-outdoor-core.vercel.app';
  const TZ = 'Pacific/Honolulu';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const event = (name, data = {}) => { try { window.va?.('event', { name, data }); window.gtag?.('event', name, data); } catch {} };
  const stamp = (iso) => iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)) : 'unavailable';
  const dateLabel = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12))); };
  const CARD = { CALM: 'go', MODERATE: 'verify', CHECK: 'verify', ROUGH: 'stop', NO_DATA: 'verify' };
  const CONF = { MODERATE: 'Moderate confidence', LOW: 'Low confidence', NONE: 'No call' };
  const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

  let data = null, picked = '', loadSeq = 0, lastLoaded = 0;

  function renderDays() {
    $('#bdDays').innerHTML = data.days.map((d) => `<button type="button" role="tab" class="bd-day${d.date === picked ? ' on' : ''}" aria-selected="${d.date === picked}" data-date="${esc(d.date)}"><b>${esc(d.label)}</b><small>${esc(dateLabel(d.date))}</small></button>`).join('');
    $('#bdDays').querySelectorAll('.bd-day').forEach((b) => b.addEventListener('click', () => { picked = b.dataset.date; event('beachday_day_picked', { days_ahead: data.days.findIndex((d) => d.date === picked) }); render(); }));
  }

  function coastCard(c, nwsCovered) {
    const d = c.decision;
    const nws = c.nws ? `${c.nws.lowFt}–${c.nws.highFt} ft` : (nwsCovered ? 'not listed' : 'beyond the forecast');
    const m = c.model;
    const model = m ? `${m.peakM.toFixed(2)} m${m.periodS ? `, ${m.periodS} s` : ''}${m.dirDeg != null ? ` from ${compass(m.dirDeg)}` : ''} · bigger than ${m.percentile}% of days` : 'no reading';
    const w = c.wind ? `${c.wind.mph} mph from ${compass(c.wind.fromDeg)}${c.wind.onshoreMph >= 15 ? ' (onshore)' : ''}` : 'no reading';
    const al = (c.alerts || []).map((a) => `<p class="bd-alert">${esc(a.event)}${a.endsIso ? ` until ${esc(stamp(a.endsIso))}` : ''}</p>`).join('');
    return `<article class="bd-coast" data-state="${esc(CARD[d.state] || 'verify')}" data-call="${esc(d.state)}">
      <header><h3>${esc(c.name)}</h3><span class="bd-chip" data-call="${esc(d.state)}">${esc(d.label)}</span></header>
      <p class="bd-say">${esc(d.plain)}${CONF[d.confidence] ? ` · ${esc(CONF[d.confidence])}` : ''}</p>
      ${al}
      <dl class="bd-nums"><div><dt>NWS forecast</dt><dd>${esc(nws)}</dd></div><div><dt>Wave model</dt><dd>${esc(model)}</dd></div><div><dt>Daytime wind</dt><dd>${esc(w)}</dd></div></dl>
      <ul class="bd-why">${(d.reasons || []).filter((r) => !/^(NWS surf forecast|Wave model): /.test(r)).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="bd-ex">Beaches here: ${esc(c.examples)}</p>
    </article>`;
  }

  function render() {
    const day = data.days.find((d) => d.date === picked) || data.days[0];
    picked = day.date;
    renderDays();
    const calm = day.coasts.some((c) => c.decision.state === 'CALM');
    $('.live-card').setAttribute('data-state', calm ? 'go' : day.coasts.every((c) => c.decision.state === 'ROUGH') ? 'stop' : 'verify');
    $('#bdEyebrow').textContent = `${day.label} · ${dateLabel(day.date)} · 8 a.m. to 5 p.m. HST`;
    $('#bdHeadline').textContent = day.headline;
    $('#bdPlain').textContent = day.nwsCovered ? 'NWS forecast, alerts, wave model and wind, calmest coast first.' : 'This day is beyond the NWS surf forecast, so it rests on the wave model and wind. Treat it as a rough guide.';
    $('#bdCoasts').innerHTML = day.coasts.map((c) => coastCard(c, day.nwsCovered)).join('');
    const t = data.thresholds || {};
    const set = (id, v) => { const el = $(id); if (el && v != null) el.textContent = v; };
    set('#bdModerateFt', t.nwsModerateFt); set('#bdLargeFt', t.nwsLargeFt); set('#bdModeratePct', t.modelModeratePct); set('#bdLargePct', t.modelLargePct);
    $('#bdSources').innerHTML = (data.sources || []).map((s) => `<li><strong>${esc(s.name)}</strong><span>${esc(s.note || (s.asOf ? `As of ${stamp(s.asOf)}` : ''))}</span><em>${s.ok ? 'OK' : 'DOWN'}</em></li>`).join('');
    $('#bdFresh').textContent = `Updated ${stamp(data.updated)}. The step cutoffs are unvalidated starting rules.`;
    $('#bdError').hidden = true;
  }

  async function load(bust) {
    const seq = ++loadSeq;
    try {
      const res = await fetch(`${OWNER}/api/big-island-beach-day?v=1${bust ? `&_=${Date.now()}` : ''}`, { headers: { Accept: 'application/json' } });
      const p = await res.json();
      if (seq !== loadSeq) return;
      if (!res.ok || !p.ok) throw new Error(p.detail || p.error || `HTTP ${res.status}`);
      // A shared cache can hand back an old copy: if it is over 15 minutes old, ask once for a fresh one.
      if (!bust && Date.now() - Date.parse(p.updated) > 15 * 60000) return load(true);
      lastLoaded = Date.now();
      data = p;
      // Never keep showing a day that has passed: if the picked day is no longer offered, go to the first.
      if (!picked || !data.days.some((d) => d.date === picked)) picked = data.days[0].date;
      render();
      event('beachday_loaded', { calm: data.days[0].coasts.filter((c) => c.decision.state === 'CALM').length });
    } catch (e) {
      if (seq !== loadSeq) return;
      $('#bdHeadline').textContent = 'Could not load the surf';
      $('#bdPlain').textContent = 'Sources unreachable';
      const err = $('#bdError'); err.hidden = false;
      err.textContent = `${String(e.message || e)}. Check the National Weather Service Honolulu surf forecast (weather.gov/hfo) and look at the water.`;
    }
  }
  $('#bdRefresh').addEventListener('click', () => { event('beachday_refresh'); load(true); });
  const stale = () => lastLoaded && Date.now() - lastLoaded > 10 * 60000;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stale()) load(true); });
  setInterval(() => { if (!document.hidden && stale()) load(true); }, 60000);
  load();
})();
