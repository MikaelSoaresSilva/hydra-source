package com.nexusguard.app.ai

import com.nexusguard.app.network.ConnType
import com.nexusguard.app.network.ConnectionState
import com.nexusguard.app.network.DiagnosticsEngine
import com.nexusguard.app.network.DnsBenchmark
import com.nexusguard.app.network.IssueLevel
import com.nexusguard.app.network.LatencyResult
import com.nexusguard.app.network.NetworkSnapshot
import com.nexusguard.app.network.SpeedResult
import com.nexusguard.app.network.StabilitySummary
import com.nexusguard.app.security.CheckStatus
import com.nexusguard.app.security.SecurityScanResult
import java.text.Normalizer
import java.util.Locale

data class AiContext(
    val connection: ConnectionState? = null,
    val latency: LatencyResult? = null,
    val dns: DnsBenchmark? = null,
    val speed: SpeedResult? = null,
    val stability: StabilitySummary? = null,
    val security: SecurityScanResult? = null,
    val riskyApps: List<Pair<String, String>> = emptyList(),   // (nome do app, nível)
    val appsAnalyzed: Boolean = false,
    val lastPhishingLevel: String? = null
)

data class AiAnswer(
    val title: String,
    val paragraphs: List<String>,
    val actions: List<String> = emptyList(),
    val dataUsed: List<String> = emptyList(),
    val missing: List<String> = emptyList()
)

enum class AiIntent { SLOW, UNSTABLE, DNS, WIFI_RISK, PING, DOWNLOAD, BEST_CONFIG, SECURITY, APPS, PHISHING, GREETING, HELP, UNKNOWN }

/**
 * NEXUS AI — modo local. Motor de regras que interpreta somente medições reais salvas no aparelho.
 * Não é um modelo de linguagem: não "inventa", e diz explicitamente o que falta medir.
 */
object NexusAiEngine {

    val suggestions = listOf(
        "Por que minha internet está lenta?",
        "Minha conexão está instável?",
        "Meu DNS está demorando para responder?",
        "Minha rede Wi-Fi apresenta riscos?",
        "O que posso fazer para melhorar meu ping?",
        "Por que meu download está abaixo do esperado?",
        "Qual configuração é mais adequada para minha conexão?",
        "Meu celular está seguro?"
    )

