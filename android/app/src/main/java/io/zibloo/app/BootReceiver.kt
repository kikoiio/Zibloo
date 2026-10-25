package io.zibloo.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 重启/覆盖安装后从镜像重建全部闹钟(V3)。
 * 规则表为唯一事实源,原生调度只是它的投影(A0 §2.2)。
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val items = ReminderStore.load(context)
        if (items.isNotEmpty()) AlarmScheduler.reschedule(context, items)
    }
}
