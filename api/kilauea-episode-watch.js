module.exports = async function kilaueaEpisodeWatchHandler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const origin = req.headers?.origin || '';
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin === 'https://www.chrisizworski.com' ? origin : 'https://chrisizworski.com');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const engine = await import('../lib/kilauea-episode-watch.mjs');
    const payload = await engine.buildEpisodeWatch();
    // HVO updates once a day and sooner when activity changes: keep shared caching short.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
    res.statusCode = 200;
    return res.end(JSON.stringify(payload));
  } catch (error) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: 'Live source unavailable', detail: String(error?.message || error), updated: new Date().toISOString() }));
  }
};
