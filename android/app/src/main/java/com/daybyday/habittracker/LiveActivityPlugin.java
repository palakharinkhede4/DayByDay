package com.daybyday.habittracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiveActivityPlugin")
public class LiveActivityPlugin extends Plugin {
    private static final String CHANNEL_ID = "daybyday_live_channel";
    private static final int NOTIFICATION_ID = 4040;
    private NotificationManager notificationManager;

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Context context = getContext();
            CharSequence name = "DayByDay Habit Focus";
            String description = "Ongoing live habit tracking progress and partner sync";
            int importance = NotificationManager.IMPORTANCE_HIGH; // High importance for ongoing focus and HyperOS dynamic island
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.setShowBadge(true);
            channel.enableVibration(false);

            notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        } else {
            notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        }
    }

    @PluginMethod
    public void startLiveActivity(PluginCall call) {
        updateNotification(call);
    }

    @PluginMethod
    public void updateLiveActivity(PluginCall call) {
        updateNotification(call);
    }

    private void updateNotification(PluginCall call) {
        try {
            Context context = getContext();
            if (notificationManager == null) {
                createNotificationChannel();
            }

            String habitName = call.getString("habitName", "Daily Habit");
            String icon = call.getString("icon", "");
            double currentValue = call.getDouble("currentValue", 0.0);
            double targetValue = call.getDouble("targetValue", 1.0);
            String unit = call.getString("unit", "units");
            int streak = call.getInt("streak", 1);
            int partnerPercent = call.getInt("partnerProgressPercent", -1);
            String partnerUsername = call.getString("partnerUsername", "");
            boolean isCompleted = call.getBoolean("isCompleted", false);

            int progressPercent = (int) Math.round(targetValue > 0 ? Math.min(100.0, (currentValue / targetValue) * 100.0) : 0);

            // Intent to return to the app when notification is tapped
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            String title = habitName + " • " + progressPercent + "% (" + formatVal(currentValue) + "/" + formatVal(targetValue) + " " + unit + ")";
            String partnerInfo = (partnerUsername != null && !partnerUsername.isEmpty() && partnerPercent >= 0)
                ? " | @" + partnerUsername + ": " + partnerPercent + "%"
                : "";
            String contentText = (isCompleted ? "Goal completed" : streak + " day streak") + partnerInfo;

            // HyperOS Super Island / Focus Notification payload
            String hyperOsPayload = String.format(
                "{\"param_v2\":{\"business\":\"sport\",\"updatable\":true,\"param_island\":{\"title\":\"%s\",\"content\":\"%d%% completed\",\"progress\":%d}}}",
                habitName.replace("\"", "\\\""),
                progressPercent,
                progressPercent
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_agenda)
                .setContentTitle(title)
                .setContentText(contentText)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setProgress(100, progressPercent, false)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(pendingIntent);

            // Attach HyperOS & MIUI Super Island focus extras
            builder.getExtras().putString("miui.focus.param", hyperOsPayload);
            builder.getExtras().putBoolean("miui.enableFloat", true);
            builder.getExtras().putBoolean("miui.showFloat", true);

            if (notificationManager != null) {
                notificationManager.notify(NOTIFICATION_ID, builder.build());
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("progressPercent", progressPercent);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update Android live activity: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopLiveActivity(PluginCall call) {
        try {
            if (notificationManager != null) {
                notificationManager.cancel(NOTIFICATION_ID);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to cancel live activity: " + e.getMessage(), e);
        }
    }

    private String formatVal(double val) {
        if (val == (long) val) {
            return String.format("%d", (long) val);
        } else {
            return String.format("%.1f", val);
        }
    }
}
