package io.github.lieen111.suisui

import android.content.Context
import org.json.JSONObject

/** The app's language setting (settings.lang, written by the page): "en" switches native text to English. */
object Lang {
    fun en(ctx: Context): Boolean = runCatching {
        JSONObject(TodoStore.read(ctx) ?: return false).optJSONObject("settings")?.optString("lang") == "en"
    }.getOrDefault(false)

    fun t(ctx: Context, zh: String, en: String): String = if (en(ctx)) en else zh
}
