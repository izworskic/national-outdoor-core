(() => {
  const root=document.querySelector('[data-tool-id]');
  if(!root) return;
  const id=root.dataset.toolId;
  const $=s=>document.querySelector(s);
  const status=$('#liveStatus'), headline=$('#liveHeadline'), facts=$('#liveFacts'), fresh=$('#liveFresh'), excerpt=$('#sourceExcerpt'), source=$('#sourceLink'), ramps=$('#ramps'), err=$('#liveError');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function load(){
    err.hidden=true; status.textContent='Checking live source…'; headline.textContent='This page will not invent a live answer if the source fails.'; facts.innerHTML='';
    try{
      const r=await fetch(`/api/breakout-live?id=${encodeURIComponent(id)}`,{cache:'no-store'});
      const d=await r.json();
      if(!r.ok||!d.ok) throw new Error(d.detail||d.error||`HTTP ${r.status}`);
      status.textContent=d.status||'Live source checked';
      headline.textContent=d.headline||'Current source is responding.';
      facts.innerHTML=(d.facts||[]).map(f=>`<div class="fact"><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('');
      fresh.textContent=`Source check: ${new Date(d.updated).toLocaleString()}${d.rawUpdated?` · source observation ${new Date(d.rawUpdated).toLocaleString()}`:''}`;
      excerpt.textContent=d.sourceExcerpt||'No source excerpt returned.';
      source.href=d.source?.url||'#'; source.textContent=`Open ${d.source?.name||'official source'} →`;
      if(ramps && Array.isArray(d.ramps)){
        ramps.innerHTML=d.ramps.map(x=>`<div class="ramp"><div><strong>${esc(x.name)}</strong><br><small>${esc(x.current)}</small></div><div><strong>${x.min?esc(x.min+' ft'):'—'}</strong><br><small>${x.aboveThreshold===true?'above threshold':x.aboveThreshold===false?'below threshold':'current NPS status controls'}</small></div></div>`).join('');
      }
      window.va?.('event',{name:'breakout_live_loaded',data:{tool:id,status:String(d.status||'unknown').slice(0,80)}});
    }catch(e){
      status.textContent='LIVE SOURCE UNAVAILABLE';
      headline.textContent='No substitute status is being shown. Use the official source before making the trip decision.';
      excerpt.textContent='The live data request failed.';
      fresh.textContent='Last attempt: '+new Date().toLocaleString();
      err.hidden=false; err.textContent=`Live refresh failed: ${e.message}`;
      window.va?.('event',{name:'breakout_live_failed',data:{tool:id}});
    }
  }
  $('#refreshLive')?.addEventListener('click',load);
  load();
})();