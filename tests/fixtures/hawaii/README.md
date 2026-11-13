# NWS Honolulu SRF regression fixtures

These are verbatim Big Island block excerpts of US National Weather Service public-domain bulletins, fetched November 12, 2026 (HST). They are historical test data, never live forecasts.

- `srf-2026-11-12-morning.txt`: 848 AM HST Thu Nov 12 2026; WMO `FZHW52 PHFO 121848`; Today/Friday table with AM PM / AM PM columns. Retrieved from https://forecast.weather.gov/product.php?site=HFO&issuedby=HFO&product=SRF&format=txt&version=2&glossary=0 . Version numbers are relative and will rotate; the issue timestamp and WMO header identify the captured bulletin.
- `srf-2026-11-12-afternoon.txt`: 344 PM HST Thu Nov 12 2026; WMO `FZHW52 PHFO 130144`; Tonight/Friday table with PM AM / AM PM columns. Retrieved through the latest product linked by https://api.weather.gov/products/types/SRF/locations/HFO . The full fetched product was used to reproduce the existing null `srfFirstDate` result before the change.

The November 11 afternoon bulletin independently confirms the Tonight layout: https://forecast.weather.gov/product.php?format=CI&glossary=1&issuedby=HFO&product=SRF&site=HFO&version=4 . This rotating URL is contextual evidence only. Tests use the captured files, not network access.
