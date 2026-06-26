package com.dride.driver.plugins.backgroundlocation

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BackgroundLocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var apiUrl: String = ""
    private var token: String = ""
    private var vehicleId: String = ""
    private var driverId: String = ""

    // Dedicated background thread for location callbacks — avoids UI thread pressure
    private var locationThread: HandlerThread? = null
    private var locationHandler: Handler? = null

    // Notification update handler
    private var notificationHandler: Handler? = null
    private var lastLocationTime: Long = 0L

    private var lastSentLatitude: Double = 0.0
    private var lastSentLongitude: Double = 0.0
    private var lastSentTime: Long = 0L

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

                lastSentLatitude = 0.0
                lastSentLongitude = 0.0
                lastSentTime = 0L

                // Save config to SharedPreferences for restart recovery
                saveConfig()

                // Acquire WakeLock to keep CPU alive when screen is off
                acquireWakeLock()

                // Start the dedicated background thread for location callbacks
                startLocationThread()

                val notification = buildNotification("Live location tracking active")
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
                startNotificationUpdater()
                Log.d(TAG, "Background location service started with Fused client")
            }
            ACTION_STOP -> {
                clearConfig()
                stopLocationUpdates()
                stopNotificationUpdater()
                stopLocationThread()
                releaseWakeLock()
                cancelRestartAlarm()
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
        stopNotificationUpdater()
        stopLocationThread()
        releaseWakeLock()
        isRunning = false
        super.onDestroy()
    }

    /**
     * Called when the user swipes the app from the recent-tasks list.
     * Schedule a restart via AlarmManager to bring the service back.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "onTaskRemoved: scheduling service restart")

        val prefs = getSharedPreferences(RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        val shouldRun = prefs.getBoolean(RestartReceiver.KEY_SHOULD_RUN, false)
        if (!shouldRun) return

        scheduleRestartAlarm()
    }

    // ── SharedPreferences Persistence ───────────────────────────

    private fun saveConfig() {
        getSharedPreferences(RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(RestartReceiver.KEY_SHOULD_RUN, true)
            .putString(RestartReceiver.KEY_API_URL, apiUrl)
            .putString(RestartReceiver.KEY_TOKEN, token)
            .putString(RestartReceiver.KEY_VEHICLE_ID, vehicleId)
            .putString(RestartReceiver.KEY_DRIVER_ID, driverId)
            .apply()
        Log.d(TAG, "Config saved to SharedPreferences")
    }

    private fun clearConfig() {
        getSharedPreferences(RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(RestartReceiver.KEY_SHOULD_RUN, false)
            .apply()
        Log.d(TAG, "Config cleared from SharedPreferences (should_run = false)")
    }

    // ── Restart Alarm ──────────────────────────────────────────

    private fun scheduleRestartAlarm() {
        val restartIntent = Intent(this, RestartReceiver::class.java).apply {
            action = RestartReceiver.ACTION_RESTART
        }
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            restartIntent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 3000, // 3 seconds delay
            pendingIntent
        )
        Log.d(TAG, "Restart alarm scheduled for 3 seconds from now")
    }

    private fun cancelRestartAlarm() {
        val restartIntent = Intent(this, RestartReceiver::class.java).apply {
            action = RestartReceiver.ACTION_RESTART
        }
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            restartIntent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent)
    }

    // ── WakeLock ───────────────────────────────────────────────

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "DRide::LocationWakeLock"
            ).apply {
                acquire(12 * 60 * 60 * 1000L) // 12 hours timeout safety limit
            }
            Log.d(TAG, "Partial WakeLock acquired successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire WakeLock", e)
        }
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

    // ── Location Thread ────────────────────────────────────────

    private fun startLocationThread() {
        locationThread = HandlerThread("DRide-LocationThread").also {
            it.start()
            locationHandler = Handler(it.looper)
        }
    }

    private fun stopLocationThread() {
        locationThread?.quitSafely()
        locationThread = null
        locationHandler = null
    }

    // ── Notification Channel & Builder ─────────────────────────

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

    private fun buildNotification(contentText: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("D-Ride Driver")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .build()
    }

    // ── Notification Updater (keeps foreground service alive on aggressive OEMs) ──

    private fun startNotificationUpdater() {
        notificationHandler = Handler(Looper.getMainLooper())
        val updateRunnable = object : Runnable {
            override fun run() {
                if (!isRunning) return
                val timeSince = if (lastLocationTime > 0) {
                    val elapsed = (System.currentTimeMillis() - lastLocationTime) / 1000
                    if (elapsed < 60) "${elapsed}s ago" else "${elapsed / 60}m ago"
                } else {
                    "waiting..."
                }
                val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                val text = "Tracking active · Last: $timeSince · ${sdf.format(Date())}"
                val notification = buildNotification(text)
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, notification)
                notificationHandler?.postDelayed(this, 30_000L) // Update every 30s
            }
        }
        notificationHandler?.postDelayed(updateRunnable, 30_000L)
    }

    private fun stopNotificationUpdater() {
        notificationHandler?.removeCallbacksAndMessages(null)
        notificationHandler = null
    }

    // ── Location Updates ──────────────────────────────────────

    private fun startLocationUpdates() {
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
                lastLocationTime = System.currentTimeMillis()

                // Throttling logic to restrict api uploads when static
                val now = System.currentTimeMillis()
                val isFirstUpdate = lastSentTime == 0L
                val timeDiff = now - lastSentTime
                val distDiff = if (isFirstUpdate) 0.0 else calculateDistance(
                    lastSentLatitude, lastSentLongitude,
                    location.latitude, location.longitude
                )

                if (isFirstUpdate || distDiff >= 5.0 || timeDiff >= 15000L) {
                    lastSentLatitude = location.latitude
                    lastSentLongitude = location.longitude
                    lastSentTime = now
                    sendLocationToApi(location)
                }

                eventCallback?.invoke(
                    location.latitude,
                    location.longitude,
                    location.speed,
                    if (location.hasBearing()) location.bearing else 0f
                )
            }
        }

        try {
            // Use dedicated HandlerThread looper — avoids UI thread starvation
            val looper = locationHandler?.looper ?: Looper.getMainLooper()
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                looper
            )
            Log.d(TAG, "Fused location updates requested on background thread")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException: Location permission not granted", e)
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

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0 // Earth radius in meters
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return r * c
    }

    // ── API Sender with Retry ─────────────────────────────────

    private fun sendLocationToApi(location: Location) {
        if (apiUrl.isEmpty() || token.isEmpty() || vehicleId.isEmpty() || driverId.isEmpty()) {
            Log.w(TAG, "sendLocationToApi skipped: missing config")
            return
        }

        // Post to background thread to avoid blocking location callback
        locationHandler?.post {
            sendWithRetry(location, maxRetries = 2, delayMs = 2000L)
        } ?: run {
            // Fallback to plain thread if handler is null
            Thread {
                sendWithRetry(location, maxRetries = 2, delayMs = 2000L)
            }.start()
        }
    }

    private fun sendWithRetry(location: Location, maxRetries: Int, delayMs: Long) {
        var attempt = 0
        while (attempt <= maxRetries) {
            try {
                val endpoint = "${apiUrl}/vehicles/location"
                val url = URL(endpoint)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val bm = getSystemService(Context.BATTERY_SERVICE) as? android.os.BatteryManager
                val batteryPct = bm?.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
                val batteryPercentageJson = if (batteryPct >= 0) batteryPct.toString() else "null"

                val jsonBody = """
                    {
                        "vehicleId": "$vehicleId",
                        "driverId": "$driverId",
                        "longitude": ${location.longitude},
                        "latitude": ${location.latitude},
                        "speedKmh": ${if (location.hasSpeed()) location.speed * 3.6 else 0},
                        "headingDegrees": ${if (location.hasBearing()) location.bearing else 0},
                        "batteryPercentage": $batteryPercentageJson
                    }
                """.trimIndent()

                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(jsonBody)
                    writer.flush()
                }

                val responseCode = conn.responseCode
                conn.disconnect()

                if (responseCode in 200..299) {
                    if (attempt > 0) {
                        Log.d(TAG, "Location sent successfully after ${attempt + 1} attempts")
                    }
                    return // Success — exit retry loop
                } else {
                    Log.w(TAG, "API returned HTTP $responseCode (attempt ${attempt + 1})")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send location (attempt ${attempt + 1}): ${e.message}")
            }

            attempt++
            if (attempt <= maxRetries) {
                try {
                    Thread.sleep(delayMs * attempt) // Exponential-ish backoff
                } catch (ie: InterruptedException) {
                    return
                }
            }
        }
    }
}
