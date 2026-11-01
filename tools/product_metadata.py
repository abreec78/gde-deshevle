"""Read public product metadata without bypassing access restrictions or charging APIs."""
import json
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

HOSTS={'ozon.ru','www.ozon.ru','wildberries.ru','www.wildberries.ru','market.yandex.ru','www.citilink.ru','citilink.ru'}
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args): return None

def allowed(url):
    try:
        p=urlparse(url)
        return p.scheme=='https' and p.hostname in HOSTS and not p.username and not p.password and p.port in (None,443)
    except ValueError: return False

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta={}; self.scripts=[]; self.active=False; self.buf=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='meta': self.meta[a.get('property') or a.get('name','')]=a.get('content','')
        if tag=='script' and a.get('type')=='application/ld+json': self.active=True; self.buf=''
    def handle_data(self,data):
        if self.active:self.buf+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.active:self.scripts.append(self.buf);self.active=False

def products(value):
    if isinstance(value,list):
        for v in value: yield from products(v)
    elif isinstance(value,dict):
        kind=value.get('@type',[])
        if kind=='Product' or isinstance(kind,list) and 'Product' in kind:yield value
        if '@graph' in value:yield from products(value['@graph'])

def parse_metadata(html,url):
    p=Metadata();p.feed(html)
    for script in p.scripts:
        try:
            for v in products(json.loads(script)):
                name=v.get('name');image=v.get('image')
                if isinstance(image,list):image=image[0] if image else None
                if isinstance(image,dict):image=image.get('url')
                if isinstance(name,str) and name.strip():
                    return {'identified':True,'title':name.strip()[:300],'image':image if isinstance(image,str) and image.startswith('https://') else None,'mpn':str(v.get('mpn') or '')[:100],'gtin':str(v.get('gtin13') or v.get('gtin') or '')[:30],'url':url,'source':'public-product-metadata','offers':[]}
        except (ValueError,TypeError):continue
    # Generic titles and Open Graph alone do not prove this is a product page.
    return {'identified':False,'reason':'Public product metadata was not available','url':url,'offers':[]}

def identify(url):
    if not allowed(url):return {'identified':False,'reason':'Unsupported product URL','offers':[]}
    opener=build_opener(NoRedirect())
    for _ in range(5):
        try:
            with opener.open(Request(url,headers={'User-Agent':'KupioraMetadata/1.0','Accept':'text/html'}),timeout=8) as r:
                if 'text/html' not in r.headers.get('Content-Type',''):break
                raw=r.read(1500001)
                if len(raw)>1500000:break
                return parse_metadata(raw.decode(r.headers.get_content_charset() or 'utf-8',errors='replace'),url)
        except HTTPError as e:
            code=e.code;location=e.headers.get('Location');e.close()
            if code in (301,302,303,307,308) and location:
                target=urljoin(url,location)
                if allowed(target):url=target;continue
            break
        except (URLError,OSError,ValueError):break
    return {'identified':False,'reason':'Store did not provide an accessible public product page','url':url,'offers':[]}
