"""Authorized YML feeds -> SQLite history -> public catalogue. Python stdlib only.

Feed URLs/credentials stay in SOURCE_FEEDS_JSON, never in exported catalogue/logs.
No scraping, merchant seller API impersonation or deployment is performed.
"""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
import xml.etree.ElementTree as ET

MAX_BYTES = 20 * 1024 * 1024
TTL = timedelta(hours=24)
CATEGORIES = ['Электроника','Компьютеры и комплектующие','Бытовая техника','Смартфоны и гаджеты','Телевизоры и видео','Аудио','Дом и сад','Инструменты','Автотовары','Спорт и отдых','Детские товары','Красота и здоровье']

def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return result if result.tzinfo else result.replace(tzinfo=timezone(timedelta(hours=3)))

def amount(value):
    try:
        result = Decimal(str(value))
        if not result.is_finite() or result < 0 or result > 100_000_000:
            raise ValueError('invalid_money')
        return float(result.quantize(Decimal('0.01')))
    except (InvalidOperation, TypeError):
        raise ValueError('invalid_money') from None

def public_url(url, allowed_hosts=None):
    try:
        p = urlsplit(url)
        if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None,443):
            return False
        if p.hostname == 'localhost' or p.hostname.endswith('.local'):
            return False
        try:
            if not ipaddress.ip_address(p.hostname).is_global:
                return False
        except ValueError:
            pass
        return not allowed_hosts or p.hostname in allowed_hosts
    except (ValueError, AttributeError):
        return False

def product_key(source, external_id, brand, mpn, gtin, params):
    # Exact identifiers only. Capacity, colour and bundle prevent variant merging.
    variant = sorted((k.casefold(), v.casefold()) for k,v in params.items() if any(x in k.casefold() for x in ['объем','объём','capacity','цвет','color','комплект','bundle']))
    norm = lambda s: re.sub(r'\s+', '', s.casefold())
    if gtin and re.fullmatch(r'\d{8}|\d{12,14}', gtin):
        digits = list(map(int, gtin))
        check = (10 - sum(n*(3 if i%2==0 else 1) for i,n in enumerate(reversed(digits[:-1])))%10)%10
        identity = ['gtin',gtin] if check == digits[-1] else ['source',source,external_id]
    elif brand and mpn:
        identity = ['mpn',norm(brand),norm(mpn)]
    else:
        identity = ['source',source,external_id]
    return 'live:'+hashlib.sha256(json.dumps([identity,variant],ensure_ascii=False).encode()).hexdigest()[:24]

def parse_yml(raw, config, now):
    if len(raw)>MAX_BYTES or b'\x00' in raw or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('unsafe_xml')
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        raise ValueError('invalid_xml') from None
    if root.tag != 'yml_catalog' or not root.get('date'):
        raise ValueError('missing_feed_timestamp')
    updated = timestamp(root.get('date'))
    if updated > now+timedelta(minutes=5) or now-updated > TTL:
        raise ValueError('stale_feed')
    shop = root.find('shop')
    if shop is None:
        raise ValueError('missing_shop')
    expiry = min(updated+TTL, now+TTL)
    records, rejected = [], 0
    for item in shop.findall('./offers/offer'):
        try:
            ext = item.get('id','')
            title = item.findtext('name') or ' '.join(filter(None,[item.findtext('typePrefix'),item.findtext('vendor'),item.findtext('model')]))
            currency = item.findtext('currencyId')
            price = amount(item.findtext('price'))
            url = item.findtext('url','').strip()
            image = item.findtext('picture','').strip()
            if not ext or not title or len(title)>500 or currency not in ('RUB','RUR') or not public_url(url,config['productHosts']) or not public_url(image,config['imageHosts']):
                raise ValueError('invalid_offer')
            params = {p.get('name','')[:100]:((p.text or '').strip()+(' '+p.get('unit') if p.get('unit') else ''))[:300] for p in item.findall('param') if p.get('name')}
            brand = (item.findtext('vendor') or '').strip()[:100]
            mpn = (item.findtext('vendorCode') or '').strip()[:100]
            category = config.get('categoryMap',{}).get(item.findtext('categoryId'),config.get('category'))
            if category not in CATEGORIES:
                raise ValueError('unmapped_category')
            shipping = None
            if config.get('deliveryVerified') is True:
                options = item.find('delivery-options')
                if options is None:
                    options = shop.find('delivery-options')
                costs = {amount(o.get('cost')) for o in options.findall('option')} if options is not None else set()
                # Ambiguous destination/tier-dependent shipping stays unknown.
                if len(costs)==1:
                    shipping = costs.pop()
            pid = product_key(config['id'],ext,brand,mpn,item.findtext('barcode',''),params)
            record = {'product':{'id':pid,'name':title,'category':category,'brand':brand,'mpn':mpn,'imageUrl':image,'specs':[f'{k}: {v}' for k,v in sorted(params.items())][:12]},
                      'offer':{'id':config['id']+':'+ext,'source':config['id'],'shop':config['merchant'],'price':price,'delivery':shipping,'currency':'RUB','url':url,'checkedAt':iso(now),'sourceUpdatedAt':iso(updated),'validUntil':iso(expiry),'region':config['region'],'available':{'true':True,'false':False}.get(item.get('available'))}}
            capacity = next((v for k,v in params.items() if any(x in k.casefold() for x in ('объем','объём','capacity'))),None)
            if capacity:
                record['product']['capacity'] = re.sub(r'\s*(TB|ТБ)\s*$', ' ТБ',re.sub(r'\s*(GB|ГБ)\s*$',' ГБ',capacity,flags=re.I),flags=re.I).strip()
            interface = next((v for k,v in params.items() if 'интерфейс' in k.casefold() or 'interface' in k.casefold()),None)
            if interface: record['product']['interface'] = 'NVMe' if 'nvme' in interface.casefold() else 'SATA' if 'sata' in interface.casefold() else interface
            records.append(record)
        except (ValueError, TypeError):
            rejected += 1
    if not records:
        raise ValueError('no_valid_offers')
    return records, rejected


