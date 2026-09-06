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

    @PluginMethod
    public void getFitnessStats(PluginCall call) {
        Context context = getContext();
        SensorManager sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);

        if (sensorManager == null) {
            call.reject("Sensor manager is unavailable on this device");
            return;
        }

        Sensor stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepSensor == null) {
            // Fallback to last known steps or 0 if hardware sensor is absent
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            int lastKnown = prefs.getInt(KEY_LAST_STEPS, 0);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("hasSensor", false);
            ret.put("steps", lastKnown);
            ret.put("calories", (int) Math.round(lastKnown * 0.04));
            ret.put("distanceKm", (double) Math.round(lastKnown * 0.000762 * 10.0) / 10.0);
            ret.put("activeMinutes", (int) Math.round(lastKnown / 100.0));
            ret.put("source", "cached_fallback");
            call.resolve(ret);
            return;
        }

        // Register one-shot listener to query current hardware steps
        final SensorEventListener[] listenerHolder = new SensorEventListener[1];
        listenerHolder[0] = new SensorEventListener() {
            private boolean resolved = false;

            @Override
            public void onSensorChanged(SensorEvent event) {
                if (resolved || event.values.length == 0) return;
                resolved = true;

                int currentTotalHardwareSteps = (int) event.values[0];
                sensorManager.unregisterListener(this);

                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                String savedDate = prefs.getString(KEY_BASELINE_DATE, "");
                int baselineSteps = prefs.getInt(KEY_BASELINE_STEPS, -1);

                int dailySteps;
                if (!today.equals(savedDate) || baselineSteps == -1 || baselineSteps > currentTotalHardwareSteps) {
                    // New day or phone restarted: establish fresh midnight baseline
                    baselineSteps = currentTotalHardwareSteps;
                    prefs.edit()
                        .putString(KEY_BASELINE_DATE, today)
                        .putInt(KEY_BASELINE_STEPS, baselineSteps)
                        .putInt(KEY_LAST_STEPS, 0)
                        .apply();
                    dailySteps = 0;
                } else {
                    dailySteps = Math.max(0, currentTotalHardwareSteps - baselineSteps);
                    prefs.edit().putInt(KEY_LAST_STEPS, dailySteps).apply();
                }

                int calories = (int) Math.round(dailySteps * 0.04);
                double distanceKm = (double) Math.round(dailySteps * 0.000762 * 100.0) / 100.0;
                int activeMinutes = (int) Math.round(dailySteps / 100.0);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("hasSensor", true);
                ret.put("steps", dailySteps);
                ret.put("totalHardwareSteps", currentTotalHardwareSteps);
                ret.put("calories", calories);
                ret.put("distanceKm", distanceKm);
                ret.put("activeMinutes", activeMinutes);
                ret.put("source", "android_step_counter");
                ret.put("date", today);
                call.resolve(ret);
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };

        boolean registered = sensorManager.registerListener(
            listenerHolder[0],
            stepSensor,
            SensorManager.SENSOR_DELAY_UI
        );

        if (!registered) {
            call.reject("Could not bind to step sensor listener");
            return;
        }

        // Safety timeout in case hardware sensor does not fire immediately
        context.getMainExecutor().execute(() -> {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    sensorManager.unregisterListener(listenerHolder[0]);
                } catch (Exception ignored) {}
            }, 3000);
        });
    }
}
