package ru.kupiora.radar;
import android.content.Context;import org.json.*;
final class Inbox {
 static final String KEY="notification_inbox";
 static JSONArray load(Context c){try{return new JSONArray(Store.prefs(c).getString(KEY,"[]"));}catch(Exception e){return new JSONArray();}}
 static int unread(JSONArray entries){int count=0;for(int i=0;i<entries.length();i++){JSONObject entry=entries.optJSONObject(i);if(entry!=null&&!entry.optBoolean("read"))count++;}return count;}
 static int count(Context c){return unread(load(c));}
 static JSONArray append(JSONArray old,JSONObject item){JSONArray result=new JSONArray();for(int i=0;i<old.length();i++)if(item.optString("id").equals(old.optJSONObject(i)==null?"":old.optJSONObject(i).optString("id")))return old;result.put(item);for(int i=0;i<old.length()&&result.length()<200;i++)result.put(old.opt(i));return result;}
 static synchronized boolean add(Context c,String id,String title,String body,boolean test)throws Exception {JSONArray old=load(c);JSONObject item=new JSONObject().put("id",id).put("title",title).put("body",body).put("test",test).put("read",false).put("createdAt",System.currentTimeMillis());JSONArray next=append(old,item);if(next==old)return false;if(!Store.prefs(c).edit().putString(KEY,next.toString()).commit())throw new IllegalStateException("Уведомление не удалось сохранить");return true;}
 static synchronized void importLegacy(Context c){if(Store.prefs(c).getBoolean("notification_center_initialized",false))return;try{for(android.service.notification.StatusBarNotification status:c.getSystemService(android.app.NotificationManager.class).getActiveNotifications()){android.os.Bundle extras=status.getNotification().extras;String title=String.valueOf(extras.getCharSequence(android.app.Notification.EXTRA_TITLE,"Уведомление")),body=String.valueOf(extras.getCharSequence(android.app.Notification.EXTRA_TEXT,""));add(c,"legacy:"+status.getKey()+":"+status.getPostTime(),title,body,title.startsWith("Тест"));}Store.prefs(c).edit().putBoolean("notification_center_initialized",true).commit();}catch(Exception ignored){}}
 static JSONArray read(JSONArray entries,String id)throws Exception{JSONArray result=new JSONArray(entries.toString());for(int i=0;i<result.length();i++){JSONObject x=result.getJSONObject(i);if(id==null||id.equals(x.optString("id")))x.put("read",true);}return result;}
 static synchronized void markRead(Context c,String id){try{Store.prefs(c).edit().putString(KEY,read(load(c),id).toString()).commit();SyncJob.updateSystemBadge(c);}catch(Exception ignored){}}
}
