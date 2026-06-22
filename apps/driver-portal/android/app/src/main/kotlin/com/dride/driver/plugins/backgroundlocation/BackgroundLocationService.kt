package com.dride.driver.plugins.backgroundlocation

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class BackgroundLocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var apiUrl: String = ""
    private var token: String = ""
    private var vehicleId: String = ""
    private var driverId: String = ""

    companion object {
        const val TAG = "BackgroundLocation"
        const val CHANNEL_ID = "dride_location_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "START"
        const val ACTION_STOP = "STOP"
        const val EXTRA_API_URL = "apiUrl"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_VEHICLE_ID = "vehicleId"
        const val EXTRA_DRIVER_ID = "driverId"

        var lastLatitude: Double = 0.0
        var lastLongitude: Double = 0.0
        var lastHeading: Float = 0f
        var lastSpeed: Float = 0f
        var isRunning: Boolean = false
            private set

        private var eventCallback: ((latitude: Double, longitude: Double, speed: Float, heading: Float) -> Unit)? = null

        fun setEventCallback(callback: (Double, Double, Float, Float) -> Unit) {
            eventCallback = callback
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                apiUrl = intent.getStringExtra(EXTRA_API_URL) ?: ""
                token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                vehicleId = intent.getStringExtra(EXTRA_VEHICLE_ID) ?: ""
                driverId = intent.getStringExtra(EXTRA_DRIVER_ID) ?: ""

                // Acquire WakeLock to keep CPU alive when device screen is turned off
                try {
                    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                    wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DRide::LocationWakeLock").apply {
                        acquire(12 * 60 * 60 * 1000L) // 12 hours timeout safety limit
                    }
                    Log.d(TAG, "Partial WakeLock acquired successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to acquire WakeLock", e)
                }

                val notification = buildNotification()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                isRunning = true
                startLocationUpdates()
                Log.d(TAG, "Background location service started with Fused client")
            }
            ACTION_STOP -> {
                stopLocationUpdates()
                releaseWakeLock()
                isRunning = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.d(TAG, "Background location service stopped")
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopLocationUpdates()
        releaseWakeLock()
        isRunning = false
        super.onDestroy()
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WakeLock", e)
        }
        wakeLock = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "D-Ride Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows that D-Ride is tracking your location"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("D-Ride Driver")
            .setContentText("Live location tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .build()
    }

    private fun startLocationUpdates() {
        // High accuracy, 2s interval update location request (Uber-style)
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            2000L
        ).apply {
            setMinUpdateIntervalMillis(1000L)
            setMinUpdateDistanceMeters(0f)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation ?: return
                lastLatitude = location.latitude
                lastLongitude = location.longitude
                lastHeading = if (location.hasBearing()) location.bearing else 0f
                lastSpeed = if (location.hasSpeed()) location.speed else 0f

                sendLocationToApi(location)
                eventCallback?.invoke(
                    location.latitude,
                    location.longitude,
                    location.speed,
                    if (location.hasBearing()) location.bearing else 0f
                )
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                Looper.getMainLooper()
            )
            Log.d(TAG, "Fused location updates requested successfully")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException: Location permission not granted for Fused client", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting Fused location updates", e)
        }
    }

    private fun stopLocationUpdates() {
        locationCallback?.let {
            try {
                fusedLocationClient.removeLocationUpdates(it)
                Log.d(TAG, "Fused location updates removed successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing location updates from Fused client", e)
            }
        }
        locationCallback = null
    }

    private fun sendLocationToApi(location: Location) {
        if (apiUrl.isEmpty() || token.isEmpty() || vehicleId.isEmpty() || driverId.isEmpty()) return

        try {
            val url = URL("${apiUrl}/vehicles/location")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val jsonBody = """
                {
                    "vehicleId": "$vehicleId",
                    "driverId": "$driverId",
                    "longitude": ${location.longitude},
                    "latitude": ${location.latitude},
                    "speedKmh": ${if (location.hasSpeed()) location.speed * 3.6 else 0},
                    "headingDegrees": ${if (location.hasBearing()) location.bearing else 0}
                }
            """.trimIndent()

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(jsonBody)
                writer.flush()
            }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                Log.w(TAG, "API returned $responseCode for location update")
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send location to API", e)
        }
    }
}
