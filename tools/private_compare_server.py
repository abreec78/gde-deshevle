#!/usr/bin/env python3
"""Private localhost Kupiora search. API key stays in environment, never sent to frontend.
Run from repository root: PARSER_MARKET_API_KEY=... python tools/private_compare_server.py
Only bind 127.0.0.1. The provider charges checks; set explicit opt-in before using.
"""
import json, os, re, secrets, time, threading
from urllib.parse import urlparse, quote, parse_qs, unquote
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
STORES={'ozons':'Ozon','ozon':'Ozon','wbs':'Wildberries','ym':'Яндекс Маркет'}
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
                # A search results page is not an individual product URL.
                path=urlparse(url).path.lower()
                if market in ('ozon','ozons') and '/product/' not in path:continue
                if market=='ym' and not any(x in path for x in ('/card/','/p/','/product')):continue
                if market=='wbs' and not re.search(r'/catalog/\d+/',path):continue
                title=str(offer.get('Name') or row.get('sku',{}).get('Name_found') or '').strip()
                if not title:continue
                pics=[p for p in offer.get('Offer_pics',[]) if isinstance(p,str) and p.startswith('https://')]
                out.append({'shop':STORES[market],'title':title[:240],'url':url,'price':price,'delivery':None,
                    'image':pics[0] if pics else None,'region':report.get('regioncode') or 'Москва',
                    'checkedAt':stamp,'source':'api','mpn':next(iter(re.findall(r'\b(?:[A-Z]{2,}-)?[A-Z][A-Z0-9]+-[A-Z0-9-]{5,}\b',title,flags=re.I)),'')})
            except (KeyError,TypeError,ValueError,OverflowError,AttributeError):continue
    return out
def permitted_store_url(value,market):
    try:
        p=urlparse(value);host=p.hostname or ''
        bases={'ozons':'ozon.ru','ozon':'ozon.ru','wbs':'wildberries.ru','ym':'market.yandex.ru'}
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

def flatten_order_records(payload):
    d=unpack_pairs(payload)
    values=d.get('data', [])
    if isinstance(values,dict):values=list(values.values())
    if not isinstance(values,list):return []
    return [unpack_pairs(x) for x in values if isinstance(x,(dict,list))]

def ozon_product_link(value):
    if not isinstance(value,str):return None
    try:
        p=urlparse(value)
        if p.scheme!='https' or p.hostname not in ('ozon.ru','www.ozon.ru') or p.username or p.password:return None
        if not re.fullmatch(r'/product/(?:[\w%.-]*?-)?\d+/?',p.path,re.I):return None
        return 'https://www.ozon.ru'+p.path
    except ValueError:return None

def product_id(value):
    link=ozon_product_link(value)
    if not link:return None
    m=re.search(r'-(\d+)/?$|/(\d+)/?$',urlparse(link).path)
    return next((x for x in m.groups() if x),None) if m else None

def slug_label(link):
    segment=urlparse(link).path.strip('/').split('/')[-1]
    return (unquote(re.sub(r'-\d+$','',segment)).replace('-',' ').strip() or 'товар по ссылке')[:160]

def product_match(reference,candidate):
    # Strict confirmation: exact known manufacturer part numbers only.
    def models(text):
        tokens=re.findall(r'\b[A-Z0-9]+(?:[-/][A-Z0-9]+)+\b',str(text).upper())
        return {t for t in tokens if len(t)>=8 and any(c.isdigit() for c in t)}
    left,right=models(reference),models(candidate)
    cap=lambda title:{(v.replace(',','.'),'TB' if u.upper() in ('TB','ТБ') else 'GB') for v,u in re.findall(r'(\d+(?:[.,]\d+)?)\s*(TB|GB|ТБ|ГБ)\b',title,re.I)}
    lc,rc=cap(str(reference)),cap(str(candidate))
    return bool(left and right and left&right and (not lc or not rc or lc==rc))

def submit(job,query,region,source_url=None,markets=None):
    market_list=['ozon'] if source_url else list(markets or STORES)
    search_text=slug_label(source_url) if source_url else query
    for market in market_list:
        label=secrets.token_hex(6)
        link=source_url if source_url and market=='ozons' else make_link(market,search_text)
        payload={'regionid':'Москва' if market=='ym' else region,'market':market,'userlabel':label,
                 'products':[{'name':search_text,'linkset':[link],'donotsearch':16 if market in ('ozon','ozons') else 12 if market=='wbs' else 0}]}
        try:
            response=unpack_pairs(provider_post('send-order',payload))
            if response.get('result')!='success':raise ValueError('Provider did not accept search')
            with LOCK:job['markets'][market]={'label':label,'state':'waiting'}
        except Exception:
            with LOCK:
                job['markets'][market]={'label':label,'state':'error'}
                job['errors'].append(market+': запрос не принят')
    with LOCK:job['submitted']=True

