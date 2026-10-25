package io.zibloo.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** 闹钟域:提醒(用户规则)与计时段边界(兜底)互不干扰,各自全量重排。 */
object AlarmDomain {
    const val REMINDER = "R"
    const val TIMER = "T"
}

/** 闹钟载荷:原生层只收绝对时刻与已翻译文案,不理解规则语义(A0 §2.4)。 */
data class AlarmItem(
    val reminderId: String,
    val at: Long,
    val title: String,
    val body: String,
    val soundRes: String
) {
    fun requestCode(domain: String): Int = "$domain:$reminderId:$at".hashCode()
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
     * 单域全量替换式幂等重排:只取消该域镜像里的旧闹钟,再排新集合。
     * 返回 true = 精确闹钟可用;false = 已降级(不精确但仍触发)。
     */
    fun reschedule(context: Context, storeKey: String, domain: String, items: List<AlarmItem>): Boolean {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (old in ReminderStore.load(context, storeKey)) cancel(context, old, domain)
        val exactAllowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.canScheduleExactAlarms()
        } else true
        for (item in items) schedule(context, am, item, domain, exactAllowed)
        return exactAllowed
    }

    private fun schedule(context: Context, am: AlarmManager, item: AlarmItem, domain: String, exact: Boolean) {
        val pi = pendingIntent(context, item, domain)
        if (exact) {
            // 用户主动设置的到点事项:setAlarmClock 级别(最可靠,系统展示闹钟图标)
            val show = PendingIntent.getActivity(
                context,
                item.requestCode(domain),
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            am.setAlarmClock(AlarmManager.AlarmClockInfo(item.at, show), pi)
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, item.at, pi)
        }
    }

    fun cancel(context: Context, item: AlarmItem, domain: String) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context, item, domain))
    }

    private fun pendingIntent(context: Context, item: AlarmItem, domain: String): PendingIntent {
        val intent = Intent(ALARM_ACTION).setPackage(context.packageName)
            .putExtra("domain", domain)
            .putExtra("reminderId", item.reminderId)
            .putExtra("at", item.at)
            .putExtra("title", item.title)
            .putExtra("body", item.body)
            .putExtra("soundRes", item.soundRes)
        return PendingIntent.getBroadcast(
            context,
            item.requestCode(domain),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
