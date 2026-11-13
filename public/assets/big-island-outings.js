/* A local outing matcher. No weather score, routing estimate, or live access claim. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BigIslandOutings = api; api.mount(document); }
})(typeof window === 'object' ? window : globalThis, function () {
  const reviewed = '2026-11-12';
  const notices = 'https://dlnr.hawaii.gov/dsp/important-park-notices/';
  const places = [
    {
      id: 'hapuna', name: 'Hāpuna Beach', region: 'Kohala', interests: ['shore'],
      fit: { kohala: 1, kona: 2, south: 3, hilo: 3, volcano: 3 },
      scene: 'A broad sweep of pale sand on the dry Kohala coast. Leave room in the day to sit under the trees and watch the water.',
      plan: 'Choose a beach-and-picnic outing. Check the Kohala surf card, then ask the lifeguard about conditions at this beach.',
      access: 'Use the main Hāpuna beach entrance. Waialea is a separate section with a closure notice in the reviewed bulletin. Entry and parking fees may apply; check posted hours.',
      source: 'https://dlnr.hawaii.gov/dsp/parks/Hawaii/hapuna-beach-state-recreation-area/',
      check: notices, map: 'Hapuna Beach State Recreation Area Hawaii',
      tool: '/national-tools/big-island-beach-day/', toolLabel: 'Compare coastal surf'
    },
    {
      id: 'puho', name: 'Puʻuhonua o Hōnaunau', region: 'South Kona', interests: ['culture', 'shore'],
      fit: { south: 1, kona: 2, kohala: 3, hilo: 3, volcano: 3 },
      scene: 'Black lava, coconut palms and a place of refuge beside Hōnaunau Bay. Give the stories of this sacred place as much time as the view.',
      plan: 'Walk the cultural grounds, then take a picnic to the designated picnic area. Follow the park’s walking tour at your own pace.',
      access: 'Park at the national historical park. Ocean entry is not allowed inside the park; nearby Two Step is outside its grounds. This is a land-based visit.',
      source: 'https://www.nps.gov/puho/planyourvisit/things2do.htm',
      check: 'https://www.nps.gov/puho/planyourvisit/conditions.htm', map: '19.422750,-155.909873',
      tool: '#south-kona-access?plan=twostep', toolLabel: 'Looking for Two Step? Check its separate access'
    },
    {
      id: 'kaloko', name: 'Kaloko-Honokōhau', region: 'Kailua-Kona', interests: ['culture', 'shore'],
      fit: { kona: 1, south: 2, kohala: 2, hilo: 3, volcano: 3 },
      scene: 'Coastal trails connect a living Hawaiian landscape of fishponds, lava and ocean. Slow down and look for wildlife from a respectful distance.',
      plan: 'Begin at Hale Hoʻokipa, the park visitor center, and ask which trail fits the time you have. Bring water and sun protection.',
      access: 'Use the visitor-center entrance off Highway 19. The harbor and Kaloko road are different entrances; follow NPS directions for the entrance you choose.',
      source: 'https://www.nps.gov/kaho/planyourvisit/directions.htm',
      check: 'https://www.nps.gov/kaho/planyourvisit/conditions.htm', map: 'Hale Hookipa Visitor Center Kaloko Honokohau Hawaii'
    },
    {
      id: 'akaka', name: 'ʻAkaka Falls', region: 'Hāmākua, north of Hilo', interests: ['waterfalls'],
      fit: { hilo: 1, volcano: 2, kohala: 2, kona: 3, south: 3 },
      scene: 'Rainforest frames a long white ribbon of water dropping into a steep gorge. The approach has steps and can be wet.',
      plan: 'Check the trail notice first. The usual walk is a 0.4-mile loop, but the reviewed bulletin reports a partial trail closure. Do not assume the full loop is available.',
      access: 'Access needs a fresh check: the October 30 bulletin listed fallen trees on part of the trail. No reopening was established in this review. Stay behind barriers.',
      source: 'https://dlnr.hawaii.gov/dsp/parks/Hawaii/akaka-falls-state-park/',
      check: notices, holdDirections: true
    },
    {
      id: 'volcano', name: 'Hawaiʻi Volcanoes National Park', region: 'Kīlauea summit', interests: ['volcano'],
      fit: { volcano: 1, hilo: 2, kona: 3, south: 3, kohala: 3 },
      scene: 'A volcanic landscape changes at its own pace. A quiet crater is still worth understanding; visible lava is never a promise.',
      plan: 'Use Kīlauea Live to check the eruption update, viewing conditions and park information before choosing an overlook. Allow a full day from the west side.',
      access: 'Follow the park’s current viewing plan. Closures, volcanic gas and crowded parking can change the visit. This chooser does not select an open overlook.',
      source: 'https://www.nps.gov/havo/planyourvisit/eruption-viewing.htm',
      check: 'https://www.nps.gov/havo/planyourvisit/conditions.htm',
      tool: '/national-tools/kilauea-live/', toolLabel: 'Check Kīlauea before driving'
    },
    {
      id: 'maunakea', name: 'Maunakea Visitor Information Station', region: 'Saddle Road', interests: ['stars'],
      fit: { kona: 2, kohala: 2, hilo: 2, south: 3, volcano: 3 },
      scene: 'The island’s coast gives way to a much colder mountain evening. Begin with the sky above the visitor station, not a drive to the summit.',
      plan: 'Use Mauna Kea Tonight to compare clouds and moonlight. Plan around visitor-station hours and leave time for the return drive.',
      access: 'The station is at 9,200 feet. Published daily hours are 9 a.m.–9 p.m.; verify changes. Summit access is separate, requires 4WD and ends 30 minutes after sunset.',
      source: 'https://hilo.hawaii.edu/maunakea/visitor-information/station',
      check: 'https://hilo.hawaii.edu/maunakea/visitor-information/station', map: 'Onizuka Center for International Astronomy',
      tool: '/national-tools/mauna-kea-tonight/', toolLabel: 'Compare stargazing evenings'
    }
  ];
  const bases = { kona: 'Kailua-Kona', south: 'South Kona / Captain Cook', kohala: 'Waikoloa / Kohala', hilo: 'Hilo', volcano: 'Volcano village' };
  const interests = { any: 'Open to ideas', shore: 'Shore and picnic', culture: 'Hawaiian history', waterfalls: 'Waterfalls', volcano: 'Volcano', stars: 'Stars' };
  const timeLabels = { 1: 'A short outing nearby', 2: 'Half a day or an evening', 3: 'A full day' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function match({ base = 'kona', time = '2', interest = 'any' } = {}) {
    if (!Object.hasOwn(bases, base) || !Object.hasOwn(timeLabels, time) || !Object.hasOwn(interests, interest)) return [];
    return places.filter(p => p.fit[base] <= Number(time) && (interest === 'any' || p.interests.includes(interest)))
      .sort((a, b) => a.fit[base] - b.fit[base]);
  }
  function mapUrl(place) {
    return place.map && !place.holdDirections ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.map)}` : null;
  }
  function mount(doc) {
    const anchor = doc.querySelector('.bd-coasts');
    if (!anchor || doc.getElementById('island-outings')) return;
    const section = doc.createElement('section');
    section.id = 'island-outings'; section.className = 'island-outings';
    section.setAttribute('aria-labelledby', 'outing-heading');
    const options = values => Object.entries(values).map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    section.innerHTML = `<div class="outing-intro"><p class="eyebrow">A little less driving. A little more island.</p><h2 id="outing-heading">Find your next Big Island outing</h2><p>Start with where you’re staying and the kind of day you want. These are places to consider, with the checks you need before leaving.</p></div><form class="outing-controls"><label>Starting area<select name="base">${options(bases)}</select></label><label>Time to spend<select name="time">${options(timeLabels)}</select></label><label>What sounds good?<select name="interest">${options(interests)}</select></label></form><p class="outing-note">Time categories are broad planning suggestions, including a return to your starting area. They are not drive-time estimates. A match does not mean a place is open or conditions are suitable today.</p><p class="outing-count" role="status" aria-live="polite"></p><div class="outing-results"></div><p class="outing-note">Access sources reviewed ${reviewed}. This is a planning guide, not a live closure feed. <a href="${notices}">Read the latest state park notices</a>.</p>`;
    anchor.after(section);
    const form = section.querySelector('form');
    const values = () => Object.fromEntries(new FormData(form));
    const params = new URLSearchParams(location.hash.startsWith('#island-outings?') ? location.hash.split('?')[1] : '');
    for (const key of ['base', 'time', 'interest']) {
      const control = form.elements.namedItem(key);
      const value = params.get(key) || (key === 'time' ? '2' : control.value);
      if ([...control.options].some(o => o.value === value)) control.value = value;
    }
    function render(save = false) {
      const choice = values(), found = match(choice);
      section.querySelector('.outing-count').textContent = found.length ? `${found.length} ${found.length === 1 ? 'outing fits' : 'outings fit'} this plan from ${bases[choice.base]}.` : 'No outing in this small collection fits those choices. Try more time or a different interest.';
      section.querySelector('.outing-results').innerHTML = found.map(p => `<article class="outing-card"><p class="eyebrow">${esc(p.region)}</p><h3>${esc(p.name)}</h3><p>${esc(p.scene)}</p><p><strong>Your visit:</strong> ${esc(p.plan)}</p><p class="outing-access"><strong>Before you leave:</strong> ${esc(p.access)}</p><div class="outing-links"><a href="${esc(p.check)}">Check official access</a>${mapUrl(p) ? `<a href="${esc(mapUrl(p))}">Find the entrance on Google Maps</a>` : ''}${p.tool ? `<a href="${esc(p.tool)}">${esc(p.toolLabel)}</a>` : ''}<a href="${esc(p.source)}">Read the place guide</a></div></article>`).join('');
      if (save) {
        history.replaceState(null, '', '#island-outings?' + new URLSearchParams(choice));
        try { window.gtag?.('event', 'hawaii_outing_matched', { ...choice, result_count: found.length }); } catch {}
      }
    }
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('change', () => render(true));
    render();
    if (location.hash.startsWith('#island-outings')) section.scrollIntoView();
  }
  return { reviewed, places, bases, interests, timeLabels, match, mapUrl, mount };
});
