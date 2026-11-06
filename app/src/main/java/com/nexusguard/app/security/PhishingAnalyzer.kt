package com.nexusguard.app.security

import java.net.URI
import java.text.Normalizer
import java.util.Locale

enum class Severity(val weight: Int, val label: String) {
    INFO(0, "Informação"), LOW(8, "Baixo"), MEDIUM(18, "Médio"), HIGH(35, "Alto"), CRITICAL(70, "Crítico")
}

data class Finding(val severity: Severity, val title: String, val explanation: String)

enum class RiskLevel(val label: String) {
    NONE_FOUND("Nenhum indicador forte encontrado"),
    ATTENTION("Atenção"),
    SUSPICIOUS("Suspeito"),
    DANGEROUS("Provavelmente perigoso"),
    INVALID("Endereço inválido")
}

data class PhishingReport(
    val input: String,
    val url: String?,
    val host: String?,
    val registrableDomain: String?,
    val score: Int,
    val level: RiskLevel,
    val findings: List<Finding>,
    val isShortener: Boolean,
    val impersonatedBrand: String?
)

/**
 * Análise heurística local de URLs. Não acessa o link.
 * Resultado é uma estimativa de risco baseada em sinais conhecidos de phishing — nunca uma garantia.
 */
class PhishingAnalyzer(private val iocWebsites: Set<String> = emptySet()) {

    data class Brand(val name: String, val keywords: List<String>, val officialDomains: Set<String>, val strict: Boolean = false)

    companion object {
        val brands = listOf(
            Brand("Nubank", listOf("nubank"), setOf("nubank.com.br", "nu.com.mx", "nubank.com")),
            Brand("Itaú", listOf("itau"), setOf("itau.com.br", "itau.com", "itaucard.com.br", "itaupersonnalite.com.br"), strict = true),
            Brand("Bradesco", listOf("bradesco"), setOf("bradesco.com.br", "bradesco", "bradescoseguros.com.br", "bradescard.com.br")),
            Brand("Santander", listOf("santander"), setOf("santander.com.br", "santander.com")),
            Brand("Caixa", listOf("caixa"), setOf("caixa.gov.br"), strict = true),
            Brand("Banco do Brasil", listOf("bancodobrasil", "bbcombr"), setOf("bb.com.br")),
            Brand("Banco Inter", listOf("bancointer"), setOf("bancointer.com.br", "inter.co")),
            Brand("PicPay", listOf("picpay"), setOf("picpay.com", "picpay.com.br")),
            Brand("Mercado Livre", listOf("mercadolivre", "mercadolibre"), setOf("mercadolivre.com.br", "mercadolibre.com", "mercadolivre.com")),
            Brand("Mercado Pago", listOf("mercadopago"), setOf("mercadopago.com.br", "mercadopago.com")),
            Brand("C6 Bank", listOf("c6bank"), setOf("c6bank.com.br")),
            Brand("Sicoob", listOf("sicoob"), setOf("sicoob.com.br")),
            Brand("Sicredi", listOf("sicredi"), setOf("sicredi.com.br")),
            Brand("PayPal", listOf("paypal"), setOf("paypal.com", "paypal.me")),
            Brand("Netflix", listOf("netflix"), setOf("netflix.com", "netflix.net")),
            Brand("Apple", listOf("apple", "icloud", "appleid"), setOf("apple.com", "icloud.com", "apple.com.br"), strict = true),
            Brand("Google", listOf("google", "gmail"), setOf("google.com", "google.com.br", "gmail.com", "goo.gl", "g.co", "youtube.com", "googleusercontent.com", "googleapis.com", "gstatic.com", "googlevideo.com", "google.dev", "googleblog.com", "withgoogle.com")),
            Brand("Microsoft", listOf("microsoft", "office365", "outlook", "hotmail"), setOf("microsoft.com", "live.com", "outlook.com", "office.com", "hotmail.com", "microsoftonline.com")),
            Brand("WhatsApp", listOf("whatsapp"), setOf("whatsapp.com", "whatsapp.net", "wa.me")),
            Brand("Instagram", listOf("instagram"), setOf("instagram.com")),
            Brand("Facebook", listOf("facebook"), setOf("facebook.com", "fb.com", "fb.me", "meta.com")),
            Brand("Amazon", listOf("amazon"), setOf("amazon.com", "amazon.com.br", "amazonaws.com", "amazon.dev"), strict = true),
            Brand("Shopee", listOf("shopee"), setOf("shopee.com.br", "shopee.com")),
            Brand("Magalu", listOf("magalu", "magazineluiza"), setOf("magazineluiza.com.br", "magalu.com", "magalu.com.br")),
            Brand("Americanas", listOf("americanas"), setOf("americanas.com.br", "americanas.com")),
            Brand("Correios", listOf("correios"), setOf("correios.com.br")),
            Brand("Receita Federal / gov.br", listOf("receitafederal", "govbr", "gov-br", "serpro"), setOf("gov.br")),
            Brand("Serasa", listOf("serasa"), setOf("serasa.com.br", "serasaexperian.com.br")),
            Brand("Steam", listOf("steamcommunity", "steampowered"), setOf("steampowered.com", "steamcommunity.com")),
            Brand("Binance", listOf("binance"), setOf("binance.com")),
            Brand("TikTok", listOf("tiktok"), setOf("tiktok.com")),
            Brand("Free Fire / Garena", listOf("garena", "freefire"), setOf("garena.com", "ff.garena.com"))
        )

        val shorteners = setOf(
            "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly", "shorturl.at",
            "tiny.cc", "rb.gy", "t.ly", "v.gd", "bl.ink", "short.io", "s.id", "encurtador.com.br", "tinyurl.is", "shorturl.gg", "lnkd.in", "qr.io"
        )

        /** TLDs com alta proporção de abuso segundo relatórios públicos (ex.: Spamhaus, Interisle). Sinal fraco, nunca decisivo. */
        val abusedTlds = setOf(
            "zip", "mov", "top", "xyz", "click", "link", "work", "rest", "cam", "icu", "cfd", "sbs", "bond", "tk", "ml", "ga", "cf", "gq",
            "buzz", "monster", "cyou", "quest", "loan", "win", "bid", "country", "kim", "support", "live", "online", "site", "fun", "lol", "su"
        )

        private val lureWords = listOf(
            "login", "signin", "sign-in", "logon", "verify", "verificar", "verificacao", "validar", "atualizar", "atualizacao", "update",
            "confirm", "confirmar", "senha", "password", "conta", "account", "seguranca", "security", "secure", "bloqueio", "bloqueada",
            "desbloquear", "regularizar", "premio", "ganhe", "gratis", "brinde", "resgate", "resgatar", "rastreio", "rastreamento", "taxa",
            "pix", "cartao", "token", "wallet", "carteira", "recover", "recuperar", "suporte", "cadastro", "pendencia", "multa", "boleto", "fatura"
        )

        private val dangerousDownloadExt = listOf(".apk", ".xapk", ".apks", ".exe", ".scr", ".bat", ".cmd", ".msi", ".js", ".vbs", ".jar", ".ps1", ".hta", ".lnk", ".dex")

        private val urlRegex = Regex("""(?i)\b((?:https?://|www\.)[^\s<>"'`]+|(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:/[^\s<>"'`]*)?)""")

        /** Extrai o primeiro link de um texto compartilhado (ex.: mensagem de WhatsApp). */
        fun extractUrl(text: String): String? {
            val t = text.trim()
            if (t.startsWith("javascript:", true) || t.startsWith("data:", true)) return t
            val m = urlRegex.find(t) ?: return null
            return m.value.trimEnd('.', ',', ';', ')', ']', '!', '?')
        }

        fun stripAccents(s: String): String =
            Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
    }

