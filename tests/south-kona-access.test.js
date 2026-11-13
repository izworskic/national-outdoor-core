const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const access = require('../public/assets/south-kona-access.js');
const script = fs.readFileSync('public/assets/south-kona-access.js', 'utf8');
function page(html = '<section class="bd-method"></section>', hash = '') {
  const dom = new JSDOM(html, { url: 'https://chrisizworski.com/national-tools/big-island-beach-day/' + hash, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.eval(script);
  return dom;
}
test('rental, private vessel and guided tour have distinct permission plans', () => {
  assert.match(access.getPlan('rental').rows.flat().join(' '), /renter does not obtain a separate/);
  assert.match(access.getPlan('rental').rows.flat().join(' '), /does not allow a launch from Nāpōʻopoʻo wharf/);
  assert.match(access.getPlan('own').rows.flat().join(' '), /submitting an application is not permission/);
  assert.match(access.getPlan('guided').rows.flat().join(' '), /rental from the same company is not automatically/);
  for (const key of ['rental', 'own']) assert.match(access.plans[key].rows.flat().join(' '), /separate DLNR written approval/i);
});
test('driving map is only supplied for the documented cultural park entrance', () => {
  assert.equal(access.plans.cultural.map, '19.422750,-155.909873');
  for (const key of ['twostep', 'rental', 'own', 'guided', 'hike']) assert.equal(access.plans[key].map, undefined);
  assert.match(access.plans.twostep.rows.flat().join(' '), /outside the park gate/);
  assert.match(access.plans.twostep.rows.flat().join(' '), /does not make every roadside space legal/);
});
test('review age becomes explicit after 30 days and cannot claim a fresh future review', () => {
  assert.doesNotMatch(access.reviewNote(Date.parse('2026-11-12')), /needs updating/);
  for (const date of ['2026-12-13', '2027-11-12', '2026-11-11', 'invalid']) assert.match(access.reviewNote(Date.parse(date)), /needs updating/);
});
test('all six selections replace the previous plan and produce restorable links', () => {
  const dom = page();
  try {
    const doc = dom.window.document, select = doc.querySelector('select');
    assert.equal(doc.querySelectorAll('#south-kona-access').length, 1);
    for (const [key, plan] of Object.entries(access.plans)) {
      select.value = key; select.dispatchEvent(new dom.window.Event('change'));
      assert.equal(doc.querySelector('.kona-access-result h3').textContent, plan.title);
      assert.equal(doc.querySelectorAll('.kona-access-result article').length, 1);
      assert.equal(dom.window.location.hash, '#south-kona-access?plan=' + key);
      assert.equal(doc.querySelectorAll('.kona-access-result a[href*="google.com/maps"]').length, plan.map ? 1 : 0);
    }
    select.value = ''; select.dispatchEvent(new dom.window.Event('change'));
    assert.equal(doc.querySelector('.kona-access-result h3'), null);
    assert.match(doc.querySelector('.kona-access-result').textContent, /Choose a visit/);
  } finally { dom.window.close(); }
});
test('bookmarks and same-page outing links select the intended access plan', () => {
  const dom = page(undefined, '#south-kona-access?plan=own');
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelector('select').value, 'own');
    dom.window.history.replaceState(null, '', '#south-kona-access?plan=twostep');
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    assert.equal(doc.querySelector('select').value, 'twostep');
    assert.match(doc.querySelector('.kona-access-result').textContent, /outside the park gate/);
  } finally { dom.window.close(); }
});
test('untrusted hashes and inherited property names do not become plans or markup', () => {
  for (const key of ['__proto__', 'constructor', '<img src=x onerror=alert(1)>']) {
    assert.equal(access.getPlan(key), null);
    const dom = page(undefined, '#south-kona-access?plan=' + encodeURIComponent(key));
    try {
      assert.equal(dom.window.document.querySelector('select').value, '');
      assert.equal(dom.window.document.querySelector('.kona-access-result img'), null);
    } finally { dom.window.close(); }
  }
});
test('generated HTML has readable access essentials without JavaScript and mounts once', () => {
  const html = fs.readFileSync('public/national-tools/big-island-beach-day/index.html', 'utf8');
  const dom = page(html, '#south-kona-access?plan=rental');
  try {
    const doc = dom.window.document;
    assert.match(html, /A transit permit alone does not authorize a Kaʻawaloa landing/);
    assert.match(html, /G-Y5D2V2W7HN/); assert.match(html, /ca-pub-8222782620788075/);
    dom.window.SouthKonaAccess.mount(doc);
    assert.equal(doc.querySelectorAll('#south-kona-access').length, 1);
    assert.equal(doc.querySelectorAll('#kona-access-plan').length, 1);
    assert.match(doc.querySelector('.kona-access-result h3').textContent, /before renting/);
  } finally { dom.window.close(); }
});
