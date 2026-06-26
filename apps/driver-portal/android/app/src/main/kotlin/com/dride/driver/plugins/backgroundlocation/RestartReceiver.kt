package com.dride.driver.plugins.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Restarts the BackgroundLocationService after:
 *   1. Device reboot (BOOT_COMPLETED)
 *   2. OS-initiated service kill (custom RESTART_LOCATION_SERVICE action)
 *
 * Reads saved config from SharedPreferences to reconstruct the start Intent.
 */
class RestartReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "RestartReceiver"
        const val ACTION_RESTART = "com.dride.driver.RESTART_LOCATION_SERVICE"
        const val PREFS_NAME = "dride_bg_location"
        const val KEY_SHOULD_RUN = "should_run"
        const val KEY_API_URL = "api_url"
        const val KEY_TOKEN = "token"
        const val KEY_VEHICLE_ID = "vehicle_id"
        const val KEY_DRIVER_ID = "driver_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "onReceive: action=$action")

        if (action != Intent.ACTION_BOOT_COMPLETED && action != ACTION_RESTART) {
            return
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val shouldRun = prefs.getBoolean(KEY_SHOULD_RUN, false)
        if (!shouldRun) {
            Log.d(TAG, "Service should not be running, ignoring restart")
            return
        }

        val apiUrl = prefs.getString(KEY_API_URL, "") ?: ""
        val token = prefs.getString(KEY_TOKEN, "") ?: ""
        val vehicleId = prefs.getString(KEY_VEHICLE_ID, "") ?: ""
        val driverId = prefs.getString(KEY_DRIVER_ID, "") ?: ""

        if (apiUrl.isEmpty() || token.isEmpty() || vehicleId.isEmpty() || driverId.isEmpty()) {
            Log.w(TAG, "Missing saved config, cannot restart service")
            return
        }

        // Already running? Skip.
        if (BackgroundLocationService.isRunning) {
            Log.d(TAG, "Service is already running, skipping restart")
            return
        }

        Log.d(TAG, "Restarting BackgroundLocationService after $action")

        val serviceIntent = Intent(context, BackgroundLocationService::class.java).apply {
            this.action = BackgroundLocationService.ACTION_START
            putExtra(BackgroundLocationService.EXTRA_API_URL, apiUrl)
            putExtra(BackgroundLocationService.EXTRA_TOKEN, token)
            putExtra(BackgroundLocationService.EXTRA_VEHICLE_ID, vehicleId)
            putExtra(BackgroundLocationService.EXTRA_DRIVER_ID, driverId)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d(TAG, "Service restart initiated successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restart service: ${e.message}", e)
        }
    }
}
