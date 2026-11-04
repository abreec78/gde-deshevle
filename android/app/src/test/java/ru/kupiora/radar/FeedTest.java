package ru.kupiora.radar;
import org.junit.Test;import org.json.*;import static org.junit.Assert.*;
public class FeedTest {
 JSONObject item() throws Exception {return new JSONObject().put("id","test").put("title","Test").put("summary","Test summary").put("jurisdiction","RU").put("kind","normative_act").put("reviewed",true).put("categoryId","auto").put("publishedAt","2025-01-01").put("sourceUrl","https://publication.pravo.gov.ru/document/0001202501010001");}
 String feed(JSONObject...xs)throws Exception{return new JSONObject().put("schemaVersion",1).put("jurisdiction","RU").put("items",new JSONArray(xs)).toString();}
 @Test public void acceptsValidAndDeduplicates()throws Exception{assertEquals(1,Feed.parse(feed(item(),item())).size());}
 @Test public void rejectsUntrustedHostsAndHomepage()throws Exception{for(String url:new String[]{"https://publication.pravo.gov.ru.evil.test/document/1","https://pravo.gov.ru/","http://publication.pravo.gov.ru/document/1","https://evil@publication.pravo.gov.ru/document/1"})assertEquals(0,Feed.parse(feed(item().put("sourceUrl",url))).size());}
 @Test public void rejectsNewsForeignUnreviewedAndFuture()throws Exception{assertEquals(0,Feed.parse(feed(item().put("kind","news"),item().put("jurisdiction","US"),item().put("reviewed",false),item().put("publishedAt","2099-01-01"))).size());}
 @Test public void rejectsIncompleteDatesAndCategories()throws Exception{assertEquals(0,Feed.parse(feed(item().put("summary",""),item().put("categoryId","unknown"),item().put("effectiveAt","tomorrow"))).size());}
 @Test(expected=Exception.class)public void rejectsForeignFeed()throws Exception{Feed.parse(new JSONObject(feed()).put("jurisdiction","US").toString());}
}
