package com.nexusguard.app

import com.nexusguard.app.ai.AiContext
import com.nexusguard.app.ai.AiIntent
import com.nexusguard.app.ai.NexusAiEngine
import com.nexusguard.app.network.ConnType
import com.nexusguard.app.network.ConnectionState
import com.nexusguard.app.network.DiagnosticsEngine
import com.nexusguard.app.network.DnsBenchmark
import com.nexusguard.app.network.DnsPacket
import com.nexusguard.app.network.DnsResolverResult
import com.nexusguard.app.network.IssueLevel
import com.nexusguard.app.network.LatencyResult
import com.nexusguard.app.network.NetworkSnapshot
import com.nexusguard.app.network.PingParser
import com.nexusguard.app.network.Stats
import com.nexusguard.app.network.WifiDetails
import com.nexusguard.app.security.AppFacts
import com.nexusguard.app.security.AppRiskRules
import com.nexusguard.app.security.CheckStatus
import com.nexusguard.app.security.DetectedType
import com.nexusguard.app.security.FileTypeDetector
import com.nexusguard.app.security.SecurityCheck
import com.nexusguard.app.security.SecurityScore
import com.nexusguard.app.security.Severity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LogicTest {

    // ---------------- Estatística / ping / DNS
    @Test fun stats() {
        val v = listOf(10.0, 20.0, 30.0, 40.0)
        assertEquals(25.0, Stats.mean(v)!!, 1e-9)
        assertEquals(25.0, Stats.median(v)!!, 1e-9)
        assertEquals(10.0, Stats.jitter(v)!!, 1e-9)
        assertNull(Stats.jitter(listOf(5.0)))
        assertNull(Stats.mean(emptyList()))
        assertEquals(37.0, Stats.percentile(v, 90.0)!!, 1e-9)
    }

    @Test fun pingParser() {
        val out = """
            PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.
            64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.4 ms
            64 bytes from 1.1.1.1: icmp_seq=2 ttl=57 time=15 ms
            64 bytes from 1.1.1.1: icmp_seq=4 ttl=57 time=11.9 ms

            --- 1.1.1.1 ping statistics ---
            4 packets transmitted, 3 received, 25% packet loss, time 3004ms
        """.trimIndent()
        val p = PingParser.parse(out)
        assertEquals(listOf(12.4, 15.0, 11.9), p.rttsMs)
        assertEquals(4, p.transmitted); assertEquals(3, p.received)
        assertEquals(25.0, p.lossPercent!!, 1e-9)
    }

    @Test fun dnsPacketRoundTrip() {
        val q = DnsPacket.buildQuery(0x1234, "example.com")
        assertEquals(0x12, q[0].toInt() and 0xFF); assertEquals(0x34, q[1].toInt() and 0xFF)
        // Resposta sintética: cabeçalho + pergunta + 1 resposta A 93.184.216.34 (nome comprimido)
        val resp = q.copyOf().toMutableList()
        resp[2] = 0x81.toByte(); resp[3] = 0x80.toByte(); resp[7] = 1
        resp += listOf(0xC0, 0x0C, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 93, 184, 216, 34).map { it.toByte() }
        val r = DnsPacket.parse(resp.toByteArray())!!
        assertEquals(0x1234, r.id); assertTrue(r.isResponse); assertEquals(0, r.rcode)
        assertEquals(listOf("93.184.216.34"), r.ipv4)
    }

    // ---------------- Arquivos
    @Test fun fileTypes() {
        assertEquals(DetectedType.PE, FileTypeDetector.detect("MZ\u0090\u0000".toByteArray(Charsets.ISO_8859_1)))
        assertEquals(DetectedType.PDF, FileTypeDetector.detect("%PDF-1.7".toByteArray()))
        assertEquals(DetectedType.ZIP, FileTypeDetector.detect(byteArrayOf(0x50, 0x4B, 3, 4, 0)))
        val disguised = FileTypeDetector.evaluate("foto.jpg", "MZ\u0090\u0000".toByteArray(Charsets.ISO_8859_1))
        assertTrue(disguised.findings.any { it.severity == Severity.CRITICAL })
        val dbl = FileTypeDetector.evaluate("boleto.pdf.apk", byteArrayOf(0x50, 0x4B, 3, 4), isApk = true)
        assertEquals(DetectedType.APK, dbl.type)
        assertTrue(dbl.findings.any { it.title.contains("dupla") })
        val ok = FileTypeDetector.evaluate("relatorio.pdf", "%PDF-1.4 ...".toByteArray())
        assertEquals(0, ok.score)
        val rlo = FileTypeDetector.evaluate("foto‮gpj.apk", byteArrayOf(0x50, 0x4B, 3, 4), isApk = true)
        assertTrue(rlo.findings.any { it.title.contains("inversão") })
    }

    // ---------------- Segurança do aparelho
    @Test fun securityScore() {
        val checks = listOf(
            SecurityCheck("a", "A", CheckStatus.PASS, 10, ""),
            SecurityCheck("b", "B", CheckStatus.FAIL, 10, ""),
            SecurityCheck("c", "C", CheckStatus.UNKNOWN, 50, ""),
            SecurityCheck("d", "D", CheckStatus.WARN, 20, "")
        )
        // (10*2 + 0 + 20) / (40*2) = 50%
        assertEquals(50, SecurityScore.compute(checks))
        assertNull(SecurityScore.compute(listOf(SecurityCheck("x", "X", CheckStatus.UNKNOWN, 5, ""))))
        assertEquals(0L, SecurityScore.patchAgeDays("2026-11-01", java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply { clear(); set(2026, 10, 1) }.timeInMillis))
        assertNull(SecurityScore.patchAgeDays(""))
    }

    private fun facts(
        requested: Set<String> = emptySet(), granted: Set<String> = emptySet(), installer: String? = "com.android.vending",
        acc: Boolean = false, accOn: Boolean = false, admin: Boolean = false, ioc: String? = null, target: Int = 34, visible: Boolean = true
    ) = AppFacts("x.y", "X", false, target, installer, requested, granted, acc, accOn, admin, false, false, emptyList(), ioc, launcherVisible = visible)

    @Test fun appRisk() {
        val clean = AppRiskRules.evaluate(facts())
        assertEquals("Baixo", clean.level)
        val p = "android.permission."
        val banker = AppRiskRules.evaluate(facts(
            requested = setOf("${p}READ_SMS", "${p}SYSTEM_ALERT_WINDOW", "${p}REQUEST_INSTALL_PACKAGES"),
            granted = setOf("${p}READ_SMS"), installer = null, acc = true, accOn = true, admin = true, visible = false))
        assertTrue(banker.level == "Crítico" || banker.level == "Alto")
        assertTrue(banker.reasons.size >= 4)
        val stalker = AppRiskRules.evaluate(facts(ioc = "TheTruthSpy"))
        assertEquals("Crítico", stalker.level)
        assertEquals("Moderado", AppRiskRules.evaluate(facts(target = 21, installer = null)).level)
    }

    // ---------------- Diagnóstico de rede
    private fun wifiConn(rssi: Int = -50, freq: Int = 5200, validated: Boolean = true) = ConnectionState(
        type = ConnType.WIFI, connected = true, validated = validated,
        wifi = WifiDetails(rssiDbm = rssi, frequencyMhz = freq, linkSpeedMbps = 433, securityLevel = 2))

    private fun lat(med: Double, jit: Double, loss: Double) = LatencyResult("1.1.1.1", "ICMP", listOf(med), 20, 20, med, med, med, med, jit, loss)

    @Test fun diagnosisGood() {
        val d = DiagnosticsEngine.diagnose(NetworkSnapshot(wifiConn(), lat(15.0, 2.0, 0.0)))
        assertTrue(d.issues.none { it.level >= IssueLevel.WARN })
        assertTrue(d.score!! >= 85)
        assertTrue(d.issues.any { it.id == "all_good" })
    }

    @Test fun diagnosisBad() {
        val d = DiagnosticsEngine.diagnose(NetworkSnapshot(wifiConn(rssi = -84, freq = 2437), lat(180.0, 45.0, 8.0)))
        val ids = d.issues.map { it.id }.toSet()
        assertTrue(ids.containsAll(listOf("wifi_signal_bad", "latency_high", "jitter_high", "loss_high")))
        assertTrue(d.score!! < 50)
        assertEquals(0, DiagnosticsEngine.diagnose(NetworkSnapshot(ConnectionState())).score)
    }

    @Test fun dnsRecommendation() {
        val dns = DnsBenchmark(listOf(
            DnsResolverResult("Sistema", "192.168.0.1", null, true, 90.0, 200.0, 1.0, 20),
            DnsResolverResult("Cloudflare", "1.1.1.1", "one.one.one.one", false, 12.0, 40.0, 1.0, 20),
            DnsResolverResult("Google", "8.8.8.8", "dns.google", false, 20.0, 50.0, 1.0, 20),
            DnsResolverResult("Ruim", "9.9.9.10", "x", false, 5.0, 5.0, 0.5, 20)
        ))
        assertEquals("Cloudflare", dns.best!!.name)
        val d = DiagnosticsEngine.diagnose(NetworkSnapshot(wifiConn(), lat(15.0, 2.0, 0.0), dns))
        val issue = d.issues.first { it.id == "dns_slow" }
        assertTrue(issue.recommendation.contains("one.one.one.one"))
        assertTrue(issue.consequence!!.contains("NÃO aumenta"))
    }

    // ---------------- NEXUS AI
    @Test fun aiIntents() {
        assertEquals(AiIntent.SLOW, NexusAiEngine.classify("Por que minha internet está lenta?"))
        assertEquals(AiIntent.UNSTABLE, NexusAiEngine.classify("Minha conexão está instável?"))
        assertEquals(AiIntent.DNS, NexusAiEngine.classify("Meu DNS está demorando para responder?"))
        assertEquals(AiIntent.WIFI_RISK, NexusAiEngine.classify("Minha rede Wi-Fi apresenta riscos?"))
        assertEquals(AiIntent.PING, NexusAiEngine.classify("O que posso fazer para melhorar meu ping?"))
        assertEquals(AiIntent.DOWNLOAD, NexusAiEngine.classify("Por que meu download está abaixo do esperado?"))
        assertEquals(AiIntent.BEST_CONFIG, NexusAiEngine.classify("Qual configuração é mais adequada para minha conexão?"))
        assertEquals(AiIntent.SECURITY, NexusAiEngine.classify("Meu celular está seguro?"))
    }

    @Test fun aiNeverInventsMissingData() {
        val empty = NexusAiEngine.answer("Por que minha internet está lenta?", AiContext())
        assertTrue(empty.missing.isNotEmpty())
        assertFalse(empty.paragraphs.joinToString().contains("Mbps"))
        val ping = NexusAiEngine.answer("melhorar meu ping", AiContext(connection = wifiConn(), latency = lat(25.0, 3.0, 0.0)))
        assertTrue(ping.paragraphs.joinToString().contains("25"))
        assertTrue(ping.actions.any { it.contains("DNS NÃO reduz") })
        val dl = NexusAiEngine.answer("download abaixo do esperado", AiContext(connection = wifiConn()))
        assertTrue(dl.missing.contains("teste de velocidade"))
        assertNotNull(NexusAiEngine.contextSummary(AiContext(connection = wifiConn())))
    }
}
