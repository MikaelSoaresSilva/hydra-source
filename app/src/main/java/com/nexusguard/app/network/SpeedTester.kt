package com.nexusguard.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.ConnectionPool
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import kotlin.coroutines.coroutineContext

data class SpeedProgress(val phase: String, val liveMbps: Double?, val fraction: Float, val latencyMs: Double? = null)

enum class SpeedMode(val label: String, val downSec: Int, val downCapMb: Int, val upSec: Int, val upCapMb: Int) {
    LIGHT("Leve", 6, 25, 5, 10),
    FULL("Completo", 10, 100, 8, 40);

    /** Consumo máximo de dados (teto rígido). O consumo real costuma ser menor em conexões lentas. */
    val maxDataMb get() = downCapMb + upCapMb + 1
}

/**
 * Teste de velocidade com a infraestrutura pública da Cloudflare (speed.cloudflare.com),
 * a mesma usada pelo teste oficial deles e pela biblioteca de código aberto @cloudflare/speedtest.
 * Mede download, upload, latência ociosa e latência sob carga. Respeita limites rígidos de dados.
 */
class SpeedTester(base: OkHttpClient) {
    companion object {
        const val SERVER = "Cloudflare (speed.cloudflare.com)"
        private const val BASE = "https://speed.cloudflare.com"
        private const val WARMUP_MS = 1000L
    }

    private val client = base.newBuilder()
        .connectionPool(ConnectionPool(8, 30, TimeUnit.SECONDS))
        .readTimeout(10, TimeUnit.SECONDS).writeTimeout(10, TimeUnit.SECONDS).callTimeout(40, TimeUnit.SECONDS)
        .build()
    private val probeClient = base.newBuilder().connectionPool(ConnectionPool(1, 30, TimeUnit.SECONDS))
        .callTimeout(5, TimeUnit.SECONDS).build()

