package com.nexusguard.app.network

import android.net.Network
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext

/** Latência real: ICMP (utilitário ping do Android) com alternativa por tempo de conexão TCP. */
object LatencyTester {

    suspend fun measure(host: String = "1.1.1.1", count: Int = 20, onSample: (Double?) -> Unit = {}): LatencyResult = withContext(Dispatchers.IO) {
        val i = icmp(host, count, onSample)
        if (i != null && i.received > 0) return@withContext i
        // ICMP bloqueado (comum em emuladores, redes corporativas e algumas operadoras): mede por conexão TCP
        val t = tcp(host, if (host == "8.8.8.8") 53 else 443, count, onSample)
        if (t.received > 0 || i == null) t else i
    }

    /** Retorna null se o ping não estiver disponível no aparelho (aí usamos TCP). */
    suspend fun icmp(host: String, count: Int, onSample: (Double?) -> Unit = {}): LatencyResult? = withContext(Dispatchers.IO) {
        val proc = runCatching {
            ProcessBuilder("ping", "-n", "-c", count.toString(), "-i", "0.2", "-W", "2", host).redirectErrorStream(true).start()
        }.getOrNull() ?: return@withContext null
        val out = StringBuilder()
        try {
            proc.inputStream.bufferedReader().use { r ->
                while (true) {
                    coroutineContext.ensureActive()
                    val line = r.readLine() ?: break
                    out.appendLine(line)
                    Regex("""time[=<]\s*([0-9.]+)""").find(line)?.groupValues?.get(1)?.toDoubleOrNull()?.let(onSample)
                }
            }
            proc.waitFor(count * 3L + 5, TimeUnit.SECONDS)
        } finally { proc.destroy() }
        val p = PingParser.parse(out.toString())
        if (p.transmitted == null && p.rttsMs.isEmpty()) return@withContext null
        val sent = p.transmitted ?: count
        val rec = p.received ?: p.rttsMs.size
        build(host, "ICMP", p.rttsMs, sent, rec, p.lossPercent ?: if (sent > 0) (sent - rec) * 100.0 / sent else null)
    }

    suspend fun tcp(host: String, port: Int, count: Int, onSample: (Double?) -> Unit = {}): LatencyResult = withContext(Dispatchers.IO) {
        val rtts = mutableListOf<Double>()
        var ok = 0
        repeat(count) {
            coroutineContext.ensureActive()
            val t0 = System.nanoTime()
            val success = runCatching { Socket().use { s -> s.connect(InetSocketAddress(host, port), 2000) } }.isSuccess
            val ms = (System.nanoTime() - t0) / 1e6
            if (success) { ok++; rtts += ms; onSample(ms) } else onSample(null)
            delay(150)
        }
        build("$host:$port", "TCP", rtts, count, ok, (count - ok) * 100.0 / count)
    }

    fun build(target: String, method: String, rtts: List<Double>, sent: Int, rec: Int, loss: Double?) = LatencyResult(
        target, method, rtts, sent, rec, Stats.mean(rtts), Stats.median(rtts), rtts.minOrNull(), rtts.maxOrNull(), Stats.jitter(rtts), loss
    )
}

data class Resolver(val name: String, val address: String, val dotHost: String?, val note: String)

/** Compara o tempo de resposta de resolvedores DNS com consultas UDP reais (porta 53). */
class DnsBenchmarker {
    companion object {
        val resolvers = listOf(
            Resolver("Cloudflare", "1.1.1.1", "one.one.one.one", "Foco em velocidade e privacidade."),
            Resolver("Cloudflare Segurança", "1.1.1.2", "security.cloudflare-dns.com", "Bloqueia domínios de malware conhecidos."),
            Resolver("Google", "8.8.8.8", "dns.google", "Grande infraestrutura global."),
            Resolver("Quad9", "9.9.9.9", "dns.quad9.net", "Bloqueia domínios maliciosos (organização sem fins lucrativos)."),
            Resolver("AdGuard", "94.140.14.14", "dns.adguard-dns.com", "Bloqueia anúncios e rastreadores (pode quebrar alguns sites)."),
            Resolver("OpenDNS", "208.67.222.222", null, "Sem DNS privado (DoT) para Android; apenas comparação.")
        )
        val popular = listOf("google.com", "youtube.com", "whatsapp.net", "instagram.com", "globo.com", "netflix.com", "wikipedia.org", "mercadolivre.com.br")
    }

