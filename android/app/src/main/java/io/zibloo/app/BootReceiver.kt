package io.zibloo.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 重启/覆盖安装后从镜像重建提醒域闹钟(V3)。
 * 规则表为唯一事实源,原生调度只是它的投影(A0 §2.2)。
 * 计时域随进程消失:会话已不存在,重建会造成幽灵响铃,只清不建。
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val reminders = ReminderStore.load(context, ReminderStore.KEY_REMINDERS)
        if (reminders.isNotEmpty()) {
            AlarmScheduler.reschedule(context, ReminderStore.KEY_REMINDERS, AlarmDomain.REMINDER, reminders)
        }
        ReminderStore.save(context, ReminderStore.KEY_TIMER, emptyList())
    }
}
