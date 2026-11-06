package com.nexusguard.app.network

import kotlinx.serialization.Serializable

enum class IssueLevel(val label: String, val rank: Int) { OK("Bom", 0), INFO("Dica", 1), WARN("Atenção", 2), BAD("Problema", 3) }

enum class FixAction { PRIVATE_DNS, WIFI_PANEL, INTERNET_PANEL, CAPTIVE_LOGIN, MOBILE_DATA_SETTINGS, NONE }

@Serializable
data class Issue(
    val id: String,
    val level: IssueLevel,
    val title: String,
    val detail: String,
    val recommendation: String,
    val consequence: String? = null,
    val action: FixAction = FixAction.NONE
)

@Serializable
data class NetworkSnapshot(
    val connection: ConnectionState,
    val latency: LatencyResult? = null,
    val dns: DnsBenchmark? = null,
    val speed: SpeedResult? = null,
    val stability: StabilitySummary? = null,
    val httpCheck: String? = null,     // "ok", "portal", "falha" ou null
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class Diagnosis(val score: Int?, val label: String, val issues: List<Issue>)

/**
 * Motor de diagnóstico por regras. Usa somente valores medidos; quando algo não foi medido,
 * a regra correspondente simplesmente não dispara.
 */
object DiagnosticsEngine {

    fun diagnose(s: NetworkSnapshot): Diagnosis {
        val c = s.connection
        val issues = mutableListOf<Issue>()

        if (!c.connected || c.type == ConnType.NONE) {
            issues += Issue("offline", IssueLevel.BAD, "Sem conexão",
                "O aparelho não está conectado a nenhuma rede.",
                "Ative o Wi-Fi ou os dados móveis e verifique o modo avião.", action = FixAction.INTERNET_PANEL)
            return Diagnosis(0, "Sem conexão", issues)
        }
        if (c.captivePortal || s.httpCheck == "portal") {
            issues += Issue("captive", IssueLevel.BAD, "Rede exige login (portal cativo)",
                "Essa rede intercepta o acesso até você aceitar termos ou fazer login numa página da própria rede (comum em hotéis, shoppings e aeroportos).",
                "Abra a página de login da rede. Depois do login, refaça o teste. Evite digitar senhas pessoais nessa página.",
                "Até o login, quase nada funciona e as medições ficam distorcidas.", FixAction.CAPTIVE_LOGIN)
        } else if (!c.validated) {
            issues += Issue("not_validated", IssueLevel.BAD, "Conectado, mas sem internet confirmada",
                "O Android não conseguiu confirmar o acesso à internet nessa rede.",
                "Reinicie o roteador (desligue por 30 segundos) ou troque de rede. Em dados móveis, confira se o pacote não acabou.",
                action = if (c.type == ConnType.WIFI) FixAction.WIFI_PANEL else FixAction.MOBILE_DATA_SETTINGS)
        }

        // Wi-Fi: sinal, banda, velocidade de enlace
        c.wifi?.let { w ->
            w.rssiDbm?.let { rssi ->
                when {
                    rssi <= -80 -> issues += Issue("wifi_signal_bad", IssueLevel.BAD, "Sinal Wi-Fi muito fraco ($rssi dBm)",
                        "Com sinal abaixo de -80 dBm a conexão perde pacotes, oscila e fica lenta, mesmo que o plano seja rápido.",
                        "Aproxime-se do roteador ou tire obstáculos (paredes grossas, espelhos, aquários, micro-ondas). Se a casa for grande, um repetidor ou sistema mesh resolve melhor do que qualquer configuração no celular.",
                        action = FixAction.WIFI_PANEL)
                    rssi <= -70 -> issues += Issue("wifi_signal_weak", IssueLevel.WARN, "Sinal Wi-Fi fraco ($rssi dBm)",
                        "Entre -70 e -80 dBm a velocidade costuma cair bastante e o ping oscila.",
                        "Fique mais perto do roteador ou deixe-o em local alto, central e sem obstáculos.")
                    else -> {}
                }
            }
            val band = w.frequencyMhz
            if (band != null && band in 2400..2500) {
                val rssi = w.rssiDbm
                if (rssi == null || rssi > -67) {
                    issues += Issue("wifi_24", IssueLevel.INFO, "Conectado em 2,4 GHz",
                        "A banda de 2,4 GHz alcança mais longe, mas é mais lenta e mais congestionada (vizinhos, Bluetooth, micro-ondas).",
                        "Se o roteador tiver rede 5 GHz e você estiver perto dele, conecte-se a ela para mais velocidade e menos interferência.",
                        "A 5 GHz atravessa menos paredes: longe do roteador, a 2,4 GHz pode ser melhor.", FixAction.WIFI_PANEL)
                }
            }
            w.linkSpeedMbps?.let { link ->
                if (link in 1..53) issues += Issue("wifi_link_low", IssueLevel.WARN, "Velocidade de enlace baixa ($link Mbps)",
                    "É a velocidade negociada entre o celular e o roteador. Ela limita tudo o que passa pelo Wi-Fi.",
                    "Normalmente melhora com sinal mais forte ou mudando para 5 GHz.")
            }
            if (w.securityLevel == 0) {
                issues += Issue("wifi_open", IssueLevel.WARN, "Rede Wi-Fi aberta",
                    "Não há senha nem criptografia do Wi-Fi. Outras pessoas na rede podem observar o tráfego que não usa HTTPS.",
                    "Prefira dados móveis para bancos e compras. Veja a aba Segurança > Wi-Fi para detalhes.")
            }
        }

        // Rede móvel
        c.cellular?.let { cell ->
            cell.signalLevel?.let { lvl ->
                if (lvl <= 1) issues += Issue("cell_signal", IssueLevel.WARN, "Sinal de celular fraco (nível $lvl de 4)",
                    "Sinal baixo reduz a velocidade e aumenta a latência e as quedas.",
                    "Perto de janelas e em locais mais altos a recepção melhora. Em 5G NSA com sinal fraco, fixar 4G nas configurações da operadora pode deixar a conexão mais estável.",
                    "Mudar o modo de rede afeta somente a velocidade máxima e o consumo de bateria; pode ser revertido a qualquer momento.", FixAction.MOBILE_DATA_SETTINGS)
            }
            if (cell.roaming == true) issues += Issue("roaming", IssueLevel.INFO, "Em roaming",
                "O tráfego pode passar por outra operadora, com latência maior e possíveis custos.", "Confira as condições do seu plano.")
        }

        // Latência
        s.latency?.let { l ->
            val med = l.medianMs
            if (med != null) {
                when {
                    med > 150 -> issues += Issue("latency_high", IssueLevel.BAD, "Latência alta (${fmt(med)} ms)",
                        "Cada pedido demora muito para ir e voltar. Jogos e chamadas de vídeo sentem isso primeiro.",
                        latencyAdvice(c))
                    med > 70 -> issues += Issue("latency_mid", IssueLevel.WARN, "Latência moderada (${fmt(med)} ms)",
                        "Aceitável para navegar e assistir vídeos, mas pode atrapalhar jogos competitivos.", latencyAdvice(c))
                    else -> {}
                }
            }
            l.jitterMs?.let { j ->
                if (j > 30) issues += Issue("jitter_high", IssueLevel.BAD, "Oscilação alta (jitter ${fmt(j)} ms)",
                    "O tempo de resposta varia muito entre um pacote e outro. Isso causa travadas em chamadas e lag em jogos.",
                    "Feche downloads e streaming em outros aparelhos da rede. No Wi-Fi, aproxime-se do roteador ou use 5 GHz.")
                else if (j > 15) issues += Issue("jitter_mid", IssueLevel.WARN, "Oscilação moderada (jitter ${fmt(j)} ms)",
                    "Há variação perceptível no tempo de resposta.", "Evite usar a rede com muitos downloads simultâneos durante jogos ou chamadas.")
            }
            l.lossPercent?.let { loss ->
                if (loss >= 5) issues += Issue("loss_high", IssueLevel.BAD, "Perda de pacotes (${fmt(loss)}%)",
                    "Parte dos dados se perde no caminho e precisa ser reenviada. Isso deixa tudo mais lento e instável.",
                    if (c.type == ConnType.WIFI) "Causa mais comum: sinal fraco ou interferência. Aproxime-se do roteador e reinicie-o. Se persistir em todos os aparelhos, fale com o provedor."
                    else "Causa mais comum: sinal fraco ou torre congestionada. Mude de local ou teste em outro horário.")
                else if (loss > 0) issues += Issue("loss_low", IssueLevel.WARN, "Pequena perda de pacotes (${fmt(loss)}%)",
                    "Perdas ocasionais acontecem, mas não deveriam ser frequentes.", "Repita o teste em alguns minutos para ver se é constante.")
            }
        }

        // DNS
        s.dns?.let { d ->
            val sys = d.system
            val best = d.best
            val sysMs = sys?.combinedMs
            if (sys != null && sys.successRate < 0.8) {
                issues += Issue("dns_fail", IssueLevel.BAD, "DNS do sistema falhando (${(sys.successRate * 100).toInt()}% de sucesso)",
                    "O DNS traduz nomes (google.com) em endereços. Se falha, sites demoram ou não abrem.",
                    best?.let { "Configure o DNS privado \"${it.dotHost}\" (${it.name}), que respondeu em ${fmt(it.combinedMs!!)} ms." } ?: "Teste um DNS público confiável.",
                    "Trocar o DNS não aumenta a velocidade de download; melhora a confiabilidade e o tempo para começar a carregar.", FixAction.PRIVATE_DNS)
            } else if (best != null && sysMs != null && best.combinedMs!! + 15 < sysMs && best.combinedMs!! < sysMs * 0.75) {
                issues += Issue("dns_slow", IssueLevel.WARN, "DNS do sistema mais lento (${fmt(sysMs)} ms)",
                    "${best.name} respondeu em ${fmt(best.combinedMs!!)} ms nesta rede, contra ${fmt(sysMs)} ms do DNS atual.",
                    "Configure o DNS privado do Android com \"${best.dotHost}\". Ele também criptografa as consultas (DNS sobre TLS).",
                    "Benefício principal: sites começam a carregar um pouco mais rápido. NÃO aumenta a velocidade de download. Em algumas redes corporativas ou com controle parental, um DNS externo pode desativar filtros locais. Para desfazer, volte o DNS privado para \"Automático\".",
                    FixAction.PRIVATE_DNS)
            } else if (sys == null && best != null && c.privateDnsActive != true) {
                issues += Issue("dns_suggest", IssueLevel.INFO, "DNS privado não ativado",
                    "Não foi possível medir o DNS do sistema, mas ${best.name} respondeu em ${fmt(best.combinedMs!!)} ms.",
                    "Opcional: ative o DNS privado com \"${best.dotHost}\" para consultas criptografadas.",
                    "Não aumenta a velocidade de download. Para desfazer, volte para \"Automático\".", FixAction.PRIVATE_DNS)
            }
        }

        // Velocidade
        s.speed?.let { sp ->
            if (sp.error == null) {
                sp.downloadMbps?.let { dl ->
                    if (dl < 5) issues += Issue("dl_low", IssueLevel.WARN, "Download baixo (${fmt(dl)} Mbps)",
                        "Com menos de 5 Mbps, vídeos em HD e chamadas de vídeo podem travar.",
                        downloadAdvice(c))
                }
                val idle = sp.idleLatencyMs; val loaded = sp.loadedLatencyMs
                if (idle != null && loaded != null && loaded - idle > 100) {
                    issues += Issue("bufferbloat", IssueLevel.WARN, "Latência sobe muito sob uso (${fmt(idle)} → ${fmt(loaded)} ms)",
                        "Quando a rede está ocupada, o tempo de resposta dispara (\"bufferbloat\"). Por isso jogos travam quando alguém baixa algo.",
                        "Se o roteador tiver QoS/SQM (\"Smart Queue\"), ative-o. Também ajuda limitar downloads em segundo plano durante jogos e chamadas.")
                }
            }
        }

        // Estabilidade
        s.stability?.let { st ->
            if (st.outages > 0) issues += Issue("outages", IssueLevel.BAD, "${st.outages} queda(s) de conexão registrada(s)",
                "A internet ficou indisponível por até ${st.longestOutageSec} s durante o monitoramento.",
                "Quedas repetidas no Wi-Fi costumam vir do roteador (superaquecimento, firmware desatualizado) ou do provedor. Reinicie o roteador e, se continuar, registre as quedas e informe ao provedor.")
            else if (st.failureRate > 0.05) issues += Issue("unstable", IssueLevel.WARN, "Falhas ocasionais (${(st.failureRate * 100).toInt()}% das verificações)",
                "Algumas verificações não tiveram resposta a tempo.", "Mantenha o Modo Estabilidade ligado por mais tempo para identificar o padrão.")
        }

        if (c.httpProxy != null) issues += Issue("proxy", IssueLevel.INFO, "Proxy configurado (${c.httpProxy})",
            "O tráfego web passa por um servidor intermediário.", "Se você não configurou isso, remova o proxy nas configurações da rede Wi-Fi.")

        // Problemas de desempenho detectados descontam da nota (questões só de segurança, como rede aberta, não)
        val penalty = issues.filter { it.id !in setOf("wifi_open", "proxy", "roaming") }.sumOf { when (it.level) { IssueLevel.BAD -> 12; IssueLevel.WARN -> 5; else -> 0 }.toInt() }
        val score = computeScore(s, issues)?.let { (it - penalty).coerceIn(0, 100) }
        val label = when {
            score == null -> "Sem dados suficientes"
            score >= 85 -> "Excelente"
            score >= 70 -> "Boa"
            score >= 50 -> "Regular"
            else -> "Ruim"
        }
        if (issues.none { it.level >= IssueLevel.WARN } && s.latency != null) {
            issues += Issue("all_good", IssueLevel.OK, "Nenhum problema detectado nas medições",
                "Os valores medidos estão dentro do esperado para ${c.type.label}.",
                "Se ainda sentir lentidão, faça o teste de velocidade completo e compare com o contratado.")
        }
        return Diagnosis(score, label, issues.sortedByDescending { it.level.rank })
    }

    /** Pontuação 0–100 só com o que foi medido; null se nada relevante foi medido. */
    fun computeScore(s: NetworkSnapshot, issues: List<Issue> = emptyList()): Int? {
        if (!s.connection.connected) return 0
        val parts = mutableListOf<Pair<Double, Double>>() // (nota 0..1, peso)
        s.latency?.medianMs?.let { parts += scale(it, 20.0, 200.0) to 3.0 }
        s.latency?.jitterMs?.let { parts += scale(it, 3.0, 60.0) to 2.0 }
        s.latency?.lossPercent?.let { parts += scale(it, 0.0, 10.0) to 3.0 }
        s.dns?.system?.combinedMs?.let { parts += scale(it, 15.0, 250.0) to 1.0 }
        s.speed?.downloadMbps?.let { parts += scaleUp(it) to 2.0 }
        s.connection.wifi?.rssiDbm?.let { parts += (1.0 - scale(it.toDouble(), -55.0, -88.0, invert = true)) to 1.0 }
        s.stability?.let { parts += scale(it.failureRate * 100, 0.0, 20.0) to 2.0 }
        if (parts.isEmpty()) return null
        var v = parts.sumOf { it.first * it.second } / parts.sumOf { it.second }
        if (!s.connection.validated || s.connection.captivePortal) v *= 0.4
        return (v * 100).toInt().coerceIn(0, 100)
    }

    /** 1.0 quando valor <= bom, 0.0 quando >= ruim (menor é melhor). */
    private fun scale(v: Double, good: Double, bad: Double, invert: Boolean = false): Double {
        if (invert) { // maior é melhor (ex.: dBm): good=-55, bad=-88 -> retorna 0 quando bom
            return when {
                v >= good -> 0.0
                v <= bad -> 1.0
                else -> (good - v) / (good - bad)
            }
        }
        return when {
            v <= good -> 1.0
            v >= bad -> 0.0
            else -> 1.0 - (v - good) / (bad - good)
        }
    }

    /** Converte Mbps em nota (log): 1 Mbps -> 0, 100+ Mbps -> 1. */
    private fun scaleUp(mbps: Double): Double {
        if (mbps <= 1) return 0.0
        return (kotlin.math.ln(mbps) / kotlin.math.ln(100.0)).coerceIn(0.0, 1.0)
    }

    private fun latencyAdvice(c: ConnectionState) = when (c.type) {
        ConnType.WIFI -> "No Wi-Fi: aproxime-se do roteador, prefira 5 GHz e evite downloads simultâneos. Se possível, compare com os dados móveis — às vezes eles têm ping menor."
        ConnType.CELLULAR -> "Nos dados móveis a latência depende da torre e do sinal. Compare com uma rede Wi-Fi e teste em outro local ou horário."
        else -> "Compare com outra rede para saber se o problema é da conexão ou do servidor."
    }

    private fun downloadAdvice(c: ConnectionState) = when (c.type) {
        ConnType.WIFI -> "Teste perto do roteador. Se continuar baixo e outros aparelhos também estiverem lentos, reinicie o roteador e compare com o plano contratado."
        ConnType.CELLULAR -> "Velocidade móvel depende do sinal, da lotação da antena e do plano (pacote reduzido após a franquia). Teste em outro local."
        else -> "Compare com outra rede."
    }

    fun fmt(v: Double): String = if (v >= 100) v.toInt().toString() else String.format(java.util.Locale.US, "%.1f", v).replace('.', ',')
}
