"use strict";

const URL_TO_SUBMIT = "https://chrisizworski.com/national-tools/smoke/";
const KEY = "5b4f872f11781f223cca2273093559c0";
const KEY_LOCATION = `${URL_TO_SUBMIT}${KEY}.txt`;

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
    const text = await response.text();
    return { status: response.status, ok: response.ok, final_url: response.url, text: text.slice(0, 240) };
  } catch (error) {
    return { status: null, ok: false, final_url: null, text: String(error?.message || error).slice(0, 240) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (req.method !== "GET") return res.status(405).end(JSON.stringify({ error: "Method not allowed" }));

  const canonical = await fetchText(URL_TO_SUBMIT, { headers: { "user-agent": "ChrisIzworski-IndexNow-Release/1.0" } });
  const keyFile = await fetchText(KEY_LOCATION, { headers: { "user-agent": "ChrisIzworski-IndexNow-Release/1.0" } });
  const keyMatches = keyFile.ok && keyFile.text.trim() === KEY;

  if (!canonical.ok || !keyMatches) {
    return res.status(424).end(JSON.stringify({ submitted: false, canonical, key_file: keyFile, key_matches: keyMatches }));
  }

  const params = new URLSearchParams({ url: URL_TO_SUBMIT, key: KEY, keyLocation: KEY_LOCATION });
  const generic = await fetchText(`https://api.indexnow.org/indexnow?${params.toString()}`);
  const yandex = await fetchText(`https://yandex.com/indexnow?${params.toString()}`);

  return res.status(generic.ok || yandex.ok ? 200 : 502).end(JSON.stringify({
    submitted: generic.ok || yandex.ok,
    canonical,
    key_file: keyFile,
    key_matches: keyMatches,
    indexnow: generic,
    yandex
  }));
};
