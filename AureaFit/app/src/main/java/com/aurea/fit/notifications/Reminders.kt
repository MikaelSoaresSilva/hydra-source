package com.aurea.fit.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.aurea.fit.AureaApp
import com.aurea.fit.MainActivity
import com.aurea.fit.R
import com.aurea.fit.data.ScheduleEntity
import com.aurea.fit.domain.parseTime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId

object NextTrigger {
    /**
     * Próximo horário (epoch millis) em que um lembrete deve tocar.
     * @param daysMask bit 0 = segunda ... bit 6 = domingo.
     */
    fun compute(nowMillis: Long, time: String, daysMask: Int, zone: ZoneId = ZoneId.systemDefault()): Long? {
        if (daysMask and 0b1111111 == 0) return null
        val (h, m) = parseTime(time)
        val now = LocalDateTime.ofInstant(Instant.ofEpochMilli(nowMillis), zone)
        for (offset in 0..7) {
            val date = now.toLocalDate().plusDays(offset.toLong())
            val dow = date.dayOfWeek.value // 1 = segunda
            if (daysMask and (1 shl (dow - 1)) == 0) continue
            val candidate = date.atTime(h, m)
            if (candidate.isAfter(now)) return candidate.atZone(zone).toInstant().toEpochMilli()
        }
        return null
    }
}

class ReminderScheduler(private val context: Context) {

    companion object {
        const val CHANNEL_ROUTINE = "rotina"
        const val EXTRA_ID = "id"
        const val EXTRA_LABEL = "label"
        const val EXTRA_TYPE = "type"

        fun createChannels(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = context.getSystemService(NotificationManager::class.java)
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ROUTINE, "Rotina e lembretes", NotificationManager.IMPORTANCE_DEFAULT).apply {
                        description = "Refeições, treinos, hidratação, descanso e sono"
                    }
                )
            }
        }
    }

    private val alarm get() = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun pending(item: ScheduleEntity, flags: Int): PendingIntent? {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = "com.aurea.fit.REMINDER"
            putExtra(EXTRA_ID, item.id)
            putExtra(EXTRA_LABEL, item.label)
            putExtra(EXTRA_TYPE, item.type)
        }
        return PendingIntent.getBroadcast(context, item.id.toInt(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
    }

    fun schedule(item: ScheduleEntity) {
        cancel(item)
        if (!item.enabled) return
        val at = NextTrigger.compute(System.currentTimeMillis(), item.time, item.daysMask) ?: return
        val pi = pending(item, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
        runCatching { alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
    }

    fun scheduleAll(items: List<ScheduleEntity>) = items.forEach { schedule(it) }

    fun cancel(item: ScheduleEntity) {
        pending(item, PendingIntent.FLAG_NO_CREATE)?.let { alarm.cancel(it); it.cancel() }
    }

    fun cancelAll(items: List<ScheduleEntity>) = items.forEach { cancel(it) }

    fun canPostNotifications(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Mostra a notificação no sistema (se houver permissão) e registra na central do app. */
    fun show(id: Long, title: String, body: String) {
        if (!canPostNotifications()) return
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).putExtra("open", "notifications"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(context, CHANNEL_ROUTINE)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(open)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(id.toInt(), n)
        } catch (_: SecurityException) { }
    }
}

fun reminderText(type: String, label: String): Pair<String, String> = when (type) {
    "WAKE" -> "Bom dia! ☀️" to label
    "MEAL" -> "Hora da refeição: $label" to "Confira o que está no seu cardápio de hoje."
    "TRAINING" -> "Hora do treino! 💪" to "Seu treino de hoje está pronto. Cada sessão conta."
    "WATER" -> "Hidratação 💧" to "Beba um copo de água e registre no app."
    "REST" -> "Pausa" to label
    "SLEEP" -> "Hora de desacelerar 🌙" to "Dormir bem ajuda na recuperação muscular e no controle da fome."
    "CHECKIN" -> "Check-in semanal" to "Conte como foi sua semana para ajustarmos seu plano."
    else -> "Áurea" to label
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getLongExtra(ReminderScheduler.EXTRA_ID, -1)
        val label = intent.getStringExtra(ReminderScheduler.EXTRA_LABEL) ?: return
        val type = intent.getStringExtra(ReminderScheduler.EXTRA_TYPE) ?: ""
        val app = context.applicationContext as AureaApp
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val repo = app.container.repository
                val item = repo.db.schedule().byId(id)
                if (item != null && item.enabled && repo.settings.state.value.notificationsEnabled) {
                    val (title, body) = reminderText(type, label)
                    app.container.scheduler.show(id, title, body)
                    repo.logNotification(title, body)
                    app.container.scheduler.schedule(item) // agenda a próxima ocorrência
                }
            } finally {
                pending.finish()
            }
        }
    }
}

/** Reagenda os lembretes depois que o celular reinicia ou o horário muda. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext as AureaApp
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try { app.container.repository.rescheduleAll() } finally { pending.finish() }
        }
    }
}
