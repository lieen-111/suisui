package io.github.lieen111.suisui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper

/** "✓ 完成" tapped on the lock-screen card. */
class CompleteReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        TodoStore.complete(context, id)
        LockCard.update(context)
        Handler(Looper.getMainLooper()).post { TodoStore.onChange?.invoke() }
    }
}

/** Just after midnight: apply the new-day rules and redraw the card. */
class MidnightReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        LockCard.update(context)
        Handler(Looper.getMainLooper()).post { TodoStore.onChange?.invoke() }
    }
}

/** After a reboot or an app update, put the card back. */
class SystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        LockCard.update(context)
    }
}
