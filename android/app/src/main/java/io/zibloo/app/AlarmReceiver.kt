package io.zibloo.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * 到点接收器:直接发通知 + 原生 MediaPlayer 播叫声 + 震动,不依赖 WebView 存活
 * (PRD §4.1 / A0 §5.2);铃声资源随 APK 打包。
 *
 * 计时域可见性去重:WebView 存活且页面可见时让位给 JS(它自己会发声/更新 UI),
 * 其余情况(被杀、后台、锁屏)由这里发声。
 */
class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getStringExtra("reminderId") ?: return
        val domain = intent.getStringExtra("domain") ?: AlarmDomain.REMINDER
        val title = intent.getStringExtra("title") ?: "Zibloo"
        val body = intent.getStringExtra("body") ?: ""
        val soundRes = intent.getStringExtra("soundRes") ?: "chirrup_reminder"

        if (domain == AlarmDomain.TIMER &&
            ZiblooAlarmsPlugin.webViewAlive &&
            ZiblooAlarmsPlugin.webVisible
        ) {
            return // 前台可见:JS ticker 已在处理,避免双重发声
        }

        notify(context, domain, reminderId, title, body)
        playSound(context, soundRes)
        vibrate(context)

        if (domain == AlarmDomain.REMINDER) {
            // 进程若存活,让 WebView 侧呈现召唤态
            context.sendBroadcast(
                Intent("io.zibloo.app.ALARM_FIRED").setPackage(context.packageName)
                    .putExtra("reminderId", reminderId)
            )
        }
    }

    private fun notify(context: Context, domain: String, reminderId: String, title: String, body: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = if (domain == AlarmDomain.TIMER) TimerForegroundService.CHANNEL else CHANNEL
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(channel, "Zibloo", NotificationManager.IMPORTANCE_HIGH)
            )
        }
        val open = PendingIntent.getActivity(
            context,
            ("$domain$reminderId").hashCode(),
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification: Notification = NotificationCompat.Builder(context, channel)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setContentIntent(open)
            .build()
        nm.notify(("$domain$reminderId").hashCode(), notification)
    }

    private fun playSound(context: Context, soundRes: String) {
        val resId = context.resources.getIdentifier(soundRes, "raw", context.packageName)
        if (resId == 0) return
        val pending = goAsync()
        try {
            val player = MediaPlayer()
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            player.setAudioAttributes(attrs)
            player.setDataSource(context, android.net.Uri.parse("android.resource://${context.packageName}/$resId"))
            player.setOnCompletionListener { mp ->
                mp.release()
                pending.finish()
            }
            player.setOnErrorListener { mp, _, _ ->
                mp.release()
                pending.finish()
                true
            }
            player.prepare()
            player.start()
        } catch (e: Exception) {
            pending.finish()
        }
    }

    private fun vibrate(context: Context) {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator?
        }
        vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 180, 120, 180), -1))
    }

    companion object {
        const val CHANNEL = "zibloo_reminders"
    }
}