def parse_citilink(raw, config, now):
    # The full Adv.Cake catalogue is large; export only configured categories.
    if len(raw) > 160 * 1024 * 1024 or b'\x00' in raw or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('unsafe_xml')
    root = ET.fromstring(raw)
    shop = root.find('shop')
    if root.tag != 'yml_catalog' or shop is None:
        raise ValueError('missing_shop')
    currencies = shop.findall('./currencies/currency')
    default_currency = currencies[0].get('id') if len(currencies) == 1 and currencies[0].get('id') in ('RUR', 'RUB') and currencies[0].get('rate') == '1' else None
    offers = shop.find('offers')
    if offers is None:
        raise ValueError('missing_offers')
    seen = {}
    conflicts = set()
    for offer in list(offers):
        if offer.findtext('categoryId') not in config.get('categoryMap', {}):
            offers.remove(offer)
            continue
        identity = offer.get('id')
        payload = [(e.tag, sorted(e.attrib.items()), (e.text or '').strip()) for e in offer.iter()]
        if identity in seen:
            previous, previous_payload = seen[identity]
            if previous_payload != payload:
                conflicts.add(identity)
            offers.remove(offer)
            continue
        seen[identity] = (offer, payload)
    for identity, (offer, _) in seen.items():
        if identity in conflicts:
            offers.remove(offer)
        elif offer.find('currencyId') is None and default_currency:
            ET.SubElement(offer, 'currencyId').text = default_currency
    return parse_yml(ET.tostring(root, encoding='utf-8'), config, now)

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('redirect_requires_explicit_feed_url')

