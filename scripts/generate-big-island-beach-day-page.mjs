#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'public', 'national-tools', 'big-island-beach-day', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });

const canonical = 'https://chrisizworski.com/national-tools/big-island-beach-day/';
const title = 'Big Island Beach Day: Which Coast Is Calm | Chris Izworski';
const description = 'Which Big Island coast has calm water today? One call per coast from the NWS surf forecast, high surf alerts, the wave model and the wind.';
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': 'https://chrisizworski.com/#website', url: 'https://chrisizworski.com/', name: 'Chris Izworski' },
    { '@type': 'WebApplication', '@id': `${canonical}#app`, name: 'Big Island Beach Day', applicationCategory: 'TravelApplication', operatingSystem: 'Any', url: canonical, description },
    { '@type': 'WebPage', '@id': `${canonical}#page`, url: canonical, name: 'Big Island Beach Day', isPartOf: { '@id': 'https://chrisizworski.com/#website' }, mainEntity: { '@id': `${canonical}#app` }, dateModified: '2026-10-22', inLanguage: 'en-US' }
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
<meta property="og:title" content="Big Island Beach Day: Which Coast Is Calm">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Big Island Beach Day: Which Coast Is Calm">
<meta name="twitter:description" content="${description}">
<meta name="google-adsense-account" content="ca-pub-8222782620788075">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/breakout-live.css">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/big-island-beach-day.css">
<script type="application/ld+json">${jsonLd}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y5D2V2W7HN"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-Y5D2V2W7HN');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8222782620788075" crossorigin="anonymous"></script>
<script defer src="/_vercel/insights/script.js"></script>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
<script defer src="https://national-outdoor-core.vercel.app/assets/hawaii-charts.js"></script>
<script defer src="https://national-outdoor-core.vercel.app/assets/big-island-beach-day.js"></script>
</head>
<body class="beachday" data-tool-id="big-island-beach-day">
<header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a><a href="/national-tools/live-decisions/">Live destinations</a></nav></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / Hawaii / Big Island Beach Day</nav>

<section class="hero">
<p class="eyebrow">Live destination decision &middot; Hawaii Island</p>
<h1>Big Island Beach Day</h1>
<p class="lede">The island has six very different coasts and they are rarely calm on the same day. This ranks them from four sources that do not agree with each other.</p>
</section>

<section class="live-card" aria-labelledby="bdHeadline">
<div class="bd-days" id="bdDays" role="tablist" aria-label="Choose a day"></div>
<div class="live-row"><div>
<p class="eyebrow" id="bdEyebrow">Checking the water</p>
<h2 class="status" id="bdHeadline">Reading the surf forecast&hellip;</h2>
<p class="bd-plain" id="bdPlain">NWS forecast, alerts, wave model and wind.</p>
</div><button class="refresh" id="bdRefresh" type="button">Refresh</button></div>
<p class="fresh" id="bdFresh">Loading source freshness&hellip;</p>
<div class="error" id="bdError" hidden></div>
</section>

<section class="bd-coasts" aria-label="Coasts, calmest first"><div id="bdCoasts" class="bd-grid"></div></section>

