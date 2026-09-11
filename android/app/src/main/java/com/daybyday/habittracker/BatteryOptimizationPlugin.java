package com.daybyday.habittracker;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                boolean isIgnored = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                ret.put("isIgnored", isIgnored);
            } else {
                ret.put("isIgnored", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("isIgnored", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                    JSObject ret = new JSObject();
                    ret.put("alreadyIgnored", true);
                    call.resolve(ret);
                    return;
                }

                try {
                    Intent intent = new Intent();
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    JSObject ret = new JSObject();
                    ret.put("prompted", true);
                    call.resolve(ret);
                    return;
                } catch (Exception directEx) {
                    // Direct prompt failed, fallback to App Details or Battery Optimization settings
                }
            }

            // Fallback for devices restricting direct intent
            openAppSettingsFallback();
            JSObject ret = new JSObject();
            ret.put("openedSettings", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open battery optimization settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            openAppSettingsFallback();
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private void openAppSettingsFallback() {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            try {
                Intent generic = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                generic.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(generic);
            } catch (Exception ignored) {}
        }
    }
}