    fun analyze(input: String): PhishingReport {
        val raw = input.trim()
        val extracted = extractUrl(raw)
        if (extracted == null) {
            return PhishingReport(raw, null, null, null, 0, RiskLevel.INVALID,
                listOf(Finding(Severity.INFO, "Nenhum link encontrado", "O texto não contém um endereço web reconhecível.")), false, null)
        }
        val findings = mutableListOf<Finding>()
        val lower = extracted.lowercase(Locale.ROOT)

        if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
            findings += Finding(Severity.CRITICAL, "Esquema perigoso",
                "Links \"javascript:\" ou \"data:\" executam código ou embutem páginas inteiras. Não são usados por sites legítimos para navegação.")
            return build(raw, extracted, null, null, findings, false, null)
        }

        val withScheme = if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(extracted)) extracted else "http://$extracted"
        val schemeGiven = withScheme === extracted || extracted.contains("://")

        // Host bruto (antes de normalização do URI), para detectar '@' e caracteres não ASCII
        val afterScheme = withScheme.substringAfter("://")
        val authority = afterScheme.substringBefore('/').substringBefore('?').substringBefore('#')
        if (authority.contains('@')) {
            findings += Finding(Severity.HIGH, "Uso de \"@\" no endereço",
                "Tudo antes do \"@\" é ignorado pelo navegador. Golpistas usam isso para exibir um nome confiável e levar a outro site (ex.: banco.com@site-falso.com).")
        }
        val hostPortRaw = authority.substringAfterLast('@')
        val hostRaw = if (hostPortRaw.startsWith("[")) hostPortRaw.substringBefore(']') + "]" else hostPortRaw.substringBefore(':')
        val port = if (!hostPortRaw.startsWith("[") && hostPortRaw.contains(':')) hostPortRaw.substringAfter(':').toIntOrNull() else null

        val host = DomainUtils.normalizeHost(hostRaw)
        if (host.isEmpty() || (!host.contains('.') && !DomainUtils.isIpAddress(host))) {
            return PhishingReport(raw, extracted, null, null, 0, RiskLevel.INVALID,
                listOf(Finding(Severity.INFO, "Endereço incompleto", "Não foi possível identificar um domínio válido.")), false, null)
        }

        val scheme = withScheme.substringBefore("://").lowercase(Locale.ROOT)
        val pathAndQuery = afterScheme.removePrefix(authority)

        // 1. Protocolo
        if (scheme == "http" && schemeGiven && extracted.lowercase().startsWith("http://")) {
            findings += Finding(Severity.MEDIUM, "Sem criptografia (HTTP)",
                "Dados digitados nessa página podem ser lidos ou alterados no caminho. Nunca informe senhas ou dados bancários em páginas HTTP.")
        } else if (scheme != "http" && scheme != "https") {
            findings += Finding(Severity.MEDIUM, "Protocolo incomum ($scheme)", "Links desse tipo podem abrir aplicativos ou arquivos em vez de uma página web.")
        }

        // 2. Host por IP
        val isIp = DomainUtils.isIpAddress(host)
        if (isIp) {
            findings += Finding(Severity.HIGH, "Endereço IP no lugar de nome",
                "Sites legítimos de bancos, lojas e serviços usam nomes de domínio. Links com número IP são comuns em golpes e servidores improvisados.")
        }

        // 3. Caracteres internacionais / punycode
        val nonAscii = hostRaw.any { it.code > 127 }
        if (nonAscii || host.split('.').any { it.startsWith("xn--") }) {
            findings += Finding(Severity.HIGH, "Caracteres que imitam letras",
                "O domínio usa caracteres internacionais (punycode). Isso permite criar endereços visualmente idênticos aos de sites reais, trocando letras latinas por letras parecidas de outros alfabetos.")
        }

        val registrable = if (isIp) host else DomainUtils.registrableDomain(host)
        val regLabel = registrable.substringBefore('.')
        val tld = host.substringAfterLast('.')
        val isShortener = registrable in shorteners || host in shorteners

        // 4. Base de indicadores conhecidos (stalkerware)
        if (iocWebsites.any { it == host || it == registrable || host.endsWith(".$it") }) {
            findings += Finding(Severity.CRITICAL, "Domínio em base de indicadores conhecidos",
                "Este domínio consta na base pública stalkerware-indicators (Echap) como associado a aplicativos de espionagem.")
        }

        // 5. Imitação de marca
        var brandHit: String? = null
        val institutional = listOf(".gov.br", ".jus.br", ".leg.br", ".mil.br", ".edu.br", ".mp.br").any { registrable.endsWith(it) }
        if (!isIp && !institutional) {
            val tokens = stripAccents(host).split('.', '-', '_').filter { it.isNotEmpty() }
            val hostFlat = stripAccents(host).replace(".", "")
            val hostDeconf = DomainUtils.deconfuse(hostFlat)
            val officialAny = brands.any { b -> b.officialDomains.any { registrable == it || host == it || host.endsWith(".$it") } }
            for (b in brands) {
                if (officialAny) break
                val contains = if (b.strict) {
                    b.keywords.any { k -> tokens.any { t -> t == k || t.matches(Regex("$k\\d+")) || DomainUtils.deconfuse(t) == k } }
                } else b.keywords.any { k -> hostFlat.contains(k) || hostDeconf.contains(k) }
                if (contains) {
                    brandHit = b.name
                    findings += Finding(Severity.HIGH, "Possível imitação de ${b.name}",
                        "O endereço contém o nome \"${b.name}\", mas o domínio real é \"$registrable\", que não é um domínio oficial conhecido da marca (${b.officialDomains.first()}).")
                    break
                }
                val labelDeconf = DomainUtils.deconfuse(regLabel)
                val near = b.keywords.firstOrNull { k -> k.length >= 5 && regLabel != k &&
                        (DomainUtils.levenshtein(regLabel, k) in 1..(if (k.length >= 8) 2 else 1) || (labelDeconf == k && regLabel != k)) }
                if (near != null) {
                    brandHit = b.name
                    findings += Finding(Severity.HIGH, "Nome muito parecido com ${b.name}",
                        "\"$regLabel\" difere de \"$near\" por poucas letras. Essa técnica (typosquatting) engana quem lê rápido.")
                    break
                }
            }
        }
        if (!isIp) {
            if (host.contains("gov.br") && !host.endsWith(".gov.br") && host != "gov.br") {
                findings += Finding(Severity.HIGH, "Falso endereço do governo",
                    "O texto \"gov.br\" aparece no meio do endereço, mas o domínio termina em \".$tld\". Sites oficiais do governo brasileiro terminam em \".gov.br\".")
            }
        }

        // 6. Encurtador
        if (isShortener) {
            findings += Finding(Severity.LOW, "Link encurtado",
                "O destino real está escondido. Use \"Expandir link\" para ver para onde ele leva antes de abrir.")
        }

        // 7. Hospedagem gratuita
        val freeHost = DomainUtils.freeHostingSuffixes.firstOrNull { host.endsWith(".$it") }
        if (freeHost != null) {
            findings += Finding(Severity.MEDIUM, "Hospedado em serviço gratuito ($freeHost)",
                "Qualquer pessoa pode criar páginas nesse serviço em segundos. Bancos e lojas não usam esses endereços para login ou pagamentos.")
        }

        // 8. TLD abusado
        if (!isIp && tld in abusedTlds) {
            findings += Finding(Severity.LOW, "Terminação \".$tld\" com histórico de abuso",
                "Domínios com essa terminação aparecem com frequência acima da média em relatórios de phishing. Sozinho, isso não prova nada.")
        }

        // 9. Subdomínios em excesso
        val depth = DomainUtils.subdomainDepth(host)
        if (depth >= 3) {
            findings += Finding(Severity.MEDIUM, "Muitos subdomínios ($depth)",
                "Endereços como \"banco.login.seguro.site-x.com\" colocam nomes confiáveis no começo para esconder o domínio real (\"$registrable\").")
        }

        // 10. Hífens
        if (regLabel.count { it == '-' } >= 2) {
            findings += Finding(Severity.LOW, "Domínio com vários hífens", "Nomes como \"seguranca-conta-atualizar.com\" são típicos de páginas falsas.")
        }

        // 11. Porta não padrão
        if (port != null && port != 80 && port != 443) {
            findings += Finding(Severity.MEDIUM, "Porta incomum ($port)", "Sites comuns usam as portas padrão. Portas diferentes indicam servidores improvisados.")
        }

        // 12. Palavras-isca
        val pathNorm = stripAccents(pathAndQuery.lowercase(Locale.ROOT))
        val hostWords = stripAccents(host)
        val lures = lureWords.filter { pathNorm.contains(it) || hostWords.contains(it) }.distinct()
        if (lures.isNotEmpty()) {
            val sev = if (lures.size >= 3 || brandHit != null) Severity.MEDIUM else Severity.LOW
            findings += Finding(sev, "Palavras usadas como isca",
                "O link contém termos como ${lures.take(4).joinToString { "\"$it\"" }}, comuns em golpes que pedem login, pagamento ou \"regularização\".")
        }

        // 13. Download de executável
        val pathOnly = pathAndQuery.substringBefore('?').substringBefore('#').lowercase(Locale.ROOT)
        dangerousDownloadExt.firstOrNull { pathOnly.endsWith(it) }?.let { ext ->
            findings += Finding(Severity.HIGH, "Baixa um arquivo executável ($ext)",
                "O link aponta direto para um instalável. Aplicativos devem ser instalados pela loja oficial; arquivos assim são o principal meio de instalar malware.")
        }

        // 14. Redirecionamento embutido
        if (Regex("(?i)[?&](url|redirect|redir|next|goto|target|dest|continue|return)=(https?%3a|https?:|//)").containsMatchIn(pathAndQuery)) {
            findings += Finding(Severity.MEDIUM, "Redirecionamento escondido",
                "O link contém outro endereço dentro dele. Golpes usam sites legítimos com redirecionamento aberto para levar a páginas falsas.")
        }

        // 15. Comprimento
        if (extracted.length > 120) {
            findings += Finding(Severity.LOW, "Endereço muito longo", "Links enormes dificultam enxergar o domínio real.")
        }

        return build(raw, extracted, host, registrable, findings, isShortener, brandHit)
    }

    private fun build(input: String, url: String, host: String?, reg: String?, findings: List<Finding>, short: Boolean, brand: String?): PhishingReport {
        val score = findings.sumOf { it.severity.weight }.coerceIn(0, 100)
        val level = when {
            score >= 70 -> RiskLevel.DANGEROUS
            score >= 35 -> RiskLevel.SUSPICIOUS
            score >= 15 -> RiskLevel.ATTENTION
            else -> RiskLevel.NONE_FOUND
        }
        val all = if (findings.isEmpty()) listOf(Finding(Severity.INFO, "Nenhum sinal conhecido de golpe",
            "A análise local não encontrou sinais típicos de phishing. Isso não garante que o site seja seguro: confira o endereço e desconfie de pedidos de senha ou pagamento.")) else findings
        return PhishingReport(input, url, host, reg, score, level, all.sortedByDescending { it.severity.weight }, short, brand)
    }

    /** Mantido para chamadas que já tenham um URI pronto. */
    fun hostOf(url: String): String? = runCatching { URI(url).host }.getOrNull()
}
