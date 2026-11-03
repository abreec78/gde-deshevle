"""Fetch bounded public feeds; keep last successful records on failures."""
import json, urllib.request, datetime, xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'radar'
registry=json.loads((root/'source-registry.json').read_text(encoding='utf-8'))
out=root/'feed.json'
old=json.loads(out.read_text(encoding='utf-8')) if out.exists() else {'sources':[]}
previous={x['id']:x for x in old['sources']}
results=[]
for source in registry['feeds']:
 result={**source,'attemptedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  req=urllib.request.Request(source['url'],headers={'User-Agent':'LifeRadar/0.1 public-feed-reader','Accept':'application/json, application/xml, application/rss+xml, */*'})
  with urllib.request.urlopen(req,timeout=18) as response:
   raw=response.read(4_000_001)
  if len(raw)>4_000_000: raise ValueError('Feed exceeds size limit')
  kind=source['adapter'];items=[]
  if kind=='xml':
   doc=ET.fromstring(raw)
   items=[{'title':f"{n.findtext('CharCode')}: {n.findtext('Value')} ₽ за {n.findtext('Nominal')}",'url':source['url'],'date':doc.get('Date')} for n in doc.findall('Valute')]
  elif kind in ('rss','atom'):
   doc=ET.fromstring(raw);ns='{http://www.w3.org/2005/Atom}'
   for n in (doc.findall('./channel/item') if kind=='rss' else doc.findall(ns+'entry'))[:15]:
    link=n.findtext('link') if kind=='rss' else next((x.get('href') for x in n.findall(ns+'link') if x.get('rel','alternate')=='alternate'),source['url'])
    items.append({'title':n.findtext('title' if kind=='rss' else ns+'title'),'url':link,'date':n.findtext('pubDate' if kind=='rss' else ns+'published')})
  else:
   data=json.loads(raw)
   if kind=='pubmed':items=[{'title':'PubMed · исследование '+i,'url':'https://pubmed.ncbi.nlm.nih.gov/'+i+'/','date':None} for i in data['esearchresult']['idlist']]
   if kind=='cisa':items=[{'title':x['cveID']+' · '+x['vulnerabilityName'],'url':'https://www.cve.org/CVERecord?id='+x['cveID'],'date':x['dateAdded']} for x in sorted(data['vulnerabilities'],key=lambda x:x['dateAdded'],reverse=True)[:15]]
   if kind=='usgs':items=[{'title':x['properties']['title'],'url':x['properties']['url'],'date':datetime.datetime.fromtimestamp(x['properties']['time']/1000,datetime.timezone.utc).isoformat()} for x in data['features'][:15]]
  result.update(status='ok',fetchedAt=result['attemptedAt'],items=items)
 except Exception as exc:
  prior=previous.get(source['id'],{})
  result.update(status='error',error=str(exc)[:250],fetchedAt=prior.get('fetchedAt'),items=prior.get('items',[]))
 results.append(result)
 print(source['id'],result['status'],len(result['items']))
out.write_text(json.dumps({'schema':1,'sources':results},ensure_ascii=False,indent=2),encoding='utf-8')
