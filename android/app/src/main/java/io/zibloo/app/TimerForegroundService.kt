package io.zibloo.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * 计时运行中的前台服务:只负责保活与常驻通知,不 tick 计时(A0 §5.1)。
 * 剩余时间由 WebView 侧的纯推导驱动,经插件更新文案;段边界由 AlarmManager 兜底。
 */
class TimerForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_HIDE -> {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Zibloo"
                val body = intent?.getStringExtra(EXTRA_BODY) ?: ""
                startForeground(NOTIFICATION_ID, buildNotification(title, body))
            }
        }
        return START_STICKY
    }

    private fun buildNotification(title: String, body: String): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Zibloo timer", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            .build()
    }

    companion object {
        const val CHANNEL = "zibloo_timer"
        const val NOTIFICATION_ID = 42
        const val ACTION_SHOW = "io.zibloo.app.TIMER_SHOW"
        const val ACTION_HIDE = "io.zibloo.app.TIMER_HIDE"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"

        fun show(context: Context, title: String, body: String) {
            val intent = Intent(context, TimerForegroundService::class.java)
                .setAction(ACTION_SHOW)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body)
            context.startForegroundService(intent)
        }

        fun hide(context: Context) {
            context.startForegroundService(
                Intent(context, TimerForegroundService::class.java).setAction(ACTION_HIDE)
            )
        }
    }
}
