"""Daily official-source collection. Never auto-approve legal interpretations."""
import hashlib,concurrent.futures,datetime,email.utils,json,re,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urljoin,urlparse
from html import unescape
ROOT=Path(__file__).resolve().parents[1]/"radar"
NOW=datetime.datetime.now(datetime.timezone.utc)
SOURCES=[("cbr","Банк России: нормативные акты","https://www.cbr.ru/rss/navr"),("fns","ФНС: нормативные документы","https://www.nalog.gov.ru/rn77/about_fts/docs/"),("minzdrav","Минздрав: банк документов","https://minzdrav.gov.ru/documents"),("sfr","Социальный фонд: семья, пенсии и пособия","https://sfr.gov.ru/order/")]
def get(url):
 result=subprocess.run(["curl","--fail","--location","--silent","--show-error","--max-time","25","--max-filesize","4000000",url],capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError(result.stderr.decode(errors="replace")[:200])
 if len(result.stdout)>4000000:raise ValueError("Response exceeds 4 MB")
 return result.stdout

def classify(title):
 t=title.lower().replace("ё","е")
 rules=[("auto",["осаго","транспортных средств","водительск"]),("tax",["налог","деклараци","ндфл"]),("health",["медицинск","лекарствен","здравоохран","омс"]),("education",["образован","школ","экзамен","егэ"]),("family",["семейн","материнск","рождени","детей","ребенка"]),("benefits",["пенси","пособи","социальных выплат","инвалид"]),("housing",["ипотек","жилищ","коммунальн","жилых помещений"]),("work",["трудов","работодател","заработн","нетрудоспособност"]),("consumer",["потребительск","кредит","заемщик","заемщика"]),("digital",["персональных данных","электронной подписи","связи"]),("environment",["эколог","отход","окружающей среды"]),("business",["предпринимател","юридических лиц","кредитных организац","некредитных финансовых"])]
 for category,words in rules:
  if any(word in t for word in words):return category
 return None

def anchors(raw,base):
 for href,body in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',raw.decode("utf-8"),re.I|re.S):
  name=" ".join(unescape(re.sub("<[^>]+>"," ",body)).split())
  yield urljoin(base,unescape(href)),name

def sfr_documents(raw,base,default):
 result=[]
 for link,name in anchors(raw,base):
  if urlparse(link).hostname!="sfr.gov.ru" or not re.fullmatch(r"/order/[a-zA-Z0-9_/]+~[0-9]+/?",urlparse(link).path):continue
  if not re.search(r"федеральный закон|приказ|постановление|указ президента",name,re.I)or re.search(r"проект|письмо",name,re.I):continue
  item={"id":"sfr-"+link.rstrip("/").split("~")[-1],"title":name,"sourceUrl":link,"categoryId":classify(name)or default,"reviewState":"needs_review"}
  signed=re.search(r"от\s+(\d{2})\.(\d{2})\.(\d{4})",name)
  if signed:
   try:item["signedAt"]=datetime.date(int(signed[3]),int(signed[2]),int(signed[1])).isoformat()
   except ValueError:pass
  result.append(item)
 return result

def collect(source):
 sid,title,url=source;state={"id":sid,"title":title,"url":url,"attemptedAt":NOW.isoformat()};candidates=[]
 try:
  raw=get(url)
  if sid=="sfr":
   pages=[("families","family"),("organization_appointment_payme","benefits"),("temporary_disability/government_resolutions/","work")];errors=[];success=0
   for path,category in pages:
    try:
     page=urljoin(url,path);found=sfr_documents(get(page),page,category)
     if not found:raise ValueError("Список актов не распознан")
     candidates.extend(found);success+=1
    except Exception as exc:errors.append(path+": "+str(exc)[:120])
   if not success:raise ValueError("; ".join(errors))
   state["sectionsChecked"]=success;state["sectionsTotal"]=len(pages)
   if errors:state["sectionErrors"]=errors
  elif sid=="cbr":
   doc=ET.fromstring(raw)
   for item in doc.findall("./channel/item"):
    link=item.findtext("link","");name=" ".join(item.findtext("title","").split());category=classify(name)or "unassigned"
    if not re.fullmatch(r"https://www\.cbr\.ru/Queries/UniDbQuery/File/90134/[0-9]+",link):continue
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
  state.update(status="partial" if state.get("sectionErrors") else "ok",fetchedAt=NOW.isoformat(),candidateCount=len(candidates),message="Документы загружены; выжимки требуют проверки. Дата принятия не считается датой публикации.")
 except Exception as exc:state.update(status="error",message=str(exc)[:200])
 return state,candidates

def main():
 old=json.loads((ROOT/"legal-feed.json").read_text(encoding="utf-8"));reviewed=json.loads((ROOT/"legal-reviewed.json").read_text(encoding="utf-8"));approved={x["id"]for x in reviewed};approved_urls={x["sourceUrl"]for x in reviewed}
 prior={x["id"]:x for x in old.get("sources",[])};pending={x["id"]:x for x in old.get("pending",[])if x["id"]not in approved and x.get("sourceUrl")not in approved_urls};states=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
  for state,items in pool.map(collect,SOURCES):
   if state["status"]=="error"and prior.get(state["id"],{}).get("fetchedAt"):state["lastSuccessAt"]=prior[state["id"]]["fetchedAt"]
   states.append(state)
   for item in items:
    if item["id"]not in approved and item.get("sourceUrl")not in approved_urls:
     previous=pending.get(item["id"],{});item["firstSeenAt"]=previous.get("firstSeenAt",NOW.isoformat());item["lastSeenAt"]=NOW.isoformat();item["contentHash"]=hashlib.sha256((item["title"]+"|"+item["sourceUrl"]).encode()).hexdigest();pending[item["id"]]=item
   print(state["id"],state["status"],len(items))
 states.append({"id":"pravo","title":"Официальное опубликование","url":"https://publication.pravo.gov.ru/","status":"directory","message":"Автоматический импорт этого портала пока не подключён."})
 out={"schemaVersion":2,"jurisdiction":"RU","reviewedSnapshotAt":old.get("reviewedSnapshotAt"),"collection":{"attemptedAt":NOW.isoformat(),"schedule":"Ежедневно около 09:00 МСК","reviewRequired":True,"pendingTotal":len(pending),"pendingLimit":500},"sources":states,"items":reviewed,"pending":sorted(pending.values(),key=lambda x:(x.get("publishedAt")or x.get("signedAt")or "",x["id"]),reverse=True)[:500]}
 text=json.dumps(out,ensure_ascii=False,indent=2);(ROOT/"legal-feed.json").write_text(text,encoding="utf-8")
 history=ROOT/"legal-history";history.mkdir(exist_ok=True);(history/(NOW.date().isoformat()+".json")).write_text(text,encoding="utf-8")
if __name__=="__main__":main()
