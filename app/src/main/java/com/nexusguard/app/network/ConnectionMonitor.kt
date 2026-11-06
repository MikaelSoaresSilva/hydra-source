package com.nexusguard.app.network

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.CellSignalStrengthWcdma
import android.telephony.TelephonyCallback
import android.telephony.TelephonyDisplayInfo
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.Inet4Address
import java.util.concurrent.Executors

/**
 * Acompanha a rede ativa com as APIs oficiais (ConnectivityManager.NetworkCallback).
 * Campos que o Android não fornece (ou que exigem permissão negada) ficam nulos — a interface mostra "não disponível".
 */
class ConnectionMonitor(private val context: Context) {
    private val cm = context.getSystemService(ConnectivityManager::class.java)
    private val wm = context.applicationContext.getSystemService(WifiManager::class.java)
    private val tm = context.getSystemService(TelephonyManager::class.java)

    private val _state = MutableStateFlow(ConnectionState())
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    /** Contador de trocas de rede (usado pelo Modo Estabilidade). */
    private val _changes = MutableStateFlow(0)
    val changes: StateFlow<Int> = _changes.asStateFlow()

    @Volatile private var displayOverride: Int? = null
    @Volatile private var currentNetwork: Network? = null
    private var started = false

    private inner class Cb : ConnectivityManager.NetworkCallback {
        constructor() : super()
        constructor(flags: Int) : super(flags)

        override fun onAvailable(network: Network) {
            if (currentNetwork != null && currentNetwork != network) _changes.value++
            currentNetwork = network
            update()
        }
        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) { currentNetwork = network; update(network, networkCapabilities) }
        override fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) { currentNetwork = network; update(network, null, linkProperties) }
        override fun onLost(network: Network) {
            if (currentNetwork == network) { currentNetwork = null; _changes.value++ }
            _state.value = ConnectionState()
        }
    }

    // O construtor com flags só existe no Android 12+; FLAG_INCLUDE_LOCATION_INFO permite ver o nome da rede quando há permissão.
    private val callback: ConnectivityManager.NetworkCallback =
        if (Build.VERSION.SDK_INT >= 31) Cb(ConnectivityManager.NetworkCallback.FLAG_INCLUDE_LOCATION_INFO) else Cb()

    fun start() {
        if (started) return
        started = true
        runCatching { cm.registerDefaultNetworkCallback(callback) }
        if (Build.VERSION.SDK_INT >= 31) registerDisplayInfo()
        update()
    }

    @SuppressLint("MissingPermission")
    private fun registerDisplayInfo() {
        runCatching {
            if (Build.VERSION.SDK_INT >= 31) {
                val cb = object : TelephonyCallback(), TelephonyCallback.DisplayInfoListener {
                    override fun onDisplayInfoChanged(telephonyDisplayInfo: TelephonyDisplayInfo) {
                        displayOverride = telephonyDisplayInfo.overrideNetworkType
                        update()
                    }
                }
                tm?.registerTelephonyCallback(Executors.newSingleThreadExecutor(), cb)
            }
        }
    }

    fun refresh(): ConnectionState { update(); return _state.value }

    val activeNetwork: Network? get() = cm.activeNetwork

    private fun update(net: Network? = null, capsIn: NetworkCapabilities? = null, lpIn: LinkProperties? = null) {
        val network = net ?: cm.activeNetwork
        if (network == null) { _state.value = ConnectionState(); return }
        val caps = capsIn ?: cm.getNetworkCapabilities(network)
        val lp = lpIn ?: cm.getLinkProperties(network)
        _state.value = build(caps, lp)
    }

    private fun hasPerm(p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

    private fun build(caps: NetworkCapabilities?, lp: LinkProperties?): ConnectionState {
        if (caps == null) return ConnectionState()
        val vpn = caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        val type = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> ConnType.WIFI
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> ConnType.CELLULAR
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> ConnType.ETHERNET
            vpn -> underlyingType() ?: ConnType.VPN
            else -> ConnType.OTHER
        }
        val signal = if (Build.VERSION.SDK_INT >= 29) caps.signalStrength.takeIf { it != Int.MIN_VALUE && it != NetworkCapabilities.SIGNAL_STRENGTH_UNSPECIFIED } else null
        val proxy = lp?.httpProxy?.let { if (it.host.isNullOrBlank()) null else "${it.host}:${it.port}" }
        val gateway = lp?.routes?.firstOrNull { it.isDefaultRoute && it.gateway is Inet4Address }?.gateway?.hostAddress
        return ConnectionState(
            type = type,
            connected = true,
            validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED),
            captivePortal = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL),
            metered = !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
            vpnActive = vpn,
            privateDnsActive = if (Build.VERSION.SDK_INT >= 28) lp?.isPrivateDnsActive else null,
            privateDnsServer = if (Build.VERSION.SDK_INT >= 28) lp?.privateDnsServerName else null,
            dnsServers = lp?.dnsServers?.mapNotNull { it.hostAddress } ?: emptyList(),
            httpProxy = proxy,
            estDownKbps = caps.linkDownstreamBandwidthKbps.takeIf { it > 0 },
            estUpKbps = caps.linkUpstreamBandwidthKbps.takeIf { it > 0 },
            signalStrength = signal,
            wifi = if (type == ConnType.WIFI) wifiDetails(caps, gateway) else null,
            cellular = if (type == ConnType.CELLULAR) cellularDetails() else null
        )
    }

    /** Com VPN ativa, descobre a rede física por baixo. */
    private fun underlyingType(): ConnType? {
        @Suppress("DEPRECATION")
        val all = runCatching { cm.allNetworks.toList() }.getOrDefault(emptyList())
        for (n in all) {
            val c = cm.getNetworkCapabilities(n) ?: continue
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue
            if (!c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) continue
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return ConnType.WIFI
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return ConnType.CELLULAR
        }
        return null
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    private fun wifiDetails(caps: NetworkCapabilities, gateway: String?): WifiDetails {
        val info: WifiInfo? = if (Build.VERSION.SDK_INT >= 31) (caps.transportInfo as? WifiInfo) ?: runCatching { wm?.connectionInfo }.getOrNull()
        else runCatching { wm?.connectionInfo }.getOrNull()
        if (info == null) return WifiDetails(gatewayIp = gateway)
        val ssid = info.ssid?.trim('"')?.takeIf { it.isNotBlank() && it != WifiManager.UNKNOWN_SSID.trim('<', '>') && it != "<unknown ssid>" }
        val bssid = info.bssid?.takeIf { it != "02:00:00:00:00:00" }
        val rssi = info.rssi.takeIf { it in -126..0 }
        val level = rssi?.let {
            if (Build.VERSION.SDK_INT >= 30) {
                val max = wm?.maxSignalLevel ?: 4
                val l = wm?.calculateSignalLevel(it) ?: 0
                if (max > 0) Math.round(l * 4f / max) else l
            } else WifiManager.calculateSignalLevel(it, 5)
        }
        val freq = info.frequency.takeIf { it > 0 }
        val std = if (Build.VERSION.SDK_INT >= 30) when (info.wifiStandard) {
            4 -> "Wi-Fi 4 (802.11n)"; 5 -> "Wi-Fi 5 (802.11ac)"; 6 -> "Wi-Fi 6/6E (802.11ax)"; 7 -> "802.11ad"; 8 -> "Wi-Fi 7 (802.11be)"
            1 -> "802.11a/b/g (legado)"; else -> null
        } else null
        var secLabel: String? = null
        var secLevel: Int? = null
        if (Build.VERSION.SDK_INT >= 31) {
            val (l, lv) = securityFromType(info.currentSecurityType)
            secLabel = l; secLevel = lv
        }
        if (secLabel == null && bssid != null && hasPerm(Manifest.permission.ACCESS_FINE_LOCATION)) {
            runCatching { wm?.scanResults?.firstOrNull { it.BSSID == bssid }?.capabilities }.getOrNull()?.let { capStr ->
                val (l, lv) = securityFromCapabilities(capStr); secLabel = l; secLevel = lv
            }
        }
        return WifiDetails(
            ssid = ssid, bssid = bssid, rssiDbm = rssi, signalLevel = level,
            linkSpeedMbps = info.linkSpeed.takeIf { it > 0 },
            txLinkSpeedMbps = if (Build.VERSION.SDK_INT >= 29) info.txLinkSpeedMbps.takeIf { it > 0 } else null,
            rxLinkSpeedMbps = if (Build.VERSION.SDK_INT >= 29) info.rxLinkSpeedMbps.takeIf { it > 0 } else null,
            frequencyMhz = freq, channel = freq?.let { channelOf(it) }, standard = std,
            securityType = secLabel, securityLevel = secLevel, gatewayIp = gateway
        )
    }

    @SuppressLint("MissingPermission")
    private fun cellularDetails(): CellularDetails {
        val t = tm ?: return CellularDetails()
        var level: Int? = null
        var dbm: Int? = null
        var rsrp: Int? = null
        var rsrq: Int? = null
        var sinr: Int? = null
        var inferred: String? = null
        if (Build.VERSION.SDK_INT >= 29) {
            runCatching { t.signalStrength }.getOrNull()?.let { ss ->
                level = ss.level
                val list = ss.cellSignalStrengths
                list.firstOrNull { it is CellSignalStrengthNr }?.let { nr ->
                    nr as CellSignalStrengthNr
                    inferred = "5G"
                    rsrp = nr.ssRsrp.takeIf { it != Int.MAX_VALUE }; rsrq = nr.ssRsrq.takeIf { it != Int.MAX_VALUE }; sinr = nr.ssSinr.takeIf { it != Int.MAX_VALUE }
                    dbm = nr.dbm.takeIf { it != Int.MAX_VALUE }
                }
                list.firstOrNull { it is CellSignalStrengthLte }?.let { lte ->
                    lte as CellSignalStrengthLte
                    if (inferred == null) inferred = "4G LTE"
                    if (rsrp == null) rsrp = lte.rsrp.takeIf { it != Int.MAX_VALUE }
                    if (rsrq == null) rsrq = lte.rsrq.takeIf { it != Int.MAX_VALUE }
                    if (sinr == null) sinr = lte.rssnr.takeIf { it != Int.MAX_VALUE }
                    if (dbm == null) dbm = lte.dbm.takeIf { it != Int.MAX_VALUE }
                }
                if (inferred == null) list.firstOrNull { it is CellSignalStrengthWcdma }?.let { inferred = "3G"; dbm = it.dbm.takeIf { v -> v != Int.MAX_VALUE } }
                if (inferred == null) list.firstOrNull { it is CellSignalStrengthGsm }?.let { inferred = "2G"; dbm = it.dbm.takeIf { v -> v != Int.MAX_VALUE } }
            }
        } else if (Build.VERSION.SDK_INT >= 28) {
            level = runCatching { t.signalStrength?.level }.getOrNull()
        }
        var tech: String? = null
        var source: String? = null
        if (hasPerm(Manifest.permission.READ_PHONE_STATE)) {
            runCatching {
                tech = when (t.dataNetworkType) {
                    TelephonyManager.NETWORK_TYPE_NR -> "5G (SA)"
                    TelephonyManager.NETWORK_TYPE_LTE -> if (displayOverride == TelephonyDisplayInfo.OVERRIDE_NETWORK_TYPE_NR_NSA ||
                        displayOverride == 5 /* NR_ADVANCED */) "5G (NSA, ancorado no 4G)" else if (displayOverride == TelephonyDisplayInfo.OVERRIDE_NETWORK_TYPE_LTE_CA) "4G+ (LTE-A)" else "4G LTE"
                    TelephonyManager.NETWORK_TYPE_HSPAP, TelephonyManager.NETWORK_TYPE_HSPA, TelephonyManager.NETWORK_TYPE_HSDPA,
                    TelephonyManager.NETWORK_TYPE_HSUPA, TelephonyManager.NETWORK_TYPE_UMTS -> "3G"
                    TelephonyManager.NETWORK_TYPE_EDGE, TelephonyManager.NETWORK_TYPE_GPRS -> "2G"
                    else -> null
                }
                if (tech != null) source = "sistema"
            }
        }
        if (tech == null && displayOverride != null && Build.VERSION.SDK_INT >= 30) {
            tech = when (displayOverride) {
                TelephonyDisplayInfo.OVERRIDE_NETWORK_TYPE_NR_NSA, 5 -> "5G (NSA)"
                TelephonyDisplayInfo.OVERRIDE_NETWORK_TYPE_LTE_CA -> "4G+ (LTE-A)"
                else -> null
            }
            if (tech != null) source = "indicador do sistema"
        }
        if (tech == null && inferred != null) { tech = inferred; source = "inferido pelo tipo de sinal" }
        return CellularDetails(
            technology = tech, operatorName = runCatching { t.networkOperatorName }.getOrNull()?.takeIf { it.isNotBlank() },
            signalLevel = level, signalDbm = dbm, rsrp = rsrp, rsrq = rsrq, sinr = sinr,
            roaming = runCatching { t.isNetworkRoaming }.getOrNull(), techSource = source
        )
    }

    companion object {
        fun channelOf(f: Int): Int? = when (f) {
            2484 -> 14
            in 2412..2472 -> (f - 2407) / 5
            in 5000..5895 -> (f - 5000) / 5
            in 5955..7115 -> (f - 5950) / 5
            else -> null
        }

        /** Converte WifiInfo.getCurrentSecurityType() (Android 12+) em texto e nível (0 aberta … 3 forte). */
        fun securityFromType(t: Int): Pair<String?, Int?> = when (t) {
            0 -> "Aberta (sem senha)" to 0
            1 -> "WEP (obsoleta)" to 1
            2 -> "WPA/WPA2-Personal" to 2
            3 -> "WPA2/WPA3-Enterprise (EAP)" to 3
            4 -> "WPA3-Personal (SAE)" to 3
            5, 9 -> "WPA3-Enterprise" to 3
            6 -> "Aberta com criptografia (OWE)" to 2
            7, 8 -> "WAPI" to 2
            10, 11, 12 -> "Passpoint / Hotspot 2.0" to 3
            13 -> "Wi-Fi Easy Connect (DPP)" to 3
            else -> null to null
        }

        fun securityFromCapabilities(c: String): Pair<String, Int> = when {
            c.contains("SAE") -> "WPA3-Personal (SAE)" to 3
            c.contains("EAP") -> "WPA/WPA2-Enterprise (EAP)" to 3
            c.contains("WPA2") -> "WPA2-Personal" to 2
            c.contains("WPA") -> "WPA (antigo)" to 1
            c.contains("WEP") -> "WEP (obsoleta)" to 1
            c.contains("OWE") -> "Aberta com criptografia (OWE)" to 2
            else -> "Aberta (sem senha)" to 0
        }
    }
}
