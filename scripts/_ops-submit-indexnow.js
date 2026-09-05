"use strict";

// One-time release operation. Final retry after chrisizworski.com explicit Smoke routing passed production smoke checks.
const URL_TO_SUBMIT = "https://chrisizworski.com/national-tools/smoke/";
const KEY = "5b4f872f11781f223cca2273093559c0";
const KEY_LOCATION = `${URL_TO_SUBMIT}${KEY}.txt`;

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
    const text = await response.text();
    return { status: response.status, ok: response.ok, finalUrl: response.url, text: text.slice(0, 300) };
  } catch (error) {
    return { status: null, ok: false, finalUrl: null, text: String(error?.message || error).slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

const canonical = await request(URL_TO_SUBMIT, { headers: { "user-agent": "ChrisIzworski-IndexNow-Release/1.0" } });
const keyFile = await request(KEY_LOCATION, { headers: { "user-agent": "ChrisIzworski-IndexNow-Release/1.0" } });
const keyMatches = keyFile.ok && keyFile.text.trim() === KEY;
console.log("canonical", JSON.stringify({ status: canonical.status, ok: canonical.ok, finalUrl: canonical.finalUrl }));
console.log("key-file", JSON.stringify({ status: keyFile.status, ok: keyFile.ok, finalUrl: keyFile.finalUrl, keyMatches }));

if (!canonical.ok || !keyMatches) {
  console.error("Public canonical or IndexNow key is not ready; refusing to submit.");
  process.exit(2);
}

const params = new URLSearchParams({ url: URL_TO_SUBMIT, key: KEY, keyLocation: KEY_LOCATION });
const generic = await request(`https://api.indexnow.org/indexnow?${params}`);
const yandex = await request(`https://yandex.com/indexnow?${params}`);
console.log("indexnow", JSON.stringify({ status: generic.status, ok: generic.ok, finalUrl: generic.finalUrl, body: generic.text }));
console.log("yandex", JSON.stringify({ status: yandex.status, ok: yandex.ok, finalUrl: yandex.finalUrl, body: yandex.text }));

if (!generic.ok || !yandex.ok) process.exit(3);
