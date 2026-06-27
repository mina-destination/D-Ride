package com.dride.driver.plugins.backgroundlocation

import android.content.Context
import android.content.Intent
import android.location.LocationManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

@CapacitorPlugin(
    name = "BackgroundLocation",
    permissions = [
        Permission(
            alias = "location",
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ]
        ),
        Permission(
            alias = "backgroundLocation",
            strings = [
                "android.permission.ACCESS_BACKGROUND_LOCATION"
            ]
        ),
        Permission(
            alias = "notifications",
            strings = [
                "android.permission.POST_NOTIFICATIONS"
            ]
        )
    ]
)
class BackgroundLocationPlugin : Plugin() {

    companion object {
        const val TAG = "BackgroundLocationPlugin"
    }

    override fun load() {
        super.load()
        BackgroundLocationService.setEventCallback { latitude, longitude, speed, heading ->
            val data = JSObject().apply {
                put("latitude", latitude)
                put("longitude", longitude)
                put("speed", speed * 3.6)
                put("heading", heading)
            }
            notifyListeners("locationUpdate", data)
        }

        // Auto-restart: Check if the service should be running but isn't
        restartServiceIfNeeded()
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val context = activity.applicationContext

        // 1. Verify ACCESS_FINE_LOCATION
        val hasFineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFineLocation) {
            return call.reject("ACCESS_FINE_LOCATION not granted")
        }

