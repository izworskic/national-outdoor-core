const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('breakout tool fetches live API on page origin, avoiding cross-origin browser failures',()=>{
 const js=fs.readFileSync('public/assets/breakout-live.js','utf8');
 assert.match(js,/fetch\(\x60\/api\/breakout-live\?id=\$\{encodeURIComponent\(id\)\}\x60/);
 assert.doesNotMatch(js,/fetch\(\x60\$\{OWNER\}\/api\/breakout-live/);
 assert.match(js,/LIVE SOURCE UNAVAILABLE/);
});
