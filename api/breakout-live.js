module.exports = async function breakoutLiveHandler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const origin = req.headers?.origin || '';
  // Responses are shared-cached. A request without an Origin header (curl, bots, prefetch) must not prime the
  // cache with a response the browser then rejects, so every response carries an allow-origin and Vary: Origin.
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin === 'https://www.chrisizworski.com' ? origin : 'https://chrisizworski.com');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }
  const id=(req.query?.id || new URL(req.url,'https://example.test').searchParams.get('id') || '').trim();
  try {
    let payload=null;
    if (id === 'haleakala-sunrise') {
      const haleakala = await import('../lib/haleakala-sunrise-production.mjs');
      const date=(req.query?.date || new URL(req.url,'https://example.test').searchParams.get('date') || '').trim();
      const planner = await import('../lib/haleakala-planner.mjs');
      const core = await import('../lib/haleakala-sunrise.mjs');
      const hst = (iso) => new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Honolulu'}).format(new Date(iso));
      const nextYmd = hst(core.nextSunrise(new Date()).iso);
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.statusCode=400; res.setHeader('Content-Type','application/json; charset=utf-8'); return res.end(JSON.stringify({ok:false,error:'Bad date',detail:'Use YYYY-MM-DD'})); }
      if (date && date !== nextYmd) {
        payload = await planner.buildHaleakalaMorning(date);
      } else {
        payload = await haleakala.buildHaleakalaSunrise();
        const ymd = payload?.astronomy?.sunriseIso ? hst(payload.astronomy.sunriseIso) : null;
        if (ymd) { payload.date = ymd; payload.reservation = planner.reservationRelease(ymd); payload.climate = planner.climateForMonth(Number(ymd.slice(5,7))); }
      }
    } else {
      const replacement = await import('../lib/breakout-live-replacements.mjs');
      const normalizers = await import('../lib/breakout-live-value-normalizers.mjs');
      const rawPayload = await replacement.buildReplacement(id);
      payload = rawPayload ? normalizers.normalizeReplacementPayload(id,rawPayload) : null;
    }
    if (payload) {
      res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=900');
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.statusCode = 200;
      return res.end(JSON.stringify(payload));
    }
  } catch (error) {
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=180');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.statusCode = error?.status === 400 ? 400 : 502;
    return res.end(JSON.stringify({ok:false,error:'Live source unavailable',detail:String(error?.message||error),updated:new Date().toISOString()}));
  }
  const mod = await import('../lib/breakout-live-engine.mjs');
  return mod.default(req, res);
};
