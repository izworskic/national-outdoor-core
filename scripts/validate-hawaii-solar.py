#!/usr/bin/env python3
"""Independent astronomical comparison, not observed visibility validation.
Install: python3 -m pip install -r scripts/requirements-hawaii-validation.txt
Run from repo root: python3 scripts/validate-hawaii-solar.py [--write]
"""
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from astral import Observer
from astral.sun import sun
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo('Pacific/Honolulu')
places = json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./public/assets/hawaii-day-tools.js').places))"],cwd=ROOT))
dates = [dt.date(2026,1,1)+dt.timedelta(days=i) for i in range((dt.date(2029,1,1)-dt.date(2026,1,1)).days)]
dates += [dt.date(2020,1,1),dt.date(2020,2,29),dt.date(2040,12,31)]
rows=[]
for date in dates:
    for key,p in places.items():
        values=sun(Observer(p['lat'],p['lon'],0),date=date,tzinfo=TZ)
        rows.append({'date':date.isoformat(),'place':key,**{k:round(values[k].hour*60+values[k].minute+values[k].second/60,4) for k in ['sunrise','sunset','dawn','dusk']}})
code="const a=require('./public/assets/hawaii-day-tools.js');let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(r=>a.solar(r.date,r.place)))));"
actual=json.loads(subprocess.check_output(['node','-e',code],input=json.dumps(rows).encode(),cwd=ROOT))
errors={k:max(abs(row[k]-got[k]) for row,got in zip(rows,actual)) for k in ['sunrise','sunset','dawn','dusk']}
assert all(v<=5 for v in errors.values()),errors
summary={'schemaVersion':1,'comparator':'Astral 3.2; sea-level observer; civil twilight 6 degrees','cases':len(rows),'coverage':'Every day 2026–2028, six Hawaii places; 2020/2040 and leap boundaries','maxAbsoluteMinutes':{k:round(v,3) for k,v in errors.items()},'toleranceMinutes':5,'note':'Agreement between calculations, not observed sunrise or weather/terrain visibility accuracy.'}
fixtures=[r for r in rows if r['date'][5:] in ['01-01','02-29','03-15','06-15','09-15','12-15','12-31']]
if '--write' in sys.argv:
    (ROOT/'tests/fixtures/hawaii-solar-reference.json').write_text(json.dumps({'summary':summary,'samples':fixtures},indent=2)+'\n')
print(json.dumps(summary,indent=2))
