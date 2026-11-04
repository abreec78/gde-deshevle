package ru.kupiora.radar;
import android.app.*;import android.app.job.*;import android.content.*;import android.os.*;import org.json.*;import java.util.*;
public class SyncJob extends JobService {
 static final String CHANNEL="official_changes";
 static void schedule(Context c){((JobScheduler)c.getSystemService(JOB_SCHEDULER_SERVICE)).schedule(new JobInfo.Builder(101,new ComponentName(c,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(24*60*60*1000L).setPersisted(true).build());}
 public boolean onStartJob(JobParameters p){sync(this,()->jobFinished(p,false));return true;}
 public boolean onStopJob(JobParameters p){return true;}
 static void sync(Context c,Runnable done){new Thread(()->{try{
 // Set only after a reviewed normative feed is deployed. Do not reuse the general news feed.
 Catalog.init(c);String endpoint=Store.prefs(c).getString("feed_endpoint","https://kupiora.ru/radar/legal-feed.json");if(endpoint.isEmpty())throw new Exception("Поток официальных изменений ещё не подключён");
 java.net.URL url=new java.net.URL(endpoint);if(!url.getProtocol().equals("https"))throw new Exception("Требуется HTTPS");
 java.net.HttpURLConnection conn=(java.net.HttpURLConnection)url.openConnection();conn.setConnectTimeout(15000);conn.setReadTimeout(15000);String json;try{if(conn.getResponseCode()!=200)throw new Exception("Сервер временно недоступен");try(java.io.InputStream in=conn.getInputStream()){java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[8192];int len;while((len=in.read(chunk))!=-1){buffer.write(chunk,0,len);if(buffer.size()>2_000_000)throw new Exception("Слишком большой ответ");}byte[] data=buffer.toByteArray();if(data.length>2_000_000)throw new Exception("Слишком большой ответ");json=new String(data,java.nio.charset.StandardCharsets.UTF_8);}}finally{conn.disconnect();}
 java.util.List<JSONObject> items=Feed.parse(json);synchronized(SyncJob.class){Set<String>seen=new HashSet<>(Store.prefs(c).getStringSet("seen",new HashSet<>()));boolean baseline=Store.prefs(c).getBoolean("has_baseline",false);
 Set<String> pending=new HashSet<>(Store.prefs(c).getStringSet("digest_pending",new HashSet<>()));
 for(JSONObject x:items){String id=x.getString("id");if(baseline&&!seen.contains(id)&&Store.matches(c,x))pending.add(id);seen.add(id);}
 Store.prefs(c).edit().putString("feed",json).putStringSet("seen",seen).putStringSet("digest_pending",pending).putBoolean("has_baseline",true).putString("sync_status","Последняя загрузка: "+java.time.LocalDateTime.now().withSecond(0).withNano(0)).apply();
 deliverDigest(c,items);}
 }catch(Exception e){Store.prefs(c).edit().putString("sync_status",e.getMessage()==null?"Обновление недоступно":e.getMessage()).apply();}finally{try{deliverDigest(c,Feed.parse(Store.feed(c)));}catch(Exception ignored){}done.run();}}).start();}
 static synchronized void deliverDigest(Context c,java.util.List<JSONObject> items)throws Exception {
 android.content.SharedPreferences prefs=Store.prefs(c);long now=System.currentTimeMillis(),previous=prefs.getLong("digest_last",0);if(previous==0){prefs.edit().putLong("digest_last",now).apply();return;}
 String interval=prefs.getString("digest_interval","daily");if(!DigestPolicy.isDue(previous,now,interval,java.time.ZoneId.systemDefault()))return;
 Set<String> pending=new HashSet<>(prefs.getStringSet("digest_pending",new HashSet<>()));java.util.List<JSONObject> eligible=new java.util.ArrayList<>();for(JSONObject x:items)if(pending.contains(x.getString("id"))&&Store.matches(c,x))eligible.add(x);
 if(eligible.isEmpty()){prefs.edit().putStringSet("digest_pending",new HashSet<>()).putLong("digest_last",now).apply();return;}
 if(!c.getSystemService(NotificationManager.class).areNotificationsEnabled())return;
 StringBuilder summary=new StringBuilder();for(int i=0;i<Math.min(3,eligible.size());i++)summary.append("• ").append(eligible.get(i).getString("title")).append("\n");
 notify(c,101,"Радар жизни · новых изменений: "+eligible.size(),summary.toString().trim());
 prefs.edit().putStringSet("digest_pending",new HashSet<>()).putLong("digest_last",now).apply();
 }
 static void notify(Context c,int id,String title,String summary){NotificationManager nm=c.getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Официальные изменения",NotificationManager.IMPORTANCE_DEFAULT));if(!nm.areNotificationsEnabled())return;PendingIntent pi=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).putExtra("open_feed",true),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);try{nm.notify(id,new Notification.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(summary).setStyle(new Notification.BigTextStyle().bigText(summary)).setContentIntent(pi).setAutoCancel(true).build());}catch(SecurityException ignored){}}
 static void testNotification(Context c){if(!c.getSystemService(NotificationManager.class).areNotificationsEnabled()){android.widget.Toast.makeText(c,"Сначала разрешите уведомления",android.widget.Toast.LENGTH_LONG).show();return;}notify(c,999,"Тест · Радар жизни","Это проверка уведомлений, а не изменение закона.");}
}
