package com.nexusguard.app.network

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.nexusguard.app.NexusApp
import com.nexusguard.app.R
import com.nexusguard.app.core.Notifier
import com.nexusguard.app.data.HistoryRepository
import com.nexusguard.app.data.Kind
import com.nexusguard.app.data.StabilityEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket

data class StabilitySample(val t: Long, val rttMs: Double?, val type: ConnType)

data class StabilityState(
    val running: Boolean = false,
    val session: Long = 0,
    val startedAt: Long = 0,
    val intervalSec: Int = 5,
    val samples: List<StabilitySample> = emptyList(),
    val total: Int = 0,
    val failures: Int = 0,
    val outages: Int = 0,
    val longestOutageMs: Long = 0,
    val outageStart: Long? = null,
    val networkChanges: Int = 0,
    val allRtts: List<Double> = emptyList()
) {
    fun summary(now: Long = System.currentTimeMillis()) = StabilitySummary(
        total, failures, outages, longestOutageMs / 1000, Stats.median(allRtts), Stats.jitter(allRtts.takeLast(200)), networkChanges,
        if (startedAt == 0L) 0 else (now - startedAt) / 1000
    )
}

/** Estado compartilhado do Modo Estabilidade (lido pela interface). */
object StabilityTracker {
    private val _state = MutableStateFlow(StabilityState())
    val state: StateFlow<StabilityState> = _state.asStateFlow()

    internal fun set(s: StabilityState) { _state.value = s }
    internal fun update(f: (StabilityState) -> StabilityState) { _state.value = f(_state.value) }

    fun start(context: Context, intervalSec: Int) {
        val i = Intent(context, StabilityService::class.java).putExtra(StabilityService.EXTRA_INTERVAL, intervalSec)
        ContextCompat.startForegroundService(context, i)
    }

    fun stop(context: Context) {
        context.startService(Intent(context, StabilityService::class.java).setAction(StabilityService.ACTION_STOP))
    }

    /** Uma verificação: conexão TCP a dois destinos independentes; só conta falha se ambos falharem. */
    fun probe(): Double? {
        val targets = listOf("1.1.1.1" to 443, "8.8.8.8" to 443, "9.9.9.9" to 443)
        for ((h, p) in targets.shuffled().take(2)) {
            val t0 = System.nanoTime()
            val ok = runCatching { Socket().use { it.connect(InetSocketAddress(h, p), 2500) } }.isSuccess
            if (ok) return (System.nanoTime() - t0) / 1e6
        }
        return null
    }
}

class StabilityService : LifecycleService() {
    companion object {
        const val ACTION_STOP = "com.nexusguard.app.STOP_STABILITY"
        const val EXTRA_INTERVAL = "interval"
    }

    private var loop: Job? = null
    private var consecutiveFail = 0
    private lateinit var repo: HistoryRepository

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val app = application as NexusApp
        repo = app.container.history
        if (intent?.action == ACTION_STOP) { finish(); return START_NOT_STICKY }
        val interval = intent?.getIntExtra(EXTRA_INTERVAL, 5) ?: 5
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, Notifier.MONITOR_ID, notification("Iniciando monitoramento…"), type)
        if (loop?.isActive == true) return START_NOT_STICKY

        val session = System.currentTimeMillis()
        StabilityTracker.set(StabilityState(running = true, session = session, startedAt = session, intervalSec = interval))
        lifecycleScope.launch(Dispatchers.IO) { repo.stability.insert(StabilityEvent(session = session, type = "start", detail = "Monitoramento iniciado (a cada $interval s)")) }

        val monitor = app.container.monitor
        lifecycleScope.launch {
            monitor.changes.drop(1).collect {
                val st = monitor.state.value
                StabilityTracker.update { it.copy(networkChanges = it.networkChanges + 1) }
                withContext(Dispatchers.IO) {
                    repo.stability.insert(StabilityEvent(session = session, type = "network_change", detail = "Rede mudou para ${st.type.label}"))
                }
            }
        }

        loop = lifecycleScope.launch(Dispatchers.IO) {
            var lastNotif = 0L
            while (isActive) {
                val rtt = StabilityTracker.probe()
                val now = System.currentTimeMillis()
                val connType = monitor.state.value.type
                if (rtt == null) consecutiveFail++ else consecutiveFail = 0
                var endedOutage: Long? = null
                StabilityTracker.update { s ->
                    var outageStart = s.outageStart
                    var outages = s.outages
                    var longest = s.longestOutageMs
                    if (rtt == null && consecutiveFail == 2 && outageStart == null) {
                        outageStart = now - interval * 1000L; outages++
                    }
                    if (rtt != null && outageStart != null) {
                        val dur = now - outageStart
                        endedOutage = dur
                        longest = maxOf(longest, dur)
                        outageStart = null
                    }
                    s.copy(
                        samples = (s.samples + StabilitySample(now, rtt, connType)).takeLast(180),
                        total = s.total + 1,
                        failures = s.failures + if (rtt == null) 1 else 0,
                        outages = outages, longestOutageMs = longest, outageStart = outageStart,
                        allRtts = if (rtt != null) (s.allRtts + rtt).takeLast(2000) else s.allRtts
                    )
                }
                endedOutage?.let { dur ->
                    repo.stability.insert(StabilityEvent(session = session, type = "outage", detail = "Internet indisponível (${connType.label})", durationMs = dur))
                    app.container.notifier.alert("network", "warn", "Queda de internet detectada",
                        "A conexão ficou indisponível por ${dur / 1000} s às ${java.text.SimpleDateFormat("HH:mm", java.util.Locale("pt", "BR")).format(java.util.Date(now - dur))}.",
                        "internet/stability", dedupeHours = 0)
                }
                if (now - lastNotif > 15_000) {
                    lastNotif = now
                    val s = StabilityTracker.state.value
                    val text = "${s.total} verificações • ${s.failures} falhas • ${s.outages} quedas" + (rtt?.let { " • ${it.toInt()} ms" } ?: " • sem resposta")
                    if (Notifier.canPost(this@StabilityService)) runCatching {
                        NotificationManagerCompat.from(this@StabilityService).notify(Notifier.MONITOR_ID, notification(text))
                    }
                }
                delay(interval * 1000L)
            }
        }
        return START_NOT_STICKY
    }

    private fun notification(text: String): Notification {
        val stop = PendingIntent.getService(this, 1, Intent(this, StabilityService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, Notifier.CH_MONITOR)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentTitle("Modo Estabilidade ativo")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(Notifier.openAppIntent(this, "internet/stability"))
            .addAction(0, "Encerrar", stop)
            .build()
    }

    private fun finish() {
        loop?.cancel()
        val s = StabilityTracker.state.value
        if (s.running) {
            val summary = s.summary()
            StabilityTracker.set(s.copy(running = false, outageStart = null))
            val app = application as NexusApp
            app.container.appScope.launch(Dispatchers.IO) {
                repo.stability.insert(StabilityEvent(session = s.session, type = "stop", detail = "Monitoramento encerrado"))
                if (summary.samples > 0) repo.add(Kind.STABILITY, "Modo Estabilidade",
                    "${summary.samples} verificações em ${summary.durationSec / 60} min • ${summary.failures} falhas • ${summary.outages} quedas • latência mediana ${summary.medianRttMs?.toInt() ?: "-"} ms",
                    level = if (summary.outages > 0) "Instável" else if (summary.failureRate > 0.05) "Oscilando" else "Estável",
                    payload = HistoryRepository.encode(summary))
            }
        }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (StabilityTracker.state.value.running) finish()
        super.onDestroy()
    }
}
