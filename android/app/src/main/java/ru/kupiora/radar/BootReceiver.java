package ru.kupiora.radar;
import android.content.*;
public class BootReceiver extends BroadcastReceiver {public void onReceive(Context c,Intent i){if(Store.prefs(c).getBoolean("onboarded",false))SyncJob.schedule(c);}}
