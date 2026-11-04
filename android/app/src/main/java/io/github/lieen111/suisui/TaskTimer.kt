package io.github.lieen111.suisui

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.io.File

/**
 * Task timers started in the app: while one runs, an ongoing notification counts down (visible on the
 * lock screen); when it ends, an alarm posts "时间到" with sound and vibration even if the app is closed.
 * Also saves review posters to the photo library.
 */
object TaskTimer {
    private const val RUNNING_CHANNEL = "timer_running"
    private const val DONE_CHANNEL = "timer_done"
    const val RUNNING_ID = 1003
    const val DONE_ID = 1004

    private fun channels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(RUNNING_CHANNEL) == null) nm.createNotificationChannel(
            NotificationChannel(RUNNING_CHANNEL, Lang.t(ctx, "计时中", "Timer"), NotificationManager.IMPORTANCE_LOW).apply {
                description = Lang.t(ctx, "正在倒计时的任务", "The task being timed"); setShowBadge(false); lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            })
        if (nm.getNotificationChannel(DONE_CHANNEL) == null) nm.createNotificationChannel(
            NotificationChannel(DONE_CHANNEL, Lang.t(ctx, "计时结束", "Timer finished"), NotificationManager.IMPORTANCE_HIGH).apply {
                description = Lang.t(ctx, "任务时长到了", "Time is up"); enableVibration(true); lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            })
    }

    private fun openApp(ctx: Context) = PendingIntent.getActivity(
        ctx, 3, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    private fun alarmIntent(ctx: Context, title: String = "") = PendingIntent.getBroadcast(
        ctx, 4, Intent(ctx, TimerReceiver::class.java).putExtra("title", title), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    @SuppressLint("MissingPermission")
    fun set(ctx: Context, json: String) {
        val nm = NotificationManagerCompat.from(ctx)
        val am = ctx.getSystemService(AlarmManager::class.java)
        am.cancel(alarmIntent(ctx))
        val t = runCatching { JSONObject(json) }.getOrNull()
        if (t == null) { nm.cancel(RUNNING_ID); return }
        channels(ctx)
        val title = t.optString("title")
        val endsAt = t.optLong("endsAt", 0L)
        val left = t.optLong("left", 0L)
        val running = endsAt > System.currentTimeMillis()
        val b = NotificationCompat.Builder(ctx, RUNNING_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_check)
            .setContentTitle(if (running) Lang.t(ctx, "专注中：$title", "Focusing: $title") else Lang.t(ctx, "已暂停：$title", "Paused: $title"))
            .setContentIntent(openApp(ctx))
            .setOngoing(running)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        if (running) {
            b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(endsAt).setShowWhen(true).setContentText(Lang.t(ctx, "到时间会提醒你", "You'll be told when time is up"))
            val pi = alarmIntent(ctx, title)
            runCatching {
                if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pi)
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pi)
            }
        } else {
            val s = (left / 1000).toInt()
            b.setShowWhen(false).setContentText(String.format(Lang.t(ctx, "还剩 %02d:%02d", "%02d:%02d left"), s / 60, s % 60))
        }
        if (LockCard.notificationsAllowed(ctx)) runCatching { nm.notify(RUNNING_ID, b.build()) }
    }

    @SuppressLint("MissingPermission")
    fun done(ctx: Context, title: String) {
        val nm = NotificationManagerCompat.from(ctx)
        nm.cancel(RUNNING_ID)
        if (!LockCard.notificationsAllowed(ctx)) return
        channels(ctx)
        nm.notify(DONE_ID, NotificationCompat.Builder(ctx, DONE_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_check)
            .setContentTitle(Lang.t(ctx, "时间到", "Time's up"))
            .setContentText(if (title.isBlank()) Lang.t(ctx, "计时结束了", "The timer finished") else Lang.t(ctx, "「$title」的时间到了，点开标记完成", "Time's up for “$title” — tap to mark it done"))
            .setContentIntent(openApp(ctx))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build())
    }

    /** Pictures/碎碎清单 via MediaStore (no permission needed on Android 10+); app pictures folder before that. */
    fun saveImage(ctx: Context, bytes: ByteArray, fileName: String): Boolean {
        val name = fileName.replace(Regex("[\\\\/:*?\"<>|]"), "-")
        return if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/碎碎清单")
            }
            val uri = ctx.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return false
            ctx.contentResolver.openOutputStream(uri)?.use { it.write(bytes) } != null
        } else {
            val dir = ctx.getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: return false
            File(dir, name).writeBytes(bytes)
            true
        }
    }
}

/** The countdown reached zero. */
class TimerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        TaskTimer.done(context, intent.getStringExtra("title") ?: "")
    }
}
