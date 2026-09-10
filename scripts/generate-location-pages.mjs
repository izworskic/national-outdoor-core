import fs from 'node:fs';
import path from 'node:path';

const tool={slug:'smoke',parent:'public/national-tools/smoke/index.html',label:'Smoke & Air',locations:[
  {slug:'spokane-wa',name:'Spokane, Washington',query:'Spokane, WA',title:'Spokane Smoke & Outdoor Air Window | Chris Izworski',description:'Check Spokane smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals for outdoor plans.',intro:'Spokane can receive smoke from regional and distant fires, with wind shifts changing outdoor conditions over the course of a day.',why:'This page presets the live smoke-window engine to Spokane so the outdoor timing call follows current local conditions.'},
  {slug:'missoula-mt',name:'Missoula, Montana',query:'Missoula, MT',title:'Missoula Smoke & Outdoor Air Window | Chris Izworski',description:'Check Missoula smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals for outdoor plans.',intro:'Missoula’s valley setting can trap smoke, making time-of-day ventilation and changing weather especially relevant.',why:'This page presets the live smoke-window engine to Missoula and updates the local outdoor decision from current signals.'},
  {slug:'boise-id',name:'Boise, Idaho',query:'Boise, ID',title:'Boise Smoke & Outdoor Air Window | Chris Izworski',description:'Check Boise smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals for outdoor plans.',intro:'Boise regularly sees wildfire-smoke episodes where plume movement and local mixing can change conditions quickly.',why:'This page presets the live smoke-window engine to Boise so the result reflects the current local air and weather setup.'},
  {slug:'sacramento-ca',name:'Sacramento, California',query:'Sacramento, CA',title:'Sacramento Smoke & Outdoor Air Window | Chris Izworski',description:'Check Sacramento smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals for outdoor plans.',intro:'Sacramento can be affected by smoke from multiple California fire regions, and Delta winds can materially alter local exposure.',why:'This page presets the live smoke-window engine to Sacramento and recalculates the outdoor timing call as air and weather signals change.'},
  {slug:'bend-or',name:'Bend, Oregon',query:'Bend, OR',title:'Bend Oregon Smoke & Outdoor Air Window | Chris Izworski',description:'Check Bend wildfire smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals for outdoor plans.',intro:'Central Oregon can shift quickly between clear air and wildfire smoke as wind direction, mixing and nearby fire activity change.',why:'This page presets the live smoke-window engine to Bend so hiking, riding and other outdoor plans use the current local setup.'},
  {slug:'reno-nv',name:'Reno, Nevada',query:'Reno, NV',title:'Reno Smoke & Outdoor Air Window | Chris Izworski',description:'Check Reno and Tahoe-area smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals.',intro:'Reno and the eastern Sierra can be affected by California and Great Basin smoke, with basin inversions and afternoon mixing changing exposure.',why:'This page presets the live smoke-window engine to Reno so the outdoor timing call follows local air and weather conditions.'},
  {slug:'denver-co',name:'Denver, Colorado',query:'Denver, CO',title:'Denver Smoke & Outdoor Air Window | Chris Izworski',description:'Check Denver smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals for outdoor plans.',intro:'Front Range smoke can arrive from local or distant fires, while upslope and downslope wind shifts can change conditions within hours.',why:'This page presets the live smoke-window engine to Denver and recalculates the outdoor decision from current local signals.'},
  {slug:'flagstaff-az',name:'Flagstaff, Arizona',query:'Flagstaff, AZ',title:'Flagstaff Smoke & Outdoor Air Window | Chris Izworski',description:'Check Flagstaff wildfire smoke and outdoor air conditions with live air-quality, smoke, weather and timing signals.',intro:'High-country Arizona can see sharp smoke changes from forest fires, prescribed burns, wind and daytime atmospheric mixing.',why:'This page presets the live smoke-window engine to Flagstaff so the outdoor timing call reflects the local high-country environment.'}
]};

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const root=process.cwd();
const parentPath=path.join(root,tool.parent);
let source=fs.readFileSync(parentPath,'utf8');
source=source.replace(/<section[^>]*data-location-directory[\s\S]*?<\/section>/i,'');
if(!source.includes('<title>')||!source.includes('rel="canonical"'))throw new Error('Parent SEO shell not found');

