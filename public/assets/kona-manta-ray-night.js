(() => {
  const root = document.querySelector('[data-tool-id="kona-manta-ray-night"]');
  if (!root) return;
  const OWNER = 'https://national-outdoor-core.vercel.app';
  const TZ = 'Pacific/Honolulu';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const event = (name, data = {}) => { try { window.va?.('event', { name, data }); window.gtag?.('event', name, data); } catch {} };
  const stamp = (iso) => iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)) : 'unavailable';
  const dateLabel = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12))); };
  const CARD = { GOOD: 'go', WATCH: 'verify', CHECK: 'verify', ROUGH: 'stop', NO_DATA: 'verify' };
  const CHIP = { GOOD: 'CALM', WATCH: 'MODERATE', CHECK: 'CHECK', ROUGH: 'ROUGH', NO_DATA: 'NO_DATA' }; // reuse the beach-day chip colours
  const CONF = { MODERATE: 'Moderate confidence', LOW: 'Low confidence', NONE: 'No call' };
  const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  const RANK = { GOOD: 0, WATCH: 1, CHECK: 2, ROUGH: 3, NO_DATA: 4 };

  let data = null, picked = '', loadSeq = 0, lastLoaded = 0;

  function renderDays() {
    $('#mnDays').innerHTML = data.nights.map((d) => `<button type="button" role="tab" class="bd-day${d.date === picked ? ' on' : ''}" aria-selected="${d.date === picked}" data-date="${esc(d.date)}"><b>${esc(d.label)}</b><small>${esc(dateLabel(d.date))}</small></button>`).join('');
    $('#mnDays').querySelectorAll('.bd-day').forEach((b) => b.addEventListener('click', () => { picked = b.dataset.date; event('manta_night_picked', { days_ahead: data.nights.findIndex((d) => d.date === picked) }); render(); }));
  }

  function siteCard(s, covered) {
    const d = s.decision;
    const nws = s.nws ? `${s.nws.lowFt}–${s.nws.highFt} ft (west-facing, whole day)` : (covered ? 'not listed' : 'beyond the forecast');
    const m = s.sea;
    const sea = m ? `${m.peakM.toFixed(2)} m${m.periodS ? `, ${m.periodS} s` : ''}${m.dirDeg != null ? ` from ${compass(m.dirDeg)}` : ''} · rougher than ${m.percentile}% of evenings` : 'no reading';
    const w = s.wind ? `${s.wind.mph} mph from ${compass(s.wind.fromDeg)}${s.wind.onshoreMph >= 15 ? ' (onshore)' : ''}` : 'no reading';
    const rain = s.rain ? `${s.rain.windowMm} mm tonight, ${s.rain.prior24Mm} mm in the 24 h before` : 'no reading';
    const al = (s.alerts || []).map((a) => `<p class="bd-alert">${esc(a.event)}${a.endsIso ? ` until ${esc(stamp(a.endsIso))}` : ''}</p>`).join('');
    return `<article class="bd-coast" data-state="${esc(CARD[d.state] || 'verify')}">
      <header><h3>${esc(s.short)}</h3><span class="bd-chip" data-call="${esc(CHIP[d.state] || d.state)}">${esc(d.label)}</span></header>
      <p class="bd-say">${esc(d.plain)}${CONF[d.confidence] ? ` · ${esc(CONF[d.confidence])}` : ''}</p>
      ${al}
      <dl class="bd-nums"><div><dt>NWS forecast</dt><dd>${esc(nws)}</dd></div><div><dt>Wave model, 6–9 p.m.</dt><dd>${esc(sea)}</dd></div><div><dt>Wind, 6–9 p.m.</dt><dd>${esc(w)}</dd></div><div><dt>Rain</dt><dd>${esc(rain)}</dd></div></dl>
      <ul class="bd-why">${(d.reasons || []).filter((r) => !/^(NWS west-facing|Wave model,)/.test(r)).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="bd-ex">${esc(s.name)}</p>
    </article>`;
  }

  function render() {
    const night = data.nights.find((d) => d.date === picked) || data.nights[0];
    picked = night.date;
    renderDays();
    const best = Math.min(...night.sites.map((s) => RANK[s.decision.state]));
    $('.live-card').setAttribute('data-state', best === 0 ? 'go' : night.sites.every((s) => s.decision.state === 'ROUGH') ? 'stop' : 'verify');
    $('#mnEyebrow').textContent = `${night.label} · ${dateLabel(night.date)} · 6 to 9 p.m. HST`;
    $('#mnHeadline').textContent = data.headline;
    $('#mnPlain').textContent = night.nwsCovered ? 'Rating for the evening selected below. The headline covers all four nights.' : 'This evening is beyond the NWS surf forecast, so its rating rests on the wave model, wind and rain. Treat it as a rough guide.';
    $('#mnSites').innerHTML = night.sites.map((s) => siteCard(s, night.nwsCovered)).join('');
    const t = data.thresholds || {};
    const set = (id, v) => { const el = $(id); if (el && v != null) el.textContent = v; };
    set('#mnNwsMod', 4); set('#mnNwsLarge', 7); set('#mnModPct', t.modelModeratePct); set('#mnLargePct', t.modelLargePct);
    set('#mnWind', t.onshoreWatchMph); set('#mnWindRough', t.onshoreRoughMph); set('#mnRain', t.rainWatchMm); set('#mnRainRough', t.rainRoughMm); set('#mnRunoff', t.runoffWatchMm);
    $('#mnSources').innerHTML = (data.sources || []).map((s) => `<li><strong>${esc(s.name)}</strong><span>${esc(s.note || (s.asOf ? `As of ${stamp(s.asOf)}` : ''))}</span><em>${s.ok ? 'OK' : 'DOWN'}</em></li>`).join('');
    $('#mnFresh').textContent = `Updated ${stamp(data.updated)}. The cutoffs are unvalidated starting rules.`;
    $('#mnError').hidden = true;
  }

  async function load(bust) {
    const seq = ++loadSeq;
    try {
      const res = await fetch(`${OWNER}/api/kona-manta-ray-night?v=1${bust ? `&_=${Date.now()}` : ''}`, { headers: { Accept: 'application/json' } });
      const p = await res.json();
      if (seq !== loadSeq) return;
      if (!res.ok || !p.ok) throw new Error(p.detail || p.error || `HTTP ${res.status}`);
      if (!bust && Date.now() - Date.parse(p.updated) > 15 * 60000) return load(true);
      lastLoaded = Date.now();
      data = p;
      // Never keep showing a night that has passed: if the picked night is no longer offered, go to the first.
      if (!picked || !data.nights.some((d) => d.date === picked)) picked = data.nights[0].date;
      render();
      event('manta_loaded', { good: data.nights.filter((n) => n.sites.some((s) => s.decision.state === 'GOOD')).length });
    } catch (e) {
      if (seq !== loadSeq) return;
      $('#mnHeadline').textContent = 'Could not load the sea conditions';
      $('#mnPlain').textContent = 'Sources unreachable';
      const err = $('#mnError'); err.hidden = false;
      err.textContent = `${String(e.message || e)}. Check the National Weather Service Honolulu surf forecast (weather.gov/hfo) and ask your operator.`;
    }
  }
  $('#mnRefresh').addEventListener('click', () => { event('manta_refresh'); load(true); });
  const stale = () => lastLoaded && Date.now() - lastLoaded > 10 * 60000;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stale()) load(true); });
  setInterval(() => { if (!document.hidden && stale()) load(true); }, 60000);
  load();
})();
