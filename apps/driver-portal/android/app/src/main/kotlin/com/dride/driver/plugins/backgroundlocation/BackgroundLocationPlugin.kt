package com.dride.driver.plugins.backgroundlocation

import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "BackgroundLocation")
class BackgroundLocationPlugin : Plugin() {

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
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val apiUrl = call.getString("apiUrl") ?: return call.reject("apiUrl is required")
        val token = call.getString("token") ?: return call.reject("token is required")
        val vehicleId = call.getString("vehicleId") ?: return call.reject("vehicleId is required")
        val driverId = call.getString("driverId") ?: return call.reject("driverId is required")

        val context = activity.applicationContext
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

        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val context = activity.applicationContext
        val intent = Intent(context, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_STOP
        }
        context.startService(intent)
        call.resolve()
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        val result = JSObject().apply {
            put("running", BackgroundLocationService.isRunning)
        }
        call.resolve(result)
    }
}
