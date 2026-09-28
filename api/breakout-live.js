module.exports = async function breakoutLiveHandler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const origin = req.headers?.origin || '';
  if (origin === 'https://chrisizworski.com' || origin === 'https://www.chrisizworski.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }
  const id=(req.query?.id || new URL(req.url,'https://example.test').searchParams.get('id') || '').trim();
  const replacement = await import('../lib/breakout-live-replacements.mjs');
  try {
    const payload = await replacement.buildReplacement(id);
    if (payload) {
      res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=900');
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.statusCode = 200;
      return res.end(JSON.stringify(payload));
    }
  } catch (error) {
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=180');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.statusCode = 502;
    return res.end(JSON.stringify({ok:false,error:'Live source unavailable',detail:String(error?.message||error),updated:new Date().toISOString()}));
  }
  const mod = await import('../lib/breakout-live-engine.mjs');
  return mod.default(req, res);
};
