#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(root, 'public', 'national-tools', 'kona-manta-ray-night', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });

const canonical = 'https://chrisizworski.com/national-tools/kona-manta-ray-night/';
const title = 'Kona Manta Night Snorkel: Is the Sea Calm? | Chris Izworski';
const description = 'Is the sea calm enough for a Kona manta ray night snorkel? Swell, wind, rain and alerts at both manta sites, and the calmest of the next four nights.';
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': 'https://chrisizworski.com/#website', url: 'https://chrisizworski.com/', name: 'Chris Izworski' },
    { '@type': 'WebApplication', '@id': `${canonical}#app`, name: 'Kona Manta Night Snorkel Conditions', applicationCategory: 'TravelApplication', operatingSystem: 'Any', url: canonical, description },
    { '@type': 'WebPage', '@id': `${canonical}#page`, url: canonical, name: 'Kona Manta Night Snorkel Conditions', isPartOf: { '@id': 'https://chrisizworski.com/#website' }, mainEntity: { '@id': `${canonical}#app` }, dateModified: '2026-10-22', inLanguage: 'en-US' }
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
<meta property="og:title" content="Kona Manta Night Snorkel: Is the Sea Calm?">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Kona Manta Night Snorkel: Is the Sea Calm?">
<meta name="twitter:description" content="${description}">
<meta name="google-adsense-account" content="ca-pub-8222782620788075">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/breakout-live.css">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/big-island-beach-day.css">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/kona-manta-ray-night.css">
<script type="application/ld+json">${jsonLd}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y5D2V2W7HN"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-Y5D2V2W7HN');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8222782620788075" crossorigin="anonymous"></script>
<script defer src="/_vercel/insights/script.js"></script>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
<script defer src="https://national-outdoor-core.vercel.app/assets/kona-manta-ray-night.js"></script>
</head>
<body class="beachday mantanight" data-tool-id="kona-manta-ray-night">
<header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a><a href="/national-tools/live-decisions/">Live destinations</a></nav></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / Hawaii / Kona Manta Night Snorkel</nav>

<section class="hero">
<p class="eyebrow">Live destination decision &middot; Kona, Hawaii Island</p>
<h1>Kona Manta Night Snorkel: Is the Sea Calm?</h1>
<p class="lede">Rough water is what cancels or spoils a manta night. This rates the sea at both manta sites for the next four evenings, so you can pick your night. It cannot tell you whether the rays will show up.</p>
</section>

<section class="live-card" aria-labelledby="mnHeadline">
<div class="bd-days" id="mnDays" role="tablist" aria-label="Choose an evening"></div>
<div class="live-row"><div>
<p class="eyebrow" id="mnEyebrow">Checking the sea</p>
<h2 class="status" id="mnHeadline">Reading the surf forecast&hellip;</h2>
<p class="bd-plain" id="mnPlain">NWS forecast, alerts, wave model, wind and rain.</p>
</div><button class="refresh" id="mnRefresh" type="button">Refresh</button></div>
<p class="fresh" id="mnFresh">Loading source freshness&hellip;</p>
<div class="error" id="mnError" hidden></div>
</section>

<section class="bd-coasts" aria-label="The two manta sites"><div id="mnSites" class="bd-grid"></div></section>

<section class="mn-limit panel" aria-labelledby="mnLimitHead">
<p class="eyebrow">What this cannot tell you</p>
<h2 id="mnLimitHead">Calm sea does not mean rays</h2>
<p>Whether mantas show up depends mostly on how much plankton the lights draw in. Some nights few or no rays appear, and on a good night a dozen or more can. None of the sources this page reads measures plankton, so it makes no prediction about sightings. Some operators will rebook you free if no mantas appear. Ask when you book.</p>
<p>It also has no cancellation cutoffs to check against. Operators do not publish them. What the page can do is show how rough the sea is compared with that site&#8217;s own record, so you know whether a night is typical or unusually rough.</p>
</section>

