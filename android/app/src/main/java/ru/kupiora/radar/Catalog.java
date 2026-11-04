package ru.kupiora.radar;
import android.content.Context;import org.json.*;import java.util.*;
final class Catalog {
 static final class Topic {final String id,title;final List<Topic> children=new ArrayList<>();Topic(String i,String t){id=i;title=t;}boolean leaf(){return children.isEmpty();}}
 static final Map<String,Topic> index=new LinkedHashMap<>();static final List<Topic> roots=new ArrayList<>();
 static synchronized void init(Context c){if(!roots.isEmpty())return;try(java.io.InputStream in=c.getAssets().open("topic-catalog.json")){java.io.ByteArrayOutputStream o=new java.io.ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)o.write(b,0,n);loadJson(o.toString("UTF-8"));}catch(Exception e){throw new IllegalStateException("Каталог тем недоступен",e);}}
 static synchronized void loadJson(String json)throws Exception {index.clear();roots.clear();JSONArray a=new JSONObject(json).getJSONArray("categories");for(int i=0;i<a.length();i++)roots.add(read(a.getJSONObject(i)));}
 static Topic read(JSONObject x)throws Exception {String id=x.getString("id");if(index.containsKey(id))throw new Exception("Duplicate topic");Topic t=new Topic(id,x.getString("title"));index.put(id,t);JSONArray a=x.optJSONArray("children");if(a!=null)for(int i=0;i<a.length();i++){JSONObject child=a.getJSONObject(i);if(!child.getString("id").startsWith(id+"."))throw new Exception("Invalid path");t.children.add(read(child));}return t;}
 static List<String> leaves(String id){List<String> out=new ArrayList<>();Topic t=index.get(id);if(t!=null){if(t.leaf())out.add(t.id);else for(Topic x:t.children)out.addAll(leaves(x.id));}return out;}
 static String rootId(String id){return id.split("\\.")[0];}
 static String parent(String id){int p=id.lastIndexOf('.');return p<0?"settings":"topic:"+id.substring(0,p);}
 static String title(String id){Topic t=index.get(id);return t==null?id:t.title;}
}
