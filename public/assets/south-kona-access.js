/* South Kona access planning: no live opening, permit approval or ocean-safety verdict. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SouthKonaAccess = api; api.mount(document); }
})(typeof window === 'object' ? window : globalThis, function () {
  const reviewed = '2026-11-12';
  const sources = {
    park: ['Kealakekua park and authorized tour list', 'https://dlnr.hawaii.gov/dsp/parks/hawaii/kealakekua-bay-state-historical-park/'],
    permit: ['DLNR transit permit instructions', 'https://outdoor.hawaii.gov/state-parks/permit/'],
    guided: ['DLNR guided-tour access rules', 'https://dlnr.hawaii.gov/dsp/parks/state-parks-special-use-permit/'],
    step: ['NPS directions to Hōnaunau Bay access', 'https://www.nps.gov/puho/planyourvisit/snorkeling.htm'],
    cultural: ['Plan a visit to the place of refuge', 'https://www.nps.gov/puho/planyourvisit/things2do.htm']
  };
  const plans = {
    rental: {
      label: 'Rent a kayak for Kealakekua Bay', title: 'Confirm the boat’s permit and your launch before renting',
      intro: 'A rental can take you across the bay without giving you permission to go ashore at the Captain Cook Monument.',
      rows: [['Crossing the bay', 'Ask the rental owner to confirm that the particular vessel has a valid transit permit. DLNR says the renter does not obtain a separate transit permit.'], ['Launching', 'An ordinary rental permit does not allow a launch from Nāpōʻopoʻo wharf. Ask the owner to identify and confirm a lawful launch and parking arrangement.'], ['Going ashore', 'Do not plan to land at Kaʻawaloa on a transit permit. Separate DLNR written approval is required.']],
      next: 'Before paying, ask: “Is this vessel permitted for my date, where may I launch and park, and does this booking include any separately authorized landing?” If you want a guided landing visit, choose that option above.',
      refs: ['park', 'permit']
    },
    guided: {
      label: 'Take a guided kayak tour to the monument', title: 'Choose an authorized guided tour and confirm its landing plan',
      intro: 'DLNR distinguishes authorized guided tours from ordinary kayak rentals. Their permissions are different.',
      rows: [['Choosing a company', 'Start with the authorized tour list on the state park page. Confirm that the exact tour you book operates under the required permission for your date.'], ['Launch and landing', 'Authorized guided tours may have permission to use Nāpōʻopoʻo wharf and land at Kaʻawaloa under specific conditions. Confirm both with the operator; a rental from the same company is not automatically the same arrangement.'], ['Meeting and parking', 'Use the meeting point supplied for your booking. A map pin at the monument is not a driving destination.']],
      next: 'Ask the operator whether this tour lands, where to meet, where to park, and what happens if ocean conditions cancel the trip.',
      refs: ['guided', 'park']
    },
    own: {
      label: 'Bring my own kayak, SUP or other vessel', title: 'Arrange the vessel permit before planning a crossing',
      intro: 'The transit requirement covers private vessels, including paddleboards and inflatables.',
      rows: [['Permit application', 'DLNR asks for an application at least 14 days before access. Use the form valid for your visit year and wait for approval; submitting an application is not permission.'], ['Launch and landing', 'A transit permit does not authorize launching at Nāpōʻopoʻo wharf or going ashore at Kaʻawaloa. Landing needs separate DLNR written approval.'], ['Before transporting your vessel', 'Confirm a lawful launch and parking arrangement with the managing authority. This guide has not established a public self-launch location.']],
      next: 'Open the DLNR instructions and confirm the correct form for your date. If the page’s year labels disagree, contact the permit office at KBSHP.VESSEL.SUP@hawaii.gov before applying.',
      refs: ['permit', 'park']
    },
    hike: {
      label: 'Hike to the Captain Cook Monument', title: 'Plan a trail visit from the uplands',
      intro: 'The historic Kaʻawaloa Trail is the land approach identified by State Parks. The monument is not a drive-up stop.',
      rows: [['Approach', 'Use the state park’s trail information to plan the hike. This chooser does not verify trailhead parking, current trail conditions or a hiking time.'], ['Facilities', 'State Parks reports no restrooms on the trail. Carry out everything you bring.'], ['Water access', 'Reaching the shore on foot does not establish that snorkeling conditions are suitable. Keep the hike and the decision to enter the ocean separate.']],
      next: 'Check State Parks for current access and establish the trailhead and lawful parking before setting out. No monument driving pin is supplied here.',
      refs: ['park']
    },
    twostep: {
      label: 'Snorkel at Two Step / Hōnaunau Bay', title: 'Use the coastal access outside the national park',
      intro: 'Hōnaunau Bay Boat Ramp, often called Two Step, is outside Puʻuhonua o Hōnaunau. It is a different destination from the place of refuge.',
      rows: [['Finding the approach', 'NPS describes a signed, one-way public coastal access road just before the park entrance. Follow the official approach instructions and signs on arrival.'], ['Parking', 'NPS asks snorkelers to park outside the park gate. That does not make every roadside space legal or guarantee a space. Follow posted restrictions and keep access clear.'], ['At the water', 'Keep clear of boat traffic. Do not enter at Keoneʻele Cove inside the park or use the park restrooms to change or rinse.']],
      next: 'Read the NPS approach directions before driving. On arrival, check the water and local warnings; a calm regional forecast does not assess this entry.',
      refs: ['step']
    },
    cultural: {
      label: 'Visit Puʻuhonua o Hōnaunau on land', title: 'Plan a visit to the place of refuge',
      intro: 'Make time for the cultural grounds, coastal setting and stories of this sacred place.',
      rows: [['Entrance', 'Use the national historical park entrance for a cultural visit and follow its current hours and entry requirements.'], ['Visit', 'Start with the park’s self-guided walking tour. Two Step snorkeling uses separate access outside the park.']],
      next: 'Read the park’s visit guide and check its current conditions before leaving.',
      refs: ['cultural'], map: '19.422750,-155.909873'
    }
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const getPlan = key => Object.hasOwn(plans, key) ? plans[key] : null;
  function reviewNote(now = Date.now()) {
    const age = Number(now) - Date.parse(reviewed + 'T00:00:00Z');
    return `Official sources reviewed November 12, 2026. ${!Number.isFinite(age) || age < 0 || age > 30 * 86400000 ? 'This review needs updating; recheck the official rules before relying on the plan.' : 'Recheck the linked authority before your visit.'} This is not a live access or ocean-conditions report.`;
  }
  function shell() {
    return `<section id="south-kona-access" class="south-kona-access" aria-labelledby="kona-access-heading"><div class="outing-intro"><p class="eyebrow">Two bays. Different ways in.</p><h2 id="kona-access-heading">Plan your South Kona shore visit</h2><p>For Kealakekua Bay, crossing the water, launching a kayak and landing near the monument are separate permissions. At Hōnaunau, Two Step snorkeling and a national park visit use different access.</p></div><div class="kona-access-controls"></div><div class="kona-access-result"></div><details class="kona-access-basics"><summary>Read the access essentials</summary><p>A Kealakekua rental needs a permitted vessel and a lawful launch. A transit permit alone does not authorize a Kaʻawaloa landing. Start with <a href="${sources.park[1]}">State Parks’ access rules and authorized guided tours</a>.</p><p>Two Step is outside the national park. Use <a href="${sources.step[1]}">NPS coastal access directions</a>; the park’s lot is for visiting the cultural grounds.</p></details><p class="outing-note kona-access-review">${reviewNote()}</p></section>`;
  }
  function mount(doc) {
    const anchor = doc.querySelector('.bd-method');
    let section = doc.getElementById('south-kona-access');
    if (!section && anchor) { anchor.insertAdjacentHTML('beforebegin', shell()); section = doc.getElementById('south-kona-access'); }
    if (!section || section.dataset.mounted) return;
    section.dataset.mounted = 'true';
    const win = doc.defaultView;
    section.querySelector('.kona-access-controls').innerHTML = `<label for="kona-access-plan">What would you like to do?</label><select id="kona-access-plan"><option value="">Choose your visit</option>${Object.entries(plans).map(([k,p]) => `<option value="${k}">${esc(p.label)}</option>`).join('')}</select>`;
    const select = section.querySelector('select'), result = section.querySelector('.kona-access-result');
    result.setAttribute('aria-live', 'polite');
    section.querySelector('.kona-access-review').textContent = reviewNote();
    function render(save = false) {
      const plan = getPlan(select.value);
      result.innerHTML = plan ? `<article><h3>${esc(plan.title)}</h3><p>${esc(plan.intro)}</p><dl>${plan.rows.map(([label,text]) => `<div><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl><p class="kona-access-next"><strong>Your next step:</strong> ${esc(plan.next)}</p><div class="outing-links">${plan.refs.map(k => `<a href="${sources[k][1]}">${esc(sources[k][0])}</a>`).join('')}${plan.map ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.map)}">Find the national park entrance on Google Maps</a><a href="https://www.nps.gov/puho/planyourvisit/conditions.htm">Check national park conditions</a>` : ''}</div></article>` : '<p>Choose a visit to see its approach, permissions and next step.</p>';
      if (save) {
        win.history.replaceState(null, '', '#south-kona-access' + (plan ? '?plan=' + select.value : ''));
        try { win.gtag?.('event', 'south_kona_access_selected', { plan: select.value || 'none' }); } catch {}
      }
    }
    function restore() {
      if (!win.location.hash.startsWith('#south-kona-access')) return;
      const key = new URLSearchParams(win.location.hash.split('?')[1] || '').get('plan');
      select.value = getPlan(key) ? key : '';
      render(); section.scrollIntoView();
    }
    select.addEventListener('change', () => render(true));
    win.addEventListener('hashchange', restore);
    render(); restore();
  }
  return { reviewed, sources, plans, getPlan, reviewNote, shell, mount };
});
