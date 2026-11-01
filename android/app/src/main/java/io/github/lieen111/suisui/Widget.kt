package io.github.lieen111.suisui

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Home-screen widget "碎碎清单 · 今天": today's open tasks with a tap-to-complete circle, the progress, and
 * a + that opens the app. Refreshed whenever the data changes (LockCard.update).
 */
class SuiSuiWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) = ids.forEach { draw(ctx, manager, it) }

    companion object {
        fun updateAll(ctx: Context) {
            val manager = AppWidgetManager.getInstance(ctx) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(ctx, SuiSuiWidget::class.java))
            if (ids.isEmpty()) return
            ids.forEach { draw(ctx, manager, it) }
            @Suppress("DEPRECATION")
            manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
        }

        private fun draw(ctx: Context, manager: AppWidgetManager, id: Int) {
            val s = TodoStore.state(ctx)
            val open = s?.let { TodoStore.pending(it) } ?: emptyList()
            val done = s?.let { st -> TodoStore.done(st).count { TodoStore.dueToday(it) } } ?: 0
            val views = RemoteViews(ctx.packageName, R.layout.widget_suisui)
            views.setTextViewText(R.id.widget_count, if (open.isEmpty() && done == 0) "" else "$done/${open.size + done}")
            val app = PendingIntent.getActivity(ctx, 10, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_header, app)
            views.setOnClickPendingIntent(R.id.widget_add, app)
            val service = Intent(ctx, WidgetService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            service.data = Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME))
            @Suppress("DEPRECATION")
            views.setRemoteAdapter(R.id.widget_list, service)
            views.setEmptyView(R.id.widget_list, R.id.widget_empty)
            // Rows fill in the task id; the template must be mutable for that.
            val complete = PendingIntent.getBroadcast(
                ctx, 11, Intent(ctx, CompleteReceiver::class.java).setAction(LockCard.ACTION_COMPLETE),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            views.setPendingIntentTemplate(R.id.widget_list, complete)
            manager.updateAppWidget(id, views)
        }
    }
}

class WidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = object : RemoteViewsFactory {
        private var rows: List<Pair<String, String>> = emptyList()
        override fun onCreate() {}
        override fun onDataSetChanged() {
            val s = TodoStore.state(applicationContext)
            rows = (s?.let { TodoStore.pending(it) } ?: emptyList()).take(20).map { it.optString("id") to it.optString("title") }
        }
        override fun onDestroy() {}
        override fun getCount() = rows.size
        override fun getViewAt(position: Int): RemoteViews {
            val (id, title) = rows.getOrNull(position) ?: ("" to "")
            return RemoteViews(packageName, R.layout.widget_row).apply {
                setTextViewText(R.id.widget_row_title, title)
                setOnClickFillInIntent(R.id.widget_row_check, Intent().putExtra("id", id))
            }
        }
        override fun getLoadingView(): RemoteViews? = null
        override fun getViewTypeCount() = 1
        override fun getItemId(position: Int) = rows.getOrNull(position)?.first?.hashCode()?.toLong() ?: position.toLong()
        override fun hasStableIds() = true
    }
}
