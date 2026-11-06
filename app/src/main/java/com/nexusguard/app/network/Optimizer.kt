package com.nexusguard.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Serializable
data class OptimizationReport(
    val before: NetworkSnapshot,
    val beforeDiagnosis: Diagnosis,
    val after: NetworkSnapshot? = null,
    val afterDiagnosis: Diagnosis? = null,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Executa a sequência do botão OTIMIZAR MINHA INTERNET (medições reais).
 * O app não altera configurações do sistema sozinho: o Android não permite trocar DNS, banda ou modo de rede
 * sem ação do usuário. As correções são oferecidas como atalhos para as telas oficiais.
 */
class Optimizer(private val monitor: ConnectionMonitor, private val dns: DnsBenchmarker, private val checks: NetChecks) {

    val steps = listOf(
        "Analisando a conexão atual",
        "Medindo latência e perda de pacotes",
        "Avaliando a resolução DNS",
        "Verificando estabilidade",
        "Verificando acesso livre (portal cativo)",
        "Identificando problemas"
    )

    suspend fun measure(onStep: (Int, String) -> Unit, onLive: (String) -> Unit = {}): NetworkSnapshot {
        onStep(0, steps[0])
        val conn = monitor.refresh()
        if (!conn.connected) {
            onStep(5, steps[5])
            return NetworkSnapshot(conn)
        }
        onStep(1, steps[1])
        val latency = LatencyTester.measure("1.1.1.1", 20) { v -> onLive(v?.let { "${it.toInt()} ms" } ?: "sem resposta") }
        onStep(2, steps[2])
        val dnsResult = runCatching { dns.run(monitor.activeNetwork, conn.dnsServers) { onLive(it) } }.getOrNull()
        onStep(3, steps[3])
        val rtts = mutableListOf<Double>()
        var fails = 0
        repeat(10) {
            val r = withContext(Dispatchers.IO) { StabilityTracker.probe() }
            if (r == null) fails++ else rtts += r
            onLive(r?.let { "${it.toInt()} ms" } ?: "falha")
            delay(250)
        }
        val stab = StabilitySummary(10, fails, 0, 0, Stats.median(rtts), Stats.jitter(rtts), 0, 5)
        onStep(4, steps[4])
        val http = checks.captiveProbe()
        onStep(5, steps[5])
        return NetworkSnapshot(monitor.refresh(), latency, dnsResult, null, stab, http)
    }
}
