package ru.kupiora.radar;
import java.time.*;
final class DigestPolicy {
 static final String[] IDS={"daily","three_days","weekly","monthly"};
 static final String[] NAMES={"Раз в день","Раз в три дня","Раз в неделю","Раз в месяц"};
 static ZonedDateTime due(long previous,String frequency,ZoneId zone){ZonedDateTime base=Instant.ofEpochMilli(previous).atZone(zone);switch(frequency){case "three_days":return base.plusDays(3);case "weekly":return base.plusWeeks(1);case "monthly":return base.plusMonths(1);default:return base.plusDays(1);}}
 static boolean shouldQueue(org.json.JSONObject item,boolean baseline,java.util.Set<String> seen,java.util.Set<String> chosen){return baseline&&!seen.contains(item.optString("id"))&&!item.optBoolean("archive")&&Store.matchesSelection(chosen,item);}
 static boolean isDue(long previous,long now,String frequency,ZoneId zone){return !Instant.ofEpochMilli(now).isBefore(due(previous,frequency,zone).toInstant());}
}
