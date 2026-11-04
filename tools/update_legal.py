"""Daily official-source collection. Never auto-approve legal interpretations."""
import concurrent.futures,datetime,email.utils,json,re,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urljoin,urlparse
from html import unescape
ROOT=Path(__file__).resolve().parents[1]/"radar"
NOW=datetime.datetime.now(datetime.timezone.utc)
SOURCES=[("cbr","Банк России: нормативные акты","https://www.cbr.ru/rss/navr"),("fns","ФНС: нормативные документы","https://www.nalog.gov.ru/rn77/about_fts/docs/"),("minzdrav","Минздрав: банк документов","https://minzdrav.gov.ru/documents")]
def get(url):
 result=subprocess.run(["curl","--fail","--location","--silent","--show-error","--max-time","25","--max-filesize","4000000",url],capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError(result.stderr.decode(errors="replace")[:200])
 if len(result.stdout)>4000000:raise ValueError("Response exceeds 4 MB")
 return result.stdout

def classify(title):
 t=title.lower()
 if "страхован" in t and ("транспортн" in t or "осагo" in t or "осаго" in t):return "auto"
 if any(x in t for x in ["налог","деклараци","ндфл"]):return "tax"
 if any(x in t for x in ["медицинск","лекарствен","здоров","нетрудоспособност"]):return "health"
 return None

def collect(source):
 sid,title,url=source;state={"id":sid,"title":title,"url":url,"attemptedAt":NOW.isoformat()};candidates=[]
 try:
  raw=get(url)
  if sid=="cbr":
   doc=ET.fromstring(raw)
   for item in doc.findall("./channel/item"):
    link=item.findtext("link","");name=" ".join(item.findtext("title","").split());category=classify(name)
    if not category or not re.fullmatch(r"https://www\.cbr\.ru/Queries/UniDbQuery/File/90134/[0-9]+",link):continue
    date=email.utils.parsedate_to_datetime(item.findtext("pubDate"))
    if date>NOW or (NOW-date).days>730:continue
    candidates.append({"id":"cbr-"+item.findtext("guid"),"title":name,"sourceUrl":link,"categoryId":category,"publishedAt":date.date().isoformat(),"reviewState":"needs_review"})
  else:
   html=raw.decode("utf-8")
   expected=r"/about_fts/docs/[0-9]+" if sid=="fns" else r"/documents/[0-9]+"
   if not re.search(expected,html):raise ValueError("Официальный список документов не распознан; импорт не подтверждён")
   for href,body in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',html,re.I|re.S):
    name=" ".join(unescape(re.sub("<[^>]+>"," ",body)).split());link=urljoin(url,unescape(href));category=classify(name)
    host=urlparse(link).hostname
    if not category or host!=urlparse(url).hostname or not re.search(r"/(?:documents|docs)/[0-9]+",link):continue
    if not re.search(r"приказ|постановление|указание",name,re.I)or re.search(r"проект|конгресс|конференци",name,re.I):continue
    candidates.append({"id":sid+"-"+re.findall(r"[0-9]+",urlparse(link).path)[-1],"title":name,"sourceUrl":link,"categoryId":category,"reviewState":"needs_review"})
  state.update(status="ok",fetchedAt=NOW.isoformat(),candidateCount=len(candidates),message="Документы загружены; новые выжимки требуют проверки.")
 except Exception as exc:state.update(status="error",message=str(exc)[:200])
 return state,candidates

def main():
 old=json.loads((ROOT/"legal-feed.json").read_text(encoding="utf-8"));reviewed=json.loads((ROOT/"legal-reviewed.json").read_text(encoding="utf-8"));approved={x["id"]for x in reviewed}
 prior={x["id"]:x for x in old.get("sources",[])};pending={x["id"]:x for x in old.get("pending",[])if x["id"]not in approved};states=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
  for state,items in pool.map(collect,SOURCES):
   if state["status"]=="error"and prior.get(state["id"],{}).get("fetchedAt"):state["lastSuccessAt"]=prior[state["id"]]["fetchedAt"]
   states.append(state)
   for item in items:
    if item["id"]not in approved:pending[item["id"]]=item
   print(state["id"],state["status"],len(items))
 states.append({"id":"pravo","title":"Официальное опубликование","url":"https://publication.pravo.gov.ru/","status":"directory","message":"Автоматический импорт этого портала пока не подключён."})
 out={"schemaVersion":2,"jurisdiction":"RU","reviewedSnapshotAt":old.get("reviewedSnapshotAt"),"collection":{"attemptedAt":NOW.isoformat(),"schedule":"Ежедневно около 09:00 МСК","reviewRequired":True},"sources":states,"items":reviewed,"pending":list(pending.values())[:300]}
 text=json.dumps(out,ensure_ascii=False,indent=2);(ROOT/"legal-feed.json").write_text(text,encoding="utf-8")
 history=ROOT/"legal-history";history.mkdir(exist_ok=True);(history/(NOW.date().isoformat()+".json")).write_text(text,encoding="utf-8")
if __name__=="__main__":main()
