(() => {
  const root = document.querySelector('[data-tool-id="big-island-beach-day"]');
  if (!root) return;
  const OWNER = document.currentScript?.src ? new URL(document.currentScript.src).origin : 'https://national-outdoor-core.vercel.app';
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

  $('#bdDays').setAttribute('role', 'group');
  function renderDays() {
    $('#bdDays').innerHTML = data.days.map((d) => `<button type="button" class="bd-day${d.date === picked ? ' on' : ''}" aria-pressed="${d.date === picked}" data-date="${esc(d.date)}"><b>${esc(d.label)}</b><small>${esc(dateLabel(d.date))}</small></button>`).join('');
    $('#bdDays').querySelectorAll('.bd-day').forEach((b) => b.addEventListener('click', () => { picked = b.dataset.date; event('beachday_day_picked', { days_ahead: data.days.findIndex((d) => d.date === picked) }); render(); }));
  }

  function coastCard(c, nwsCovered) {
    const d = c.decision;
    const nws = c.nws ? `${c.nws.lowFt}–${c.nws.highFt} ft` : (nwsCovered ? 'not listed' : 'not available for this date');
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
    $('#bdPlain').textContent = day.nwsCovered ? 'NWS forecast, alerts, wave model and wind, calmest coast first.' : 'An NWS surf forecast could not be matched to this date. Ratings use the available model and wind data; check the official surf forecast before choosing a beach.';
    $('#bdCoasts').innerHTML = day.coasts.map((c) => coastCard(c, day.nwsCovered)).join('');
    const HC = window.HawaiiCharts;
    if (HC && $('#bdRuler')) {
      $('#bdRuler').innerHTML = HC.ruler(day.coasts.map((c) => ({ name: c.name, value: c.model ? c.model.peakM : null, record: c.record })), 'm');
      $('#bdGrid').innerHTML = HC.grid(data.days.map((d) => ({ label: d.label, states: day.coasts.map((row) => d.coasts.find((c) => c.id === row.id)?.decision.state || 'NO_DATA') })), day.coasts.map((c) => c.name));
    }
    const t = data.thresholds || {};
    const set = (id, v) => { const el = $(id); if (el && v != null) el.textContent = v; };
    set('#bdModerateFt', t.nwsModerateFt); set('#bdLargeFt', t.nwsLargeFt); set('#bdModeratePct', t.modelModeratePct); set('#bdLargePct', t.modelLargePct);
    $('#bdSources').innerHTML = (data.sources || []).map((s) => `<li><strong>${esc(s.name)}</strong><span>${esc(s.note || (s.asOf ? `As of ${stamp(s.asOf)}` : ''))}</span><em>${s.ok ? 'OK' : 'DOWN'}</em></li>`).join('');
    $('#bdFresh').textContent = `Updated ${stamp(data.updated)}. The step cutoffs are unvalidated starting rules.`;
    $('#bdError').hidden = true;
  }

  async function load(bust) {
    const seq = ++loadSeq;
    data = null;
    $('.live-card').setAttribute('data-state', 'verify');
    for (const id of ['bdCoasts', 'bdDays', 'bdRuler', 'bdGrid', 'bdSources']) $('#' + id).replaceChildren();
    $('#bdHeadline').textContent = 'Updating the forecast…';
    $('#bdPlain').textContent = 'Checking the selected date.';
    $('#bdFresh').textContent = 'Checking for a current forecast.';
    $('#bdError').hidden = true;
    try {
      const res = await fetch(`${OWNER}/api/big-island-beach-day?v=1${bust ? `&_=${Date.now()}` : ''}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      const p = await res.json();
      if (seq !== loadSeq) return;
      if (!res.ok || !p.ok) throw new Error(p.detail || p.error || `HTTP ${res.status}`);
      // A shared cache can hand back an old copy: if it is over 15 minutes old, ask once for a fresh one.
      const age = Date.now() - Date.parse(p.updated);
      if (!Number.isFinite(age) || age < -5 * 60000 || age > 15 * 60000) {
        if (!bust) return load(true);
        throw new Error('The forecast could not be refreshed. Older ratings are hidden');
      }
      if (!Array.isArray(p.days) || !p.days.length) throw new Error('No forecast dates were returned');
      lastLoaded = Date.now();
      data = p;
      // Never keep showing a day that has passed: if the picked day is no longer offered, go to the first.
      if (!picked || !data.days.some((d) => d.date === picked)) picked = data.days[0].date;
      render();
      event('beachday_loaded', { calm: data.days[0].coasts.filter((c) => c.decision.state === 'CALM').length });
    } catch (e) {
      if (seq !== loadSeq) return;
      lastLoaded = Date.now();
      data = null;
      $('.live-card').setAttribute('data-state', 'verify');
      for (const id of ['bdCoasts', 'bdDays', 'bdRuler', 'bdGrid', 'bdSources']) $('#' + id).replaceChildren();
      $('#bdHeadline').textContent = 'Could not load the surf';
      $('#bdPlain').textContent = 'No current rating is available. Use the official checks below.';
      $('#bdFresh').textContent = 'Forecast unavailable; previous ratings have been removed.';
      const err = $('#bdError'); err.hidden = false;
      err.textContent = `${String(e.message || e)}. Check the National Weather Service Honolulu surf forecast (weather.gov/hfo) and look at the water.`;
      err.append(' ', Object.assign(document.createElement('a'), { href: 'https://www.weather.gov/hfo/', textContent: 'Open the official Honolulu forecast' }));
    }
  }
  $('#bdRefresh').addEventListener('click', () => { event('beachday_refresh'); load(true); });
  const stale = () => lastLoaded && Date.now() - lastLoaded > 10 * 60000;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stale()) load(true); });
  setInterval(() => { if (!document.hidden && stale()) load(true); }, 60000);
  const outingScript = document.createElement('script');
  outingScript.src = OWNER + '/assets/big-island-outings.js';
  document.head.append(outingScript);
  load();
})();
