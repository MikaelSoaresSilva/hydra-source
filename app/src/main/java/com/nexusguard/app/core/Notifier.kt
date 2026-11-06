package com.nexusguard.app.core

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.nexusguard.app.MainActivity
import com.nexusguard.app.R
import com.nexusguard.app.data.AlertEntry
import com.nexusguard.app.data.HistoryRepository

/** Alertas: sempre registrados no histórico; notificação só se o usuário permitir. */
class Notifier(private val context: Context, private val repo: HistoryRepository, private val settings: SettingsRepository) {

    companion object {
        const val CH_SECURITY = "security_alerts"
        const val CH_NETWORK = "network_alerts"
        const val CH_MONITOR = "stability_monitor"
        const val MONITOR_ID = 4242

        fun createChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CH_SECURITY, "Alertas de segurança", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Configurações perigosas, apps de risco, links e Wi-Fi inseguro"
            })
            nm.createNotificationChannel(NotificationChannel(CH_NETWORK, "Alertas de conexão", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Quedas de internet e problemas de rede detectados"
            })
            nm.createNotificationChannel(NotificationChannel(CH_MONITOR, "Modo Estabilidade", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notificação fixa enquanto o monitoramento estiver ligado"
                setShowBadge(false)
            })
        }

        fun canPost(context: Context): Boolean =
            (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
                NotificationManagerCompat.from(context).areNotificationsEnabled()

        fun openAppIntent(context: Context, route: String? = null): PendingIntent {
            val i = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                route?.let { putExtra(MainActivity.EXTRA_ROUTE, it) }
            }
            return PendingIntent.getActivity(context, route?.hashCode() ?: 0, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
    }

    /**
     * Registra o alerta. Evita repetir o mesmo título em menos de [dedupeHours] horas.
     * @return true se um novo alerta foi criado.
     */
    suspend fun alert(category: String, severity: String, title: String, message: String, route: String? = null, dedupeHours: Int = 12): Boolean {
        val since = System.currentTimeMillis() - dedupeHours * 3_600_000L
        if (repo.alerts.findRecent(title, since) != null) return false
        repo.alerts.insert(AlertEntry(category = category, severity = severity, title = title, message = message))
        val s = settings.current()
        val allowed = if (category == "security") s.notifySecurity else s.notifyNetwork
        if (allowed && canPost(context)) {
            val n = NotificationCompat.Builder(context, if (category == "security") CH_SECURITY else CH_NETWORK)
                .setSmallIcon(R.drawable.ic_stat_shield)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(if (severity == "high") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(openAppIntent(context, route))
                .setAutoCancel(true)
                .build()
            try {
                NotificationManagerCompat.from(context).notify(title.hashCode(), n)
            } catch (_: SecurityException) { }
        }
        return true
    }
}
