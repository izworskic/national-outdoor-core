const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const outings = require('../public/assets/big-island-outings.js');
const asset = name => fs.readFileSync(`public/assets/${name}.js`, 'utf8');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const response = p => ({ ok: true, json: async () => p });
function page(route, fetch) {
  const dom = new JSDOM(fs.readFileSync(`public/national-tools/${route}/index.html`, 'utf8'), {
    url: `https://chrisizworski.com/national-tools/${route}/`, runScripts: 'outside-only'
  });
  dom.window.fetch = fetch;
  dom.window.AbortSignal = AbortSignal;
  dom.window.setInterval = () => 0;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  return dom;
}
const coast = (id, state) => ({ id, name: id, decision: { state, label: state, plain: state, reasons: [] }, alerts: [], model: null, wind: null });
const beach = () => ({ ok: true, updated: new Date().toISOString(), sources: [], days: [
  { date: '2026-11-12', label: 'Today', headline: 'Today', coasts: [coast('south', 'CALM'), coast('kohala', 'ROUGH')] },
  { date: '2026-11-13', label: 'Tomorrow', headline: 'Tomorrow', coasts: [coast('kohala', 'CALM'), coast('south', 'ROUGH')] }
] });
test('four-day grid follows coast identity when each day sorts differently', async () => {
  const dom = page('big-island-beach-day', async () => response(beach()));
  try {
    dom.window.eval(asset('hawaii-charts')); dom.window.eval(asset('big-island-beach-day')); await flush();
    const doc = dom.window.document;
    assert.match(doc.querySelector('#bdGrid').innerHTML, /south, Tomorrow: ROUGH/);
    assert.match(doc.querySelector('#bdGrid').innerHTML, /kohala, Tomorrow: CALM/);
    doc.querySelectorAll('#bdDays button')[1].click();
    assert.match(doc.querySelector('#bdGrid').innerHTML, /south, Today: CALM/);
    assert.equal(doc.querySelectorAll('#bdDays [aria-pressed="true"]').length, 1);
  } finally { dom.window.close(); }
});
test('beach refresh failure removes previous favorable ratings and grid', async () => {
  let fail = false;
  const dom = page('big-island-beach-day', async () => { if (fail) throw Error('offline'); return response(beach()); });
  try {
    dom.window.eval(asset('hawaii-charts')); dom.window.eval(asset('big-island-beach-day')); await flush();
    const doc = dom.window.document;
    assert.ok(doc.querySelector('[data-call="CALM"]'));
    fail = true; doc.querySelector('#bdRefresh').click(); await flush();
    assert.equal(doc.querySelector('#bdCoasts').textContent, '');
    assert.equal(doc.querySelector('#bdGrid').textContent, '');
    assert.equal(doc.querySelector('.live-card').dataset.state, 'verify');
    assert.equal(doc.querySelector('#bdError').hidden, false);
  } finally { dom.window.close(); }
});
for (const updated of ['not-a-date', new Date(Date.now() - 3600000).toISOString(), new Date(Date.now() + 3600000).toISOString()]) {
  test(`rejects cached timestamp ${updated} even after a cache-busting retry`, async () => {
    let calls = 0;
    const dom = page('big-island-beach-day', async () => { calls++; return response({ ...beach(), updated }); });
    try {
      dom.window.eval(asset('big-island-beach-day')); await flush();
      assert.equal(calls, 2); assert.equal(dom.window.document.querySelector('#bdCoasts').textContent, '');
      assert.equal(dom.window.document.querySelector('#bdError').hidden, false);
    } finally { dom.window.close(); }
  });
}
test('an older in-flight beach request cannot replace the most recent refresh', async () => {
  let resolveFirst, calls = 0;
  const dom = page('big-island-beach-day', () => ++calls === 1 ? new Promise(r => { resolveFirst = r; }) : Promise.resolve(response(beach())));
  try {
    dom.window.eval(asset('big-island-beach-day'));
    dom.window.document.querySelector('#bdRefresh').click(); await flush();
    resolveFirst(response({ ...beach(), days: [] })); await flush();
    assert.equal(dom.window.document.querySelector('#bdHeadline').textContent, 'Today');
  } finally { dom.window.close(); }
});
test('manta selected-night headline changes with the selected date and clears on failure', async () => {
  let fail = false;
  const site = state => ({ id: 'village', short: 'Manta Village', name: 'Manta Village', decision: { state, label: state, plain: state } });
  const p = { ok: true, updated: new Date().toISOString(), sources: [], nights: [
    { date: '2026-11-12', label: 'Tonight', sites: [site('GOOD')], nwsCovered: true },
    { date: '2026-11-13', label: 'Tomorrow', sites: [site('ROUGH')], nwsCovered: true }
  ] };
  const dom = page('kona-manta-ray-night', async () => { if (fail) throw Error('offline'); return response(p); });
  try {
    dom.window.eval(asset('kona-manta-ray-night')); await flush();
    const doc = dom.window.document;
    assert.match(doc.querySelector('#mnHeadline').textContent, /^Tonight: calmer/);
    doc.querySelectorAll('#mnDays button')[1].click();
    assert.match(doc.querySelector('#mnHeadline').textContent, /^Tomorrow: rough/);
    fail = true; doc.querySelector('#mnRefresh').click(); await flush();
    assert.equal(doc.querySelector('#mnSites').textContent, '');
    assert.equal(doc.querySelector('.live-card').dataset.state, 'verify');
  } finally { dom.window.close(); }
});
test('Maunakea hides prior weather and road status after refresh failure', async () => {
  let fail = false;
  const p = { ok: true, updated: new Date().toISOString(), today: '2026-11-12', date: '2026-11-12', mode: 'tonight',
    decision: { state: 'GO', label: 'GO' }, astronomy: {}, weather: {}, nights: [], sources: [],
    roadGate: { official: { status: 'OPEN', messageIso: new Date().toISOString() } } };
  const dom = page('mauna-kea-tonight', async () => { if (fail) throw Error('offline'); return response(p); });
  try {
    dom.window.eval(asset('mauna-kea')); await flush();
    const doc = dom.window.document;
    assert.equal(doc.querySelector('.mk-road').hidden, false);
    assert.match(doc.querySelector('#mkVisitHeading').textContent, /visitor station/);
    fail = true; doc.querySelector('#mkRefresh').click(); await flush();
    for (const css of ['.mk-road', '.mk-halves', '.mk-moon-section']) assert.equal(doc.querySelector(css).hidden, true);
    assert.equal(doc.querySelector('.live-card').dataset.state, 'verify');
  } finally { dom.window.close(); }
});
test('outing matches respect time and base; short Kona visit cannot become a volcano road trip', () => {
  assert.deepEqual(outings.match({ base: 'kona', time: 1, interest: 'volcano' }), []);
  assert.equal(outings.match({ base: 'kona', time: 3, interest: 'volcano' })[0].id, 'volcano');
  assert.equal(outings.match({ base: 'south', time: 1, interest: 'culture' })[0].id, 'puho');
  assert.deepEqual(outings.match({ base: '__proto__', time: 3 }), []);
  assert.equal(outings.mapUrl(outings.places.find(p => p.id === 'akaka')), null);
  assert.ok(outings.places.every(p => p.source.startsWith('https://') && p.check.startsWith('https://')));
});
test('outing chooser restores sharable filters and explains an empty match', () => {
  const dom = page('big-island-beach-day', async () => response(beach()));
  try {
    dom.window.history.replaceState(null, '', '#island-outings?base=kona&time=1&interest=volcano');
    dom.window.eval(asset('big-island-outings'));
    const doc = dom.window.document;
    assert.match(doc.querySelector('.outing-count').textContent, /No outing/);
    doc.querySelector('[name="time"]').value = '3';
    doc.querySelector('[name="time"]').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.match(doc.querySelector('.outing-results').textContent, /Hawaiʻi Volcanoes/);
    assert.match(dom.window.location.hash, /time=3/);
    assert.equal(doc.querySelectorAll('#island-outings').length, 1);
  } finally { dom.window.close(); }
});
