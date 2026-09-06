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

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;

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
                    processSensorUpdate(event);
                }

                @Override
                public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            }, sensorToUse, SensorManager.SENSOR_DELAY_NORMAL);
        } catch (Exception ignored) {}
    }

    private synchronized void processSensorUpdate(SensorEvent event) {
        if (event == null || event.values == null || event.values.length == 0) return;
        Context context = getContext();
        if (context == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String savedDate = prefs.getString(KEY_BASELINE_DATE, "");

        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int currentTotalHardwareSteps = (int) event.values[0];
            int baselineSteps = prefs.getInt(KEY_BASELINE_STEPS, -1);

            int dailySteps;
            if (!today.equals(savedDate) || baselineSteps == -1 || baselineSteps > currentTotalHardwareSteps) {
                baselineSteps = currentTotalHardwareSteps;
                prefs.edit()
                    .putString(KEY_BASELINE_DATE, today)
                    .putInt(KEY_BASELINE_STEPS, baselineSteps)
                    .putInt(KEY_LAST_STEPS, 0)
                    .apply();
            } else {
                dailySteps = Math.max(0, currentTotalHardwareSteps - baselineSteps);
                prefs.edit().putInt(KEY_LAST_STEPS, dailySteps).apply();
            }
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // Incremental step detector
            int currentDaily = today.equals(savedDate) ? prefs.getInt(KEY_LAST_STEPS, 0) : 0;
            currentDaily += (int) event.values[0];
            prefs.edit()
                .putString(KEY_BASELINE_DATE, today)
                .putInt(KEY_LAST_STEPS, currentDaily)
                .apply();
        }
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

        Sensor stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepSensor == null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        }

        final SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        final String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

        if (stepSensor == null) {
            // Hardware sensor is completely absent on this device (e.g. tablet or emulator)
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, 0);
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

                processSensorUpdate(event);

                int dailySteps = prefs.getInt(KEY_LAST_STEPS, 0);
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
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, 0);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("hasSensor", true);
            ret.put("steps", lastKnown);
            ret.put("calories", (int) Math.round(lastKnown * 0.04));
            ret.put("distanceKm", (double) Math.round(lastKnown * 0.000762 * 100.0) / 100.0);
            ret.put("activeMinutes", (int) Math.round(lastKnown / 100.0));
            ret.put("source", "cached_fallback");
            ret.put("date", today);
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
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("hasSensor", true);
                ret.put("steps", lastKnown);
                ret.put("calories", (int) Math.round(lastKnown * 0.04));
                ret.put("distanceKm", (double) Math.round(lastKnown * 0.000762 * 100.0) / 100.0);
                ret.put("activeMinutes", (int) Math.round(lastKnown / 100.0));
                ret.put("source", "android_step_counter_stationary");
                ret.put("date", today);
                call.resolve(ret);
            }
        }, 1200);
    }
}
