module.exports = async function breakoutLiveHandler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const mod = await import('../lib/breakout-live-engine.mjs');
  return mod.default(req, res);
};
