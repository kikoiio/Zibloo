package io.zibloo.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 重启/覆盖安装后两域都不重建。
 * 提醒产品已下线:取消残留提醒闹钟并清空镜像。
 * 计时域随进程消失:会话已不在原生侧,重建会造成幽灵响铃;打开应用后由 loadRuns 再同步。
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        AlarmScheduler.reschedule(context, ReminderStore.KEY_REMINDERS, AlarmDomain.REMINDER, emptyList())
        ReminderStore.save(context, ReminderStore.KEY_REMINDERS, emptyList())
        AlarmScheduler.reschedule(context, ReminderStore.KEY_TIMER, AlarmDomain.TIMER, emptyList())
        ReminderStore.save(context, ReminderStore.KEY_TIMER, emptyList())
    }
}
