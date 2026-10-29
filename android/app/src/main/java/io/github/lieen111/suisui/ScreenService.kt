package io.github.lieen111.suisui

import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.provider.Settings
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
        if (!enabled(this)) return
        runCatching {
            startActivity(
                Intent(this, LockActivity::class.java).addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                )
            )
        }
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
