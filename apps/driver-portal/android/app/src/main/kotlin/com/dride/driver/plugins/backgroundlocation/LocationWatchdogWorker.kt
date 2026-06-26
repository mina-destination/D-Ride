package com.dride.driver.plugins.backgroundlocation

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

class LocationWatchdogWorker(
    private val ctx: Context,
    params: WorkerParameters
) : Worker(ctx, params) {

    override fun doWork(): Result {
        val prefs = ctx.getSharedPreferences(RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        val shouldRun = prefs.getBoolean(RestartReceiver.KEY_SHOULD_RUN, false)

        if (!shouldRun || BackgroundLocationService.isRunning) {
            return Result.success()
        }

        Log.d("LocationWatchdog", "Service should be running but isn't — restarting")

        val intent = Intent(ctx, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_START
            putExtra(BackgroundLocationService.EXTRA_API_URL, prefs.getString(RestartReceiver.KEY_API_URL, ""))
            putExtra(BackgroundLocationService.EXTRA_TOKEN, prefs.getString(RestartReceiver.KEY_TOKEN, ""))
            putExtra(BackgroundLocationService.EXTRA_VEHICLE_ID, prefs.getString(RestartReceiver.KEY_VEHICLE_ID, ""))
            putExtra(BackgroundLocationService.EXTRA_DRIVER_ID, prefs.getString(RestartReceiver.KEY_DRIVER_ID, ""))
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        } catch (e: Exception) {
            Log.e("LocationWatchdog", "Failed to restart service: ${e.message}")
            return Result.retry()
        }

        return Result.success()
    }
}
