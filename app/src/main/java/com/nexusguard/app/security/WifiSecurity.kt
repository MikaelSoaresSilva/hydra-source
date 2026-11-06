package com.nexusguard.app.security

import com.nexusguard.app.network.ConnType
import com.nexusguard.app.network.ConnectionState

data class WifiAssessment(val onWifi: Boolean, val label: String, val score: Int, val findings: List<Finding>, val check: SecurityCheck?)

/**
 * Avaliação defensiva da rede Wi-Fi atual com base no que o Android informa.
 * Não faz varredura de outros dispositivos, não ataca nem testa a rede.
 */
object WifiSecurityAssessor {

    fun assess(c: ConnectionState, captiveProbe: String? = null, locationGranted: Boolean = true): WifiAssessment {
        if (c.type != ConnType.WIFI) {
            return WifiAssessment(false, "Fora do Wi-Fi", 0, listOf(Finding(Severity.INFO, "Você não está em uma rede Wi-Fi",
                "Conexão atual: ${c.type.label}. Dados móveis são criptografados entre o celular e a operadora.")), null)
        }
        val f = mutableListOf<Finding>()
        val w = c.wifi
        var check: SecurityCheck
        when (w?.securityLevel) {
            0 -> {
                f += Finding(Severity.HIGH, "Rede aberta (sem senha/criptografia)",
                    "Qualquer pessoa conectada pode observar seu tráfego que não usa HTTPS e ver quais sites você acessa. Redes abertas também são fáceis de imitar (\"Wi-Fi gêmeo\").")
                check = SecurityCheck("wifi_current", "Wi-Fi atual", CheckStatus.FAIL, 6, "Conectado a uma rede aberta.", "Evite bancos/compras nesta rede ou use dados móveis.")
            }
            1 -> {
                f += Finding(Severity.HIGH, "Criptografia fraca (${w.securityType})", "WEP e WPA antigo podem ser quebrados em minutos com ferramentas públicas.")
                check = SecurityCheck("wifi_current", "Wi-Fi atual", CheckStatus.FAIL, 6, "Criptografia fraca: ${w.securityType}.", "No roteador, use WPA2-AES ou WPA3.")
            }
            2 -> {
                f += Finding(Severity.INFO, "Proteção adequada (${w.securityType})",
                    if (w.securityType?.contains("OWE") == true) "Rede sem senha, mas com criptografia individual (OWE). Melhor que uma rede aberta comum."
                    else "WPA2 é seguro com senha forte (12+ caracteres). Se o roteador oferecer WPA3, prefira.")
                check = SecurityCheck("wifi_current", "Wi-Fi atual", CheckStatus.PASS, 6, "Rede protegida (${w.securityType}).")
            }
            3 -> {
                f += Finding(Severity.INFO, "Proteção forte (${w.securityType})", "Padrão de segurança moderno.")
                check = SecurityCheck("wifi_current", "Wi-Fi atual", CheckStatus.PASS, 6, "Rede com proteção forte (${w.securityType}).")
            }
            else -> {
                f += Finding(Severity.INFO, "Tipo de segurança não disponível",
                    if (!locationGranted) "Em versões anteriores ao Android 12, o tipo de segurança só aparece com a permissão de localização." else "O Android não informou o tipo de segurança desta rede.")
                check = SecurityCheck("wifi_current", "Wi-Fi atual", CheckStatus.UNKNOWN, 6, "Tipo de segurança da rede não disponível.")
            }
        }
        if (c.captivePortal || captiveProbe == "portal") f += Finding(Severity.MEDIUM, "Portal cativo detectado",
            "A rede exige login em uma página própria (comum em redes públicas). Não reutilize senhas pessoais nessa página e confira se o endereço é da empresa dona da rede.")
        if (!c.validated && !c.captivePortal) f += Finding(Severity.LOW, "Internet não confirmada", "O Android não confirmou acesso à internet nesta rede.")
        c.httpProxy?.let { f += Finding(Severity.MEDIUM, "Proxy configurado ($it)", "Um proxy pode observar ou alterar tráfego não criptografado. Remova se não foi você que configurou.") }
        if (c.vpnActive) f += Finding(Severity.INFO, "VPN ativa", "O tráfego sai criptografado até o servidor da VPN.")
        when (c.privateDnsActive) {
            true -> f += Finding(Severity.INFO, "DNS privado ativo", "Consultas de nomes estão criptografadas${c.privateDnsServer?.let { " ($it)" } ?: ""}.")
            false -> f += Finding(Severity.LOW, "DNS sem criptografia",
                "Quem controla a rede pode ver (e em redes maliciosas, falsificar) os nomes dos sites consultados. Ative o DNS privado.")
            null -> {}
        }
        if (w?.ssid == null && !locationGranted) f += Finding(Severity.INFO, "Nome da rede oculto pelo Android",
            "O Android só revela o nome (SSID) para apps com permissão de localização. Ela é opcional no NEXUS GUARD.")
        if (w?.ssid != null && looksPublic(w.ssid) && (w.securityLevel ?: 2) <= 1) f += Finding(Severity.MEDIUM, "Nome típico de rede pública",
            "\"${w.ssid}\" parece uma rede pública. Golpistas criam redes com nomes iguais aos de cafés, aeroportos e hotéis.")
        f += Finding(Severity.INFO, "Limite da verificação",
            "Sem root, nenhum app consegue confirmar ataques ativos na rede (como ARP spoofing). Use HTTPS, DNS privado e evite redes desconhecidas para operações sensíveis.")

        val score = (100 - f.sumOf { it.severity.weight }).coerceIn(0, 100)
        val label = when {
            f.any { it.severity == Severity.HIGH || it.severity == Severity.CRITICAL } -> "Insegura"
            f.any { it.severity == Severity.MEDIUM } -> "Atenção"
            w?.securityLevel == null -> "Parcialmente verificada"
            else -> "Protegida"
        }
        return WifiAssessment(true, label, score, f.sortedByDescending { it.severity.weight }, check)
    }

    private fun looksPublic(ssid: String): Boolean {
        val s = ssid.lowercase()
        return listOf("free", "gratis", "grátis", "wifi", "guest", "visitante", "public", "publico", "aeroporto", "airport", "hotel", "shopping", "cafe", "starbucks").any { s.contains(it) }
    }
}
