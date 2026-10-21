# Hawaii island tool set: demand, ranking, build order

Measured 2026-10-21. Data: `benchmarks/hawaii-island-tools-demand-2026-10-21.json`.

## What was measured
Google autocomplete, 48 Hawaii seeds x (blank, a to z, 8 question stems) = 1,680 queries, 9,127 distinct suggestions.
Counts are **breadth** (distinct suggestions per theme), not search volume, and the themes are regex-bucketed and noisy.
This ranks themes. It does not size them. Existing Hawaii tools on the hub: Haleakalā sunrise, Kīlauea live.

## The messy decisions, by breadth of "intent" suggestions
Reservations/permits/closures 312 (noisy) · which island 228 · volcano 192 · where to stay 125 · packing 122 ·
sunrise/sunset 103 · hurricane/storm 103 · Road to Hana 96 · December/winter 67 · turtles/manta 66 · whales 43 ·
costs/fees 40 · ocean safety 26 · weather by island 14 · rental car 14.

Small counts are not small problems. Ocean safety and "where is it sunny" are short because people ask a map or an app,
not a search box, and they are the ones with a live answer a blog cannot give.

## Ranking
Each 1 to 5, my judgment: **Demand** (breadth above), **Live value** (does fresh data change the answer),
**Data** (free, reliable source we can cite), **Gap** (what the visitor gets today), **Christmas** (useful before Dec 25).

| Tool | Demand | Live | Data | Gap | Xmas | Total |
|---|---|---|---|---|---|---|
| 1. What you need to book (reservations, permits, release dates) | 5 | 3 | 4 | 4 | 5 | 21 |
| 2. Sun or rain: which side of the island today | 2 | 5 | 5 | 5 | 5 | 22 |
| 3. Ocean safety today (surf, advisories, jellyfish calendar) | 3 | 5 | 4 | 4 | 5 | 21 |
| 4. Road to Hana day planner (conditions, timing, combos) | 4 | 4 | 3 | 4 | 3 | 18 |
| 5. Which island / where to stay for your trip | 5 | 1 | 2 | 2 | 3 | 13 |
| 6. Winter wildlife calendar (whales, turtles) | 3 | 1 | 2 | 3 | 4 | 13 |

Not ranked: Kīlauea (exists), hurricane (Central Pacific season is June to November, so it is a banner, not a tool),
rental car and packing (guide content).

## Build order
1. **What you need to book.** Reuses the release-date logic shipped with the Haleakalā work. A checker like the Michigan snowmobile
   one: pick an island and what you want to do, get what needs a reservation, when it opens, what it costs, what is closed which day.
   Every rule comes from the official page and carries its checked date.
2. **Sun or rain.** About a dozen representative points per island from NWS, windward vs leeward, this week. Best in the week before travel.
3. **Ocean safety today.** NWS surf and advisory products plus a moon-based jellyfish calendar. North Shore winter surf is the biggest
   December hazard for a visitor. Must defer to lifeguards and say so.
4. **Road to Hana planner.** After 1 to 3, using the same booking and conditions feeds.
5. **Island chooser.** Needs Chris's voice and six trips of judgment more than data. Do it as his guide with climate numbers behind it.

A Hawaii section page ties them to Haleakalā and Kīlauea.

## Open questions for Chris
Which of these decisions cost you the most time or money on trip one versus trip six? That ordering beats mine.
