package ru.kupiora.radar;
import org.junit.Test;import static org.junit.Assert.*;import org.json.*;
public class InboxTest {
 JSONObject entry(String id)throws Exception{return new JSONObject().put("id",id).put("title","Test").put("read",false);}
 @Test public void duplicateDeliveryDoesNotInflateBadge()throws Exception{JSONArray a=Inbox.append(new JSONArray(),entry("digest:1"));a=Inbox.append(a,entry("digest:1"));assertEquals(1,a.length());assertEquals(1,Inbox.unread(a));}
 @Test public void readingOneOnlyClearsItsBadge()throws Exception{JSONArray a=Inbox.append(Inbox.append(new JSONArray(),entry("1")),entry("2"));JSONArray read=Inbox.read(a,"1");assertEquals(1,Inbox.unread(read));assertEquals(2,Inbox.unread(a));}
 @Test public void readingAllClearsBadgeWithoutDeletingHistory()throws Exception{JSONArray a=Inbox.append(Inbox.append(new JSONArray(),entry("1")),entry("2"));JSONArray read=Inbox.read(a,null);assertEquals(0,Inbox.unread(read));assertEquals(2,read.length());}
}
