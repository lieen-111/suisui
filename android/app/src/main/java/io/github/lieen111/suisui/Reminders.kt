package io.github.lieen111.suisui

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Calendar

/**
 * "到点提醒": every task with a time (HH:MM) rings on the days it is due — from the stored data, so it
 * works with the app closed. Re-planned on every save, on resume, after a reboot and at midnight
 * (all of which go through LockCard.update). Covers today and tomorrow.
 */
object Reminders {
    private const val CHANNEL = "reminders"
    private const val PREFS = "reminders"

    private fun intent(ctx: Context) = Intent(ctx, ReminderReceiver::class.java)

    fun schedule(ctx: Context) {
        val s = TodoStore.state(ctx) ?: return
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = prefs.getStringSet("codes", emptySet()) ?: emptySet()
        val now = System.currentTimeMillis()
        val codes = mutableSetOf<String>()
        val tasks = s.optJSONArray("tasks")
        for (offset in 0..1) {
            val day = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, offset) }
            for (i in 0 until (tasks?.length() ?: 0)) {
                val t = tasks!!.optJSONObject(i) ?: continue
                val time = t.optString("time", "")
                if (!Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(time)) continue
                val repeating = t.optString("repeat", "none") != "none"
                if (t.optBoolean("done") && (offset == 0 || !repeating)) continue
                if (!TodoStore.dueToday(t, day)) continue
                val at = (day.clone() as Calendar).apply {
                    set(Calendar.HOUR_OF_DAY, time.substring(0, 2).toInt()); set(Calendar.MINUTE, time.substring(3, 5).toInt())
                    set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                }.timeInMillis
                if (at <= now) continue
                val id = t.optString("id")
                val code = (id + TodoStore.dayKey(day)).hashCode()
                codes += code.toString()
                val pi = PendingIntent.getBroadcast(
                    ctx, code, intent(ctx).putExtra("id", id).putExtra("title", t.optString("title")).putExtra("time", time),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                runCatching {
                    if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                    else am.setWindow(AlarmManager.RTC_WAKEUP, at, 60_000, pi)
                }
            }
        }
        for (c in old - codes) {
            runCatching { am.cancel(PendingIntent.getBroadcast(ctx, c.toInt(), intent(ctx), PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE) ?: return@runCatching) }
        }
        prefs.edit().putStringSet("codes", codes).apply()
    }

    @SuppressLint("MissingPermission")
    fun ring(ctx: Context, id: String, title: String, time: String) {
        // Still open? (It may have been finished or deleted since the alarm was set.)
        val s = TodoStore.state(ctx) ?: return
        val tasks = s.optJSONArray("tasks") ?: return
        val open = (0 until tasks.length()).mapNotNull { tasks.optJSONObject(it) }.any { it.optString("id") == id && !it.optBoolean("done") }
        if (!open || !LockCard.notificationsAllowed(ctx)) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "到点提醒", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "设了时间的待办到点提醒"; enableVibration(true); lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            })
        val notifId = 2000 + (id.hashCode() and 0xFFFF)
        val done = PendingIntent.getBroadcast(
            ctx, notifId, Intent(ctx, CompleteReceiver::class.java).setAction(LockCard.ACTION_COMPLETE).putExtra("id", id).putExtra("notification", notifId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val open2 = PendingIntent.getActivity(ctx, notifId, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        NotificationManagerCompat.from(ctx).notify(notifId, NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_check)
            .setContentTitle(title)
            .setContentText("$time 到了")
            .setContentIntent(open2)
            .addAction(0, "完成", done)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build())
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Reminders.ring(context, intent.getStringExtra("id") ?: return, intent.getStringExtra("title") ?: "", intent.getStringExtra("time") ?: "")
    }
}
