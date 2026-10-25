package io.zibloo.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * zibloo-alarms 插件(A0 §1):双域(提醒/计时段边界)幂等闹钟同步、
 * 精确闹钟权限引导、前台计时通知、到点事件上报。
 * 对应 PRD §4.1 的安卓可靠性路径。
 */
@CapacitorPlugin(name = "ZiblooAlarms")
class ZiblooAlarmsPlugin : Plugin() {

    private val firedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val data = JSObject()
            data.put("reminderId", intent.getStringExtra("reminderId") ?: "")
            data.put("firedAt", System.currentTimeMillis())
            notifyListeners("alarmFired", data)
        }
    }

    override fun load() {
        webViewAlive = true
        webVisible = true
        bridge.context.registerReceiver(
            firedReceiver,
            IntentFilter("io.zibloo.app.ALARM_FIRED")
        )
    }

    override fun handleOnDestroy() {
        webViewAlive = false
        webVisible = false
        try {
            bridge.context.unregisterReceiver(firedReceiver)
        } catch (e: IllegalArgumentException) {
            // 未注册时忽略
        }
    }

    /** 提醒域:全量替换式幂等同步,结构上无法表达「漏取消」(A0 §0) */
    @PluginMethod
    fun syncAlarms(call: PluginCall) {
        val exact = syncDomain(call, ReminderStore.KEY_REMINDERS, AlarmDomain.REMINDER)
        val result = JSObject()
        result.put("degraded", !exact)
        call.resolve(result)
    }

    /** 计时段边界兜底域:独立全量同步,不影响提醒域 */
    @PluginMethod
    fun syncTimerAlarms(call: PluginCall) {
        syncDomain(call, ReminderStore.KEY_TIMER, AlarmDomain.TIMER)
        call.resolve()
    }

    private fun syncDomain(call: PluginCall, storeKey: String, domain: String): Boolean {
        val array: JSArray = call.getArray("alarms") ?: JSArray()
        val raw = ArrayList<Map<String, Any?>>()
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i) ?: continue
            val map = HashMap<String, Any?>()
            map["reminderId"] = obj.optString("reminderId")
            map["at"] = obj.optLong("at")
            map["title"] = obj.optString("title")
            map["body"] = obj.optString("body")
            map["soundRes"] = obj.optString("soundRes")
            raw.add(map)
        }
        val items = AlarmScheduler.parse(raw)
        ReminderStore.save(bridge.context, storeKey, items)
        return AlarmScheduler.reschedule(bridge.context, storeKey, domain, items)
    }

    /** 页面可见性上报:计时段边界闹钟到点时据此决定是否由原生发声 */
    @PluginMethod
    fun setWebVisible(call: PluginCall) {
        webVisible = call.getBoolean("visible") ?: false
        call.resolve()
    }

    @PluginMethod
    fun getPermission(call: PluginCall) {
        val result = JSObject()
        result.put("state", exactState())
        call.resolve(result)
    }

    /**
     * 引导授权:跳系统精确闹钟设置(Android 14+ 默认拒绝),同时请求通知权限。
     * 返回当前状态;用户从设置返回后 UI 重新查询。
     */
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val activity = bridge.activity
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                1001
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !exactAllowed()) {
            val intent = Intent(
                Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:${activity.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        }
        val result = JSObject()
        result.put("state", exactState())
        call.resolve(result)
    }

    /** 计时前台服务(A0 §5.1) */
    @PluginMethod
    fun showTimerNotification(call: PluginCall) {
        TimerForegroundService.show(
            bridge.context,
            call.getString("title") ?: "Zibloo",
            call.getString("body") ?: ""
        )
        call.resolve()
    }

    @PluginMethod
    fun hideTimerNotification(call: PluginCall) {
        TimerForegroundService.hide(bridge.context)
        call.resolve()
    }

    private fun exactAllowed(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = bridge.context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            am.canScheduleExactAlarms()
        } else true

    private fun exactState(): String = if (exactAllowed()) "granted" else "denied"

    companion object {
        /** WebView 存活/页面可见性:静态标记,AlarmReceiver 在 App 进程内即可读取 */
        @Volatile var webViewAlive: Boolean = false
        @Volatile var webVisible: Boolean = false
    }
}
