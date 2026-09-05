(() => {
  "use strict";
  const $ = (q) => document.querySelector(q);
  const form = $("#waterfall-search-form"), input = $("#waterfall-query"), status = $("#search-status");
  const resultsWrap = $("#search-results-wrap"), results = $("#search-results"), analysis = $("#analysis");
  const nearby = $("#nearby-button");
  const API = "/national-tools/waterfalls/_api", SEARCH = "/national-tools/waterfalls/_search";

  function text(v, fallback = "—") { return v === null || v === undefined || v === "" ? fallback : String(v); }
  function num(v, digits = 0) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:digits,minimumFractionDigits:digits}) : "—"; }
  function time(v) { if (!v || !Date.parse(v)) return "—"; return new Date(v).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }
  function setStatus(message, isError=false) { status.textContent = message || ""; status.style.color = isError ? "#8a4b35" : ""; }
  function track(name, params={}) { if (typeof window.gtag === "function") window.gtag("event", name, params); }
  async function getJson(url) { const r = await fetch(url,{headers:{accept:"application/json"}}); const data = await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error || data.detail || `Request failed (${r.status})`); return data; }
  function resultButton(item) {
    const b=document.createElement("button"); b.type="button"; b.className="result-btn";
    b.innerHTML=`<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.distance_miles!=null?`${item.distance_miles} mi away · ${item.label||""}`:(item.label||"Select to analyze"))}</span>`;
    b.addEventListener("click",()=>loadWindow(item)); return b;
  }
  function escapeHtml(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function showResults(items) {
    results.innerHTML=""; resultsWrap.hidden=false;
    if(!items.length){results.innerHTML='<p class="detail">No named waterfalls were returned. Try a broader name or another nearby search.</p>';return;}
    items.forEach(item=>results.appendChild(resultButton(item)));
  }
  async function searchName(q){
    setStatus("Searching named waterfalls…"); resultsWrap.hidden=true;
    try { const data=await getJson(`${SEARCH}?q=${encodeURIComponent(q)}`); showResults(data.results||[]); setStatus(`${(data.results||[]).length} waterfall${(data.results||[]).length===1?"":"s"} found.`); track("waterfall_search",{search_mode:"name",result_count:(data.results||[]).length}); }
    catch(e){setStatus(e.message,true);track("source_degraded",{source:"waterfall_search"});}
  }
  async function searchNearby(lat,lon){
    setStatus("Looking for mapped waterfalls nearby…"); resultsWrap.hidden=true;
    try { const data=await getJson(`${SEARCH}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=50`); showResults(data.results||[]); setStatus(`${(data.results||[]).length} mapped waterfall${(data.results||[]).length===1?"":"s"} found within the search radius.`); track("nearby_search",{result_count:(data.results||[]).length}); }
    catch(e){setStatus(e.message,true);track("source_degraded",{source:"waterfall_nearby"});}
  }
  form?.addEventListener("submit",e=>{e.preventDefault(); const q=input.value.trim(); if(q.length<2){setStatus("Enter a waterfall name or place.",true);return;} searchName(q);});
  nearby?.addEventListener("click",()=>{
    if(!navigator.geolocation){setStatus("Location is not available in this browser.",true);return;}
    setStatus("Requesting your location…"); navigator.geolocation.getCurrentPosition(p=>searchNearby(p.coords.latitude,p.coords.longitude),()=>setStatus("Location permission was not granted. Search by waterfall name instead.",true),{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  });
  document.querySelectorAll("[data-example]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.example;searchName(b.dataset.example);}));

  function setScore(prefix, data){
    $(`#${prefix}-score`).textContent=num(data?.score); $(`#${prefix}-label`).textContent=text(data?.label);
    const flow = data?.flow_cfs ?? data?.peak_flow_cfs; $(`#${prefix}-flow`).textContent=flow==null?"Flow estimate unavailable":`${num(flow,0)} cfs${data?.peak_time?` · peak ${time(data.peak_time)}`:""}`;
  }
  function setSignal(id, metric, detail, available=true){ $(`#${id}-metric`).textContent=metric; $(`#${id}-detail`).textContent=detail; $(`#${id}-state`).textContent=available?"Live signal":"Unavailable"; }
  async function loadWindow(item){
    analysis.hidden=false; analysis.classList.add("loading"); resultsWrap.hidden=true; setStatus(`Building the hydrologic picture for ${item.name}…`); analysis.scrollIntoView({behavior:"smooth",block:"start"});
    try{
      const url=`${API}?lat=${encodeURIComponent(item.latitude)}&lon=${encodeURIComponent(item.longitude)}&name=${encodeURIComponent(item.name)}`;
      track("waterfall_select",{waterfall_name:item.name});
      const data=await getJson(url); renderWindow(data); setStatus(`Updated ${new Date(data.generated_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}.`);
      track("window_render",{waterfall_name:item.name,score_now:data.intelligence?.now?.score,confidence:data.intelligence?.confidence?.label,degraded:Boolean(data.degraded)});
      if(data.degraded) track("source_degraded",{source:"waterfall_window",waterfall_name:item.name});
      history.replaceState(null,"",`${location.pathname}?name=${encodeURIComponent(item.name)}&lat=${encodeURIComponent(item.latitude)}&lon=${encodeURIComponent(item.longitude)}`);
    }catch(e){analysis.hidden=true;setStatus(e.message,true);}finally{analysis.classList.remove("loading");}
  }
  function renderWindow(data){
    $("#analysis-name").textContent=text(data.waterfall?.name,"Waterfall"); $("#analysis-place").textContent=`Hydrologic reach ${text(data.hydrologic_link?.comid)} · ${text(data.hydrologic_link?.method,"network linkage")}`;
    const conf=data.intelligence?.confidence; $("#confidence").textContent=`${text(conf?.label,"Low")} confidence${conf?.value!=null?` · ${Math.round(conf.value*100)}% signals`:""}`;
    setScore("now",data.intelligence?.now); setScore("day",data.intelligence?.next_24h); setScore("three",data.intelligence?.next_3d);
    const reasonList=$("#reasons"); reasonList.innerHTML=""; (data.intelligence?.reasons||[]).forEach(r=>{const li=document.createElement("li");li.textContent=r;reasonList.appendChild(li)});
    const caution=$("#caution"), c=data.intelligence?.caution||{}; caution.className=`caution ${c.level==="elevated"?"elevated":""}`; caution.innerHTML=`<strong>${c.level==="elevated"?"High-water caution":"What the score does not mean"}</strong>${escapeHtml(c.message||"")}${c.regulation?`<div class="detail">${escapeHtml(c.regulation)}</div>`:""}`;
    const obs=data.observation; setSignal("gauge",obs?.flow_cfs!=null?`${num(obs.flow_cfs,0)} cfs`:"No connected live gauge",obs?`${text(obs.gauge_name)} · ${text(obs.relation)} · ${time(obs.measured_at)}${obs.trend_percent_24h!=null?` · ${obs.trend_percent_24h>0?"+":""}${obs.trend_percent_24h}% / 24h`:""}`:"The waterfall is still evaluated from its modeled reach, but confidence is lower.",Boolean(obs));
    const s=data.seasonal; setSignal("seasonal",s?.p50!=null?`${num(s.p50,0)} cfs median`:"Seasonal baseline unavailable",s?`Same-season p75 ${num(s.p75,0)} cfs · p90 ${num(s.p90,0)} cfs · ${num(s.sample_days)} daily observations. ${text(s.basis,"Connected gauge history")}.`:"Not enough connected daily-flow history was available for a strong seasonal comparison.",Boolean(s));
    const m=data.model; setSignal("model",m?.current_cfs!=null?`${num(m.current_cfs,0)} cfs now`:"Model reach unavailable",m?.current_cfs!=null?`24h peak ${num(m.peak_24h_cfs,0)} cfs · 3-day peak ${num(m.peak_72h_cfs,0)} cfs. National Water Model guidance, not an official forecast.`:"No usable National Water Model reach series returned.",m?.current_cfs!=null);
    const p=data.precipitation; setSignal("precip",p?.qpf_72h_in!=null?`${num(p.qpf_72h_in,2)} in / 72h`:"Forecast precip unavailable",p?.qpf_24h_in!=null?`${num(p.qpf_24h_in,2)} in in the first 24 hours · NWS ${text(p.office,"grid")}.`:"The NWS forecast grid did not return usable quantitative precipitation.",Boolean(p));
    const reg=data.regulation; setSignal("regulation",reg?.detected?`${num(reg.count)} upstream feature${reg.count===1?"":"s"}`:"No upstream regulation flag",reg?.detected?`${(reg.names||[]).slice(0,3).join(", ")||"Dam/reservoir features detected"}. Confidence is reduced because releases can alter natural-flow behavior.`:"No connected reference dam/reservoir was detected within the configured upstream network search.",true);
  }
  const params=new URLSearchParams(location.search), lat=Number(params.get("lat")), lon=Number(params.get("lon")), name=params.get("name");
  if(name&&Number.isFinite(lat)&&Number.isFinite(lon)) loadWindow({name,latitude:lat,longitude:lon});
})();
