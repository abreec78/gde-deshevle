package ru.kupiora.radar;
import org.json.*;
import java.net.URI;
import java.util.*;
final class Feed {
 static final String[] IDS={"auto","education","tax","housing","health","work","family","business","benefits","consumer","digital","environment"};
 static final String[] NAMES={"Автомобиль","Школа и образование","Налоги","Жильё и ЖКХ","Здоровье","Работа","Семья","Бизнес и самозанятость","Пенсии и выплаты","Покупки и права","Связь и данные","Экология"};
 static List<JSONObject> parse(String json) throws Exception {
 JSONObject root=new JSONObject(json); if((root.optInt("schemaVersion")!=1&&root.optInt("schemaVersion")!=2)||!"RU".equals(root.optString("jurisdiction")))throw new Exception("Unsupported feed");
 List<JSONObject> out=new ArrayList<>(); Set<String> seen=new HashSet<>(); JSONArray a=root.getJSONArray("items");
 for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;
 try {URI u=new URI(x.getString("sourceUrl"));String h=u.getHost();String path=u.getPath();
 boolean allowed=h!=null&&path!=null&&((h.equals("publication.pravo.gov.ru")||h.equals("pravo.gov.ru"))&&path.matches("/document/[0-9]+/?")||(h.equals("www.cbr.ru")||h.equals("cbr.ru"))&&path.matches("/Queries/UniDbQuery/File/90134/[0-9]+")||h.equals("www.nalog.gov.ru")&&path.matches("/rn[0-9]+/about_fts/docs/[0-9]+/"));
 if(!"https".equals(u.getScheme())||u.getUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443)||!allowed)continue;
 if(!"RU".equals(x.optString("jurisdiction"))||!"normative_act".equals(x.optString("kind"))||!x.optBoolean("reviewed"))continue;
 String id=x.getString("id");if(id.trim().isEmpty()||x.getString("title").trim().isEmpty()||x.getString("summary").trim().isEmpty()||!Arrays.asList(IDS).contains(x.getString("categoryId")))continue;
 if(root.optInt("schemaVersion")==2){JSONArray tags=x.optJSONArray("topicIds");if(tags==null||tags.length()==0)continue;boolean valid=true;for(int j=0;j<tags.length();j++){String tag=tags.optString(j);if(!tag.startsWith(x.getString("categoryId")+".")||!Catalog.index.containsKey(tag))valid=false;}if(!valid)continue;}
 java.time.LocalDate date=java.time.LocalDate.parse(x.getString("publishedAt"));if(date.isAfter(java.time.LocalDate.now()))continue;
 if(!x.optString("effectiveAt").isEmpty())java.time.LocalDate.parse(x.getString("effectiveAt"));
 if(seen.add(id))out.add(x);
 }catch(Exception ignored){} }
 out.sort((a1,b)->b.optString("publishedAt").compareTo(a1.optString("publishedAt")));return out;
 }
}
