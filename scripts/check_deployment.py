"""Fail closed when any deployed static resource differs from this build."""
from pathlib import Path
from urllib.request import Request,urlopen
import sys,json,hashlib
root=Path(__file__).resolve().parents[1]
origin=sys.argv[1].rstrip('/')
results={}
for p in sorted((root/'dist').iterdir()):
 if not p.is_file():continue
 try:
  with urlopen(Request(origin+'/'+p.name,headers={'Cache-Control':'no-cache'}),timeout=20) as r:actual=r.read()
  results[p.name]={'match':actual==p.read_bytes(),'sha256':hashlib.sha256(actual).hexdigest()}
 except Exception as e:results[p.name]={'match':False,'error':str(e)}
print(json.dumps(results,indent=2))
sys.exit(0 if all(r['match'] for r in results.values()) else 1)