    suspend fun run(mode: SpeedMode, connType: String, onProgress: (SpeedProgress) -> Unit): SpeedResult = withContext(Dispatchers.IO) {
        val down = AtomicLong(); val up = AtomicLong()
        try {
            onProgress(SpeedProgress("Medindo latência", null, 0.02f))
            val idle = latencySamples(10)
            val idleMed = Stats.median(idle)
            onProgress(SpeedProgress("Download", null, 0.1f, idleMed))
            val loaded = mutableListOf<Double>()
            val dl = transfer(true, mode, down, loaded) { mbps, f -> onProgress(SpeedProgress("Download", mbps, 0.1f + 0.5f * f, idleMed)) }
            onProgress(SpeedProgress("Upload", null, 0.62f, idleMed))
            val ul = transfer(false, mode, up, loaded) { mbps, f -> onProgress(SpeedProgress("Upload", mbps, 0.62f + 0.36f * f, idleMed)) }
            onProgress(SpeedProgress("Concluído", null, 1f, idleMed))
            SpeedResult(dl, ul, idleMed, Stats.median(loaded), Stats.jitter(idle), down.get(), up.get(), SERVER, connType,
                if (dl == null && ul == null) "Não foi possível transferir dados com o servidor de teste." else null)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            SpeedResult(null, null, null, null, null, down.get(), up.get(), SERVER, connType, "Falha: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /** Latência HTTP: tempo até o servidor responder um pedido de 0 bytes, descontando o processamento informado pelo servidor. */
    private suspend fun latencySamples(n: Int): List<Double> {
        val out = mutableListOf<Double>()
        repeat(n + 1) { i ->
            coroutineContext.ensureActive()
            val t0 = System.nanoTime()
            val ok = runCatching {
                probeClient.newCall(Request.Builder().url("$BASE/__down?bytes=0").build()).execute().use { r ->
                    val ms = (System.nanoTime() - t0) / 1e6
                    val server = r.header("Server-Timing")?.let { Regex("dur=([0-9.]+)").find(it)?.groupValues?.get(1)?.toDoubleOrNull() } ?: 0.0
                    if (r.isSuccessful && i > 0) out += (ms - server).coerceAtLeast(0.1) // o 1º inclui abertura da conexão TLS
                    true
                }
            }.getOrDefault(false)
            if (!ok && i == 0) throw IllegalStateException("Servidor de teste inacessível nesta rede.")
        }
        return out
    }

    private suspend fun transfer(
        download: Boolean, mode: SpeedMode, counter: AtomicLong, loaded: MutableList<Double>,
        onTick: (Double?, Float) -> Unit
    ): Double? = coroutineScope {
        val durationMs = (if (download) mode.downSec else mode.upSec) * 1000L
        val capBytes = (if (download) mode.downCapMb else mode.upCapMb) * 1_000_000L
        val streams = if (download) 4 else 3
        val chunk = if (download) minOf(capBytes / streams, 25_000_000L) else minOf(capBytes / streams, 4_000_000L)
        val start = System.nanoTime()
        fun elapsedMs() = (System.nanoTime() - start) / 1_000_000
        fun stop() = elapsedMs() >= durationMs || counter.get() >= capBytes
        var warmBytes = -1L
        var warmAt = 0L

        val workers = (0 until streams).map {
            async(Dispatchers.IO) {
                while (isActive && !stop()) {
                    runCatching { if (download) downloadOnce(chunk, counter, capBytes, ::stop) else uploadOnce(chunk, counter, capBytes, ::stop) }
                        .onFailure { if (it is kotlinx.coroutines.CancellationException) throw it; delay(200) }
                }
            }
        }
        val prober = launch(Dispatchers.IO) {
            delay(800)
            while (isActive && !stop()) {
                val t0 = System.nanoTime()
                runCatching { probeClient.newCall(Request.Builder().url("$BASE/__down?bytes=0").build()).execute().close() }
                    .onSuccess { loaded += (System.nanoTime() - t0) / 1e6 }
                delay(500)
            }
        }
        var lastBytes = 0L; var lastT = 0L
        while (!stop()) {
            delay(250)
            val now = elapsedMs(); val b = counter.get()
            if (warmBytes < 0 && now >= WARMUP_MS) { warmBytes = b; warmAt = now }
            val live = if (now > lastT) (b - lastBytes) * 8.0 / ((now - lastT) / 1000.0) / 1e6 else null
            lastBytes = b; lastT = now
            onTick(live, (now.toFloat() / durationMs).coerceIn(0f, 1f))
            if (workers.all { it.isCompleted }) break
        }
        val endT = elapsedMs(); val endB = counter.get()
        prober.cancel()
        workers.forEach { it.cancel() }
        runCatching { workers.awaitAll() }
        val (bytes, ms) = if (warmBytes >= 0 && endT - warmAt >= 500) (endB - warmBytes) to (endT - warmAt) else endB to endT
        if (bytes <= 0 || ms <= 0) null else bytes * 8.0 / (ms / 1000.0) / 1e6
    }

    private fun downloadOnce(bytes: Long, counter: AtomicLong, cap: Long, stop: () -> Boolean) {
        client.newCall(Request.Builder().url("$BASE/__down?bytes=$bytes").build()).execute().use { r ->
            if (!r.isSuccessful) throw IllegalStateException("HTTP ${r.code}")
            val src = r.body!!.byteStream()
            val buf = ByteArray(64 * 1024)
            while (!stop()) {
                val n = src.read(buf)
                if (n < 0) break
                if (counter.addAndGet(n.toLong()) >= cap) break
            }
        }
    }

    private val random = ByteArray(64 * 1024).also { SecureRandom().nextBytes(it) }

    private fun uploadOnce(bytes: Long, counter: AtomicLong, cap: Long, stop: () -> Boolean) {
        val body = object : RequestBody() {
            override fun contentType() = "application/octet-stream".toMediaType()
            override fun contentLength() = bytes
            override fun writeTo(sink: BufferedSink) {
                var left = bytes
                while (left > 0) {
                    val n = minOf(left, random.size.toLong()).toInt()
                    sink.write(random, 0, n)
                    sink.flush()
                    left -= n
                    counter.addAndGet(n.toLong())
                    if (stop() || counter.get() >= cap) throw java.io.IOException("limite atingido")
                }
            }
        }
        client.newCall(Request.Builder().url("$BASE/__up").post(body).build()).execute().close()
    }
}
