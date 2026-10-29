package io.github.lieen111.suisui

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StrikethroughSpan
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Calendar

/**
 * The lock-screen card: one persistent notification listing today's to-dos with "完成" buttons.
 * Visible on the lock screen (VISIBILITY_PUBLIC) and tappable without unlocking where the system allows.
 */
object LockCard {
    private const val CHANNEL = "lock_card"
    private const val NOTIFICATION_ID = 1001
    private const val ACCENT = 0xFF13765B.toInt()
    const val ACTION_COMPLETE = "io.github.lieen111.suisui.COMPLETE"

    fun permissionGranted(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun notificationsAllowed(ctx: Context): Boolean =
        permissionGranted(ctx) && NotificationManagerCompat.from(ctx).areNotificationsEnabled()

    private fun ensureChannel(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) != null) return
        // Default importance (not "silent") so launchers keep it on the lock screen; no sound or vibration.
        val channel = NotificationChannel(CHANNEL, ctx.getString(R.string.channel_name), NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = ctx.getString(R.string.channel_description)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            setSound(null, null)
            enableVibration(false)
            setShowBadge(true)
        }
        nm.createNotificationChannel(channel)
    }

    @SuppressLint("MissingPermission")
    fun update(ctx: Context) {
        val nm = NotificationManagerCompat.from(ctx)
        val s = TodoStore.state(ctx)
        val enabled = s?.optJSONObject("settings")?.optBoolean("lockNotify", false) ?: false
        if (s == null || !enabled) { nm.cancel(NOTIFICATION_ID); return }
        ensureChannel(ctx)
        if (!notificationsAllowed(ctx)) return

        val open = TodoStore.pending(s)
        val done = TodoStore.done(s)
        val openApp = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val builder = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_check)
            .setColor(ACCENT)
            .setContentIntent(openApp)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)

        if (open.isEmpty()) {
            builder.setContentTitle(if (done.isEmpty()) "今天还没有待办" else "今天的事，圆满完成。")
                .setContentText(if (done.isEmpty()) "打开碎碎清单添加一件" else "完成了 ${done.size} 件")
                .setOngoing(false)
                .setAutoCancel(true)
        } else {
            val style = NotificationCompat.InboxStyle()
            open.take(5).forEach { style.addLine("○  " + it.optString("title")) }
            if (open.size > 5) style.addLine("…还有 ${open.size - 5} 件")
            // Finished items stay visible at the end, struck through and dimmed, like the app's card.
            done.takeLast(2).forEach {
                val line = SpannableString("✓  " + it.optString("title"))
                line.setSpan(StrikethroughSpan(), 0, line.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                line.setSpan(ForegroundColorSpan(Color.argb(128, 120, 130, 125)), 0, line.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                style.addLine(line)
            }
            style.setSummaryText(if (done.isEmpty()) "今天的待办" else "已完成 ${done.size} 件")
            builder.setContentTitle("今天还有 ${open.size} 件待办")
                .setContentText("下一件：" + open.first().optString("title"))
                .setStyle(style)
                .setOngoing(true)
            open.take(3).forEach { task ->
                val id = task.optString("id")
                val complete = PendingIntent.getBroadcast(
                    ctx, id.hashCode(),
                    Intent(ctx, CompleteReceiver::class.java).setAction(ACTION_COMPLETE).putExtra("id", id),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                builder.addAction(
                    NotificationCompat.Action.Builder(0, "✓ " + short(task.optString("title")), complete)
                        .setAuthenticationRequired(false)
                        .build()
                )
            }
        }
        try { nm.notify(NOTIFICATION_ID, builder.build()) } catch (e: SecurityException) { /* permission revoked */ }
        scheduleMidnight(ctx)
    }

    private fun short(title: String) = if (title.length > 7) title.take(7) + "…" else title

    /** Refresh right after midnight so daily items reset and yesterday's finished items leave the card. */
    private fun scheduleMidnight(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = PendingIntent.getBroadcast(
            ctx, 7, Intent(ctx, MidnightReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val next = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 1); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
    }
}
