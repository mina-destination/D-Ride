package com.dride.driver.plugins.backgroundlocation

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
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
    private var wifiLock: android.net.wifi.WifiManager.WifiLock? = null
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

    private var currentBatteryPercentage: Int = -1

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level >= 0 && scale > 0) {
                currentBatteryPercentage = (level * 100) / scale
                Log.d(TAG, "BatteryReceiver: percentage updated to $currentBatteryPercentage%")
            }
        }
    }

    private fun checkBackgroundPermissionsGranted(): Boolean {
        val hasFine = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val hasCoarse = ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasBg = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else true

        return (hasFine || hasCoarse) && hasBg
    }

    private fun showPermissionAlertNotification(title: String, text: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = android.net.Uri.parse("package:$packageName")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            2002,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "dride_alert_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "D-Ride Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical alerts from D-Ride driver service"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(2002, notification)
    }

    companion object {
        const val TAG = "BackgroundLocation"
        const val CHANNEL_ID = "dride_location_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "START"
        const val ACTION_STOP = "STOP"
        const val ACTION_UPDATE = "UPDATE"
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

        var lastSentTime: Long = 0L
        var authFailed: Boolean = false
        var consecutiveNetworkFailures: Int = 0
        var lastResponseCode: Int = 0
        var lastResponseBody: String = ""

        private var eventCallback: ((latitude: Double, longitude: Double, speed: Float, heading: Float) -> Unit)? = null

        fun setEventCallback(callback: (Double, Double, Float, Float) -> Unit) {
            eventCallback = callback
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "onStartCommand: action=$action, intent is null = ${intent == null}")

        if (intent == null || action == null) {
            val prefs = getSharedPreferences(RestartReceiver.PREFS_NAME, Context.MODE_PRIVATE)
            val shouldRun = prefs.getBoolean(RestartReceiver.KEY_SHOULD_RUN, false)
            if (shouldRun) {
                apiUrl = prefs.getString(RestartReceiver.KEY_API_URL, "") ?: ""
                token = prefs.getString(RestartReceiver.KEY_TOKEN, "") ?: ""
                vehicleId = prefs.getString(RestartReceiver.KEY_VEHICLE_ID, "") ?: ""
                driverId = prefs.getString(RestartReceiver.KEY_DRIVER_ID, "") ?: ""

                 if (apiUrl.isNotEmpty() && token.isNotEmpty() && vehicleId.isNotEmpty() && driverId.isNotEmpty()) {
                    if (!checkBackgroundPermissionsGranted()) {
                        showPermissionAlertNotification(
                            "Location Permission Required",
                            "D-Ride needs 'Allow all the time' location permission to track your shift. Tap here to enable."
                        )
                    }
                    lastSentLatitude = 0.0
                    lastSentLongitude = 0.0
                    lastSentTime = 0L
                    authFailed = false
                    consecutiveNetworkFailures = 0

                    acquireWakeLock()
                    acquireWifiLock()
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
                    Log.d(TAG, "Sticky restart: Background location service initialized from SharedPreferences")
                } else {
                    Log.w(TAG, "Sticky restart: shouldRun is true but config is incomplete, stopping")
                    stopSelf()
                }
            } else {
                Log.d(TAG, "Sticky restart: shouldRun is false, stopping")
                stopSelf()
            }
            return START_STICKY
        }

        when (action) {
            ACTION_START -> {
                apiUrl = intent.getStringExtra(EXTRA_API_URL) ?: ""
                token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                vehicleId = intent.getStringExtra(EXTRA_VEHICLE_ID) ?: ""
                driverId = intent.getStringExtra(EXTRA_DRIVER_ID) ?: ""

                 if (!checkBackgroundPermissionsGranted()) {
                    showPermissionAlertNotification(
                        "Location Permission Required",
                        "D-Ride needs 'Allow all the time' location permission to track your shift. Tap here to enable."
                    )
                }

                lastSentLatitude = 0.0
                lastSentLongitude = 0.0
                lastSentTime = 0L
                authFailed = false
                consecutiveNetworkFailures = 0

                // Save config to SharedPreferences for restart recovery
                saveConfig()

                // Acquire WakeLock to keep CPU alive when screen is off
                acquireWakeLock()
                acquireWifiLock()

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
                releaseWifiLock()
                cancelRestartAlarm()
                isRunning = false
                authFailed = false
                consecutiveNetworkFailures = 0
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.d(TAG, "Background location service stopped")
            }
            ACTION_UPDATE -> {
                intent.getStringExtra(EXTRA_API_URL)?.let { if (it.isNotEmpty()) apiUrl = it }
                intent.getStringExtra(EXTRA_TOKEN)?.let {
                    if (it.isNotEmpty()) {
                        token = it
                        authFailed = false
                        consecutiveNetworkFailures = 0
                    }
                }
                intent.getStringExtra(EXTRA_VEHICLE_ID)?.let { if (it.isNotEmpty()) vehicleId = it }
                intent.getStringExtra(EXTRA_DRIVER_ID)?.let { if (it.isNotEmpty()) driverId = it }

                saveConfig()
                Log.d(TAG, "Background location service config updated dynamically")
                updateNotificationImmediately("Live location tracking active")
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        try {
            unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering battery receiver", e)
        }
        stopLocationUpdates()
        stopNotificationUpdater()
        stopLocationThread()
        releaseWakeLock()
        releaseWifiLock()
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

    private fun acquireWifiLock() {
        try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager
            wifiLock = wifiManager.createWifiLock(android.net.wifi.WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DRide::WifiLock").apply {
                acquire()
            }
            Log.d(TAG, "WifiLock acquired successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire WifiLock", e)
        }
    }

    private fun releaseWifiLock() {
        try {
            wifiLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WifiLock", e)
        }
        wifiLock = null
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

    private fun updateNotificationImmediately(text: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = buildNotification(text)
        manager.notify(NOTIFICATION_ID, notification)
    }

    // ── Notification Updater (keeps foreground service alive on aggressive OEMs) ──

    private fun startNotificationUpdater() {
        notificationHandler = Handler(Looper.getMainLooper())
        val updateRunnable = object : Runnable {
            override fun run() {
                if (!isRunning) return
                val text = when {
                    authFailed -> "Session expired — reopen app"
                    consecutiveNetworkFailures > 0 -> "No network — retrying... ($consecutiveNetworkFailures)"
                    else -> {
                        val timeSince = if (lastLocationTime > 0) {
                            val elapsed = (System.currentTimeMillis() - lastLocationTime) / 1000
                            if (elapsed < 60) "${elapsed}s ago" else "${elapsed / 60}m ago"
                        } else {
                            "waiting..."
                        }
                        val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                        "Tracking active · Last: $timeSince · ${sdf.format(Date())}"
                    }
                }
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
            setMinUpdateDistanceMeters(5f)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation ?: return
                
                // Discard inaccurate points to stop jumping/drifting
                if (location.accuracy > 20f) {
                    Log.d(TAG, "Discarding inaccurate location: accuracy=${location.accuracy}m")
                    return
                }

                // Fallback Speed calculation before updating lastLatitude/lastLongitude
                if (location.hasSpeed()) {
                    lastSpeed = location.speed
                } else {
                    val timeDeltaSec = if (lastLocationTime > 0L) (System.currentTimeMillis() - lastLocationTime) / 1000.0 else 0.0
                    if (timeDeltaSec > 0.0 && lastLatitude != 0.0) {
                        val dist = calculateDistance(lastLatitude, lastLongitude, location.latitude, location.longitude)
                        val calculatedSpeed = (dist / timeDeltaSec).toFloat() // meters/sec
                        if (calculatedSpeed in 0f..50f) {
                            lastSpeed = calculatedSpeed
                        } else {
                            lastSpeed = 0f
                        }
                    } else {
                        lastSpeed = 0f
                    }
                }

                lastLatitude = location.latitude
                lastLongitude = location.longitude
                lastLocationTime = System.currentTimeMillis()

                if (location.hasBearing()) {
                    lastHeading = location.bearing
                } else {
                    val dist = if (lastSentLatitude == 0.0) 0.0 else calculateDistance(
                        lastSentLatitude, lastSentLongitude,
                        location.latitude, location.longitude
                    )
                    if (dist > 2.0) {
                        lastHeading = calculateBearing(
                            lastSentLatitude, lastSentLongitude,
                            location.latitude, location.longitude
                        )
                    }
                }

                val now = System.currentTimeMillis()
                lastSentLatitude = location.latitude
                lastSentLongitude = location.longitude
                lastSentTime = now
                sendLocationToApi(location)

                eventCallback?.invoke(
                    location.latitude,
                    location.longitude,
                    lastSpeed,
                    lastHeading
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
            showPermissionAlertNotification(
                "Location Permission Required",
                "D-Ride needs 'Allow all the time' location permission to track your shift. Tap here to enable."
            )
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

    private fun calculateBearing(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val deltaLambda = Math.toRadians(lon2 - lon1)

        val y = Math.sin(deltaLambda) * Math.cos(phi2)
        val x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)
        val bearingRad = Math.atan2(y, x)
        val bearingDeg = Math.toDegrees(bearingRad)
        return ((bearingDeg + 360) % 360).toFloat()
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
        if (authFailed) {
            Log.w(TAG, "sendWithRetry: authFailed is true, skipping location send")
            return
        }

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

                val finalBattery = if (currentBatteryPercentage >= 0) currentBatteryPercentage else {
                    val bm = getSystemService(Context.BATTERY_SERVICE) as? android.os.BatteryManager
                    bm?.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
                }
                val batteryJsonField = if (finalBattery >= 0) ",\"batteryPercentage\": $finalBattery" else ""

                val jsonBody = """
                    {
                        "vehicleId": "$vehicleId",
                        "driverId": "$driverId",
                        "longitude": ${location.longitude},
                        "latitude": ${location.latitude},
                        "speedKmh": ${lastSpeed * 3.6},
                        "headingDegrees": ${if (lastHeading > 0) lastHeading else 0}${batteryJsonField}
                    }
                """.trimIndent()

                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(jsonBody)
                    writer.flush()
                }

                val responseCode = conn.responseCode
                lastResponseCode = responseCode

                if (responseCode == 401 || responseCode == 403) {
                    authFailed = true
                    val errorStream = conn.errorStream
                    val errorSnippet = errorStream?.bufferedReader()?.use { it.readText() }?.take(200) ?: ""
                    lastResponseBody = errorSnippet
                    Log.e(TAG, "Auth failed with HTTP $responseCode: $errorSnippet")

                    updateNotificationImmediately("Session expired — reopen app")
                    conn.disconnect()
                    return // Stop retries immediately on auth failure!
                }

                val responseBodySnippet = if (responseCode in 200..299) {
                    ""
                } else {
                    val errorStream = conn.errorStream
                    errorStream?.bufferedReader()?.use { it.readText() }?.take(200) ?: ""
                }
                lastResponseBody = responseBodySnippet

                conn.disconnect()

                if (responseCode in 200..299) {
                    consecutiveNetworkFailures = 0
                    if (attempt > 0) {
                        Log.d(TAG, "Location sent successfully after ${attempt + 1} attempts")
                    }
                    return // Success — exit retry loop
                } else {
                    Log.w(TAG, "API returned HTTP $responseCode (attempt ${attempt + 1}): $responseBodySnippet")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send location (attempt ${attempt + 1}): ${e.message}")
                if (attempt == maxRetries) {
                    consecutiveNetworkFailures++
                    updateNotificationImmediately("No network — retrying... ($consecutiveNetworkFailures)")
                }
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
