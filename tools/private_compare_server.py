#!/usr/bin/env python3
"""Private localhost Kupiora search. API key stays in environment, never sent to frontend.
Run from repository root: PARSER_MARKET_API_KEY=... python tools/private_compare_server.py
Only bind 127.0.0.1. The provider charges checks; set explicit opt-in before using.
"""
import json, os, secrets, time, threading
from urllib.parse import urlparse, quote, parse_qs
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HOST='127.0.0.1'
PORT=int(os.environ.get('KUPIORA_PORT','8872'))
API='https://parser.market/wp-json/client-api/v1/'
KEY=os.environ.get('PARSER_MARKET_API_KEY','').strip()
ALLOW_CHARGES=os.environ.get('KUPIORA_ENABLE_PAID_CHECKS','')=='yes'
JOBS={}
LOCK=threading.Lock()
STORES={'ozons':'Ozon','wbs':'Wildberries','ym':'Яндекс Маркет'}
def provider_post(endpoint,payload):
    req=Request(API+endpoint, data=json.dumps({'apikey':KEY,**payload},ensure_ascii=False).encode(),headers={'Content-Type':'application/json','User-Agent':'KupioraPrivateTest/1.0'},method='POST')
    with urlopen(req,timeout=20) as r:
        body=r.read(750_000)
    return json.loads(body)
def unpack_pairs(v):
    if isinstance(v,list):
        if v and isinstance(v[0],dict):return dict(x for item in v for x in item.items())
    if isinstance(v,dict):return v
    return {}
def match_report_records(report,market):
    out=[]
    for row in report.get('data',[])[:80] if isinstance(report.get('data'),list) else []:
        stamp=next(iter(row.get('sku',{}).get('history',[])),{}).get('record_date') if isinstance(row.get('sku'),dict) else None
        for offer in row.get('offers',[])[:40] if isinstance(row.get('offers'),list) else []:
            try:
                price=float(offer['Price'])
                if price<=0 or price>100_000_000:continue
                url=offer.get('ShopUrl') or row.get('link') or ''
                if not permitted_store_url(url,market):continue
                title=str(offer.get('Name') or row.get('sku',{}).get('Name_found') or '').strip()
                if not title:continue
                pics=[p for p in offer.get('Offer_pics',[]) if isinstance(p,str) and p.startswith('https://')]
                out.append({'shop':STORES[market],'title':title[:240],'url':url,'price':price,'delivery':None,
                    'image':pics[0] if pics else None,'region':report.get('regioncode') or 'Москва',
                    'checkedAt':stamp,'source':'api','mpn':''})
            except (KeyError,TypeError,ValueError,OverflowError,AttributeError):continue
    return out
def permitted_store_url(value,market):
    try:
        p=urlparse(value);host=p.hostname or ''
        bases={'ozons':'ozon.ru','wbs':'wildberries.ru','ym':'market.yandex.ru'}
        base=bases[market]
        return p.scheme=='https' and (host==base or host.endswith('.'+base)) and not p.username and not p.password
    except (ValueError,KeyError):return False
def get_report(url):
    p=urlparse(url)
    # Provider report URLs only, not arbitrary URLs (SSRF prevention).
    if p.scheme!='https' or p.hostname!='files.parser.market' or not p.path.startswith('/_filestorage/') or not p.path.endswith('.json') or p.username or p.password or p.port:return None
    with urlopen(Request(url,headers={'User-Agent':'KupioraPrivateTest/1.0'}),timeout=25) as r:
        # Validate final redirected hostname.
        final=urlparse(r.geturl())
        if final.scheme!='https' or final.hostname!='files.parser.market':return None
        raw=r.read(3_000_001)
    if len(raw)>3_000_000:return None
    return json.loads(raw)
def make_link(market,query):
    q=quote(query)
    return {'ozons':'https://www.ozon.ru/search/?text='+q,
        'wbs':'https://www.wildberries.ru/catalog/0/search.aspx?search='+q,
        'ym':'https://market.yandex.ru/search?text='+q}[market]