def poll(job):
    try:
        labels=[v['label'] for v in job['markets'].values() if v['state'] not in ('done','error')]
        if not labels:return
        for v in flatten_order_records(provider_post('get-last50',{'userlabels':labels,'limit':12})):
            label=str(v.get('userlabel',''))
            market=next((m for m,row in job['markets'].items() if row['label']==label),None)
            if not market:continue
            state=str(v.get('status','')).lower()
            if state in ('error','failed','cancelled'):
                with LOCK:
                    job['markets'][market]['state']='error'
                    job['errors'].append(market+': ошибка сбора')
                continue
            if state not in ('completed','finished'):continue
            link=v.get('report_json')
            if not isinstance(link,str) or not link:continue
            report=get_report(link)
            if not isinstance(report,dict):continue
            found=match_report_records(report,market)
            if job.get('sourceUrl') and job.get('phase')=='source' and market=='ozon':
                pid=product_id(job['sourceUrl'])
                originals=[x for x in found if product_id(x['url'])==pid]
                title=originals[0]['title'] if originals else ''
                if not title:
                    for row in report.get('data',[]) if isinstance(report.get('data'),list) else []:
                        if product_id(row.get('link'))==pid:
                            sku=row.get('sku') or {}
                            title=str(sku.get('Name_found') or '') if isinstance(sku,dict) else ''
                            if title:break
                with LOCK:
                    job['markets'][market]['state']='done'
                    job['offers'].extend({**x,'match':'source'} for x in originals[:5])
                if title:
                    with LOCK:
                        job['sourceTitle']=title
                        job['phase']='cross'
                        job['submitted']=False
                    threading.Thread(target=submit,args=(job,title,job.get('region','Москва'),None,['wbs','ym']),daemon=True).start()
                else:
                    with LOCK:
                        job['phase']='finished'
                        job['errors'].append('Невозможно подтвердить название товара из Ozon')
                continue
            source=job.get('sourceTitle')
            if source:
                found=[{**x,'match':'confirmed' if product_match(source,x['title']) else 'unverified'} for x in found]
            with LOCK:
                job['offers'].extend(found)
                job['markets'][market]['state']='done'
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
                'offers':job['offers'][:100],'errors':job['errors'][-5:],'sourceTitle':job.get('sourceTitle'),'phase':job.get('phase','search')});return
        return super().do_GET()
    def do_POST(self):
        if urlparse(self.path).path!='/api/search':self.reply(404,{'error':'not found'});return
        if not KEY or not ALLOW_CHARGES:self.reply(503,{'error':'provider not enabled'});return
        origin=self.headers.get('Origin','')
        if origin and origin not in ('http://127.0.0.1:'+str(PORT),'http://localhost:'+str(PORT)):
            self.reply(403,{'error':'cross-origin denied'});return
        if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':
            self.reply(415,{'error':'JSON required'});return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<4000:raise ValueError('size')
            d=json.loads(self.rfile.read(size))
            q=d.get('query','');region=d.get('region','Москва');source=d.get('sourceUrl')
            if not isinstance(q,str) or not isinstance(region,str) or len(region)>80:raise ValueError('query')
            if source is not None:
                source=ozon_product_link(source)
                if not source:raise ValueError('source')
            elif not 2<=len(q.strip())<=160:raise ValueError('query')
        except (ValueError,TypeError,AttributeError,json.JSONDecodeError):
            self.reply(400,{'error':'invalid query'});return
        with LOCK:
            # Limited local history to avoid memory exhaustion.
            if len(JOBS)>30:
                first=next(iter(JOBS));JOBS.pop(first,None)
            id=secrets.token_urlsafe(16);job={'markets':{},'offers':[],'errors':[],'submitted':False,'last_poll':0,'sourceUrl':source,'sourceTitle':None,'phase':'source' if source else 'search','region':region};JOBS[id]=job
        threading.Thread(target=submit,args=(job,q,region,source),daemon=True).start()
        self.reply(202,{'id':id})
if __name__=='__main__':
    print('Private Kupiora at http://127.0.0.1:'+str(PORT)+'/compare-any.html')
    print('Automated API:',bool(KEY and ALLOW_CHARGES),'(provider checks can cost money)')
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