for(const loc of tool.locations){
  const canonical=`https://chrisizworski.com/national-tools/${tool.slug}/${loc.slug}/`;
  const faq=[
    {q:`How smoky is it in ${loc.name} right now?`,a:'The live tool evaluates current air-quality and smoke-related signals with local weather. Use the displayed timestamps and official health guidance for sensitive groups.'},
    {q:`When is the best outdoor window in ${loc.name}?`,a:'The answer can shift during the day as smoke, wind and atmospheric mixing change. The tool identifies a better available window rather than labeling the whole day from one reading.'},
    {q:'Is this medical advice?',a:'No. It is outdoor-planning information. Follow EPA, AirNow and local public-health guidance, especially if you are smoke-sensitive or have a health condition.'}
  ];
  let h=source;
  h=h.replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(loc.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${esc(loc.description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/i,`<link rel="canonical" href="${canonical}">`)
    .replace(/<meta property="og:url" content="[^"]*">/i,`<meta property="og:url" content="${canonical}">`)
    .replace(/<meta property="og:title" content="[^"]*">/i,`<meta property="og:title" content="${esc(loc.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${esc(loc.description)}">`)
    .replace(/<h1([^>]*)>[\s\S]*?<\/h1>/i,`<h1$1>Smoke and outdoor air window for ${esc(loc.name)}</h1>`);
  h=h.replace('</head>',`<script type="application/ld+json" data-location-seo>${json({'@context':'https://schema.org','@graph':[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'U.S. Outdoor Tools',item:'https://chrisizworski.com/national-tools/'},{'@type':'ListItem',position:2,name:'Smoke & Air',item:'https://chrisizworski.com/national-tools/smoke/'},{'@type':'ListItem',position:3,name:loc.name,item:canonical}]},{'@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))}]})}</script></head>`);
  const siblings=tool.locations.filter(x=>x.slug!==loc.slug).slice(0,5).map(x=>`<a href="/national-tools/${tool.slug}/${x.slug}/">${esc(x.name)}</a>`).join(' · ');
  const panel=`<section class="section seo-location-context" data-seo-location="${esc(loc.slug)}"><div class="wrap"><div style="border:1px solid #ddd7cb;background:#fff;padding:18px;border-radius:6px"><div class="eyebrow">Local smoke decision page</div><h2>${esc(loc.name)} smoke context</h2><p>${esc(loc.intro)}</p><p>${esc(loc.why)}</p><p>${siblings}</p><p><a href="/national-tools/smoke/">Check another U.S. location</a></p></div></div></section>`;
  const m=h.match(/<main[^>]*>/i)?.[0];if(!m)throw new Error('Parent main not found');h=h.replace(m,`${m}${panel}`);
  const preset=`<script data-location-preset>(()=>{const preset=${json(loc.query)};const run=()=>{const inputs=[...document.querySelectorAll('form input')].filter(i=>!['hidden','checkbox','radio','number','submit','button'].includes((i.type||'text').toLowerCase()));const input=inputs.find(i=>/city|zip|location|place/i.test([i.placeholder,i.getAttribute('aria-label'),i.name,i.id].filter(Boolean).join(' ')))||inputs[0];if(!input||input.dataset.seoPresetDone)return;input.dataset.seoPresetDone='1';input.value=preset;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));const f=input.closest('form');if(f)setTimeout(()=>f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})),350)};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true}):setTimeout(run,0)})();</script>`;
  h=h.replace('</body>',`${preset}</body>`);
  const out=path.join(root,`public/national-tools/${tool.slug}/${loc.slug}/index.html`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,h);
  const b=fs.readFileSync(out,'utf8');for(const n of[canonical,`data-seo-location="${loc.slug}"`,'data-location-preset',loc.name,'FAQPage'])if(!b.includes(n))throw new Error(`Location build failed ${loc.slug}: ${n}`);
  if(/noindex/i.test((b.match(/<meta name="robots"[^>]*>/i)||[''])[0]))throw new Error(`Location page became noindex: ${loc.slug}`);
}

const directory=`<section class="section" data-location-directory><div class="wrap"><div style="border-top:1px solid #e8e4dc;padding-top:18px"><div class="eyebrow">Popular local smoke pages</div><h2>Smoke and outdoor air by location</h2><p>${tool.locations.map(x=>`<a href="/national-tools/${tool.slug}/${x.slug}/">${esc(x.name)}</a>`).join(' · ')}</p></div></div></section>`;
fs.writeFileSync(parentPath,source.replace('</main>',`${directory}</main>`));
const urls=[`https://chrisizworski.com/national-tools/${tool.slug}/`,...tool.locations.map(x=>`https://chrisizworski.com/national-tools/${tool.slug}/${x.slug}/`)];
fs.writeFileSync(path.join(root,`public/national-tools/${tool.slug}/sitemap-locations.xml`),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc><changefreq>daily</changefreq></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated and verified ${tool.locations.length} ${tool.label} location pages.`);
