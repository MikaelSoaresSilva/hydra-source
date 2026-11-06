package com.nexusguard.app.data

import com.nexusguard.app.network.DnsBenchmark
import com.nexusguard.app.network.LatencyResult
import com.nexusguard.app.network.SpeedResult
import com.nexusguard.app.network.StabilitySummary
import com.nexusguard.app.security.SecurityScanResult
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

val NexusJson = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

class HistoryRepository(private val db: NexusDatabase) {
    val history get() = db.history()
    val alerts get() = db.alerts()
    val stability get() = db.stability()

    suspend fun add(kind: String, title: String, summary: String, score: Int? = null, level: String? = null, payload: String = ""): Long {
        val id = db.history().insert(HistoryEntry(kind = kind, title = title, summary = summary, score = score, level = level, payload = payload))
        db.history().trim()
        return id
    }

    fun recent(): Flow<List<HistoryEntry>> = db.history().recent()
    fun byKinds(vararg kinds: String): Flow<List<HistoryEntry>> = db.history().byKinds(kinds.toList())

    val latestScan: Flow<SecurityScanResult?> = db.history().latest(Kind.SECURITY_SCAN).map { e -> e?.let { decode<SecurityScanResult>(it.payload) } }
    val latestSpeed: Flow<SpeedResult?> = db.history().latest(Kind.SPEED).map { e -> e?.let { decode<SpeedResult>(it.payload) } }
    val latestDns: Flow<DnsBenchmark?> = db.history().latest(Kind.DNS).map { e -> e?.let { decode<DnsBenchmark>(it.payload) } }
    val latestLatency: Flow<LatencyResult?> = db.history().latest(Kind.LATENCY).map { e -> e?.let { decode<LatencyResult>(it.payload) } }
    val latestStability: Flow<StabilitySummary?> = db.history().latest(Kind.STABILITY).map { e -> e?.let { decode<StabilitySummary>(it.payload) } }
    val latestAppScan: Flow<HistoryEntry?> = db.history().latest(Kind.APP_SCAN)
    val latestPhishing: Flow<HistoryEntry?> = db.history().latest(Kind.PHISHING)

    val speedHistory: Flow<List<SpeedResult>> = db.history().byKinds(listOf(Kind.SPEED), 30).map { l -> l.mapNotNull { decode<SpeedResult>(it.payload) }.reversed() }

    suspend fun clearAll() {
        db.history().clear(); db.alerts().clear(); db.stability().clear()
    }

    /** Relatório em texto simples (para compartilhar com o provedor, suporte técnico etc.). */
    suspend fun exportText(): String {
        val df = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale("pt", "BR"))
        val sb = StringBuilder()
        sb.appendLine("RELATÓRIO NEXUS GUARD — gerado em ${df.format(Date())}")
        sb.appendLine("Todos os valores abaixo foram medidos neste aparelho. Itens não medidos não aparecem.")
        sb.appendLine()
        sb.appendLine("== HISTÓRICO ==")
        db.history().all().forEach { e ->
            sb.appendLine("[${df.format(Date(e.timestamp))}] ${e.title}${e.score?.let { " — nota $it" } ?: ""}${e.level?.let { " — $it" } ?: ""}")
            sb.appendLine("   ${e.summary.replace("\n", "\n   ")}")
        }
        sb.appendLine()
        sb.appendLine("== ALERTAS ==")
        db.alerts().all().forEach { a -> sb.appendLine("[${df.format(Date(a.timestamp))}] (${a.severity}) ${a.title}: ${a.message}") }
        sb.appendLine()
        sb.appendLine("== EVENTOS DE ESTABILIDADE ==")
        db.stability().all().forEach { s -> sb.appendLine("[${df.format(Date(s.timestamp))}] ${s.type}: ${s.detail}${if (s.durationMs > 0) " (${s.durationMs / 1000}s)" else ""}") }
        return sb.toString()
    }

    /** CSV com o histórico de testes de velocidade. */
    suspend fun exportSpeedCsv(): String {
        val sb = StringBuilder("data_hora;tipo_conexao;download_mbps;upload_mbps;latencia_ociosa_ms;latencia_carga_ms;jitter_ms;servidor;erro\n")
        val df = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        db.history().all().filter { it.kind == Kind.SPEED }.mapNotNull { decode<SpeedResult>(it.payload) }.forEach {
            sb.append("${df.format(Date(it.timestamp))};${it.connType};${it.downloadMbps ?: ""};${it.uploadMbps ?: ""};${it.idleLatencyMs ?: ""};${it.loadedLatencyMs ?: ""};${it.jitterMs ?: ""};${it.server};${it.error ?: ""}\n")
        }
        return sb.toString()
    }

    companion object {
        inline fun <reified T> decode(s: String): T? = runCatching { NexusJson.decodeFromString<T>(s) }.getOrNull()
        inline fun <reified T> encode(v: T): String = NexusJson.encodeToString(v)
    }
}
