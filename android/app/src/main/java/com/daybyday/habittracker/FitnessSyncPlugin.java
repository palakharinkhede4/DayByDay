package com.daybyday.habittracker;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import org.json.JSONObject;
import java.util.Iterator;

@CapacitorPlugin(
    name = "FitnessSync",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACTIVITY_RECOGNITION },
            alias = "activityRecognition"
        )
    }
)
public class FitnessSyncPlugin extends Plugin {

    private static final String PREFS_NAME = "daybyday_fitness_prefs";
    private static final String KEY_BASELINE_DATE = "baseline_date";
    private static final String KEY_BASELINE_STEPS = "baseline_steps";
    private static final String KEY_LAST_STEPS = "last_known_steps";
    private static final String KEY_STEP_HISTORY = "step_history_json";
    private static final String KEY_MANUAL_OFFSET = "manual_step_offset";
    private static final String KEY_FITNESS_SYNC_ENABLED = "fitness_sync_enabled";

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;

    private synchronized void updateStepHistory(SharedPreferences prefs, String date, int steps) {
        if (prefs == null || date == null || date.isEmpty() || steps <= 0) return;
        try {
            String rawJson = prefs.getString(KEY_STEP_HISTORY, "{}");
            JSONObject historyObj = new JSONObject(rawJson);
            historyObj.put(date, steps);

            // Keep up to 60 days
            if (historyObj.length() > 60) {
                Iterator<String> keys = historyObj.keys();
                if (keys.hasNext()) {
                    historyObj.remove(keys.next());
                }
            }
            prefs.edit().putString(KEY_STEP_HISTORY, historyObj.toString()).apply();
        } catch (Exception ignored) {}
    }

