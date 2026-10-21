(() => {
  const root = document.querySelector('[data-tool-id="mauna-kea-tonight"]');
  if (!root) return;
  const OWNER = 'https://national-outdoor-core.vercel.app';
  const TZ = 'Pacific/Honolulu';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const event = (name, data = {}) => { try { window.va?.('event', { name, data }); window.gtag?.('event', name, data); } catch {} };
  const clock = (iso) => iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(' AM', ' a.m.').replace(' PM', ' p.m.') : '—';
  const stamp = (iso) => iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)) : 'unavailable';
  const ymdHst = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const plusDays = (ymd, n) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10); };
  const labelYmd = (ymd, long) => { const [y, m, d] = ymd.split('-').map(Number); return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', ...(long ? {} : {}) }).format(new Date(Date.UTC(y, m - 1, d, 12))); };
  const cToF = (c) => Math.round(c * 9 / 5 + 32);
  const CARD = { GO: 'go', MIXED: 'verify', CHECK: 'verify', UNCERTAIN: 'verify', TOO_FAR: 'verify', NO_GO: 'stop' };
  const CALL = { GO: 'GO', MIXED: 'PARTLY', NO_GO: 'NO-GO', UNKNOWN: 'NO DATA' };
  const PLAIN = {
    GO: 'Both halves look good',
    MIXED: 'One half should work',
    NO_GO: 'Not tonight',
    CHECK: 'The forecaster and the model disagree',
    UNCERTAIN: 'No weather call available',
    TOO_FAR: 'Past the weather horizon'
  };
  const CONF = { MODERATE: 'Moderate confidence', LOW: 'Low confidence', NONE: 'No weather call' };

  const sel = $('#mk-evening'), dateIn = $('#mk-date');
  let chosen = '';
  let loadSeq = 0;

  function buildPicker() {
    const today = ymdHst(new Date());
    let html = '<option value="">Tonight</option>';
    for (let i = 1; i < 7; i++) { const v = plusDays(today, i); html += `<option value="${v}">${esc(labelYmd(v))}</option>`; }
    html += '<option value="__other">Another date…</option>';
    sel.innerHTML = html;
    dateIn.min = today; dateIn.max = plusDays(today, 365);
    if (chosen) {
      if ([...sel.options].some((o) => o.value === chosen)) sel.value = chosen;
      else { sel.value = '__other'; dateIn.hidden = false; dateIn.value = chosen; }
    }
  }
  function setChosen(v, fromUser) {
    chosen = v && DATE_RE.test(v) && v !== ymdHst(new Date()) ? v : '';
    try { history.replaceState(null, '', chosen ? `#date=${chosen}` : location.pathname + location.search); } catch {}
    if (fromUser) event('maunakea_evening_picked', { days_ahead: chosen ? Math.round((Date.parse(chosen) - Date.parse(ymdHst(new Date()))) / 864e5) : 0 });
    if (sel) { if ([...sel.options].some((o) => o.value === chosen)) { sel.value = chosen; dateIn.hidden = true; } else if (chosen) { sel.value = '__other'; dateIn.hidden = false; dateIn.value = chosen; } }
    load();
  }
  sel.addEventListener('change', () => {
    if (sel.value === '__other') { dateIn.hidden = false; dateIn.focus(); return; }
    dateIn.hidden = true; setChosen(sel.value, true);
  });
  dateIn.addEventListener('change', () => { if (dateIn.value) setChosen(dateIn.value, true); });
  $('#mkRefresh').addEventListener('click', () => { event('maunakea_refresh'); load(); });

  function fact(label, value) { return `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }

  function renderNights(p) {
    const box = $('#mkNights');
    const max = 600;
    box.innerHTML = (p.nights || []).map((n) => {
      const h = Math.max(4, Math.round(Math.min(max, n.moonFreeMinutes) / max * 100));
      const hours = (n.moonFreeMinutes / 60).toFixed(1).replace(/\.0$/, '');
      const sel = n.date === p.date;
      return `<button type="button" role="listitem" class="mk-night${sel ? ' on' : ''}" data-date="${esc(n.date)}" aria-pressed="${sel}" aria-label="${esc(labelYmd(n.date))}: ${hours} moon-free hours, moon ${Math.round(n.moonIllumination * 100)} percent lit">
        <span class="mk-bar-wrap"><span class="mk-bar" style="height:${h}%"></span></span>
        <b>${esc(hours)}h</b>
        <small>${esc(labelYmd(n.date).replace(/^(\w+), /, '$1 '))}</small>
        <em>${Math.round(n.moonIllumination * 100)}%</em>
      </button>`;
    }).join('');
    box.querySelectorAll('.mk-night').forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.date; if (d && d !== p.date) setChosen(d, true);
    }));
    const a = p.astronomy || {};
    $('#mkNightsNote').textContent = `Selected night: ${a.moonPhase || ''}, ${Math.round((a.moonIllumination || 0) * 100)}% lit${a.moonriseIso ? `, moonrise ${clock(a.moonriseIso)}` : ''}${a.moonsetIso ? `, moonset ${clock(a.moonsetIso)}` : ''}. Hours and percentages are for each evening starting at sunset. Moon-free means the sun is more than 18 degrees below the horizon and the moon is down.`;
  }

  function renderHalf(prefix, half, fallback) {
    const chip = $(`#mk${prefix}Chip`), why = $(`#mk${prefix}Why`), meta = $(`#mk${prefix}Meta`);
    if (!half) { chip.textContent = 'No call'; chip.dataset.call = 'NONE'; why.textContent = fallback; meta.textContent = ''; return; }
    chip.textContent = CALL[half.call] || half.call; chip.dataset.call = half.call; why.textContent = half.why;
    if (prefix === 'Sunset') {
      meta.textContent = half.seaOfClouds ? `Humidity at summit height ${half.rh600 ?? '—'}%. Low cloud ${half.lowCloudPct ?? '—'}% under a dry summit.` : `Humidity at summit height ${half.rh600 ?? '—'}%, mid-level cloud ${half.midCloudPct ?? '—'}%.`;
    } else {
      meta.textContent = half.visitorStationInCloud ? 'Part of the night the Visitor Station may sit in cloud (humidity near 9,000 feet is very high).' : '';
    }
  }

  function render(p) {
    const d = p.decision || {};
    $('.live-card').setAttribute('data-state', CARD[d.state] || 'verify');
    root.dataset.mode = p.mode;
    $('#mkEyebrow').textContent = p.mode === 'tonight' ? `Tonight · ${labelYmd(p.date)}` : `Planned evening · ${labelYmd(p.date)}`;
    $('#mkStatus').textContent = d.label || 'No call';
    const conf = CONF[d.confidence];
    $('#mkPlain').textContent = `${PLAIN[d.state] || ''}${conf ? ` · ${conf}` : ''}`;
    $('#mkPlan').textContent = d.plan || '';
    $('#mkReasons').innerHTML = (d.reasons || []).map((r) => `<li>${esc(r)}</li>`).join('');

    const a = p.astronomy || {}, w = p.weather || {}, now = p.summitNow;
    const rows = [
      ['Sunset at the summit', clock(a.sunsetIso) + ' HST'],
      ['Moon', `${Math.round((a.moonIllumination || 0) * 100)}% lit · ${a.moonPhase || ''}`],
      ['Moon-free dark sky', a.moonFreeMinutes >= 30 ? `${clock(a.moonFreeFromIso)} to ${clock(a.moonFreeToIso)}` : 'None: moon up all night']
    ];
    if (w.tempLowC != null) rows.push(['Night low at the summit', `${cToF(w.tempLowC)}°F (${w.tempLowC}°C)`]);
    if (w.maxWindMph != null) rows.push(['Strongest wind (model)', `${w.maxWindMph} mph`]);
    if (w.freezingLevelM != null) rows.push(['Freezing level', `${Math.round(w.freezingLevelM * 3.281).toLocaleString('en-US')} ft`]);
    if (now) rows.push(['Summit now (MKWC)', `${cToF(now.tempC)}°F, ${now.rh}% RH, wind ${now.windDir} ${now.windMph} mph`]);
    $('#mkFacts').innerHTML = rows.map(([l, v]) => fact(l, v)).join('');

    renderHalf('Sunset', p.sunset, d.state === 'TOO_FAR' ? 'The weather model reaches about a week ahead. Moon and sunset below are exact.' : 'The weather model was unavailable.');
    renderHalf('Stars', p.stars, d.state === 'TOO_FAR' ? 'Pick a night inside the week for a cloud call, or use the moon bars below to choose your best dark night.' : 'The weather model was unavailable.');

    // Road gate
    const rg = p.roadGate || {};
    const off = rg.official;
    if (off) {
      $('#mkRoadOfficial').textContent = off.status || 'Unavailable';
      $('#mkRoadOfficialNote').textContent = `Written ${stamp(off.messageIso)}${off.isDefault ? '. This is the quiet-season default and may not reflect today.' : ''}`;
    } else {
      $('#mkRoadOfficial').textContent = p.mode === 'tonight' ? 'Message unavailable' : 'Only shown for tonight';
      $('#mkRoadOfficialNote').textContent = p.mode === 'tonight' ? 'Call (808) 935-6268 before you drive.' : 'The weather center’s message describes today, not a future evening.';
    }
    const m = rg.model;
    const MODEL = { OPEN: 'No closure signal', CAUTION: 'Caution', AT_RISK: 'Road may close' };
    $('#mkRoadModel').textContent = m ? (MODEL[m.state] || m.state) : 'No model data';
    $('#mkRoadModelNote').textContent = m ? (m.why.join(' ') || 'Wind and freezing level look fine for the road.') : '';

    renderNights(p);

    // Forecaster
    const f = p.mkwc;
    const box = $('#mk-forecaster');
    if (f?.cloudText && p.mode === 'tonight') {
      box.hidden = false;
      $('#mkFcText').textContent = `${f.cloudText}${f.summaryText ? ' ' + f.summaryText : ''}`;
      $('#mkFcMeta').textContent = `Issued ${stamp(f.issuedIso)}${f.fresh ? '' : ' (older than 18 hours, not used as a cross-check)'}. Warnings: ${f.warning || 'none listed'}. Seeing ${f.seeingArcsec ? f.seeingArcsec.join('–') + ' arcsec' : 'not given'}; precipitable water ${f.precipitableWaterMm ? f.precipitableWaterMm.join('–') + ' mm' : 'not given'}.`;
    } else box.hidden = true;

    // Thresholds
    const t = p.thresholds || {};
    $('#mkThresholds').innerHTML = [
      ['Road wind limit', `${t.windStopMph} mph sustained or ${t.windGustStopMph} mph gusts`],
      ['Summit saturated', `humidity at 14,000 ft at or above ${t.summitMoistRh}%`],
      ['Summit damp', `humidity at or above ${t.summitDampRh}%`],
      ['Visitor Station in cloud', `humidity at 9,000 ft at or above ${t.visCloudRh}%`],
      ['Mid-level cloud', `cover at or above ${t.midCloudPct}%`],
      ['Stars GO', `${Math.round(t.starsGoFraction * 100)}% of dark hours clear`],
      ['Stars PARTLY', `${Math.round(t.starsMixedFraction * 100)}% of dark hours clear`]
    ].map(([l, v]) => fact(l, v)).join('');

    // Sources
    $('#mkSources').innerHTML = (p.sources || []).map((s) => `<li><strong>${esc(s.name)}</strong><span>${esc(s.note || (s.asOf ? `As of ${stamp(s.asOf)}` : ''))}</span><em>${s.ok === null ? 'N/A' : s.ok ? 'OK' : 'DOWN'}</em></li>`).join('');
    $('#mkFresh').textContent = `Updated ${stamp(p.updated)}. ${p.validated ? '' : 'Sky thresholds are unvalidated starting rules.'}`;
    $('#mkError').hidden = true;
  }

  async function load() {
    const seq = ++loadSeq;
    const qs = chosen ? `&date=${encodeURIComponent(chosen)}` : '';
    $('#mkStatus').textContent = 'Checking the summit…';
    try {
      const res = await fetch(`${OWNER}/api/mauna-kea?_=1${qs}`, { headers: { Accept: 'application/json' } });
      const p = await res.json();
      if (seq !== loadSeq) return;
      if (!res.ok || !p.ok) throw new Error(p.detail || p.error || `HTTP ${res.status}`);
      render(p);
      event('maunakea_loaded', { state: p.decision?.state, mode: p.mode });
    } catch (e) {
      if (seq !== loadSeq) return;
      $('#mkStatus').textContent = 'Could not load the evening';
      $('#mkPlain').textContent = 'Sources unreachable';
      $('#mkPlan').textContent = '';
      const err = $('#mkError'); err.hidden = false;
      err.textContent = `${String(e.message || e)}. Check the Maunakea Weather Center directly before you drive: mkwc.ifa.hawaii.edu.`;
    }
  }

  const hash = /#date=(\d{4}-\d{2}-\d{2})/.exec(location.hash)?.[1];
  chosen = hash && hash > ymdHst(new Date()) ? hash : '';
  buildPicker();
  load();
})();
