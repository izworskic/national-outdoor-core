#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'public', 'national-tools', 'kilauea-episode-watch', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });

const canonical = 'https://chrisizworski.com/national-tools/kilauea-episode-watch/';
const title = 'Kilauea Eruption: Next Episode & Viewing | Chris Izworski';
const description = "Is Kilauea erupting, and when is the next fountaining episode? USGS's forecast window, summit weather hour by hour, and how often episodes have started.";
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': 'https://chrisizworski.com/#website', url: 'https://chrisizworski.com/', name: 'Chris Izworski' },
    { '@type': 'WebApplication', '@id': `${canonical}#app`, name: 'Kilauea Episode Watch', applicationCategory: 'TravelApplication', operatingSystem: 'Any', url: canonical, description },
    { '@type': 'WebPage', '@id': `${canonical}#page`, url: canonical, name: 'Kilauea Episode Watch', isPartOf: { '@id': 'https://chrisizworski.com/#website' }, mainEntity: { '@id': `${canonical}#app` }, dateModified: '2026-10-23', inLanguage: 'en-US' }
  ]
}).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="Kilauea Eruption: Next Episode &amp; Viewing">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Kilauea Eruption: Next Episode &amp; Viewing">
<meta name="twitter:description" content="${description}">
<meta name="google-adsense-account" content="ca-pub-8222782620788075">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/breakout-live.css">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/big-island-beach-day.css">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/kilauea-episode-watch.css">
<script type="application/ld+json">${jsonLd}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y5D2V2W7HN"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-Y5D2V2W7HN');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8222782620788075" crossorigin="anonymous"></script>
<script defer src="/_vercel/insights/script.js"></script>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
<script defer src="https://national-outdoor-core.vercel.app/assets/hawaii-charts.js"></script>
<script defer src="https://national-outdoor-core.vercel.app/assets/kilauea-engine.js"></script>
<script defer src="https://national-outdoor-core.vercel.app/assets/kilauea-episode-watch.js"></script>
</head>
<body class="beachday kilaueawatch" data-tool-id="kilauea-episode-watch">
<header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a><a href="/national-tools/live-decisions/">Live destinations</a></nav></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / Hawaii / Kilauea Episode Watch</nav>

<section class="hero">
<p class="eyebrow">Live destination decision &middot; Hawai&#699;i Volcanoes National Park</p>
<h1>Kilauea Eruption: Next Episode &amp; Viewing</h1>
<p class="lede">Kilauea&#8217;s summit erupts in short bursts of lava fountaining, a few hours long with weeks of quiet between. This shows what the USGS says is next, whether the summit is clear enough to see anything, and how often episodes have really started.</p>
</section>

<section class="live-card" aria-labelledby="kvHeadline">
<div class="live-row"><div>
<p class="eyebrow" id="kvEyebrow">Checking the volcano</p>
<h2 class="status" id="kvHeadline">Reading the USGS update&hellip;</h2>
<p class="bd-plain" id="kvPlain">USGS forecast, summit weather and the 2026 record.</p>
</div><button class="refresh" id="kvRefresh" type="button">Refresh</button></div>
<ul class="kv-reasons" id="kvReasons"></ul>
<p class="fresh" id="kvFresh">Loading source freshness&hellip;</p>
<div class="error" id="kvError" hidden></div>
</section>

<section class="kv-box panel" aria-labelledby="kvHvoHead">
<p class="eyebrow">In the USGS&#8217;s words</p>
<h2 id="kvHvoHead">Latest Hawaiian Volcano Observatory update</h2>
<div class="kv-meta" id="kvMeta"></div>
<blockquote class="kv-quote" id="kvQuote">Loading&hellip;</blockquote>
<p class="method-note" id="kvHvoNote"></p>
</section>

<section class="hc-wrap panel" aria-labelledby="kvWxHead">
<h2 id="kvWxHead">Can you see anything from the overlook? The next 36 hours</h2>
<p>Each block is one hour at the summit near the U&#275;kahuna overlook (about 3,700 feet). Green is clear, gold is hazy or cloudy, red is low cloud, fog or rain that would likely hide the glow. Paler blocks are night, Hawai&#699;i time. Fog and rain at the summit are the most common reason people drive up and see nothing.</p>
<div id="kvStrip"></div>
<div class="hc-key"><span><i style="background:#2e7d57"></i>clear</span><span><i style="background:#c58a1f"></i>hazy or partly cloudy</span><span><i style="background:#b23b3b"></i>fog, low cloud or rain</span></div>
<p class="kv-sub" id="kvWxLine"></p>
</section>