<section class="hc-wrap panel" aria-labelledby="bdChartHead"><h2 id="bdChartHead">How big is the swell, for each coast?</h2><p>The black dot is the wave model's forecast peak for the day you picked. The bands are that coast's own 2016 to 2025 daytime record: green is a typical day, tan is bigger than typical, red is in its roughest tenth of days. A coast can look small in feet and still be unusual for it.</p><div id="bdRuler"></div><div class="hc-key"><span><i style="background:#dcece3"></i>typical or smaller</span><span><i style="background:#f0e3c4"></i>bigger than typical</span><span><i style="background:#efd2d2"></i>roughest 10% of days</span></div><h2 id="bdGridHead" style="margin-top:22px">The next four days at a glance</h2><div id="bdGrid"></div></section>
<section class="bd-method panel" aria-labelledby="bdMethodHead">
<p class="eyebrow">How the call is made</p>
<h2 id="bdMethodHead">The rules, published</h2>
<p>No score and no hidden weighting. Each coast gets one of three steps, from the worst signal available.</p>
<ol class="bd-rules">
<li><b>An active High Surf Advisory or Warning</b> for that coast is a rough day, full stop. The National Weather Service decides this, not the tool.</li>
<li><b>The NWS Surf Zone Forecast</b> gives a range in feet for each facing shore. A high end of <span id="bdModerateFt">4</span> feet or more is moderate and <span id="bdLargeFt">7</span> feet or more is large.</li>
<li><b>The wave model</b> (PacIOOS SWAN) is compared with that coast&#8217;s own record: the daytime peak height on every day from 2016 to 2025. Bigger than <span id="bdModeratePct">70</span> percent of those days is moderate and bigger than <span id="bdLargePct">90</span> percent is large. This is why the model is not read in meters: the same height means different things on a sheltered Kona cove and an open Kohala beach.</li>
<li><b>Long-period swell and onshore wind</b> nudge a calm day up to moderate. Swell of 14 seconds or more throws surge and shore break that its height understates, and wind blowing onto the shore above 15 mph chops the surface.</li>
<li><b>If the forecast and the model are two steps apart</b> the answer is CHECK, not a guess.</li>
</ol>
<p class="method-note"><b>Honest limit:</b> the model alone is a weak judge of danger. Checked against ten years of NWS advisories, the daily peak height separated advisory days from other days only modestly (about 0.76 on Kohala and 0.63 on the south coast, where 0.5 is a coin flip and 1.0 is perfect). That is why the NWS forecast and alerts lead and the model is read against each coast&#8217;s own history. The step cutoffs are starting rules and confidence never rises above MODERATE. Brown water after heavy rain, jellyfish and vog are not part of this call.</p>
</section>

<section class="bd-sources panel" aria-labelledby="bdSrcHead">
<p class="eyebrow">Source provenance</p>
<h2 id="bdSrcHead">What the engine used</h2>
<ul class="source-list" id="bdSources"><li><strong>Loading sources&hellip;</strong></li></ul>
</section>

<section class="faq-section">
<p class="eyebrow">The questions visitors actually ask</p>
<h2>Reading a Big Island beach day</h2>
<div class="faq-grid">
<article><h3>Why is Kona so often calm?</h3><p>The Kona and Kohala coasts sit in the island&#8217;s lee. Mauna Kea, Mauna Loa and Hualalai block the trade-wind swell that hits Hilo and Puna, so the west side is calm for much of the year. Winter north and west swells are the exception, especially on Kohala and North Kona.</p></article>
<article><h3>What does a high surf advisory mean for me?</h3><p>It means large breaking waves and strong currents that can sweep people off the shore. Beach parks often close their water access. Treat it as a day to stay out of the water, even on a beach that looks fine from the sand.</p></article>
<article><h3>Is the calm side always the safe side?</h3><p>No. Calm water can still have rip currents, and a shore break can be dangerous when the height looks small if the swell is long-period. Read the notes on each coast, and swim near a lifeguard where there is one.</p></article>
<article><h3>Why does a coast say CHECK?</h3><p>The two main sources disagree by two steps, for example the forecast says small and the model says big for that coast. Rather than pick one, the tool tells you to judge the water yourself.</p></article>
<article><h3>How far ahead is this good?</h3><p>The NWS surf forecast covers about two days and the wave model about four. Days past the forecast rely on the model alone and the page says so.</p></article>
<article><h3>What about brown water and vog?</h3><p>Not in the call. After heavy rain, runoff can make water unsafe near streams and the Hawaii Department of Health posts advisories. Check them before you swim after a storm.</p></article>
</div>
</section>

<section class="network">
<p class="eyebrow">Hawaii decision tools</p>
<h2>More live Hawaii planning</h2>
<div class="network-grid"><a href="/national-tools/mauna-kea-tonight/">Mauna Kea stargazing tonight</a><a href="/national-tools/haleakala-sunrise/">Haleakal&#257; sunrise weather &amp; clouds</a><a href="/national-tools/kilauea-live/">K&#299;lauea live decision tool</a></div>
<p class="disclaimer">This is decision support, not a safety system. Lifeguards, posted signs and the National Weather Service control. Ocean conditions change within minutes. An independent site, not affiliated with any agency.</p>
</section>
</main>
<footer><div class="wrap">&copy; 2026 Chris Izworski &middot; <a href="/about/">About</a> &middot; <a href="/tools/">Tools</a></div></footer>
</body>
</html>`;

fs.writeFileSync(out, html);
console.log('Generated Big Island Beach Day page.');
