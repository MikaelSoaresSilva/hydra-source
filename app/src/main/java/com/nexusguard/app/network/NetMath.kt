package com.nexusguard.app.network

import kotlin.math.abs
import kotlin.math.sqrt

/** Estatísticas usadas em todas as medições. Funções puras. */
object Stats {
    fun mean(v: List<Double>): Double? = if (v.isEmpty()) null else v.sum() / v.size

    fun median(v: List<Double>): Double? = percentile(v, 50.0)

    fun percentile(v: List<Double>, p: Double): Double? {
        if (v.isEmpty()) return null
        val s = v.sorted()
        if (s.size == 1) return s[0]
        val rank = (p / 100.0) * (s.size - 1)
        val lo = rank.toInt()
        val hi = minOf(lo + 1, s.size - 1)
        return s[lo] + (s[hi] - s[lo]) * (rank - lo)
    }

    fun stdDev(v: List<Double>): Double? {
        val m = mean(v) ?: return null
        if (v.size < 2) return 0.0
        return sqrt(v.sumOf { (it - m) * (it - m) } / (v.size - 1))
    }

    /** Jitter = média da diferença absoluta entre medições consecutivas (como em RFC 3550/ferramentas de VoIP). */
    fun jitter(v: List<Double>): Double? {
        if (v.size < 2) return null
        var sum = 0.0
        for (i in 1 until v.size) sum += abs(v[i] - v[i - 1])
        return sum / (v.size - 1)
    }
}

data class PingOutput(val rttsMs: List<Double>, val transmitted: Int?, val received: Int?, val lossPercent: Double?)

/** Interpreta a saída do utilitário /system/bin/ping do Android (toybox/iputils). */
object PingParser {
    private val timeRe = Regex("""time[=<]\s*([0-9]+(?:\.[0-9]+)?)\s*ms""")
    private val summaryRe = Regex("""(\d+)\s+packets transmitted,\s+(\d+)\s+(?:packets\s+)?received.*?([0-9]+(?:\.[0-9]+)?)%\s+packet loss""")

    fun parse(output: String): PingOutput {
        val rtts = timeRe.findAll(output).mapNotNull { it.groupValues[1].toDoubleOrNull() }.toList()
        val m = summaryRe.find(output)
        val tx = m?.groupValues?.get(1)?.toIntOrNull()
        val rx = m?.groupValues?.get(2)?.toIntOrNull()
        val loss = m?.groupValues?.get(3)?.toDoubleOrNull()
        return PingOutput(rtts, tx, rx, loss)
    }
}

/** Montagem e leitura mínima de pacotes DNS (RFC 1035) para medir tempo de resposta de resolvedores. */
object DnsPacket {
    fun buildQuery(id: Int, name: String, qtype: Int = 1): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        fun u16(v: Int) { out.write((v shr 8) and 0xFF); out.write(v and 0xFF) }
        u16(id and 0xFFFF)
        u16(0x0100) // consulta padrão, recursão desejada
        u16(1); u16(0); u16(0); u16(0)
        name.trimEnd('.').split('.').forEach { label ->
            val b = label.toByteArray(Charsets.US_ASCII)
            require(b.size in 1..63) { "rótulo DNS inválido" }
            out.write(b.size); out.write(b)
        }
        out.write(0)
        u16(qtype); u16(1)
        return out.toByteArray()
    }

    data class Response(val id: Int, val isResponse: Boolean, val rcode: Int, val answerCount: Int, val ipv4: List<String>)

    fun parse(data: ByteArray, length: Int = data.size): Response? {
        if (length < 12) return null
        fun u8(i: Int) = data[i].toInt() and 0xFF
        fun u16(i: Int) = (u8(i) shl 8) or u8(i + 1)
        val id = u16(0)
        val flags = u16(2)
        val qd = u16(4)
        val an = u16(6)
        var p = 12
        fun skipName() {
            while (p < length) {
                val l = u8(p)
                if (l == 0) { p++; return }
                if (l and 0xC0 == 0xC0) { p += 2; return }
                p += l + 1
            }
        }
        try {
            repeat(qd) { skipName(); p += 4 }
            val ips = mutableListOf<String>()
            repeat(an) {
                skipName()
                if (p + 10 > length) return@repeat
                val type = u16(p); val rdLen = u16(p + 8)
                p += 10
                if (type == 1 && rdLen == 4 && p + 4 <= length) ips += "${u8(p)}.${u8(p + 1)}.${u8(p + 2)}.${u8(p + 3)}"
                p += rdLen
            }
            return Response(id, flags and 0x8000 != 0, flags and 0x000F, an, ips)
        } catch (e: IndexOutOfBoundsException) {
            return Response(id, flags and 0x8000 != 0, flags and 0x000F, an, emptyList())
        }
    }
}
