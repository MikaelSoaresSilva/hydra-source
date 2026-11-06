package com.nexusguard.app.security

import java.util.Locale

/** Utilidades puras de domínio (sem dependências Android), usadas pela análise de phishing. */
object DomainUtils {

    /** Sufixos de dois níveis mais comuns (lista reduzida da Public Suffix List). */
    private val multiLevelSuffixes = setOf(
        "com.br", "net.br", "org.br", "gov.br", "edu.br", "art.br", "blog.br", "app.br", "eco.br",
        "emp.br", "ind.br", "inf.br", "jus.br", "leg.br", "mil.br", "mp.br", "nom.br", "rec.br", "srv.br", "tv.br", "log.br", "dev.br",
        "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "ltd.uk", "plc.uk",
        "com.au", "net.au", "org.au", "gov.au", "edu.au",
        "co.jp", "ne.jp", "or.jp", "co.in", "co.kr", "co.nz", "co.za", "co.id",
        "com.ar", "com.mx", "com.pt", "com.es", "com.co", "com.pe", "com.uy", "com.py", "com.bo", "com.ve", "com.ec", "com.cn", "com.tr",
        "github.io", "blogspot.com", "herokuapp.com", "netlify.app", "vercel.app", "web.app", "firebaseapp.com",
        "pages.dev", "workers.dev", "glitch.me", "000webhostapp.com", "weebly.com", "wixsite.com", "duckdns.org", "ngrok.io", "ngrok-free.app",
        "azurewebsites.net", "cloudfront.net", "appspot.com", "sites.google.com", "r2.dev", "repl.co", "onrender.com", "fly.dev"
    )

    /** Plataformas onde qualquer pessoa cria subdomínios gratuitamente (frequentemente usadas em golpes). */
    val freeHostingSuffixes = setOf(
        "github.io", "blogspot.com", "herokuapp.com", "netlify.app", "vercel.app", "web.app", "firebaseapp.com",
        "pages.dev", "workers.dev", "glitch.me", "000webhostapp.com", "weebly.com", "wixsite.com", "duckdns.org", "ngrok.io", "ngrok-free.app",
        "azurewebsites.net", "appspot.com", "r2.dev", "repl.co", "onrender.com", "fly.dev"
    )

    fun normalizeHost(host: String): String = host.trim().trimEnd('.').lowercase(Locale.ROOT)

    fun publicSuffix(host: String): String {
        val h = normalizeHost(host)
        val parts = h.split('.')
        if (parts.size >= 3) {
            val three = parts.takeLast(3).joinToString(".")
            if (three in multiLevelSuffixes) return three
        }
        if (parts.size >= 2) {
            val two = parts.takeLast(2).joinToString(".")
            if (two in multiLevelSuffixes) return two
        }
        return parts.last()
    }

    /** Domínio registrável: "login.secure.nubank.com.br" -> "nubank.com.br". */
    fun registrableDomain(host: String): String {
        val h = normalizeHost(host)
        if (isIpAddress(h)) return h
        val suffix = publicSuffix(h)
        val rest = h.removeSuffix(suffix).trimEnd('.')
        if (rest.isEmpty()) return h
        val label = rest.substringAfterLast('.')
        return "$label.$suffix"
    }

    /** Primeiro rótulo do domínio registrável: "nubank.com.br" -> "nubank". */
    fun registrableLabel(host: String): String = registrableDomain(host).substringBefore('.')

    fun subdomainDepth(host: String): Int {
        val h = normalizeHost(host)
        if (isIpAddress(h)) return 0
        val reg = registrableDomain(h)
        val sub = h.removeSuffix(reg).trimEnd('.')
        return if (sub.isEmpty()) 0 else sub.split('.').size
    }

    fun isIpv4(host: String): Boolean {
        val parts = host.split('.')
        if (parts.size != 4) return false
        return parts.all { p -> p.isNotEmpty() && p.length <= 3 && p.all { it.isDigit() } && p.toInt() in 0..255 }
    }

    fun isIpAddress(host: String): Boolean {
        val h = host.trim('[', ']')
        if (isIpv4(h)) return true
        // IPv6: contém ':' e só caracteres hexadecimais/pontos
        if (h.contains(':') && h.all { it.isLetterOrDigit() || it == ':' || it == '.' } &&
            h.filter { it.isLetter() }.all { it.lowercaseChar() in 'a'..'f' }) return true
        // Formas ofuscadas: inteiro decimal (http://3232235777) ou hexadecimal (0xC0A80001)
        if (h.isNotEmpty() && h.all { it.isDigit() } && h.length in 8..10) return true
        if (h.startsWith("0x") && h.length > 2 && h.drop(2).all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) return true
        return false
    }

    fun levenshtein(a: String, b: String): Int {
        if (a == b) return 0
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        var prev = IntArray(b.length + 1) { it }
        var cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = minOf(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            }
            val t = prev; prev = cur; cur = t
        }
        return prev[b.length]
    }

    /** Substitui caracteres usados para imitar letras (0→o, 1→l, rn→m, vv→w...). */
    fun deconfuse(label: String): String = label
        .replace("rn", "m").replace("vv", "w")
        .replace('0', 'o').replace('1', 'l').replace('3', 'e').replace('4', 'a')
        .replace('5', 's').replace('7', 't').replace('@', 'a').replace('$', 's')
}
