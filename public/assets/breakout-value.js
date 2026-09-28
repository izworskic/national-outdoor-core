(() => {
  const root=document.querySelector('[data-tool-id]');
  if(!root) return;
  const id=root.dataset.toolId||'unknown';
  const started=performance.now();
  let sourceClicks=0,refreshes=0,workbenchChanges=0,answered=false;
  const statusValue=()=>String(document.querySelector('#liveStatus')?.textContent||'unknown').trim().slice(0,80);
  const elapsed=()=>Math.max(0,Math.round(performance.now()-started));
  const track=(name,data={})=>window.va?.('event',{name,data:{tool:id,...data}});

  function addStyles(){
    if(document.querySelector('#breakoutValueStyles')) return;
    const style=document.createElement('style');
    style.id='breakoutValueStyles';
    style.textContent='.decision-feedback{margin:-20px 0 32px;padding:13px 15px;border:1px solid #d9e1dc;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px}.decision-feedback p{margin:0;font-size:14px;color:#425049}.decision-feedback strong{color:#17211d}.decision-feedback-actions{display:flex;flex-wrap:wrap;gap:7px}.decision-feedback button{font:inherit;font-size:13px;font-weight:800;border:1px solid #cbd6d0;background:#f6f9f7;color:#244b3b;border-radius:999px;padding:8px 11px;cursor:pointer}.decision-feedback button:hover,.decision-feedback button:focus-visible{background:#eaf2ed}.decision-feedback[data-answered="true"]{background:#f5f8f6}.decision-feedback[data-answered="true"] .decision-feedback-actions{display:none}.decision-feedback-note{display:none;font-weight:700}.decision-feedback[data-answered="true"] .decision-feedback-note{display:block}@media(max-width:720px){.decision-feedback{display:block}.decision-feedback-actions{margin-top:10px}.decision-feedback button{flex:1 1 auto}}';
    document.head.appendChild(style);
  }

  function addFeedback(){
    if(document.querySelector('.decision-feedback')) return;
    const brief=document.querySelector('.decision-brief');
    if(!brief) return;
    addStyles();
    const box=document.createElement('section');
    box.className='decision-feedback';
    box.setAttribute('aria-label','Decision usefulness feedback');
    box.innerHTML='<p><strong>Did this give you enough to make the trip decision?</strong><span class="decision-feedback-note"> Recorded. This is used to improve the decision tool.</span></p><div class="decision-feedback-actions"><button type="button" data-answer="yes">Yes</button><button type="button" data-answer="source">I still needed the official source</button><button type="button" data-answer="unclear">Still unclear</button></div>';
    brief.insertAdjacentElement('afterend',box);
    box.addEventListener('click',e=>{
      const button=e.target.closest('button[data-answer]');
      if(!button||answered) return;
      answered=true;
      const answer=button.dataset.answer;
      box.dataset.answered='true';
      track('breakout_decision_feedback',{
        answer,
        elapsed_ms:elapsed(),
        status:statusValue(),
        source_clicks:sourceClicks,
        refreshes,
        workbench_changes:workbenchChanges
      });
    });
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#sourceLink,.source-link')){
      sourceClicks+=1;
      track('breakout_official_source_click',{elapsed_ms:elapsed(),status:statusValue()});
    }
    if(e.target.closest('#refreshLive')){
      refreshes+=1;
      track('breakout_refresh_click',{elapsed_ms:elapsed(),status:statusValue()});
    }
    const mode=e.target.closest('.mode-toggle button[data-mode]');
    if(mode){
      workbenchChanges+=1;
      track('breakout_workbench_change',{kind:'vessel',value:String(mode.dataset.mode||'').slice(0,40),elapsed_ms:elapsed()});
    }
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.id==='yellowstoneRoute'){
      workbenchChanges+=1;
      track('breakout_workbench_change',{kind:'route',value:String(e.target.value||'').slice(0,60),elapsed_ms:elapsed()});
    }
  },true);

  const observer=new MutationObserver(addFeedback);
  observer.observe(document.body,{childList:true,subtree:true});
  addFeedback();
  track('breakout_value_session',{phase:'start'});
})();