def submit(job,query,region):
    for market in STORES:
        tag=secrets.token_hex(6)
        payload={'regionid':region if market!='ym' else 'Москва','market':market,'userlabel':tag,
                 'products':[{'name':query,'linkset':[make_link(market,query)],'donotsearch':16 if market=='ozons' else 12 if market=='wbs' else 0}]}
        try:
            response=provider_post('send-order',payload)
            pairs=unpack_pairs(response)
            if pairs.get('result')!='success':raise ValueError('Provider did not accept search')
            with LOCK:job['markets'][market]={'label':tag,'state':'waiting'}
        except Exception:
            with LOCK:job['markets'][market]={'label':tag,'state':'error'};job['errors'].append(market+': запрос не принят')
    with LOCK:job['submitted']=True
def poll(job):
    try:
        labels=[v['label'] for v in job['markets'].values() if v['state'] not in ('done','error')]
        if not labels:return
        response=provider_post('get-last50',{'userlabels':labels,'limit':12})
        pairs=unpack_pairs(response)
        for entry in pairs.get('data',[]):
            v=unpack_pairs(entry)
            tag=str(v.get('userlabel',''))
            market=next((m for m,s in job['markets'].items() if s['label']==tag),None)
            if not market:continue
            state=str(v.get('status','')).lower()
            if state in ('completed','finished'):
                link=v.get('report_json')
                if not isinstance(link,str) or not link:continue
                report=get_report(link)
                if report:
                    found=match_report_records(report,market)
                    with LOCK:
                        job['offers'].extend(found)
                        job['markets'][market]['state']='done'
            elif state in ('error','failed','cancelled'):
                with LOCK:job['markets'][market]['state']='error';job['errors'].append(market+': ошибка сбора')
    except Exception:
        with LOCK:job['errors'].append('Не удалось обновить статус поставщика')
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,fmt,*args):pass
    def reply(self,status,obj):
        b=json.dumps(obj,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        p=urlparse(self.path)
        if p.path=='/api/status':
            self.reply(200,{'enabled':bool(KEY and ALLOW_CHARGES),'provider':'Parser.market','requiresOptIn':not ALLOW_CHARGES});return
        if p.path=='/api/poll':
            id=parse_qs(p.query).get('id',[''])[0]
            with LOCK:job=JOBS.get(id)
            if not job:self.reply(404,{'error':'unknown search'});return
            if job.get('submitted') and time.time()-job.get('last_poll',0)>8 and not all(x['state'] in ('done','error') for x in job['markets'].values()):
                job['last_poll']=time.time();threading.Thread(target=poll,args=(job,),daemon=True).start()
            self.reply(200,{'done':job['submitted'] and all(x['state'] in ('done','error') for x in job['markets'].values()),
                'offers':job['offers'][:100],'errors':job['errors'][-5:]});return
        return super().do_GET()
    def do_POST(self):
        if urlparse(self.path).path!='/api/search':self.reply(404,{'error':'not found'});return
        if not KEY or not ALLOW_CHARGES:self.reply(503,{'error':'provider not enabled'});return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<4000:raise ValueError('size')
            d=json.loads(self.rfile.read(size))
            q=d.get('query','').strip();region=d.get('region','Москва')
            if not isinstance(q,str) or not 2<=len(q)<=160 or not isinstance(region,str) or len(region)>80:raise ValueError('query')
        except (ValueError,TypeError,AttributeError,json.JSONDecodeError):
            self.reply(400,{'error':'invalid query'});return
        with LOCK:
            # Limited local history to avoid memory exhaustion.
            if len(JOBS)>30:
                first=next(iter(JOBS));JOBS.pop(first,None)
            id=secrets.token_urlsafe(16);job={'markets':{},'offers':[],'errors':[],'submitted':False,'last_poll':0};JOBS[id]=job
        threading.Thread(target=submit,args=(job,q,region),daemon=True).start()
        self.reply(202,{'id':id})
if __name__=='__main__':
    print('Private Kupiora at http://127.0.0.1:'+str(PORT)+'/compare-any.html')
    print('Automated API:',bool(KEY and ALLOW_CHARGES),'(provider checks can cost money)')
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
