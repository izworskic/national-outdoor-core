module.exports = async function maunaKeaHandler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const origin = req.headers?.origin || '';
  // Shared-cached responses must always carry an allow-origin and Vary: Origin, or a request without an
  // Origin header can prime the cache with a response the browser then rejects.
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
    const date = String(req.query?.date || new URL(req.url, 'https://example.test').searchParams.get('date') || '').trim();
    const engine = await import('../lib/mauna-kea.mjs');
    const payload = await engine.buildMaunaKea(date || undefined);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    res.statusCode = 200;
    return res.end(JSON.stringify(payload));
  } catch (error) {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
    res.statusCode = error?.status === 400 ? 400 : 502;
    return res.end(JSON.stringify({ ok: false, error: error?.status === 400 ? 'Bad request' : 'Live source unavailable', detail: String(error?.message || error), updated: new Date().toISOString() }));
  }
};
