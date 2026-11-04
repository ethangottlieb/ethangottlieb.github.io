// Run: node tests/campaign-links.cjs (no browser or dependencies required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(text => text.includes('tagged profile links'));
assert.ok(script, 'Find the real inline campaign handler, not a duplicate implementation');
const destinations = [...html.matchAll(/<a\b[^>]*\bhref="(https:\/\/(?:apps\.apple\.com|play\.google\.com)[^"]+)"/g)]
  .map(match => match[1]);
const identities = [
  ['apps.apple.com', '/app/id1568432072', null],
  ['play.google.com', '/store/apps/details', 'com.EGames.RoYgBv'],
  ['apps.apple.com', '/app/id1498702247', null],
  ['play.google.com', '/store/apps/details', 'com.EGames.Coloup'],
  ['apps.apple.com', '/app/id1527390623', null],
  ['play.google.com', '/store/apps/details', 'com.EGames.SideSlide']
];
assert.equal(destinations.length, identities.length, 'Every game has both store badges');
let assertions = 0;
const observations = [];
function run(query, expectedSource, expectedCampaign) {
  const input = new URL('https://ethangottlieb.github.io/' + query);
  const location = { href: input.href, search: input.search, hash: input.hash };
  const before = JSON.stringify(location);
  const links = destinations.map(href => ({ href }));
  const context = { URL, URLSearchParams, window: { location }, document: {
    querySelectorAll(selector) { assert.equal(selector, '.badges a'); return links; }
  } };
  vm.runInNewContext(script, context, { timeout: 1000 });
  assert.equal(JSON.stringify(location), before, 'Keep the landing URL and game anchor unchanged'); assertions++;
  links.forEach((link, i) => {
    const result = new URL(link.href);
    const [host, pathname, packageId] = identities[i];
    assert.equal(result.protocol, 'https:'); assert.equal(result.hostname, host);
    assert.equal(result.pathname, pathname); assert.equal(result.searchParams.get('id'), packageId);
    assertions += 4;
    if (!expectedSource) { assert.equal(link.href, destinations[i], 'Untagged/unrecognized visits remain unchanged'); assertions++; return; }
    if (host === 'apps.apple.com') {
      assert.equal(result.searchParams.get('pt'), '10389800');
      assert.equal(result.searchParams.get('ct'), expectedCampaign + '_' + expectedSource);
      assert.equal(result.searchParams.get('mt'), '8'); assertions += 3;
    } else {
      const referrer = new URLSearchParams(result.searchParams.get('referrer'));
      assert.equal(referrer.get('utm_source'), expectedSource);
      assert.equal(referrer.get('utm_medium'), expectedSource === 'creator' ? 'email' : 'social');
      assert.equal(referrer.get('utm_campaign'), expectedCampaign);
      assert.equal([...referrer].length, 3); assertions += 4;
    }
  });
  observations.push({ input: input.href, expected_source: expectedSource, expected_campaign: expectedCampaign, resulting_store_urls: links.map(link => link.href) });
}
for (const source of ['youtube', 'instagram', 'tiktok', 'creator', 'facebook', 'linkedin']) {
  run('?utm_source=' + source + '&utm_campaign=gg26r8#roygbv', source, 'gg26r8');
  run('?utm_source=' + source + '&utm_campaign=gg26r8_personal#side-slide', source, 'gg26r8_personal');
}
run('?utm_source=ig&utm_campaign=gg26r8#sky-dye', 'instagram', 'gg26r8');
run('?utm_source=youtube#roygbv', 'youtube', 'gg26r2');
run('?utm_source=ig&utm_campaign=gg26r2', 'instagram', 'gg26r2');
run('?utm_source=creator&utm_medium=social', 'creator', 'gg26r2');
for (const bad of ['', '<script>alert(1)</script>', 'gg26r8&ct=evil', 'https://evil.example', 'gg26r8/evil', 'GG26R8', 'gg26r0', 'gg26r8_' + 'x'.repeat(49)]) {
  run('?utm_source=youtube&utm_campaign=' + encodeURIComponent(bad) + '#roygbv', 'youtube', 'gg26r2');
}
run('?utm_source=youtube&utm_campaign=gg26r8&utm_campaign=gg26r9', 'youtube', 'gg26r2');
run('?utm_source=tiktok&utm_campaign=gg26r8&id=evil&pt=evil&ct=evil&referrer=evil', 'tiktok', 'gg26r8');
for (const query of ['', '#roygbv', '?utm_campaign=gg26r8', '?utm_source=unknown&utm_campaign=gg26r8', '?utm_source=https%3A%2F%2Fevil.example&utm_campaign=gg26r8']) {
  run(query, null, null);
}
console.log(JSON.stringify({ status: 'passed', cases: observations.length, checked_assertions: assertions, scope: 'Actual inline handler and all six real store destinations; network/public analytics not tested', observations }, null, 2));