<section class="bd-method panel" aria-labelledby="mnMethodHead">
<p class="eyebrow">How the call is made</p>
<h2 id="mnMethodHead">The rules, published</h2>
<p>No score and no hidden weighting. Each site gets one of three steps for the 6 to 9 p.m. window, from the worst signal available.</p>
<ol class="bd-rules">
<li><b>An active High Surf Advisory or Warning, or a Flash Flood Warning</b>, for Kona is a rough night. The National Weather Service decides this, not the tool.</li>
<li><b>The NWS Surf Zone Forecast</b> for west-facing leeward shores gives feet for the day. A high end of <span id="mnNwsMod">4</span> feet or more is moderate and <span id="mnNwsLarge">7</span> feet or more is large.</li>
<li><b>The wave model</b> (PacIOOS SWAN) peak height from 6 to 9 p.m. is compared with every evening at that site from 2016 to 2025. Rougher than <span id="mnModPct">70</span> percent of them is moderate and rougher than <span id="mnLargePct">90</span> percent is large.</li>
<li><b>Wind, rain and runoff.</b> Wind blowing onto the shore at <span id="mnWind">15</span> mph or more raises the step, and <span id="mnWindRough">25</span> mph or more makes it rough. Rain in the evening window at <span id="mnRain">0.5</span> mm or more raises it, and <span id="mnRainRough">4</span> mm or more makes it rough. More than <span id="mnRunoff">10</span> mm in the 24 hours before raises it, because runoff can cloud the water.</li>
<li><b>Long-period swell</b> of 14 seconds or more nudges a calm night to moderate, because surge outruns the wave height.</li>
<li><b>If the forecast and the model are two steps apart</b> the answer is CHECK, not a guess.</li>
</ol>
<p class="method-note"><b>Honest limit:</b> the cutoffs are starting rules, not validated against real cancellations, and confidence never rises above MODERATE. The wave model reads one nearby water cell per site and is a weak judge on its own: checked against ten years of NWS high-surf advisories it separated advisory days only modestly on this coast. Tides, currents and water clarity are not in the call, and a snorkeling guide notes that moderate currents can occur even when the sea looks fine.</p>
</section>

<section class="bd-sources panel" aria-labelledby="mnSrcHead">
<p class="eyebrow">Source provenance</p>
<h2 id="mnSrcHead">What the engine used</h2>
<ul class="source-list" id="mnSources"><li><strong>Loading sources&hellip;</strong></li></ul>
</section>

<section class="faq-section">
<p class="eyebrow">The questions visitors actually ask</p>
<h2>Reading a Kona manta night</h2>
<div class="faq-grid">
<article><h3>Where are the two manta sites?</h3><p>Garden Eel Cove, also called Manta Heaven, is off Keahole Point near Kona International Airport. Manta Village is at Keauhou Bay in front of the Sheraton resort. Your operator picks the site and may switch it on the night.</p></article>
<article><h3>Will I see mantas?</h3><p>Not guaranteed. Wild rays come to the lights for plankton, and plankton varies night to night. Ask your operator about a free return trip if none appear.</p></article>
<article><h3>Do the tours run in winter?</h3><p>Yes. Tours run year-round and are not limited by season. Winter north swells can still make some nights rougher, which is what this page checks.</p></article>
<article><h3>What turns a night rough?</h3><p>Rough sea, rain, strong wind, large swell and waves, unusual current and large tides all degrade conditions for the water. This page covers swell, wind, rain and alerts. It does not cover tides or currents.</p></article>
<article><h3>How should I pick a night?</h3><p>Look at the four nights above and the calmest one. If you can, book early in your stay so a cancelled night leaves you room to try again.</p></article>
<article><h3>Does this book a tour?</h3><p>No. It is a conditions check. Book with a licensed operator, listen to the safety briefing, and follow the guidelines that protect the rays: do not touch them.</p></article>
</div>
</section>

<section class="network">
<p class="eyebrow">Hawaii decision tools</p>
<h2>More live Hawaii planning</h2>
<div class="network-grid"><a href="/national-tools/big-island-beach-day/">Big Island beach day: which coast is calm</a><a href="/national-tools/mauna-kea-tonight/">Mauna Kea stargazing tonight</a><a href="/national-tools/haleakala-sunrise/">Haleakal&#257; sunrise weather &amp; clouds</a></div>
<p class="disclaimer">This is decision support, not a safety system. Your operator&#8217;s captain and the National Weather Service control. Ocean conditions change within minutes. An independent site, not affiliated with any tour operator or agency.</p>
</section>
</main>
<footer><div class="wrap">&copy; 2026 Chris Izworski &middot; <a href="/about/">About</a> &middot; <a href="/tools/">Tools</a></div></footer>
</body>
</html>`;

fs.writeFileSync(out, html);
console.log('Generated Kona Manta Night page.');