        // 2. Verify ACCESS_BACKGROUND_LOCATION (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val hasBgLocation = ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasBgLocation) {
                val result = JSObject().apply {
                    put("running", false)
                    put("reason", "background_location_denied")
                }
                return call.resolve(result)
            }
        }

        // 3. Verify POST_NOTIFICATIONS (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasNotifications = ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasNotifications) {
                val result = JSObject().apply {
                    put("running", false)
                    put("reason", "notifications_denied")
                }
                return call.resolve(result)
            }
        }

        val apiUrl = call.getString("apiUrl") ?: return call.reject("apiUrl is required")
        val token = call.getString("token") ?: return call.reject("token is required")
        val vehicleId = call.getString("vehicleId") ?: return call.reject("vehicleId is required")
        val driverId = call.getString("driverId") ?: return call.reject("driverId is required")

        // Save config to SharedPreferences for restart recovery
        val prefs = activity.applicationContext.getSharedPreferences(
            RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE
        )
        prefs.edit()
            .putBoolean(RestartReceiver.KEY_SHOULD_RUN, true)
            .putString(RestartReceiver.KEY_API_URL, apiUrl)
            .putString(RestartReceiver.KEY_TOKEN, token)
            .putString(RestartReceiver.KEY_VEHICLE_ID, vehicleId)
            .putString(RestartReceiver.KEY_DRIVER_ID, driverId)
            .apply()

        val intent = Intent(context, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_START
            putExtra(BackgroundLocationService.EXTRA_API_URL, apiUrl)
            putExtra(BackgroundLocationService.EXTRA_TOKEN, token)
            putExtra(BackgroundLocationService.EXTRA_VEHICLE_ID, vehicleId)
            putExtra(BackgroundLocationService.EXTRA_DRIVER_ID, driverId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }

        // Schedule WorkManager watchdog
        try {
            val watchdog = PeriodicWorkRequestBuilder<LocationWatchdogWorker>(5, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "dride_location_watchdog",
                ExistingPeriodicWorkPolicy.KEEP,
                watchdog
            )
            Log.d(TAG, "Location watchdog scheduled successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule Location watchdog: ${e.message}", e)
        }

        val result = JSObject().apply {
            put("running", true)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        // Clear the "should run" flag so RestartReceiver won't bring it back
        val prefs = activity.applicationContext.getSharedPreferences(
            RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE
        )
        prefs.edit()
            .putBoolean(RestartReceiver.KEY_SHOULD_RUN, false)
            .apply()

        val context = activity.applicationContext
        val intent = Intent(context, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_STOP
        }
        context.startService(intent)

        // Cancel WorkManager watchdog
        try {
            WorkManager.getInstance(context).cancelUniqueWork("dride_location_watchdog")
            Log.d(TAG, "Location watchdog cancelled successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel Location watchdog: ${e.message}", e)
        }

        call.resolve()
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        val result = JSObject().apply {
            put("running", BackgroundLocationService.isRunning)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun updateConfig(call: PluginCall) {
        val apiUrl = call.getString("apiUrl")
        val token = call.getString("token")
        val vehicleId = call.getString("vehicleId")
        val driverId = call.getString("driverId")

        val context = activity.applicationContext
        val prefs = context.getSharedPreferences(
            RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE
        )
        val editor = prefs.edit()
        apiUrl?.let { editor.putString(RestartReceiver.KEY_API_URL, it) }
        token?.let { editor.putString(RestartReceiver.KEY_TOKEN, it) }
        vehicleId?.let { editor.putString(RestartReceiver.KEY_VEHICLE_ID, it) }
        driverId?.let { editor.putString(RestartReceiver.KEY_DRIVER_ID, it) }
        editor.apply()

        if (BackgroundLocationService.isRunning) {
            val intent = Intent(context, BackgroundLocationService::class.java).apply {
                action = BackgroundLocationService.ACTION_UPDATE
                apiUrl?.let { putExtra(BackgroundLocationService.EXTRA_API_URL, it) }
                token?.let { putExtra(BackgroundLocationService.EXTRA_TOKEN, it) }
                vehicleId?.let { putExtra(BackgroundLocationService.EXTRA_VEHICLE_ID, it) }
                driverId?.let { putExtra(BackgroundLocationService.EXTRA_DRIVER_ID, it) }
            }
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun restart(call: PluginCall) {
        restartServiceIfNeeded()
        call.resolve()
    }

    @PluginMethod
    fun getDiagnostics(call: PluginCall) {
        val result = JSObject().apply {
            put("isRunning", BackgroundLocationService.isRunning)
            put("lastSentTime", BackgroundLocationService.lastSentTime)
            put("authFailed", BackgroundLocationService.authFailed)
            put("lastResponseCode", BackgroundLocationService.lastResponseCode)
            put("consecutiveNetworkFailures", BackgroundLocationService.consecutiveNetworkFailures)
            put("lastResponseBody", BackgroundLocationService.lastResponseBody)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun checkLocationEnabled(call: PluginCall) {
        val lm = activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val enabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        call.resolve(JSObject().apply { put("enabled", enabled) })
    }

    @PluginMethod
    fun openLocationSettings(call: PluginCall) {
        activity.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
        call.resolve()
    }

    @PluginMethod
    fun isBatteryOptimizationDisabled(call: PluginCall) {
        val pm = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
        val name = activity.packageName
        val disabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(name)
        } else true
        call.resolve(JSObject().apply { put("disabled", disabled) })
    }

    @PluginMethod
    fun requestBatteryOptimization(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = android.net.Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun openBatterySettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        activity.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = android.net.Uri.parse("package:${activity.packageName}")
        }
        activity.startActivity(intent)
        call.resolve()
    }

    /**
     * Called on plugin load — checks if the service was supposed to be running
     * (e.g., after the user reopens the app and the OS had killed the service).
     */
    private fun restartServiceIfNeeded() {
        if (BackgroundLocationService.isRunning) return

        val prefs = activity.applicationContext.getSharedPreferences(
            RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE
        )
        val shouldRun = prefs.getBoolean(RestartReceiver.KEY_SHOULD_RUN, false)
        if (!shouldRun) return

        val apiUrl = prefs.getString(RestartReceiver.KEY_API_URL, "") ?: ""
        val token = prefs.getString(RestartReceiver.KEY_TOKEN, "") ?: ""
        val vehicleId = prefs.getString(RestartReceiver.KEY_VEHICLE_ID, "") ?: ""
        val driverId = prefs.getString(RestartReceiver.KEY_DRIVER_ID, "") ?: ""

        if (apiUrl.isEmpty() || token.isEmpty() || vehicleId.isEmpty() || driverId.isEmpty()) {
            Log.w(TAG, "restartServiceIfNeeded: Missing config, skipping")
            return
        }

        Log.d(TAG, "restartServiceIfNeeded: Restarting service on plugin load")

        val context = activity.applicationContext
        val intent = Intent(context, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_START
            putExtra(BackgroundLocationService.EXTRA_API_URL, apiUrl)
            putExtra(BackgroundLocationService.EXTRA_TOKEN, token)
            putExtra(BackgroundLocationService.EXTRA_VEHICLE_ID, vehicleId)
            putExtra(BackgroundLocationService.EXTRA_DRIVER_ID, driverId)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to auto-restart service: ${e.message}", e)
        }
    }
}
