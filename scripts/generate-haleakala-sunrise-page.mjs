#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const out=path.join(root,'public','national-tools','haleakala-sunrise','index.html');
fs.mkdirSync(path.dirname(out),{recursive:true});

const canonical='https://chrisizworski.com/national-tools/haleakala-sunrise/';
const title='Haleakalā Sunrise Conditions: Clouds, Wind & Summit Forecast | Chris Izworski';
const description='See Haleakalā sunrise visibility conditions using summit observations, vertical GFS moisture, wind, hazards, sunrise time, and reservation status.';
const jsonLd=JSON.stringify({
  '@context':'https://schema.org',
  '@graph':[
    {'@type':'WebSite','@id':'https://chrisizworski.com/#website','url':'https://chrisizworski.com/','name':'Chris Izworski'},
    {'@type':'WebApplication','@id':`${canonical}#app`,'name':'Haleakalā Sunrise Conditions','applicationCategory':'TravelApplication','operatingSystem':'Any','url':canonical,description},
    {'@type':'WebPage','@id':`${canonical}#page`,'url':canonical,'name':'Haleakalā Sunrise Conditions','isPartOf':{'@id':'https://chrisizworski.com/#website'},'mainEntity':{'@id':`${canonical}#app`},'dateModified':'2026-10-01','inLanguage':'en-US'}
  ]
}).replace(/</g,'\\u003c');