    @Override
    public void load() {
        super.load();
        try {
            Context context = getContext();
            sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
                stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
                registerPersistentStepListener();
            }
        } catch (Exception ignored) {}
    }

    private void registerPersistentStepListener() {
        if (sensorManager == null) return;
        Sensor sensorToUse = stepCounterSensor != null ? stepCounterSensor : stepDetectorSensor;
        if (sensorToUse == null) return;

        try {
            sensorManager.registerListener(new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    processSensorUpdate(event, 0);
                }

                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            }, sensorToUse, SensorManager.SENSOR_DELAY_NORMAL);
        } catch (Exception ignored) {}
    }

    private synchronized void processSensorUpdate(SensorEvent event, int hintSteps) {
        if (event == null || event.values == null || event.values.length == 0) return;
        Context context = getContext();
        if (context == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String savedDate = prefs.getString(KEY_BASELINE_DATE, "");

        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int currentTotalHardwareSteps = (int) event.values[0];
            int baselineSteps = prefs.getInt(KEY_BASELINE_STEPS, -1);
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, 0);
            int manualOffset = prefs.getInt(KEY_MANUAL_OFFSET, 0);

            if (!today.equals(savedDate) || baselineSteps == -1 || baselineSteps > currentTotalHardwareSteps) {
                if (!today.equals(savedDate) && !savedDate.isEmpty() && lastKnown > 0) {
                    prefs.edit()
                        .putString("yesterday_date", savedDate)
                        .putInt("yesterday_steps", lastKnown)
                        .apply();
                    updateStepHistory(prefs, savedDate, lastKnown);
                }
                // Mid-day initialization: If we already have known steps today, initialize baselineSteps
                // so that: currentTotalHardwareSteps - baselineSteps == knownSteps. Never reset to 0 mid-day!
                int knownStepsToday = Math.max(lastKnown, hintSteps);
                baselineSteps = Math.max(0, currentTotalHardwareSteps - knownStepsToday);
                
                prefs.edit()
                    .putString(KEY_BASELINE_DATE, today)
                    .putInt(KEY_BASELINE_STEPS, baselineSteps)
                    .putInt(KEY_LAST_STEPS, knownStepsToday)
                    .apply();
            } else {
                int rawDiff = Math.max(0, currentTotalHardwareSteps - baselineSteps);
                if (hintSteps > 0 && manualOffset == 0 && (rawDiff + manualOffset) < hintSteps) {
                    manualOffset = hintSteps - rawDiff;
                    prefs.edit().putInt(KEY_MANUAL_OFFSET, manualOffset).apply();
                }
                int dailySteps = Math.max(0, rawDiff + manualOffset);
                prefs.edit().putInt(KEY_LAST_STEPS, dailySteps).apply();
                if (dailySteps > 0) {
                    updateStepHistory(prefs, today, dailySteps);
                }
            }
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // Incremental step detector
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, 0);
            if (!today.equals(savedDate) && !savedDate.isEmpty() && lastKnown > 0) {
                prefs.edit()
                    .putString("yesterday_date", savedDate)
                    .putInt("yesterday_steps", lastKnown)
                    .apply();
                updateStepHistory(prefs, savedDate, lastKnown);
            }
            int currentDaily = today.equals(savedDate) ? lastKnown : Math.max(0, hintSteps);
            currentDaily += (int) event.values[0];
            prefs.edit()
                .putString(KEY_BASELINE_DATE, today)
                .putInt(KEY_LAST_STEPS, currentDaily)
                .apply();
            if (currentDaily > 0) {
                updateStepHistory(prefs, today, currentDaily);
            }
        }
    }

    @PluginMethod
    public void setFitnessSyncEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        Context context = getContext();
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_FITNESS_SYNC_ENABLED, enabled).apply();
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void isFitnessSyncEnabled(PluginCall call) {
        Context context = getContext();
        boolean enabled = false;
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            enabled = prefs.getBoolean(KEY_FITNESS_SYNC_ENABLED, false);
        }
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void calibrateSteps(PluginCall call) {
        int targetSteps = call.getInt("targetSteps", 0);
        Context context = getContext();
        if (context == null) {
            call.reject("Context unavailable");
            return;
        }
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

        int baselineSteps = prefs.getInt(KEY_BASELINE_STEPS, -1);
        int currentTotalLast = prefs.getInt(KEY_LAST_STEPS, 0);
        int currentOffset = prefs.getInt(KEY_MANUAL_OFFSET, 0);
        int rawSensorSteps = Math.max(0, currentTotalLast - currentOffset);
        int newOffset = targetSteps - rawSensorSteps;

        prefs.edit()
            .putString(KEY_BASELINE_DATE, today)
            .putInt(KEY_MANUAL_OFFSET, newOffset)
            .putInt(KEY_LAST_STEPS, targetSteps)
            .apply();

        updateStepHistory(prefs, today, targetSteps);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("calibratedSteps", targetSteps);
        ret.put("offset", newOffset);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkFitnessPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        int permissionState = ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACTIVITY_RECOGNITION
        );
        ret.put("granted", permissionState == PackageManager.PERMISSION_GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestFitnessPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("activityRecognition", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        checkFitnessPermissions(call);
    }

    private static class ListenerHolder implements SensorEventListener {
        volatile boolean resolved = false;

        @Override
        public void onSensorChanged(SensorEvent event) {}

        @Override
        public void onAccuracyChanged(Sensor sensor, int accuracy) {}
    }

    @PluginMethod
    public void getFitnessStats(PluginCall call) {
        Context context = getContext();
        if (sensorManager == null) {
            sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        }

        if (sensorManager == null) {
            call.reject("Sensor manager is unavailable on this device");
            return;
        }

        final int hintSteps = call.getInt("currentSteps", 0);

        Sensor stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepSensor == null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        }

        final SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        final String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

        if (stepSensor == null) {
            // Hardware sensor is completely absent on this device (e.g. tablet or emulator)
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, Math.max(0, hintSteps));
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("hasSensor", false);
            ret.put("steps", lastKnown);
            ret.put("calories", (int) Math.round(lastKnown * 0.04));
            ret.put("distanceKm", (double) Math.round(lastKnown * 0.000762 * 100.0) / 100.0);
            ret.put("activeMinutes", (int) Math.round(lastKnown / 100.0));
            ret.put("source", "cached_fallback");
            ret.put("date", today);
            call.resolve(ret);
            return;
        }

        // Register one-shot listener with a safe 1200ms timeout fallback
        final ListenerHolder[] holder = new ListenerHolder[1];
        holder[0] = new ListenerHolder() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (resolved || event == null || event.values == null || event.values.length == 0) return;
                resolved = true;
                try {
                    sensorManager.unregisterListener(this);
                } catch (Exception ignored) {}

                processSensorUpdate(event, hintSteps);

                int dailySteps = prefs.getInt(KEY_LAST_STEPS, Math.max(0, hintSteps));
                int calories = (int) Math.round(dailySteps * 0.04);
                double distanceKm = (double) Math.round(dailySteps * 0.000762 * 100.0) / 100.0;
                int activeMinutes = (int) Math.round(dailySteps / 100.0);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("hasSensor", true);
                ret.put("steps", dailySteps);
                ret.put("calories", calories);
                ret.put("distanceKm", distanceKm);
                ret.put("activeMinutes", activeMinutes);
                ret.put("source", "android_step_counter");
                ret.put("date", today);
                attachYesterdayData(ret, prefs);
                call.resolve(ret);
            }
        };

        boolean registered = sensorManager.registerListener(
            holder[0],
            stepSensor,
            SensorManager.SENSOR_DELAY_UI
        );

        if (!registered) {
            // Could not register listener, return last known cached steps
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, Math.max(0, hintSteps));
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("hasSensor", true);
            ret.put("steps", lastKnown);
            ret.put("calories", (int) Math.round(lastKnown * 0.04));
            ret.put("distanceKm", (double) Math.round(lastKnown * 0.000762 * 100.0) / 100.0);
            ret.put("activeMinutes", (int) Math.round(lastKnown / 100.0));
            ret.put("source", "cached_fallback");
            ret.put("date", today);
            attachYesterdayData(ret, prefs);
            call.resolve(ret);
            return;
        }

        // Safety timeout: If device is stationary, resolve with last known count in 1200ms
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!holder[0].resolved) {
                holder[0].resolved = true;
                try {
                    sensorManager.unregisterListener(holder[0]);
                } catch (Exception ignored) {}

                int lastKnown = prefs.getInt(KEY_LAST_STEPS, 0);
                if (hintSteps > 0 && lastKnown < hintSteps) {
                    lastKnown = hintSteps;
                    prefs.edit().putInt(KEY_LAST_STEPS, lastKnown).apply();
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("hasSensor", true);
                ret.put("steps", lastKnown);
                ret.put("calories", (int) Math.round(lastKnown * 0.04));
                ret.put("distanceKm", (double) Math.round(lastKnown * 0.000762 * 100.0) / 100.0);
                ret.put("activeMinutes", (int) Math.round(lastKnown / 100.0));
                ret.put("source", "android_step_counter_stationary");
                ret.put("date", today);
                attachYesterdayData(ret, prefs);
                call.resolve(ret);
            }
        }, 1200);
    }

    private void attachYesterdayData(JSObject ret, SharedPreferences prefs) {
        if (ret == null || prefs == null) return;
        int ySteps = prefs.getInt("yesterday_steps", 0);
        String yDate = prefs.getString("yesterday_date", "");
        if (ySteps > 0 && !yDate.isEmpty()) {
            ret.put("yesterdaySteps", ySteps);
            ret.put("yesterdayDate", yDate);
            updateStepHistory(prefs, yDate, ySteps);
        }

        // Attach multi-day step history
        try {
            String rawJson = prefs.getString(KEY_STEP_HISTORY, "{}");
            JSONObject historyObj = new JSONObject(rawJson);
            JSObject jsHistory = new JSObject();
            Iterator<String> keys = historyObj.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                int sVal = historyObj.optInt(key, 0);
                if (sVal > 0) {
                    jsHistory.put(key, sVal);
                }
            }
            if (ySteps > 0 && !yDate.isEmpty() && !jsHistory.has(yDate)) {
                jsHistory.put(yDate, ySteps);
            }
            ret.put("history", jsHistory);
        } catch (Exception ignored) {}
    }
}
