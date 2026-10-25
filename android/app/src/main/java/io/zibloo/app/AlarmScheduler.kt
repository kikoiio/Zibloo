package io.zibloo.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** 闹钟载荷:原生层只收绝对时刻与已翻译文案,不理解规则语义(A0 §2.4)。 */
data class AlarmItem(
    val reminderId: String,
    val at: Long,
    val title: String,
    val body: String,
    val soundRes: String
) {
    /** 稳定 requestCode:同一 (reminder, 时刻) 重排时可替换,不同闹钟互不覆盖 */
    val requestCode: Int
        get() = 31 * reminderId.hashCode() + (at % Int.MAX_VALUE).toInt()
}

object AlarmScheduler {
    private const val ALARM_ACTION = "io.zibloo.app.ALARM_FIRED"

    fun parse(list: List<Map<String, Any?>>): List<AlarmItem> =
        list.map {
            AlarmItem(
                reminderId = it["reminderId"] as? String ?: "",
                at = (it["at"] as? Number)?.toLong() ?: 0L,
                title = it["title"] as? String ?: "Zibloo",
                body = it["body"] as? String ?: "",
                soundRes = it["soundRes"] as? String ?: "chirrup_reminder"
            )
        }.filter { it.reminderId.isNotEmpty() && it.at > 0 }

    /**
     * 全量替换式幂等重排:先取消镜像里的全部旧闹钟,再排新集合。
     * 返回 true = 精确闹钟可用;false = 已降级(不精确但仍触发)。
     */
    fun reschedule(context: Context, items: List<AlarmItem>): Boolean {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // 先撤掉上一份镜像中的全部闹钟,避免漏取消(A0 §0)
        for (old in ReminderStore.load(context)) cancel(context, old)
        val exactAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.canScheduleExactAlarms()
        } else true
        for (item in items) schedule(context, am, item, exactAllowed)
        return exactAllowed
    }

    private fun schedule(context: Context, am: AlarmManager, item: AlarmItem, exact: Boolean) {
        val pi = pendingIntent(context, item)
        if (exact) {
            // 提醒是用户主动设置的到点事项,用 setAlarmClock 级别(最可靠,系统展示闹钟图标)
            val show = PendingIntent.getActivity(
                context,
                item.requestCode,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            am.setAlarmClock(AlarmManager.AlarmClockInfo(item.at, show), pi)
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, item.at, pi)
        }
    }

    fun cancel(context: Context, item: AlarmItem) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context, item))
    }

    private fun pendingIntent(context: Context, item: AlarmItem): PendingIntent {
        val intent = Intent(ALARM_ACTION).setPackage(context.packageName)
            .putExtra("reminderId", item.reminderId)
            .putExtra("at", item.at)
            .putExtra("title", item.title)
            .putExtra("body", item.body)
            .putExtra("soundRes", item.soundRes)
        return PendingIntent.getBroadcast(
            context,
            item.requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
