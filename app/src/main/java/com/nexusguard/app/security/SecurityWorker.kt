package com.nexusguard.app.security

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.nexusguard.app.NexusApp
import com.nexusguard.app.data.HistoryRepository
import com.nexusguard.app.data.Kind
import java.util.concurrent.TimeUnit

/**
 * Verificação periódica leve (a cada 12 h, só com bateria não baixa). Pode ser desligada em Ajustes.
 * Gera alertas apenas quando há algo novo.
 */
class SecurityWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    companion object {
        private const val NAME = "nexus_periodic_security"

        fun schedule(context: Context, enabled: Boolean) {
            val wm = WorkManager.getInstance(context)
            if (!enabled) { wm.cancelUniqueWork(NAME); return }
            val req = PeriodicWorkRequestBuilder<SecurityWorker>(12, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiresBatteryNotLow(true).build())
                .build()
            wm.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }

    override suspend fun doWork(): Result {
        val c = (applicationContext as NexusApp).container
        val conn = c.monitor.refresh()
        val loc = ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val wifi = WifiSecurityAssessor.assess(conn, null, loc)
        val scan = c.deviceScanner.scan(wifi.check)
        c.history.add(Kind.SECURITY_SCAN, "Verificação automática", "Nota ${scan.score ?: "-"} • ${scan.failCount} riscos • ${scan.warnCount} atenções",
            scan.score, SecurityScore.label(scan.score), HistoryRepository.encode(scan))
        scan.checks.filter { it.status == CheckStatus.FAIL }.forEach {
            c.notifier.alert("security", "high", "Risco: ${it.title}", it.detail, "security/scan", dedupeHours = 72)
        }
        if (wifi.label == "Insegura") c.notifier.alert("security", "warn", "Wi-Fi potencialmente inseguro", wifi.findings.first().explanation, "security/wifi", dedupeHours = 24)
        val last = c.history.history.latestOnce(Kind.APP_SCAN)?.timestamp
        val ageDays = last?.let { (System.currentTimeMillis() - it) / 86_400_000L }
        if (ageDays == null) c.notifier.alert("security", "info", "Analise seus aplicativos",
            "Você ainda não revisou as permissões dos apps instalados. Abra Segurança > Análise de aplicativos.", "security/apps", dedupeHours = 24 * 14)
        else if (ageDays >= 14) c.notifier.alert("security", "info", "Revisão de aplicativos recomendada",
            "Faz $ageDays dias que os aplicativos não são analisados. Abra Segurança > Análise de aplicativos.", "security/apps", dedupeHours = 24 * 14)
        return Result.success()
    }
}