    fun normalize(s: String): String =
        Normalizer.normalize(s.lowercase(Locale.ROOT), Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")

    fun classify(question: String): AiIntent {
        val q = normalize(question)
        fun any(vararg w: String) = w.any { q.contains(it) }
        return when {
            any("dns", "resolucao", "resolvedor") -> AiIntent.DNS
            any("ping", "latencia", "lag", "delay", "atraso", "jogo", "free fire", "game") -> AiIntent.PING
            any("instav", "oscil", "cai ", "caindo", "queda", "desconect", "estabil", "cai a", "fica caindo") -> AiIntent.UNSTABLE
            any("download", "baixar", "baixando", "velocidade de download", "abaixo do esperado", "contratad", "plano") -> AiIntent.DOWNLOAD
            any("wi-fi", "wifi", "roteador", "rede publica", "rede aberta") && any("risco", "segur", "perig", "hacker", "invad", "protegid") -> AiIntent.WIFI_RISK
            any("configura", "ajuste", "melhor opcao", "otimiz", "adequad") -> AiIntent.BEST_CONFIG
            any("lent", "devagar", "demora", "travando", "ruim", "carrega") -> AiIntent.SLOW
            any("aplicativo", " app", "apps", "permiss", "espiao", "stalker") -> AiIntent.APPS
            any("link", "phishing", "golpe", "site falso", "url") -> AiIntent.PHISHING
            any("seguro", "segur", "virus", "malware", "root", "protec", "hack") -> AiIntent.SECURITY
            any("wi-fi", "wifi", "roteador") -> AiIntent.WIFI_RISK
            any("oi", "ola", "bom dia", "boa tarde", "boa noite", "eai", "e ai") && q.length < 25 -> AiIntent.GREETING
            any("ajuda", "o que voce faz", "como funciona") -> AiIntent.HELP
            else -> AiIntent.UNKNOWN
        }
    }

    private fun f(v: Double?) = v?.let { DiagnosticsEngine.fmt(it) } ?: "não disponível"

    private fun snapshot(c: AiContext) = c.connection?.let { NetworkSnapshot(it, c.latency, c.dns, c.speed, c.stability) }

    fun answer(question: String, c: AiContext): AiAnswer = when (classify(question)) {
        AiIntent.SLOW -> slow(c)
        AiIntent.UNSTABLE -> unstable(c)
        AiIntent.DNS -> dns(c)
        AiIntent.WIFI_RISK -> wifiRisk(c)
        AiIntent.PING -> ping(c)
        AiIntent.DOWNLOAD -> download(c)
        AiIntent.BEST_CONFIG -> bestConfig(c)
        AiIntent.SECURITY -> security(c)
        AiIntent.APPS -> apps(c)
        AiIntent.PHISHING -> phishing(c)
        AiIntent.GREETING, AiIntent.HELP -> help()
        AiIntent.UNKNOWN -> unknown(c)
    }

    private fun connLine(c: ConnectionState?): String? = c?.let {
        val extra = when (it.type) {
            ConnType.WIFI -> it.wifi?.let { w -> listOfNotNull(w.bandLabel, w.rssiDbm?.let { r -> "sinal $r dBm" }).joinToString(", ") }
            ConnType.CELLULAR -> it.cellular?.let { cell -> listOfNotNull(cell.technology, cell.signalLevel?.let { l -> "sinal $l/4" }).joinToString(", ") }
            else -> null
        }
        "Conexão atual: ${it.type.label}${if (!extra.isNullOrBlank()) " ($extra)" else ""}${if (it.validated) ", internet confirmada" else ", internet NÃO confirmada"}."
    }

    private fun used(c: AiContext): List<String> = listOfNotNull(
        c.connection?.let { "Estado da conexão" },
        c.latency?.let { "Teste de latência (${it.method}, ${it.received}/${it.sent} respostas)" },
        c.dns?.let { "Comparação de DNS (${it.results.size} resolvedores)" },
        c.speed?.takeIf { it.error == null }?.let { "Teste de velocidade" },
        c.stability?.let { "Modo Estabilidade (${it.samples} verificações)" },
        c.security?.let { "Verificação de segurança" }
    )

    private fun netMissing(c: AiContext, needSpeed: Boolean = false, needDns: Boolean = false, needLatency: Boolean = true): List<String> = listOfNotNull(
        if (c.connection == null) "estado da conexão" else null,
        if (needLatency && c.latency == null) "teste de latência (botão OTIMIZAR MINHA INTERNET)" else null,
        if (needDns && c.dns == null) "comparação de DNS" else null,
        if (needSpeed && (c.speed == null || c.speed.error != null)) "teste de velocidade" else null
    )

    private fun issuesText(c: AiContext, ids: Set<String>? = null, minLevel: IssueLevel = IssueLevel.INFO): Pair<List<String>, List<String>> {
        val snap = snapshot(c) ?: return emptyList<String>() to emptyList()
        val d = DiagnosticsEngine.diagnose(snap)
        val sel = d.issues.filter { it.level >= minLevel && (ids == null || ids.any { id -> it.id.startsWith(id) }) }
        return sel.map { "${it.level.label}: ${it.title}. ${it.detail}" } to sel.map { it.recommendation + (it.consequence?.let { c2 -> " (Efeito: $c2)" } ?: "") }
    }

    private fun slow(c: AiContext): AiAnswer {
        val p = mutableListOf<String>()
        connLine(c.connection)?.let { p += it }
        val (found, recs) = issuesText(c, minLevel = IssueLevel.WARN)
        if (c.latency == null && c.speed == null) {
            p += "Ainda não tenho medições suficientes para explicar a lentidão. Toque em OTIMIZAR MINHA INTERNET (mede latência, DNS e estabilidade) e, se puder gastar dados, faça o teste de velocidade."
        } else if (found.isEmpty()) {
            p += "As medições salvas não mostram problema: latência ${f(c.latency?.medianMs)} ms, jitter ${f(c.latency?.jitterMs)} ms, perda ${f(c.latency?.lossPercent)}%, download ${f(c.speed?.downloadMbps)} Mbps."
            p += "Se a lentidão é num app específico, o gargalo pode ser o servidor daquele serviço e não sua conexão. Também vale repetir o teste no horário em que a lentidão acontece."
        } else {
            p += "Encontrei estes pontos nas suas medições:"
            p += found
        }
        return AiAnswer("Por que a internet está lenta", p, recs, used(c), netMissing(c, needSpeed = true))
    }

    private fun unstable(c: AiContext): AiAnswer {
        val p = mutableListOf<String>()
        connLine(c.connection)?.let { p += it }
        val st = c.stability
        val l = c.latency
        if (st == null && l == null) {
            p += "Para saber se a conexão é instável preciso acompanhá-la por algum tempo. Ligue o Modo Estabilidade (aba Internet) por 10–30 minutos enquanto usa o celular normalmente."
            return AiAnswer("Estabilidade da conexão", p, emptyList(), used(c), listOf("Modo Estabilidade", "teste de latência"))
        }
        st?.let {
            p += "Monitoramento: ${it.samples} verificações em ${it.durationSec / 60} min, ${it.failures} sem resposta, ${it.outages} queda(s), maior queda ${it.longestOutageSec} s, ${it.networkChanges} troca(s) de rede, latência mediana ${f(it.medianRttMs)} ms."
        }
        l?.let { p += "Último teste de latência: jitter ${f(it.jitterMs)} ms e perda de pacotes ${f(it.lossPercent)}%." }
        val (found, recs) = issuesText(c, setOf("outages", "unstable", "jitter", "loss", "wifi_signal", "cell_signal"), IssueLevel.WARN)
        p += if (found.isEmpty()) "Veredito: estável nas medições feitas (jitter abaixo de 15 ms, sem perdas relevantes e sem quedas)." else "Veredito: há sinais de instabilidade:"
        p += found
        return AiAnswer("Estabilidade da conexão", p, recs, used(c), if (st == null) listOf("Modo Estabilidade (para detectar quedas ao longo do tempo)") else emptyList())
    }

    private fun dns(c: AiContext): AiAnswer {
        val d = c.dns ?: return AiAnswer("DNS", listOf("Ainda não comparei os servidores DNS nesta rede. Abra Internet > Diagnóstico DNS (gasta menos de 50 KB)."), emptyList(), used(c), listOf("comparação de DNS"))
        val p = mutableListOf<String>()
        val sys = d.system
        p += if (sys?.combinedMs != null) "DNS atual do sistema (${sys.address}): ${f(sys.combinedMs)} ms, ${(sys.successRate * 100).toInt()}% de sucesso."
        else "Não consegui medir o DNS do sistema diretamente (comum quando o DNS privado está ativo ou a operadora bloqueia consultas diretas)."
        val ranking = d.results.filter { it.combinedMs != null }.sortedBy { it.combinedMs }.take(4)
        if (ranking.isNotEmpty()) p += "Mais rápidos nesta rede: " + ranking.joinToString("; ") { "${it.name} ${f(it.combinedMs)} ms" } + "."
        val (found, recs) = issuesText(c, setOf("dns"), IssueLevel.INFO)
        p += if (found.isEmpty()) "Seu DNS está respondendo bem; trocar não traria ganho perceptível." else found.joinToString(" ")
        p += "Importante: DNS só afeta o tempo para descobrir o endereço de um site. Não aumenta a velocidade de download nem reduz o ping em jogos."
        return AiAnswer("Diagnóstico de DNS", p, recs, used(c))
    }

    private fun wifiRisk(c: AiContext): AiAnswer {
        val conn = c.connection
        if (conn == null || conn.type != ConnType.WIFI) {
            return AiAnswer("Segurança do Wi-Fi", listOf("Você não está conectado a um Wi-Fi agora${conn?.let { " (conexão atual: ${it.type.label})" } ?: ""}. Conecte-se à rede e abra Segurança > Diagnóstico de Wi-Fi."), emptyList(), used(c))
        }
        val w = conn.wifi
        val p = mutableListOf<String>()
        val acts = mutableListOf<String>()
        p += "Tipo de segurança informado pelo Android: ${w?.securityType ?: "não disponível nesta versão do Android"}."
        when (w?.securityLevel) {
            0 -> { p += "É uma rede ABERTA: sem criptografia do Wi-Fi. Quem estiver na mesma rede pode ver para quais sites você vai e ler qualquer tráfego sem HTTPS."; acts += "Para banco e compras, use dados móveis."; acts += "Se a rede é sua, ative WPA2 ou WPA3 no roteador." }
            1 -> { p += "A proteção é fraca (WEP/WPA antigo), quebrável em minutos com ferramentas públicas."; acts += "No roteador, mude para WPA2-AES ou WPA3." }
            2 -> p += "A proteção é adequada (WPA2). Use senha longa e mantenha o roteador atualizado."
            3 -> p += "A proteção é forte (WPA3 ou empresarial)."
            else -> {}
        }
        if (conn.captivePortal) { p += "A rede tem portal cativo (página de login). É comum em redes públicas; nunca use nela a mesma senha de outras contas."; }
        if (conn.httpProxy != null) { p += "Há um proxy configurado (${conn.httpProxy}). Se não foi você, remova: um proxy pode observar seu tráfego."; acts += "Remova o proxy nas opções da rede Wi-Fi." }
        if (conn.privateDnsActive == true) p += "O DNS privado está ativo: suas consultas DNS estão criptografadas."
        else { acts += "Ative o DNS privado (Internet > Diagnóstico DNS mostra o mais rápido) para criptografar as consultas de nomes." }
        if (conn.vpnActive) p += "Uma VPN está ativa: o tráfego sai criptografado até o servidor da VPN."
        p += "Limite honesto: um app sem root não consegue detectar ataques ativos na rede (como ARP spoofing) com certeza. Os sinais acima são os que o Android permite verificar."
        return AiAnswer("Segurança do Wi-Fi", p, acts, used(c))
    }

    private fun ping(c: AiContext): AiAnswer {
        val l = c.latency ?: return AiAnswer("Ping", listOf("Ainda não medi sua latência. Toque em OTIMIZAR MINHA INTERNET."), emptyList(), used(c), listOf("teste de latência"))
        val p = mutableListOf<String>()
        connLine(c.connection)?.let { p += it }
        p += "Latência (${l.method} até ${l.target}): mediana ${f(l.medianMs)} ms, mínima ${f(l.minMs)} ms, máxima ${f(l.maxMs)} ms, jitter ${f(l.jitterMs)} ms, perda ${f(l.lossPercent)}%."
        val med = l.medianMs
        p += when {
            med == null -> "Não houve respostas suficientes para avaliar."
            med <= 40 -> "Ping ótimo para jogos online."
            med <= 70 -> "Ping bom; jogável na maioria dos jogos."
            med <= 120 -> "Ping moderado: dá para jogar, mas você pode sentir atraso em jogos competitivos."
            else -> "Ping alto: jogos competitivos e chamadas vão sofrer."
        }
        val acts = mutableListOf<String>()
        if (c.connection?.type == ConnType.WIFI) {
            acts += "Fique perto do roteador e use a rede 5 GHz (menos interferência)."
            acts += "Peça para pausarem downloads, atualizações e streaming 4K na mesma rede durante a partida."
            acts += "Compare com os dados móveis: em alguns lugares o 4G/5G tem ping menor que o Wi-Fi."
        } else {
            acts += "Procure um local com sinal melhor (nível 3 ou 4) e perto de janelas."
            acts += "Compare com um Wi-Fi de boa qualidade."
        }
        acts += "Escolha no jogo o servidor da sua região (ex.: Brasil). O ping depende da distância até o servidor do jogo."
        acts += "Trocar o DNS NÃO reduz o ping do jogo — só o tempo de encontrar o servidor ao conectar."
        c.speed?.let { s -> if (s.idleLatencyMs != null && s.loadedLatencyMs != null && s.loadedLatencyMs - s.idleLatencyMs > 100) acts += "Sua latência sobe muito quando a rede está ocupada (${f(s.idleLatencyMs)} → ${f(s.loadedLatencyMs)} ms). Ativar QoS/SQM no roteador ajuda." }
        return AiAnswer("Como melhorar o ping", p, acts, used(c))
    }

    private fun download(c: AiContext): AiAnswer {
        val s = c.speed?.takeIf { it.error == null }
            ?: return AiAnswer("Download", listOf("Preciso de um teste de velocidade para responder. Abra Internet > Teste de velocidade (o consumo de dados é informado antes)."), emptyList(), used(c), listOf("teste de velocidade"))
        val p = mutableListOf<String>()
        connLine(c.connection)?.let { p += it }
        p += "Último teste: download ${f(s.downloadMbps)} Mbps, upload ${f(s.uploadMbps)} Mbps (servidor ${s.server})."
        val acts = mutableListOf<String>()
        val w = c.connection?.wifi
        if (c.connection?.type == ConnType.WIFI && w != null) {
            w.linkSpeedMbps?.let { link ->
                p += "A velocidade de enlace Wi-Fi é $link Mbps. Na prática, o download útil fica em torno de 50–70% disso."
                if (s.downloadMbps != null && s.downloadMbps > link * 0.45) acts += "O limite agora é o próprio Wi-Fi do celular. Melhore o sinal (perto do roteador, 5 GHz) para subir o teto."
            }
            if (w.frequencyMhz in 2400..2500) acts += "Você está em 2,4 GHz, que costuma limitar a velocidade. Teste a rede 5 GHz perto do roteador."
        }
        acts += "Compare com o plano contratado: faça o teste perto do roteador com poucos aparelhos usando a rede. Se ficar abaixo de ~80% do contratado de forma repetida, registre os resultados (Ajustes > Exportar) e acione o provedor."
        acts += "Velocidade também varia por horário (noite costuma ser mais congestionada)."
        val (found, recs) = issuesText(c, setOf("dl_", "wifi_", "cell_", "loss", "bufferbloat"), IssueLevel.WARN)
        p += found
        return AiAnswer("Download abaixo do esperado", p, acts + recs, used(c))
    }

    private fun bestConfig(c: AiContext): AiAnswer {
        val p = mutableListOf<String>()
        val acts = mutableListOf<String>()
        connLine(c.connection)?.let { p += it }
        val best = c.dns?.best
        val sysMs = c.dns?.system?.combinedMs
        if (best != null && sysMs != null && sysMs <= best.combinedMs!!) acts += "Seu DNS atual já é o mais rápido nesta rede (${f(sysMs)} ms); trocar não traria ganho de velocidade. Opcional, por privacidade: DNS privado \"${best.dotHost}\" (${best.name}, ${f(best.combinedMs)} ms) criptografa as consultas."
        else if (best != null) acts += "DNS privado recomendado para esta rede: \"${best.dotHost}\" (${best.name}, ${f(best.combinedMs)} ms). Configure em Ajustes do Android > Conexão e compartilhamento > DNS privado. Efeito: consultas criptografadas e resolução possivelmente mais rápida; não altera a velocidade de download. Para desfazer: voltar para \"Automático\"."
        else acts += "Faça a comparação de DNS para eu recomendar o melhor resolvedor nesta rede."
        when (c.connection?.type) {
            ConnType.WIFI -> {
                acts += "Wi-Fi: prefira 5 GHz perto do roteador e 2,4 GHz longe dele."
                acts += "No roteador (se tiver acesso): firmware atualizado, WPA2/WPA3, canal automático e QoS para jogos/chamadas."
            }
            ConnType.CELLULAR -> {
                acts += "Dados móveis: se o 5G estiver com sinal fraco e oscilando, fixar 4G pode estabilizar (Ajustes > Chip/Rede móvel > Tipo de rede preferido). Reversível a qualquer momento; 5G forte costuma ser melhor."
                acts += "Desative \"Economia de dados\" para apps que precisam de tempo real, se perceber cortes."
            }
            else -> {}
        }
        acts += "O NEXUS GUARD não altera configurações do sistema sozinho: o Android não permite que apps mudem DNS, banda ou modo de rede sem você."
        val (found, recs) = issuesText(c, minLevel = IssueLevel.WARN)
        if (found.isNotEmpty()) { p += "Pontos detectados:"; p += found }
        return AiAnswer("Configuração recomendada", p, acts + recs, used(c), netMissing(c, needDns = true))
    }

    private fun security(c: AiContext): AiAnswer {
        val s = c.security ?: return AiAnswer("Segurança do celular", listOf("Ainda não fiz uma verificação completa. Toque em VERIFICAR na tela inicial."), emptyList(), used(c), listOf("verificação de segurança"))
        val p = mutableListOf<String>()
        p += "Pontuação: ${s.score ?: "sem dados"}/100, baseada em ${s.checks.count { it.status != CheckStatus.UNKNOWN && it.status != CheckStatus.INFO }} verificações reais. Android ${s.androidVersion}, patch de segurança ${s.securityPatch ?: "não informado"}."
        val bad = s.checks.filter { it.status == CheckStatus.FAIL || it.status == CheckStatus.WARN }
        if (bad.isEmpty()) p += "Nenhum item em risco nas verificações feitas." else {
            p += "Itens que merecem atenção:"
            bad.forEach { p += "${it.status.label}: ${it.title} — ${it.detail}" }
        }
        if (c.riskyApps.isNotEmpty()) p += "Apps com risco alto ou crítico: " + c.riskyApps.joinToString { "${it.first} (${it.second})" } + "."
        else if (c.appsAnalyzed) p += "Na análise de aplicativos, nenhum ficou com risco alto ou crítico."
        p += "Nenhum app consegue garantir proteção absoluta. A pontuação mostra configurações e sinais verificáveis, não ausência total de ameaças."
        return AiAnswer("Segurança do celular", p, bad.mapNotNull { it.recommendation }, used(c), if (!c.appsAnalyzed) listOf("análise de aplicativos") else emptyList())
    }

    private fun apps(c: AiContext): AiAnswer {
        if (!c.appsAnalyzed) return AiAnswer("Aplicativos", listOf("Abra Segurança > Análise de aplicativos para eu avaliar as permissões dos apps instalados."), emptyList(), used(c), listOf("análise de aplicativos"))
        val p = mutableListOf<String>()
        p += if (c.riskyApps.isEmpty()) "Nenhum app com risco alto ou crítico. Mesmo assim, revise periodicamente quem tem acesso a localização, microfone e câmera."
        else "Estes apps têm combinação de acessos que merece revisão: " + c.riskyApps.joinToString { "${it.first} (${it.second})" } + "."
        p += "Risco alto não significa que o app esteja infectado. Significa que ele tem poderes que seriam perigosos nas mãos erradas. Se você reconhece e confia no app, tudo bem."
        return AiAnswer("Aplicativos", p, listOf("Toque no app na lista e use \"Abrir configurações\" para remover permissões que ele não precisa.", "Desinstale apps que você não reconhece."), used(c))
    }

    private fun phishing(c: AiContext) = AiAnswer("Links suspeitos", listOfNotNull(
        "Para verificar um link: no WhatsApp, navegador ou e-mail, toque em Compartilhar e escolha NEXUS GUARD. Ou cole o link em Segurança > Proteção contra phishing.",
        c.lastPhishingLevel?.let { "Último link analisado: $it." },
        "Sinais clássicos de golpe: nome de banco com domínio diferente do oficial, urgência (\"sua conta será bloqueada\"), pedido de senha/código por link e arquivos .apk enviados por mensagem."
    ), emptyList(), used(c))

    private fun help() = AiAnswer("Olá! Eu sou a NEXUS AI", listOf(
        "Funciono no modo local: leio as medições reais feitas pelo NEXUS GUARD neste aparelho (conexão, latência, DNS, velocidade, estabilidade e segurança) e explico o que elas significam.",
        "Se algo ainda não foi medido, eu aviso em vez de inventar. Experimente uma das perguntas sugeridas."
    ))

    private fun unknown(c: AiContext): AiAnswer {
        val snap = snapshot(c)
        val p = mutableListOf("Não entendi exatamente a pergunta. Posso falar sobre lentidão, estabilidade, ping, download, DNS, segurança do Wi-Fi, aplicativos e links suspeitos.")
        if (snap != null) {
            val d = DiagnosticsEngine.diagnose(snap)
            p += "Resumo atual da conexão: ${d.label}${d.score?.let { " ($it/100)" } ?: ""}."
        }
        return AiAnswer("NEXUS AI", p, emptyList(), used(c))
    }

    /** Resumo em texto para o modo online opcional (sem nome de rede, sem lista de apps, sem identificadores). */
    fun contextSummary(c: AiContext): String = buildString {
        c.connection?.let { appendLine("Conexão: ${it.type.label}; validada=${it.validated}; portal=${it.captivePortal}; DNS privado=${it.privateDnsActive}; Wi-Fi banda=${it.wifi?.bandLabel}; RSSI=${it.wifi?.rssiDbm}; enlace=${it.wifi?.linkSpeedMbps}; segurança=${it.wifi?.securityType}; celular=${it.cellular?.technology}; sinal=${it.cellular?.signalLevel}") }
        c.latency?.let { appendLine("Latência ${it.method}: mediana=${it.medianMs} jitter=${it.jitterMs} perda=${it.lossPercent}%") }
        c.dns?.let { d -> appendLine("DNS: " + d.results.joinToString { "${it.name}=${it.combinedMs?.toInt()}ms/${(it.successRate * 100).toInt()}%" }) }
        c.speed?.let { appendLine("Velocidade: down=${it.downloadMbps} up=${it.uploadMbps} lat_ociosa=${it.idleLatencyMs} lat_carga=${it.loadedLatencyMs} erro=${it.error}") }
        c.stability?.let { appendLine("Estabilidade: amostras=${it.samples} falhas=${it.failures} quedas=${it.outages}") }
        c.security?.let { s -> appendLine("Segurança: nota=${s.score}; problemas=" + s.checks.filter { it.status == CheckStatus.FAIL || it.status == CheckStatus.WARN }.joinToString { it.title }) }
    }
}
