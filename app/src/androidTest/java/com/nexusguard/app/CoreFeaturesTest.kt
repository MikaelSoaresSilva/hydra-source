package com.nexusguard.app

import android.net.Uri
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.nexusguard.app.core.KeystoreCrypto
import com.nexusguard.app.data.Kind
import com.nexusguard.app.network.ConnType
import com.nexusguard.app.network.DiagnosticsEngine
import com.nexusguard.app.network.LatencyTester
import com.nexusguard.app.network.NetworkSnapshot
import com.nexusguard.app.network.SpeedMode
import com.nexusguard.app.network.StabilityTracker
import com.nexusguard.app.security.CheckStatus
import com.nexusguard.app.security.WifiSecurityAssessor
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File

/**
 * Testes das funções principais com dados REAIS do emulador (Android 14) e da rede real do runner.
 * Os resultados são registrados no logcat com a tag NexusTest e em arquivos para o relatório.
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class CoreFeaturesTest {
    private val ctx get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val app get() = ctx.applicationContext as NexusApp
    private val c get() = app.container

    private fun log(name: String, msg: String) {
        Log.i("NexusTest", "$name: $msg")
        runCatching {
            val dir = File(ctx.getExternalFilesDir(null), "results").apply { mkdirs() }
            File(dir, "core.txt").appendText("[$name] $msg\n")
        }
    }

    /** Serviços em primeiro plano só podem ser iniciados com o app visível (regra do Android 12+). */
    private fun foreground(block: suspend () -> Unit) {
        androidx.test.core.app.ActivityScenario.launch(MainActivity::class.java).use { runBlocking { delay(1500); block() } }
    }

    private fun shell(cmd: String): String {
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(cmd)
        return android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd).bufferedReader().readText()
    }

    @Test fun a01_keystoreRoundTrip() {
        val enc = KeystoreCrypto.encryptString("segredo-123")
        assertNotEquals("segredo-123", enc)
        assertEquals("segredo-123", KeystoreCrypto.decryptString(enc))
        log("keystore", "ok (${enc.length} chars)")
    }

    @Test fun a02_encryptedDatabase() = runBlocking {
        c.history.add(Kind.SECURITY_SCAN, "teste", "teste de criptografia")
        val f = ctx.getDatabasePath("nexus_guard.db")
        assertTrue(f.exists())
        val header = f.inputStream().use { s -> ByteArray(16).also { s.read(it) } }
        val plainHeader = "SQLite format 3"
        assertNotEquals("banco NÃO está cifrado", plainHeader, String(header, 0, 15, Charsets.US_ASCII))
        log("database", "arquivo ${f.length()} bytes, cabeçalho cifrado: ${header.take(8).joinToString(" ") { "%02x".format(it) }}")
    }

    @Test fun a03_iocLoaded() {
        assertTrue(c.ioc.entryCount >= 100)
        assertTrue(c.ioc.websites.size > 100)
        log("ioc", "${c.ioc.entryCount} famílias, ${c.ioc.websites.size} domínios")
    }

    @Test fun b01_deviceScan() = runBlocking {
        val r = c.deviceScanner.scan(null)
        assertNotNull(r.score)
        assertEquals(CheckStatus.PASS, r.checks.first { it.id == "android_version" }.status)
        assertTrue(r.checks.size >= 12)
        log("deviceScan", "nota=${r.score} " + r.checks.joinToString("; ") { "${it.id}=${it.status}" })
    }

    @Test fun b02_appAnalysis() = runBlocking {
        val all = c.appAnalyzer.analyzeAll(includeSystem = true)
        assertTrue("nenhum app listado", all.size > 10)
        val withCert = all.count { it.certs.isNotEmpty() }
        assertTrue(withCert > 10)
        log("apps", "${all.size} apps, $withCert com certificado lido; top risco: " + all.take(5).joinToString { "${it.label}=${it.risk.level}/${it.risk.score}" })
    }

    @Test fun b03_fileScanOwnApk() = runBlocking {
        val apk = File(ctx.applicationInfo.sourceDir)
        val r = c.fileScanner.scan(Uri.fromFile(apk))
        assertNotNull(r.apk)
        assertEquals(ctx.packageName, r.apk!!.packageName)
        assertEquals(true, r.apk!!.installedSameSigner)
        assertEquals(64, r.sha256.length)
        log("apkScan", "${r.detectedType}, sha256=${r.sha256.take(16)}…, certs=${r.apk!!.certs.size}, debug=${r.apk!!.certs.any { it.isDebug }}, achados=${r.findings.map { it.title }}")
    }

    @Test fun b04_fileScanDisguised() = runBlocking {
        val f = File(ctx.cacheDir, "foto.jpg").apply { writeBytes(byteArrayOf(0x4D, 0x5A, 0x90.toByte(), 0) + ByteArray(200)) }
        val r = c.fileScanner.scan(Uri.fromFile(f))
        assertTrue(r.score >= 70)
        log("fileScan", "${r.name} -> ${r.level} (${r.score}) ${r.findings.first().title}")
    }

    @Test fun b05_phishing() {
        val r = c.phishing.analyze("Seu Nubank foi bloqueado! Regularize: http://nubank-seguranca.xyz/login")
        assertEquals("Nubank", r.impersonatedBrand)
        log("phishing", "${r.level} score=${r.score}")
    }

    @Test fun c01_connectionState() {
        val s = c.monitor.refresh()
        assertTrue("sem conexão no emulador", s.connected)
        log("connection", "tipo=${s.type} validada=${s.validated} dns=${s.dnsServers} privateDns=${s.privateDnsActive} wifi=${s.wifi} cell=${s.cellular}")
    }

    @Test fun c02_latencyReal() = runBlocking {
        val r = LatencyTester.measure("1.1.1.1", 8)
        assertTrue("nenhuma resposta (${r.method})", r.received > 0)
        assertNotNull(r.medianMs)
        log("latency", "${r.method} ${r.received}/${r.sent} mediana=${r.medianMs} jitter=${r.jitterMs} perda=${r.lossPercent}")
    }

    @Test fun c03_dnsReal() = runBlocking {
        val conn = c.monitor.refresh()
        val r = c.dns.run(c.monitor.activeNetwork, conn.dnsServers)
        val ok = r.results.filter { it.successRate > 0.5 }
        assertTrue("nenhum resolvedor respondeu", ok.isNotEmpty())
        log("dns", r.results.joinToString("; ") { "${it.name}=${it.combinedMs?.toInt()}ms/${(it.successRate * 100).toInt()}%" } + " melhor=${r.best?.name}")
    }

    @Test fun c04_captiveProbe() = runBlocking {
        val r = c.netChecks.captiveProbe()
        log("captive", r)
        assertTrue(r == "ok" || r == "portal" || r == "falha")
    }

    @Test fun c05_speedTestReal() = runBlocking {
        val r = withTimeout(90_000) { c.speed.run(SpeedMode.LIGHT, "teste") { } }
        log("speed", "down=${r.downloadMbps} up=${r.uploadMbps} idle=${r.idleLatencyMs} loaded=${r.loadedLatencyMs} bytes=${r.bytesDown}/${r.bytesUp} erro=${r.error}")
        assertTrue("erro: ${r.error}", r.error == null)
        assertTrue((r.downloadMbps ?: 0.0) > 0.1)
        assertTrue(r.bytesDown <= SpeedMode.LIGHT.downCapMb * 1_000_000L + 2_000_000L)
    }

    @Test fun c06_optimizerAndDiagnosis() = runBlocking {
        val snap = c.optimizer.measure({ _, _ -> })
        val d = DiagnosticsEngine.diagnose(snap)
        assertNotNull(snap.latency)
        log("optimizer", "nota=${d.score} ${d.label} problemas=${d.issues.map { it.id }}")
    }

    @Test fun c07_wifiAssessment() {
        val s = c.monitor.refresh()
        val a = WifiSecurityAssessor.assess(s)
        log("wifi", "onWifi=${a.onWifi} label=${a.label} sec=${s.wifi?.securityType} band=${s.wifi?.bandLabel} rssi=${s.wifi?.rssiDbm}")
        if (s.type == ConnType.WIFI) assertTrue(a.onWifi)
    }

    @Test fun d01_stabilityService() = foreground {
        shell("pm grant ${ctx.packageName} android.permission.POST_NOTIFICATIONS")
        StabilityTracker.start(ctx, 2)
        withTimeout(30_000) { while (StabilityTracker.state.value.total < 4) delay(500) }
        val st = StabilityTracker.state.value
        assertTrue(st.running)
        StabilityTracker.stop(ctx)
        withTimeout(10_000) { while (StabilityTracker.state.value.running) delay(200) }
        log("stability", "total=${st.total} falhas=${st.failures} rtt=${st.summary().medianRttMs}")
    }

    /** Desliga Wi-Fi e dados, confirma a detecção da queda e o retorno. */
    @Test fun d02_connectivityLossAndReturn() = foreground {
        val before = c.monitor.refresh().type
        StabilityTracker.start(ctx, 2)
        withTimeout(20_000) { while (StabilityTracker.state.value.total < 2) delay(300) }
        shell("svc wifi disable"); shell("svc data disable")
        val offline = runCatching { withTimeout(25_000) { while (c.monitor.state.value.connected) delay(300) } }.isSuccess
        delay(7_000)
        val failuresDuringOutage = StabilityTracker.state.value.failures
        shell("svc wifi enable"); shell("svc data enable")
        val back = runCatching { withTimeout(60_000) { while (!c.monitor.state.value.validated) delay(500) } }.isSuccess
        withTimeout(30_000) { while (StabilityTracker.state.value.outageStart != null) delay(500) }
        val st = StabilityTracker.state.value
        StabilityTracker.stop(ctx)
        log("connectivity", "antes=$before offlineDetectado=$offline falhas=$failuresDuringOutage quedas=${st.outages} maiorQueda=${st.longestOutageMs}ms voltou=$back depois=${c.monitor.state.value.type}")
        assertTrue("queda não detectada pelo monitor", offline)
        assertTrue("internet não voltou", back)
        assertTrue("queda não registrada pelo Modo Estabilidade", st.outages >= 1)
    }

    /** Alterna entre Wi-Fi e dados móveis (se o emulador tiver os dois). */
    @Test fun d03_wifiToMobileSwitch() = runBlocking {
        shell("svc data enable"); shell("svc wifi enable")
        withTimeout(60_000) { while (!c.monitor.state.value.validated) delay(500) }
        val t1 = c.monitor.state.value.type
        shell("svc wifi disable")
        val switched = runCatching { withTimeout(40_000) { while (c.monitor.state.value.type != ConnType.CELLULAR || !c.monitor.state.value.connected) delay(500) } }.isSuccess
        val t2 = c.monitor.state.value
        shell("svc wifi enable")
        runCatching { withTimeout(60_000) { while (c.monitor.state.value.type != ConnType.WIFI) delay(500) } }
        val t3 = c.monitor.state.value.type
        log("switch", "inicio=$t1 semWifi=${t2.type}/${t2.cellular?.technology}/${t2.cellular?.operatorName} trocou=$switched fim=$t3")
        if (t1 == ConnType.WIFI) assertTrue("não trocou para dados móveis", switched)
    }
}
