# Breakout Live Portfolio — 2026-09-28

## Objective

Build ten new canonical, source-backed decision tools with enough national demand to justify a portfolio aspiration of **1,000 organic clicks/day per tool**. That is a target, not a forecast.

The product pattern is simple: take a messy, time-sensitive visitor question, join the few current facts that actually change the decision, and put the answer before the explanation.

## Loss function

All dimensions are normalized before weighting.

`Value = 0.25D + 0.15R + 0.15C + 0.15S + 0.15G + 0.05N + 0.05Y + 0.05M`

- `D` search-demand ceiling
- `R` repeated “right now / today / next” intent
- `C` decision consequence
- `S` authoritative live-source availability
- `G` SERP differentiation gap
- `N` network fit
- `Y` durability
- `M` monetization/session-depth fit without distorting UX

`Loss = 0.20Z + 0.15I + 0.15B + 0.10E + 0.10H + 0.20K + 0.10O`

- `Z` zero-click/direct-answer risk
- `I` specialist incumbent moat
- `B` source/API brittleness
- `E` event or season concentration
- `H` safety/high-stakes interpretation risk
- `K` cannibalization with an existing Chris Izworski canonical
- `O` maintenance burden

`Net = 100 × (Value - Loss)`

A net opportunity score below 65 does not ship without new evidence.

### Hard vetoes

A tool does not launch if it has no authoritative/current source or truthful degraded state; requires thin doorway variants to create demand; duplicates an existing canonical intent; cannot materially improve a real decision beyond a search snippet; or depends on a required feed with unresolved usage/rights constraints.

## Selected portfolio

1. Zion Narrows Conditions Today — can I hike it today, and which route is viable?
2. Old Faithful Next Eruption — when is the next likely eruption?
3. Going-to-the-Sun Road Status — can I drive through Glacier now?
4. Yellowstone Road Status — which entrance/route works now?
5. Trail Ridge Road Status — is through travel open now?
6. Tioga Road Status — can I cross Yosemite now?
7. Cadillac Mountain Sunrise Planner — is tomorrow’s sunrise worth the early drive/reservation?
8. Mount Rainier Road Status — which major visitor areas are reachable now?
9. Lake Mead Access Today — what can I launch/access at this elevation?
10. Lake Powell Boat Ramp Status — which ramp works at the current elevation?

## Release plan

1. One shared source/freshness/failure engine; ten distinct canonical pages.
2. Generate pages from configuration so new sources, wording and analytics contracts are centrally maintainable.
3. Never synthesize a live state when an upstream source fails or is ambiguous.
4. Route the canonical ChrisIzworski.com URLs through the main shell; implementation remains in this owner repo.
5. Inherit the network GA4 and Auto Ads contract at build time.
6. Ship the ten together, then use Search Console to identify which query families actually earn impressions.
7. Expand only the winners and only when distinct user intent justifies another canonical page.
8. Measure impressions, CTR, engaged sessions, live-source success rate, pages/session and page RPM; do not optimize for accidental ad clicks.