const html=`<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="Haleakalā Sunrise Conditions: Clouds, Wind & Summit Forecast">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Haleakalā Sunrise Conditions">
<meta name="twitter:description" content="${description}">
<meta name="google-adsense-account" content="ca-pub-8222782620788075">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/breakout-live.css">
<link rel="stylesheet" href="https://national-outdoor-core.vercel.app/assets/haleakala-sunrise.css">
<script type="application/ld+json">${jsonLd}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y5D2V2W7HN"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-Y5D2V2W7HN');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8222782620788075" crossorigin="anonymous"></script>
<script defer src="/_vercel/insights/script.js"></script>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
<!-- legacy shared asset intentionally replaced for this specialized product: https://national-outdoor-core.vercel.app/assets/breakout-live.js -->
<script defer src="https://national-outdoor-core.vercel.app/assets/haleakala-sunrise.js"></script>
</head>
<body class="haleakala" data-tool-id="haleakala-sunrise">
<header class="site-header"><a class="brand" href="/">Chris Izworski</a><nav class="nav"><a href="/tools/">Tools</a><a href="/national-tools/">National tools</a><a href="/national-tools/live-decisions/">Live destinations</a></nav></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/national-tools/">National tools</a> / Hawaii / Haleakalā Sunrise Conditions</nav>

<section class="hero">
<p class="eyebrow">Live destination decision · Haleakalā summit, Maui</p>
<h1>Haleakalā Sunrise Conditions</h1>
<p class="lede">The summit of Haleakalā stands 10,023 feet above the Pacific on the rim of a crater roughly seven miles long. The summit often sits above Maui&#8217;s low trade-wind cloud, but not every morning. This page reads where the moisture is, how the summit is behaving right now, and what that means for the next sunrise.</p>
</section>

<section class="live-card" aria-labelledby="liveStatus">
<div class="live-row"><div>
<p class="eyebrow">Next summit sunrise</p>
<p class="plain-odds" id="livePlain">Reading the summit…</p>
<h2 class="status" id="liveStatus">Checking evidence…</h2>
<p class="headline" id="liveHeadline">Comparing summit observations, vertical moisture, hazards and access.</p>
</div><button class="refresh" id="refreshLive" type="button">Refresh live data</button></div>
<div class="facts" id="liveFacts"></div>
<p class="fresh" id="liveFresh">Loading source freshness…</p>
<div class="error" id="liveError" hidden></div>
</section>

<section class="decision-core" aria-label="Decision explanation">
<article class="decision-action">
<p class="eyebrow">Is it worth going?</p>
<h2 id="haleAction">Waiting for the evidence engine.</h2>
<span class="agreement" id="haleAgreement">Checking source agreement…</span>
<p class="recheck-note" id="haleRecheck"></p>
</article>
<article>
<p class="eyebrow">Why this call?</p>
<ul id="haleReasons"><li>The tool is loading current evidence.</li></ul>
<ul id="haleCautions"></ul>
</article>
</section>

<section class="morning-section" aria-labelledby="morningHead">
<p class="eyebrow">Plan the morning</p>
<h2 id="morningHead">Your sunrise morning, in order</h2>
<ol class="morning-timeline" id="haleTimeline">
<li><time>3:00 a.m. HST</time><div><strong>Summit entry window opens</strong><p>Vehicles entering the Summit District between 3:00 and 7:00 a.m. need a sunrise reservation.</p></div></li>
<li><time id="haleCivilTwilight">Loading…</time><div><strong>The sky starts to glow</strong><p>Civil twilight. Be parked and bundled up before this; the color build-up is often the best part.</p></div></li>
<li><time id="haleSunriseTime">Loading…</time><div><strong>Sun clears the horizon</strong><p>Sunrise bearing <span id="haleAzimuth">—</span> from the summit.</p></div></li>
<li><time>7:00 a.m. HST</time><div><strong>Reservation window ends</strong><p>Entry rules go back to normal after 7:00 a.m.</p></div></li>
</ol>
<p class="method-note">The road climbs a long series of switchbacks to the summit. Most visitors from the Kahului and south-shore resort areas allow roughly two hours of driving, and less from Upcountry. Check road and parking notices on the NPS page before leaving.</p>
</section>

<section class="feel-section" aria-labelledby="feelHead">
<p class="eyebrow">What it will feel like</p>
<h2 id="feelHead">Cold, thin air and wind at the rim</h2>
<div class="feel-grid">
<div><span>Forecast near sunrise</span><strong id="haleTemperature">Loading…</strong></div>
<div><span>Wind</span><strong id="haleWind">Loading…</strong></div>
<div><span>Feels like (calculated)</span><strong id="haleFeelsLike">Loading…</strong></div>
<div><span>Chance of rain</span><strong id="haleRain">Loading…</strong></div>
</div>
<div class="bring-grid">
<article><h3>Dress for winter</h3><p>The National Park Service warns that summit temperatures can drop below freezing around dawn, and wind makes it feel colder. Bring a warm jacket, hat and gloves, long pants and closed shoes, even if the beach you left was 78°F.</p></article>
<article><h3>Expect thin air</h3><p>At 10,023 feet, the air holds roughly 30 percent less oxygen than at sea level. Walk slowly, drink water, and watch for headache, dizziness or nausea. People with heart or lung conditions, and anyone pregnant, should talk to a doctor before going.</p></article>
<article><h3>Bring something to sit on</h3><p>Many visitors wait 30 to 60 minutes in the cold before the sun appears. A blanket, a thermos and a small flashlight make the wait far more comfortable.</p></article>
</div>
</section>

<section class="sky-section" aria-labelledby="skyHead">
<p class="eyebrow">Where the clouds are</p>
<h2 id="skyHead">Moisture compared with the summit</h2>
<p class="section-lede">Generic &#8220;cloudy&#8221; forecasts describe the lowlands. What matters up here is the humidity at three heights: below the summit, at summit level, and above it. Cloud that sits below you becomes a glowing sea; cloud at summit level means fog and wind.</p>
<div class="profile-band" id="haleProfile"><p>Loading the pressure-level moisture profile…</p></div>
<article class="panel experimental">
<span class="experimental-tag">Experimental</span>
<h2>Are the clouds mainly below the summit?</h2>
<h3 id="haleAboveCloudState">INSUFFICIENT EVIDENCE</h3>
<p id="haleAboveCloudText">This inference is intentionally cautious. Cloud below summit elevation does not guarantee a clear summit.</p>
<p class="method-note">This component uses the vertical moisture profile as context. It is never a guarantee of being above the clouds.</p>
</article>
</section>

<section class="scenario-section" aria-labelledby="scenarioHead">
<p class="eyebrow">What could go on</p>
<h2 id="scenarioHead">What each call means, and what flips it</h2>
<div class="scenario-grid" id="haleScenarios">
<article data-state="FAVORABLE"><span class="scn-tag go">FAVORABLE</span><h3>Good odds of a clear sunrise</h3><p>Dry air at summit level and a dry, steady summit reading. Small cap clouds can still form, so it is not a guarantee.</p><p class="flip"><b>Flips if:</b> summit humidity climbs quickly, or a wind or winter warning is issued.</p></article>
<article data-state="CHANGING"><span class="scn-tag verify">CHANGING</span><h3>Could go either way</h3><p>Humidity at the summit is moving fast, or the forecast and the summit sensors disagree. The view now may not be the view at sunrise.</p><p class="flip"><b>Resolves when:</b> the trend settles. Recheck shortly before you leave.</p></article>
<article data-state="UNFAVORABLE"><span class="scn-tag stop">UNFAVORABLE</span><h3>Plan for fog, cloud or rain</h3><p>Moist air at summit level, a wet summit reading, or a high-impact warning. Reservations are not refunded for cloud, so decide with this in mind.</p><p class="flip"><b>Flips if:</b> the air dries out and the summit trend improves before sunrise.</p></article>
<article data-state="UNCERTAIN"><span class="scn-tag verify">UNCERTAIN</span><h3>Not enough evidence</h3><p>Key data is missing, stale or too far ahead of sunrise to count. The tool abstains rather than guess.</p><p class="flip"><b>Resolves when:</b> summit readings fall inside the eight-hour decision window before sunrise.</p></article>
</div>
</section>

<section class="before-section" aria-labelledby="beforeHead">
<p class="eyebrow">Reservation + access</p>
<h2 id="beforeHead">Weather and legal access are separate gates</h2>
<div class="metric-list">
<div><span>Summit access</span><strong id="haleAccess">Checking NPS…</strong></div>
<div><span>Sunrise reservation</span><strong id="haleReservation">Checking rule…</strong></div>
<div><span>Ticket availability</span><strong id="haleAvailability">Not claimed</strong></div>
</div>
<p class="method-note">NPS releases reservations up to 60 days ahead and a portion two days ahead at 7:00 a.m. HST. If the call is poor, lower viewpoints on the same road, such as Leleiwi Overlook or the Haleakalā Visitor Center, can still be worth the drive. Confirm on the NPS page what your reservation covers.</p>
<div class="official-actions">
<a href="https://www.nps.gov/hale/planyourvisit/conditions.htm" target="_blank" rel="noopener" data-track="haleakala_nps_conditions">NPS current conditions →</a>
<a href="https://www.recreation.gov/ticket/facility/253731" target="_blank" rel="noopener" data-track="haleakala_reservation_click">Check Recreation.gov →</a>
</div>
</section>

<section class="evidence-section">
<p class="eyebrow">For the curious and the cautious</p>
<h2>The evidence behind the call</h2>
<p class="section-lede">Everything above comes from these sources, using vertical GFS moisture, measured summit humidity and trend, hazards, access, sunrise geometry and live imagery. Each row shows what kind of evidence it is and how fresh it is.</p>
<div class="evidence-list" id="haleEvidence">
<article class="evidence-row"><div class="evidence-copy"><span class="evidence-type">LOADING</span><strong>Current evidence</strong><p>Retrieving source data and timestamps.</p></div></article>
</div>
<div class="degraded-box" id="haleDegraded" hidden></div>
</section>

<section class="hale-grid">
<article class="panel">
<p class="eyebrow">Safety</p>
<h2>Hazards can override visibility</h2>
<ul class="hazard-list" id="haleHazards"><li>Checking active NWS alerts for the summit point.</li></ul>
<p class="method-note">An active high-impact wind or winter warning is a hard decision gate even if the visibility signal is otherwise favorable.</p>
</article>
<article class="panel camera-panel">
<p class="eyebrow">Live spatial evidence</p>
<h2>Haleakalā all-sky camera</h2>
<div id="haleImagery"><p>Checking whether the newest LCO image is fresh enough to use.</p></div>
<p class="method-note">Imagery corroborates the decision only when freshness can be verified. A stale camera is explicitly excluded.</p>
</article>
</section>

<section class="hale-grid">
<article class="panel">
<p class="eyebrow">Source provenance</p>
<h2>What the engine used</h2>
<ul class="source-list" id="haleSources"><li><strong>Loading sources…</strong></li></ul>
<p class="method-note">Generic total-cloud wording is context only. It does not select FAVORABLE, CHANGING, UNFAVORABLE or UNCERTAIN.</p>
</article>
<article class="panel">
<p class="eyebrow">How to use this result</p>
<h2>Use the call, confidence and freshness together</h2>
<p>Recheck close to departure. FAVORABLE is not a guarantee, CHANGING means conditions may not persist, and UNCERTAIN means the evidence is not strong enough to justify confidence.</p>
</article>
</section>

<section class="faq-section">
<p class="eyebrow">The questions visitors actually ask</p>
<h2>How to read Haleakalā sunrise weather</h2>
<div class="faq-grid">
<article><h3>Will Haleakalā sunrise be cloudy?</h3><p>A sea-level or generic total-cloud forecast is not enough. Haleakalā reaches 10,023 feet, so the important question is whether moisture and cloud are at summit level, below it, or changing toward it.</p></article>
<article><h3>Can the summit be clear when an app says &#8220;cloudy&#8221;?</h3><p>Yes. Low marine cloud can cover much of Maui while the summit sits above that layer. This tool therefore uses the vertical atmospheric profile and summit observations rather than total cloud percentage as the core signal.</p></article>
<article><h3>Will I definitely be above the clouds?</h3><p>No. The above-cloud component is experimental. Local cap cloud, fast transitions and small-scale cloud can obscure the summit even when the broader moisture layer is lower.</p></article>
<article><h3>How cold and windy can sunrise be?</h3><p>The page shows the NWS near-sunrise temperature and wind, plus a calculated wind-chill. Haleakalā National Park warns that summit conditions can change rapidly and can be below freezing around dawn.</p></article>
<article><h3>Do I need a reservation?</h3><p>For vehicle entry to the Summit District from 3:00–7:00 a.m. HST, NPS requires a sunrise reservation. This tool links to the official booking page but does not invent live ticket availability.</p></article>
<article><h3>What if the summit is clouded in?</h3><p>The reservation is not refunded for cloud. Lower viewpoints on the same road can sit below the cap cloud, and daylight views of the crater can still be striking. Check the call again before you leave the car.</p></article>
<article><h3>When should I check this page?</h3><p>Summit sensors only count toward the call within eight hours of sunrise. Check the evening before for the forecast picture, then again before you leave for the mountain.</p></article>
<article><h3>What does LOW confidence mean?</h3><p>It means key evidence is missing, stale, contradictory, or near an operating threshold. LOW confidence does not get silently converted into a favorable answer.</p></article>
</div>
</section>

<section class="panel">
<p class="eyebrow">Method boundary</p>
<h2>No sunrise score. No beauty prediction. No guaranteed horizon.</h2>
<p>The decision engine uses deterministic rules. A dry 700 hPa profile can support a favorable call, but it cannot overrule a wet or rapidly changing summit observation. Boltwood sky-minus-ambient temperature is supporting evidence only. Camera and satellite-style spatial evidence are corroboration, not ground truth. When evidence is missing or contradictory, the valid answer is UNCERTAIN or CHANGING.</p>
</section>

<section class="network">
<p class="eyebrow">Hawaii decision tools</p>
<h2>More live Hawaii planning</h2>
<div class="network-grid"><a href="/national-tools/kilauea-live/">Kīlauea live decision tool</a><a href="/national-tools/">Browse national live tools</a></div>
<p class="disclaimer">Official closures, warnings and reservation systems control. This tool is decision support, not a guarantee of visibility or access.</p>
</section>
</main>
<footer><div class="wrap">© 2026 Chris Izworski · <a href="/about/">About</a> · <a href="/tools/">Tools</a></div></footer>
</body>
</html>`;

fs.writeFileSync(out,html);
console.log('Generated custom Haleakalā sunrise decision page.');