    private val rnd = SecureRandom()

    suspend fun run(network: Network?, systemDns: List<String>, onProgress: (String) -> Unit = {}): DnsBenchmark = coroutineScope {
        val list = mutableListOf<Pair<Resolver, Boolean>>()
        systemDns.firstOrNull { !it.contains(':') }?.let { list += Resolver("DNS atual do sistema", it, null, "Fornecido pela rede/operadora.") to true }
        resolvers.forEach { list += it to false }
        val results = list.map { (r, sys) ->
            async(Dispatchers.IO) {
                onProgress(r.name)
                benchmark(r, sys, network)
            }
        }.awaitAll()
        DnsBenchmark(results)
    }

    private suspend fun benchmark(r: Resolver, isSystem: Boolean, network: Network?): DnsResolverResult {
        val cached = mutableListOf<Double>()
        val uncached = mutableListOf<Double>()
        var ok = 0
        var total = 0
        val addr = runCatching { InetAddress.getByName(r.address) }.getOrNull()
            ?: return DnsResolverResult(r.name, r.address, r.dotHost, isSystem, null, null, 0.0, 0)
        DatagramSocket().use { sock ->
            runCatching { network?.bindSocket(sock) }
            sock.soTimeout = 1500
            query(sock, addr, "google.com") // aquecimento (não conta)
            for (round in 0 until 2) for (d in popular) {
                coroutineContext.ensureActive()
                total++
                query(sock, addr, d)?.let { ok++; if (round == 1) cached += it }
            }
            repeat(4) {
                total++
                val label = "nx" + java.lang.Long.toHexString(rnd.nextLong()).take(10)
                query(sock, addr, "$label.wikipedia.org")?.let { ok++; uncached += it }
            }
        }
        return DnsResolverResult(r.name, r.address, r.dotHost, isSystem, Stats.median(cached), Stats.median(uncached), ok.toDouble() / total, total)
    }

    /** Tempo de ida e volta da consulta em ms, ou null se não houve resposta válida. */
    private fun query(sock: DatagramSocket, addr: InetAddress, name: String): Double? {
        val id = rnd.nextInt(0xFFFF)
        val q = DnsPacket.buildQuery(id, name)
        val buf = ByteArray(1500)
        return try {
            val t0 = System.nanoTime()
            sock.send(DatagramPacket(q, q.size, addr, 53))
            var result: Double? = null
            var done = false
            while (!done) {
                val p = DatagramPacket(buf, buf.size)
                sock.receive(p)
                val resp = DnsPacket.parse(buf, p.length) ?: continue
                if (resp.id != id || !resp.isResponse) continue
                val ms = (System.nanoTime() - t0) / 1e6
                // NOERROR (0) ou NXDOMAIN (3) contam como resposta válida
                result = if (resp.rcode == 0 || resp.rcode == 3) ms else null
                done = true
            }
            result
        } catch (_: SocketTimeoutException) { null } catch (_: Exception) { null }
    }
}

/** Verificações HTTP simples. */
class NetChecks(base: OkHttpClient) {
    private val client = base.newBuilder().followRedirects(false).followSslRedirects(false).callTimeout(6, TimeUnit.SECONDS).build()

    /** Usa o endpoint oficial de verificação de conectividade do Android: 204 = internet livre; outra resposta = portal cativo. */
    suspend fun captiveProbe(): String = withContext(Dispatchers.IO) {
        runCatching {
            client.newCall(Request.Builder().url("http://connectivitycheck.gstatic.com/generate_204").build()).execute().use { r ->
                if (r.code == 204) "ok" else "portal"
            }
        }.getOrElse { "falha" }
    }
}
