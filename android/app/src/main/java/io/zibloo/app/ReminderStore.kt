package io.zibloo.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * 闹钟载荷镜像(SharedPreferences JSON,commit 落盘):
 * 重启后 BootReceiver 不依赖 WebView 即可重建全部闹钟(A0 §5.3)。
 */
object ReminderStore {
    private const val PREFS = "zibloo_alarms"
    private const val KEY = "alarms_json"

    fun save(context: Context, items: List<AlarmItem>) {
        val array = JSONArray()
        for (item in items) {
            array.put(
                JSONObject()
                    .put("reminderId", item.reminderId)
                    .put("at", item.at)
                    .put("title", item.title)
                    .put("body", item.body)
                    .put("soundRes", item.soundRes)
            )
        }
        prefs(context).edit().putString(KEY, array.toString()).commit()
    }

    fun load(context: Context): List<AlarmItem> {
        val raw = prefs(context).getString(KEY, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).map { i ->
                val o = array.getJSONObject(i)
                AlarmItem(
                    reminderId = o.optString("reminderId"),
                    at = o.optLong("at"),
                    title = o.optString("title", "Zibloo"),
                    body = o.optString("body"),
                    soundRes = o.optString("soundRes", "chirrup_reminder")
                )
            }.filter { it.reminderId.isNotEmpty() && it.at > 0 }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
