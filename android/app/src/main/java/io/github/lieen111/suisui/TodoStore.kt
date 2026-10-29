package io.github.lieen111.suisui

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.Locale

/**
 * Native copy of the web app's state (same JSON as localStorage `suisui-locktodo-v1`, without the
 * wallpaper photo). The web app writes it through the JS bridge; lock-screen "完成" taps write it here.
 * Rules mirror app/app.js: pending first (pinned first), done in completion order, new-day rollover.
 */
object TodoStore {
    private const val FILE = "suisui-data.json"
    private const val ARCHIVE_LIMIT = 300

    /** Set by MainActivity while visible, so a lock-screen tap refreshes the open web view. */
    @Volatile
    var onChange: (() -> Unit)? = null

    private fun file(ctx: Context) = File(ctx.filesDir, FILE)

    @Synchronized
    fun read(ctx: Context): String? = file(ctx).takeIf { it.exists() }?.readText()

    @Synchronized
    fun write(ctx: Context, json: String) {
        val target = file(ctx)
        val tmp = File(target.parentFile, "$FILE.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(target)) {
            target.writeText(json)
            tmp.delete()
        }
    }

    /** Current state with the new-day rules applied (and persisted if they changed anything). */
    @Synchronized
    fun state(ctx: Context): JSONObject? {
        val raw = read(ctx) ?: return null
        val s = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (rollover(s)) write(ctx, s.toString())
        return s
    }

    @Synchronized
    fun complete(ctx: Context, id: String): Boolean {
        val s = state(ctx) ?: return false
        val tasks = s.optJSONArray("tasks") ?: return false
        var latest = 0L
        for (i in 0 until tasks.length()) latest = maxOf(latest, tasks.getJSONObject(i).optLong("completedAt", 0L) + 1)
        for (i in 0 until tasks.length()) {
            val t = tasks.getJSONObject(i)
            if (t.optString("id") == id && !t.optBoolean("done")) {
                t.put("done", true)
                t.put("completedAt", maxOf(System.currentTimeMillis(), latest))
                write(ctx, s.toString())
                return true
            }
        }
        return false
    }

    fun pending(s: JSONObject): List<JSONObject> {
        val open = items(s).filter { !it.optBoolean("done") }
        return open.filter { it.optBoolean("pinned") } + open.filter { !it.optBoolean("pinned") }
    }

    fun done(s: JSONObject): List<JSONObject> =
        items(s).filter { it.optBoolean("done") }.sortedBy { it.optLong("completedAt", 0L) }

    private fun items(s: JSONObject): List<JSONObject> {
        val tasks = s.optJSONArray("tasks") ?: return emptyList()
        return (0 until tasks.length()).mapNotNull { tasks.optJSONObject(it) }
    }

    fun dayKey(cal: Calendar = Calendar.getInstance()): String =
        String.format(Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))

    private fun startOfToday(): Long = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    /** Same as rollover() in app.js. Records without a day count as today. */
    fun rollover(s: JSONObject): Boolean {
        val today = dayKey()
        val day = s.optString("day", "")
        if (day == today) return false
        if (day.isEmpty()) { s.put("day", today); return true }
        val cutoff = startOfToday()
        val autoArchive = s.optJSONObject("settings")?.optBoolean("autoArchive", true) ?: true
        val tasks = s.optJSONArray("tasks") ?: JSONArray()
        val archive = s.optJSONArray("archive") ?: JSONArray()
        val keep = JSONArray()
        val now = System.currentTimeMillis()
        for (i in 0 until tasks.length()) {
            val t = tasks.optJSONObject(i) ?: continue
            val done = t.optBoolean("done")
            when {
                done && t.optString("repeat") == "daily" -> { t.put("done", false); t.put("completedAt", 0); keep.put(t) }
                done && autoArchive && t.optLong("completedAt", 0L) < cutoff -> { t.put("archivedAt", now); archive.put(t) }
                else -> keep.put(t)
            }
        }
        val trimmed = JSONArray()
        for (i in maxOf(0, archive.length() - ARCHIVE_LIMIT) until archive.length()) trimmed.put(archive.get(i))
        s.put("tasks", keep)
        s.put("archive", trimmed)
        s.put("day", today)
        return true
    }
}
