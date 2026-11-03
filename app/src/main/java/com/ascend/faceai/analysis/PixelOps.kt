package com.ascend.faceai.analysis

import kotlin.math.cbrt
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

/** Operações de imagem em Kotlin puro (sem dependência do Android), testáveis na JVM. */
object PixelOps {

    fun luma(c: Int): Double {
        val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
        return 0.299 * r + 0.587 * g + 0.114 * b
    }

    private fun lin(v: Int): Double {
        val c = v / 255.0
        return if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }

    /** sRGB -> CIE L*a*b* (D65). Retorna [L, a, b]. */
    fun toLab(c: Int, out: DoubleArray) {
        val r = lin((c shr 16) and 0xFF); val g = lin((c shr 8) and 0xFF); val b = lin(c and 0xFF)
        val x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
        val y = 0.2126 * r + 0.7152 * g + 0.0722 * b
        val z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
        fun f(t: Double) = if (t > 0.008856) cbrt(t) else 7.787 * t + 16.0 / 116.0
        val fx = f(x); val fy = f(y); val fz = f(z)
        out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz)
    }

    fun labPlanes(argb: IntArray): Array<DoubleArray> {
        val n = argb.size
        val L = DoubleArray(n); val A = DoubleArray(n); val B = DoubleArray(n)
        val t = DoubleArray(3)
        for (i in 0 until n) { toLab(argb[i], t); L[i] = t[0]; A[i] = t[1]; B[i] = t[2] }
        return arrayOf(L, A, B)
    }

    /** Desfoque de caixa via imagem integral, O(n). */
    fun boxBlur(src: DoubleArray, w: Int, h: Int, r: Int): DoubleArray {
        val ii = DoubleArray((w + 1) * (h + 1))
        for (y in 0 until h) {
            var row = 0.0
            for (x in 0 until w) {
                row += src[y * w + x]
                ii[(y + 1) * (w + 1) + (x + 1)] = ii[y * (w + 1) + (x + 1)] + row
            }
        }
        val out = DoubleArray(w * h)
        for (y in 0 until h) {
            val y0 = max(0, y - r); val y1 = min(h - 1, y + r)
            for (x in 0 until w) {
                val x0 = max(0, x - r); val x1 = min(w - 1, x + r)
                val s = ii[(y1 + 1) * (w + 1) + (x1 + 1)] - ii[y0 * (w + 1) + (x1 + 1)] -
                    ii[(y1 + 1) * (w + 1) + x0] + ii[y0 * (w + 1) + x0]
                out[y * w + x] = s / ((y1 - y0 + 1) * (x1 - x0 + 1))
            }
        }
        return out
    }

    /** Preenche um polígono (scanline, regra par-ímpar) numa máscara. */
    fun fillPolygon(mask: BooleanArray, w: Int, h: Int, pts: List<P>, value: Boolean = true) {
        if (pts.size < 3) return
        val minY = max(0, pts.minOf { it.y }.toInt())
        val maxY = min(h - 1, pts.maxOf { it.y }.toInt())
        val xs = DoubleArray(pts.size)
        for (y in minY..maxY) {
            val yc = y + 0.5
            var k = 0
            for (i in pts.indices) {
                val a = pts[i]; val b = pts[(i + 1) % pts.size]
                if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
                    xs[k++] = a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x)
                }
            }
            java.util.Arrays.sort(xs, 0, k)
            var i = 0
            while (i + 1 < k) {
                val x0 = max(0, kotlin.math.ceil(xs[i] - 0.5).toInt())
                val x1 = min(w - 1, kotlin.math.floor(xs[i + 1] - 0.5).toInt())
                for (x in x0..x1) mask[y * w + x] = value
                i += 2
            }
        }
    }

    fun polygonMask(w: Int, h: Int, pts: List<P>): BooleanArray = BooleanArray(w * h).also { fillPolygon(it, w, h, pts) }

    /** Dilata uma máscara (quadrado de raio r). */
    fun dilate(mask: BooleanArray, w: Int, h: Int, r: Int): BooleanArray {
        val src = DoubleArray(mask.size) { if (mask[it]) 1.0 else 0.0 }
        val b = boxBlur(src, w, h, r)
        return BooleanArray(mask.size) { b[it] > 0.0 }
    }

    /** Reduz a imagem (média por área) para medir nitidez de forma independente da resolução. */
    fun downsampleLuma(argb: IntArray, w: Int, h: Int, targetW: Int): Triple<DoubleArray, Int, Int> {
        val scale = max(1, w / targetW)
        val nw = w / scale; val nh = h / scale
        val out = DoubleArray(nw * nh)
        for (y in 0 until nh) for (x in 0 until nw) {
            var s = 0.0
            for (dy in 0 until scale) for (dx in 0 until scale) s += luma(argb[(y * scale + dy) * w + (x * scale + dx)])
            out[y * nw + x] = s / (scale * scale)
        }
        return Triple(out, nw, nh)
    }

    /** Variância do Laplaciano dentro de uma máscara — medida clássica de foco/nitidez. */
    fun laplacianVariance(l: DoubleArray, w: Int, h: Int, mask: BooleanArray?): Double {
        var n = 0; var s = 0.0; var s2 = 0.0
        for (y in 1 until h - 1) for (x in 1 until w - 1) {
            val i = y * w + x
            if (mask != null && !mask[i]) continue
            val v = l[i - 1] + l[i + 1] + l[i - w] + l[i + w] - 4 * l[i]
            s += v; s2 += v * v; n++
        }
        if (n < 10) return 0.0
        val m = s / n
        return s2 / n - m * m
    }

    fun mean(v: DoubleArray, mask: BooleanArray): Double {
        var s = 0.0; var n = 0
        for (i in v.indices) if (mask[i]) { s += v[i]; n++ }
        return if (n == 0) Double.NaN else s / n
    }

    fun std(v: DoubleArray, mask: BooleanArray): Double {
        val m = mean(v, mask)
        var s = 0.0; var n = 0
        for (i in v.indices) if (mask[i]) { s += (v[i] - m) * (v[i] - m); n++ }
        return if (n < 2) Double.NaN else sqrt(s / n)
    }

    fun percentile(v: DoubleArray, mask: BooleanArray, p: Double): Double {
        val list = ArrayList<Double>()
        for (i in v.indices) if (mask[i]) list.add(v[i])
        if (list.isEmpty()) return Double.NaN
        list.sort()
        return list[((list.size - 1) * p).toInt().coerceIn(0, list.size - 1)]
    }

    fun count(mask: BooleanArray): Int { var n = 0; for (b in mask) if (b) n++; return n }

    /** Rotula componentes conectados (4-vizinhança) e devolve o tamanho de cada um. */
    fun componentSizes(mask: BooleanArray, w: Int, h: Int): List<Int> {
        val seen = BooleanArray(mask.size)
        val sizes = ArrayList<Int>()
        val stack = IntArray(mask.size)
        for (start in mask.indices) {
            if (!mask[start] || seen[start]) continue
            var sp = 0; stack[sp++] = start; seen[start] = true; var size = 0
            while (sp > 0) {
                val i = stack[--sp]; size++
                val x = i % w; val y = i / w
                if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = true; stack[sp++] = i - 1 }
                if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = true; stack[sp++] = i + 1 }
                if (y > 0 && mask[i - w] && !seen[i - w]) { seen[i - w] = true; stack[sp++] = i - w }
                if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = true; stack[sp++] = i + w }
            }
            sizes.add(size)
        }
        return sizes
    }
}