<section class="hc-wrap panel" aria-labelledby="kvRecHead">
<p class="eyebrow">The 2026 record</p>
<h2 id="kvRecHead">How often, how long, and what time of day</h2>
<div class="kv-stats" id="kvStats"></div>
<div class="kv-grid">
<div><h3>Days between episodes</h3><div id="kvGaps"></div><p class="method-note">Each bar is the gap before that episode. The dashed line is how long it has been since the last one ended.</p></div>
<div><h3>What hour episodes started (Hawai&#699;i time)</h3><div id="kvHours"></div><p class="method-note">Count of the 16 episodes by starting hour. Most began in the morning or early afternoon.</p></div>
</div>
</section>

<section class="kv-box panel" aria-labelledby="kvChanceHead">
<p class="eyebrow">Planning a visit</p>
<h2 id="kvChanceHead">Would an episode fall in your dates?</h2>
<div class="kv-calc"><label>First day<input type="date" id="kvFrom"></label><label>Last day<input type="date" id="kvTo"></label></div>
<p class="kv-answer" id="kvChanceAnswer"></p>
<p class="kv-sub" id="kvChanceHvo"></p>
<p class="method-note">This counts, across every window of that length from January to October 2026, how many contained at least one episode start. It describes 2026 only. Nothing guarantees the pattern continues: after episode 54 the pause lasted 53 days.</p>
</section>

<section class="kv-box panel" aria-labelledby="kvMissHead">
<p class="eyebrow">How far to trust a window</p>
<h2 id="kvMissHead">Windows the USGS published, and what happened</h2>
<p class="kv-sub">USGS forecast windows come from how fast the summit is re-inflating. Most are close. Two I checked against the USGS&#8217;s own later notices were missed:</p>
<ul class="kv-miss" id="kvMiss"></ul>
<p class="method-note">This is not a hit rate: I read only these two cases by hand. The USGS says its windows are preliminary and can change.</p>
</section>

<section class="bd-method panel" aria-labelledby="kvMethodHead">
<p class="eyebrow">How the call is made</p>
<h2 id="kvMethodHead">The rules, published</h2>
<ol class="bd-rules">
<li><b>Fountaining now.</b> The latest USGS daily update says an episode is under way. Episodes in 2026 lasted 6 to 10 hours.</li>
<li><b>Watch closely.</b> The update describes precursor overflows, today falls inside the forecast window, or the window opens within <span id="kvSoon">3</span> days.</li>
<li><b>Not yet.</b> The window is more than <span id="kvSoon2">3</span> days away. <b>Past the window</b> means it has closed without fountaining. <b>No window yet</b> means the update gave no dates.</li>
<li><b>Summit weather</b> is rated hourly: red if low cloud is <span id="kvCloudPoor">80</span> percent or more, visibility under 1.5 km or rain of 0.5 mm an hour or more; gold if low cloud is 50 percent or more, light rain or visibility under 5 km; otherwise green.</li>
<li><b>Gas.</b> Wind from the south or southeast (100 to 210 degrees) can push volcanic gas toward the U&#275;kahuna and K&#299;lauea Overlook side, so the page flags it.</li>
</ol>
<p class="method-note"><b>Honest limit:</b> nobody can give the start time of an episode, only a range, and the page says so. The weather cutoffs are starting rules, not validated against real viewing trips. The weather model uses a grid about 10 km wide, so it can miss fog that sits on the crater rim. The page never replaces the park&#8217;s webcams, its air quality alerts or the closures posted at the overlooks.</p>
</section>

<section class="bd-sources panel" aria-labelledby="kvSrcHead">
<p class="eyebrow">Source provenance</p>
<h2 id="kvSrcHead">What the engine used</h2>
<ul class="source-list" id="kvSources"><li><strong>Loading sources&hellip;</strong></li></ul>
<p class="method-note">Official pages: <a href="https://www.usgs.gov/volcanoes/kilauea/volcano-updates" rel="noopener">USGS Kilauea updates</a> &middot; <a href="https://www.nps.gov/havo/planyourvisit/eruption-viewing.htm" rel="noopener">NPS eruption viewing</a> &middot; <a href="https://www.nps.gov/havo/learn/nature/air-quality-alerts.htm" rel="noopener">NPS air quality</a></p>
</section>

<section class="faq-section">
<p class="eyebrow">The questions visitors actually ask</p>
<h2>Seeing Kilauea erupt</h2>
<div class="faq-grid">
<article><h3>Is Kilauea erupting right now?</h3><p>The summit has erupted in episodes since December 2024. Between episodes it is paused, with a glow in the crater but no fountains. The top of this page says which one it is today.</p></article>
<article><h3>How long does an episode last?</h3><p>The 16 episodes of 2026 lasted 6 to 10 hours. That is why a trip needs flexibility: an episode can start and end while you are driving.</p></article>
<article><h3>Where do I watch from?</h3><p>From the overlooks along Crater Rim Drive in Hawai&#699;i Volcanoes National Park, such as U&#275;kahuna and K&#299;lauea Overlook. The eruption area is closed. Parking can fill by about 10 a.m. during an episode.</p></article>
<article><h3>Can the USGS predict the start?</h3><p>Not to the hour. It publishes a forecast window from summit tilt. Windows have been a few days wide, and a couple have been missed.</p></article>
<article><h3>What stops people seeing it?</h3><p>Low cloud, fog and rain at the summit, and sometimes gas or ash blowing across the overlooks. The weather strip above covers cloud, rain, visibility and wind. Gas and closures are on the park&#8217;s own pages.</p></article>
<article><h3>How far is it?</h3><p>Hilo is under an hour away, Kailua-Kona about two to two and a half hours, before traffic.</p></article>
</div>
</section>

<section class="network">
<p class="eyebrow">Hawaii decision tools</p>
<h2>More live Hawaii planning</h2>
<div class="network-grid"><a href="/national-tools/big-island-beach-day/">Big Island beach day: which coast is calm</a><a href="/national-tools/kona-manta-ray-night/">Kona manta night snorkel conditions</a><a href="/national-tools/mauna-kea-tonight/">Mauna Kea stargazing tonight</a></div>
<p class="disclaimer">This is decision support, not a safety system. The U.S. Geological Survey and the National Park Service control, and conditions at an active volcano change quickly. An independent site, not affiliated with any agency.</p>
</section>
</main>
<footer><div class="wrap">&copy; 2026 Chris Izworski &middot; <a href="/about/">About</a> &middot; <a href="/tools/">Tools</a></div></footer>
</body>
</html>`;

fs.writeFileSync(out, html);
console.log('Generated Kilauea Episode Watch page.');