def fetch_feed(config):
    url = config['url']
    if not public_url(url,config['feedHosts']):
        raise ValueError('feed_host_not_allowed')
    # Reject private network endpoints before opening a connection.
    for info in socket.getaddrinfo(urlsplit(url).hostname,443,type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError('private_feed_host')
    headers={'User-Agent':'GdeDeshevleFeedImporter/1.0','Accept':'application/xml,text/xml'}
    if config.get('authorizationEnv'):
        variable=config['authorizationEnv']
        if not re.fullmatch(r'[A-Z][A-Z0-9_]{0,80}',variable) or not os.environ.get(variable):
            raise ValueError('missing_feed_authorization')
        headers['Authorization']=os.environ[variable]
    request = Request(url,headers=headers)
    with build_opener(NoRedirect()).open(request,timeout=20) as response:
        limit = 160 * 1024 * 1024 if config.get('adapter') == 'citilink-yml' else MAX_BYTES
        raw = response.read(limit+1)
    if len(raw)>limit: raise ValueError('feed_too_large')
    return raw

def init_db(db):
    db.executescript('''
      CREATE TABLE IF NOT EXISTS feed_offers(source TEXT, external_id TEXT, product_id TEXT, payload TEXT, checked_at TEXT, active INTEGER, PRIMARY KEY(source,external_id));
      CREATE TABLE IF NOT EXISTS observations(offer_id TEXT, observed_at TEXT, price REAL, delivery REAL, region TEXT, product_id TEXT, UNIQUE(offer_id,observed_at));
      CREATE TABLE IF NOT EXISTS import_runs(source TEXT, observed_at TEXT, status TEXT, accepted INTEGER, rejected INTEGER);
    ''')
    if 'product_id' not in {r[1] for r in db.execute('PRAGMA table_info(observations)')}:
        db.execute('ALTER TABLE observations ADD COLUMN product_id TEXT')

ADAPTERS = {'yml': parse_yml, 'citilink-yml': parse_citilink}

def ingest(db, config, raw, now):
    parser = ADAPTERS[config.get('adapter','yml')]
    records, rejected = parser(raw,config,now)
    ids = [r['offer']['id'] for r in records]
    if len(ids)!=len(set(ids)): raise ValueError('duplicate_offer_ids')
    with db:
        db.execute('UPDATE feed_offers SET active=0 WHERE source=?',(config['id'],))
        for record in records:
            o = record['offer']
            db.execute('INSERT OR REPLACE INTO feed_offers VALUES(?,?,?,?,?,1)',(config['id'],o['id'],record['product']['id'],json.dumps(record,ensure_ascii=False),iso(now)))
            db.execute('INSERT OR IGNORE INTO observations(offer_id,observed_at,price,delivery,region,product_id) VALUES(?,?,?,?,?,?)',(o['id'],iso(now),o['price'],o['delivery'],o['region'],record['product']['id']))
        db.execute('INSERT INTO import_runs VALUES(?,?,?,?,?)',(config['id'],iso(now),'ok',len(records),rejected))
    return len(records), rejected

def export(db, now, statuses, allowed_sources=None):
    products = {}
    for source,payload in db.execute('SELECT source,payload FROM feed_offers WHERE active=1 ORDER BY product_id,source,external_id'):
        if allowed_sources is not None and source not in allowed_sources: continue
        record = json.loads(payload); o = record['offer']
        if timestamp(o['validUntil'])<=now or o['available'] is False: continue
        p = products.setdefault(record['product']['id'],dict(record['product'],offers=[]))
        p['offers'].append(o)
    for p in products.values():
        # Per-offer histories, not a synthetic line joining unlike offers.
        p['history'] = {}
        for o in p['offers']:
            points = db.execute('SELECT observed_at,price,delivery,region FROM observations WHERE offer_id=? AND region=? AND product_id=? ORDER BY observed_at DESC LIMIT 365',(o['id'],o['region'],p['id'])).fetchall()[::-1]
            p['history'][o['id']] = [{'at':t,'price':v,'delivery':s,'region':r} for t,v,s,r in points]
    return {'schemaVersion':1,'mode':'live','generatedAt':iso(now),'sources':statuses,'products':list(products.values())}

def run(configs, db_path, output, now=None):
    now = now or datetime.now(timezone.utc)
    if len({c.get('region') for c in configs})>1:
        raise ValueError('one_region_per_snapshot_required')
    for config in configs:
        if not re.fullmatch(r'[a-z0-9-]{1,40}',config.get('id','')) or config.get('authorized') is not True:
            raise ValueError('source_requires_explicit_authorization')
        if not all(config.get(k) for k in ['merchant','region','feedHosts','productHosts','imageHosts']):
            raise ValueError('incomplete_source_config')
        if config.get('adapter','yml') not in ADAPTERS: raise ValueError('unsupported_adapter')
        if not all(isinstance(config[k],list) and all(isinstance(h,str) and h for h in config[k]) for k in ['feedHosts','productHosts','imageHosts']):
            raise ValueError('invalid_host_allowlist')
    if len({c['id'] for c in configs})!=len(configs):raise ValueError('duplicate_source_ids')
    Path(db_path).parent.mkdir(parents=True,exist_ok=True)
    db = sqlite3.connect(db_path); init_db(db); statuses=[]
    for config in configs:
        try:
            count,rejected=ingest(db,config,fetch_feed(config),now)
            statuses.append({'id':config['id'],'name':config['merchant'],'status':'ok','checkedAt':iso(now),'accepted':count,'rejected':rejected})
        except Exception:
            # Never expose raw exceptions: URLs may contain authentication parameters.
            with db: db.execute('INSERT INTO import_runs VALUES(?,?,?,?,?)',(config['id'],iso(now),'error',0,0))
            statuses.append({'id':config['id'],'name':config['merchant'],'status':'error','checkedAt':iso(now)})
    result=export(db,now,statuses,{c['id'] for c in configs})
    path=Path(output);path.parent.mkdir(parents=True,exist_ok=True)
    db.close()
    body=json.dumps(result,ensure_ascii=False,indent=2)
    if len(body.encode('utf-8'))>4*1024*1024:raise ValueError('public_catalog_too_large')
    temp=path.with_suffix('.tmp');temp.write_text(body,encoding='utf-8');temp.replace(path)
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--db',default='work/catalog.sqlite');parser.add_argument('--output',default='data/catalog.json');args=parser.parse_args()
    try:
        configs=json.loads(os.environ.get('SOURCE_FEEDS_JSON','[]'))
        if not isinstance(configs,list) or len(configs)>10: raise ValueError('invalid_config')
        result=run(configs,args.db,args.output)
        print(json.dumps({'sources':len(result['sources']),'products':len(result['products']),'errors':sum(s['status']=='error' for s in result['sources'])}))
        if any(s['status']=='error' for s in result['sources']): raise SystemExit(1)
    except (ValueError,KeyError):
        print('Source configuration/feed invalid. Secret values have not been logged.')
        raise SystemExit(2)
