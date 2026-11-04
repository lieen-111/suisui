package io.github.lieen111.suisui

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Keeps 碎碎清单's lock view ready: when the screen turns off, LockActivity is placed on top of the
 * system lock screen, so the next time the phone wakes the user sees the designed lock screen and can
 * complete tasks right there. Needs "显示在其他应用上层" (overlay) to start the activity from the background;
 * some brands also need "锁屏显示" and "后台弹出界面". Runs as a foreground service with the to-do card
 * as its notification.
 */
class ScreenService : Service() {
    private val screenOff = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_SCREEN_OFF) showLockView()
        }
    }

    override fun onCreate() {
        super.onCreate()
        running = true
        ContextCompat.registerReceiver(this, screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        runCatching { ServiceCompat.startForeground(this, LockCard.NOTIFICATION_ID, LockCard.current(this), type) }
            .onFailure { stopSelf() }
        return START_STICKY
    }

    private fun showLockView() {
        if (enabled(this)) LockLauncher.launch(this)
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(screenOff) }
        // Keep the to-do card notification when the service stops.
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH)
        running = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        @Volatile
        var running = false

        /** The lock view is on when the user enabled it and the overlay permission is granted. */
        fun enabled(ctx: Context): Boolean {
            val s = TodoStore.state(ctx) ?: return false
            return s.optJSONObject("settings")?.optBoolean("lockScreen", false) == true && Settings.canDrawOverlays(ctx)
        }

        fun sync(ctx: Context) {
            val on = enabled(ctx)
            if (on && !running) {
                runCatching { ContextCompat.startForegroundService(ctx, Intent(ctx, ScreenService::class.java)) }
            } else if (!on && running) {
                ctx.stopService(Intent(ctx, ScreenService::class.java))
            }
        }
    }
}

/**
 * Brings up the lock view when the screen turns off, two ways at once:
 * 1. a direct activity start (allowed with "显示在其他应用上层", but some brands block it silently), and
 * 2. a full-screen-intent notification, which the system itself turns into the activity while the screen is
 *    off (how alarm and call apps appear on the lock screen). The notification is removed as soon as the
 *    lock view is up. Also keeps a small record of the last 20 screen-offs so settings can show how often
 *    the lock view actually came up.
 */
object LockLauncher {
    private const val CHANNEL = "lock_launch"
    private const val NOTIFICATION_ID = 1002
    private const val PREFS = "lock_stats"
    private const val KEEP = 20

    fun launch(ctx: Context) {
        record(ctx)
        val intent = Intent(ctx, LockActivity::class.java).addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
        )
        runCatching { ctx.startActivity(intent) }
        if (fullScreenAllowed(ctx) && LockCard.notificationsAllowed(ctx)) runCatching { postFullScreen(ctx, intent) }
    }

    @SuppressLint("MissingPermission")
    private fun postFullScreen(ctx: Context, intent: Intent) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, Lang.t(ctx, "锁屏界面", "Lock view"), NotificationManager.IMPORTANCE_HIGH).apply {
                description = Lang.t(ctx, "熄屏后显示碎碎清单锁屏时短暂使用，会自动消失", "Used briefly to show the SuiSui lock view")
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
                lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET
            })
        }
        val pi = PendingIntent.getActivity(ctx, 7, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_check)
            .setContentTitle(Lang.t(ctx, "碎碎清单", "SuiSui"))
            .setContentText(Lang.t(ctx, "今天的待办", "Today's to-dos"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setFullScreenIntent(pi, true)
            .setAutoCancel(true)
            .setTimeoutAfter(15_000)
            .build()
        NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, n)
    }

    /** Called by LockActivity when it comes up. */
    fun shown(ctx: Context) {
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID)
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val hist = prefs.getString("hist", "") ?: ""
        if (hist.endsWith("0")) prefs.edit().putString("hist", hist.dropLast(1) + "1").apply()
    }

    private fun record(ctx: Context) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString("hist", ((prefs.getString("hist", "") ?: "") + "0").takeLast(KEEP)).apply()
    }

    /** (screen-offs recorded, times the lock view came up) over the last 20. */
    fun stats(ctx: Context): Pair<Int, Int> {
        val hist = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("hist", "") ?: ""
        return hist.length to hist.count { it == '1' }
    }

    fun resetStats(ctx: Context) { ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("hist").apply() }

    fun batteryUnrestricted(ctx: Context): Boolean =
        ctx.getSystemService(PowerManager::class.java)?.isIgnoringBatteryOptimizations(ctx.packageName) == true

    fun fullScreenAllowed(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 34 || ctx.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
}
