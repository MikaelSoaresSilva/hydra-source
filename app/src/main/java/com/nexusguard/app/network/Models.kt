package com.nexusguard.app.network

import kotlinx.serialization.Serializable

enum class ConnType(val label: String) { WIFI("Wi-Fi"), CELLULAR("Dados móveis"), ETHERNET("Cabo (Ethernet)"), VPN("VPN"), OTHER("Outra"), NONE("Sem conexão") }

@Serializable
data class WifiDetails(
    val ssid: String? = null,          // null quando o Android não revela (sem permissão de localização)
    val bssid: String? = null,
    val rssiDbm: Int? = null,
    val signalLevel: Int? = null,      // 0..4
    val linkSpeedMbps: Int? = null,
    val txLinkSpeedMbps: Int? = null,
    val rxLinkSpeedMbps: Int? = null,
    val frequencyMhz: Int? = null,
    val channel: Int? = null,
    val standard: String? = null,      // Wi-Fi 4/5/6/6E/7
    val securityType: String? = null,  // Aberta, WPA2, WPA3...
    val securityLevel: Int? = null,    // 0 aberta / 1 fraca / 2 boa / 3 forte / null desconhecido
    val gatewayIp: String? = null
) {
    val bandLabel: String?
        get() = frequencyMhz?.let {
            when {
                it in 2400..2500 -> "2,4 GHz"
                it in 4900..5900 -> "5 GHz"
                it in 5925..7125 -> "6 GHz"
                else -> "$it MHz"
            }
        }
}

@Serializable
data class CellularDetails(
    val technology: String? = null,    // 5G (SA), 5G (NSA), 4G LTE, 3G...
    val operatorName: String? = null,
    val signalLevel: Int? = null,      // 0..4
    val signalDbm: Int? = null,
    val rsrp: Int? = null,
    val rsrq: Int? = null,
    val sinr: Int? = null,
    val roaming: Boolean? = null,
    val techSource: String? = null     // de onde veio a informação
)

@Serializable
data class ConnectionState(
    val type: ConnType = ConnType.NONE,
    val connected: Boolean = false,
    val validated: Boolean = false,
    val captivePortal: Boolean = false,
    val metered: Boolean? = null,
    val vpnActive: Boolean = false,
    val privateDnsActive: Boolean? = null,
    val privateDnsServer: String? = null,
    val dnsServers: List<String> = emptyList(),
    val httpProxy: String? = null,
    val estDownKbps: Int? = null,
    val estUpKbps: Int? = null,
    val signalStrength: Int? = null,
    val wifi: WifiDetails? = null,
    val cellular: CellularDetails? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class LatencyResult(
    val target: String,
    val method: String,              // "ICMP" ou "TCP"
    val samplesMs: List<Double>,
    val sent: Int,
    val received: Int,
    val avgMs: Double?,
    val medianMs: Double?,
    val minMs: Double?,
    val maxMs: Double?,
    val jitterMs: Double?,
    val lossPercent: Double?,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class DnsResolverResult(
    val name: String,
    val address: String,
    val dotHost: String?,            // nome para "DNS privado" do Android
    val isSystem: Boolean,
    val cachedMedianMs: Double?,
    val uncachedMedianMs: Double?,
    val successRate: Double,
    val queries: Int
) {
    /** Pontuação combinada (menor = melhor). Domínios populares pesam mais porque são os mais usados no dia a dia. */
    val combinedMs: Double?
        get() = when {
            cachedMedianMs == null && uncachedMedianMs == null -> null
            uncachedMedianMs == null -> cachedMedianMs
            cachedMedianMs == null -> uncachedMedianMs
            else -> cachedMedianMs * 0.7 + uncachedMedianMs * 0.3
        }
}

@Serializable
data class DnsBenchmark(val results: List<DnsResolverResult>, val timestamp: Long = System.currentTimeMillis()) {
    val system: DnsResolverResult? get() = results.firstOrNull { it.isSystem }
    val best: DnsResolverResult?
        get() = results.filter { !it.isSystem && it.successRate >= 0.8 && it.combinedMs != null && it.dotHost != null }.minByOrNull { it.combinedMs!! }
}

@Serializable
data class SpeedResult(
    val downloadMbps: Double?,
    val uploadMbps: Double?,
    val idleLatencyMs: Double?,
    val loadedLatencyMs: Double?,
    val jitterMs: Double?,
    val bytesDown: Long,
    val bytesUp: Long,
    val server: String,
    val connType: String,
    val error: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class StabilitySummary(
    val samples: Int,
    val failures: Int,
    val outages: Int,
    val longestOutageSec: Long,
    val medianRttMs: Double?,
    val jitterMs: Double?,
    val networkChanges: Int,
    val durationSec: Long
) {
    val failureRate: Double get() = if (samples == 0) 0.0 else failures.toDouble() / samples
}
