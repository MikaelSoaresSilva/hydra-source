package com.ascend.faceai.analysis

import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Projeção de 90 dias feita no próprio aparelho, sobre a foto frontal e os 478 pontos do rosto.
 *
 * Só simula o que o plano realmente consegue mudar, na intensidade que a medição indica:
 *  - pele: filtro guiado que preserva bordas (suaviza poros/textura sem apagar barba e sobrancelha),
 *    redução do excesso de vermelho e clareamento de manchas escuras em relação ao tom da própria pele;
 *  - olheiras: clareia a região abaixo dos olhos em direção ao tom da bochecha;
 *  - perda de gordura (opcional): deforma suavemente o contorno da mandíbula para dentro (1–3% da largura do rosto).
 * Formato dos olhos, nariz, ossos, cabelo e identidade não são alterados.
 * É uma ILUSTRAÇÃO de cenário provável, não uma promessa de resultado.
 */
object Projection {

    data class Options(
        /** 0..1 — quanto melhorar a pele (derivado da nota de pele). */
        val skin: Double,
        /** 0..1 — quanto reduzir vermelhidão/manchas. */
        val tone: Double,
        /** 0..1 — quanto clarear olheiras. */
        val underEye: Double,
        /** Fração da largura do rosto que o contorno mandibular entra (0 = desligado). */
        val jawSlim: Double
    )

    data class Result(val argb: IntArray, val w: Int, val h: Int, val changes: List<String>)

    /** Intensidades a partir do relatório: quanto pior a medição, mais espaço para melhorar (com teto realista). */
    fun optionsFor(r: FaceReport, includeFatLoss: Boolean): Options {
        fun ms(cat: String, key: String) = r.category(cat)?.metrics?.firstOrNull { it.key == key }?.score
        val skinScore = r.category("pele")?.score ?: 70
        val tex = ms("pele", "texture") ?: 80.0
        val spots = listOfNotNull(ms("pele", "spots"), ms("pele", "redness"), ms("pele", "dark_spots"), ms("pele", "tone")).minOrNull() ?: 80.0
        val ue = ms("pele", "under_eye_skin") ?: ms("olhos", "under_eye") ?: 80.0
        val jaw = minOf(r.category("mandibula")?.score ?: 80, r.category("macas")?.score ?: 80)
        fun gap(s: Double, lo: Double = 0.15, hi: Double = 0.75) = ((90.0 - s) / 60.0).coerceIn(lo, hi)
        return Options(
            skin = gap(min(skinScore.toDouble(), tex)),
            tone = gap(spots),
            underEye = gap(ue, 0.1, 0.6),
            jawSlim = if (includeFatLoss) (0.012 + 0.018 * ((80.0 - jaw) / 50.0).coerceIn(0.0, 1.0)) else 0.0
        )
    }

    fun project(src: IntArray, w: Int, h: Int, lmNorm: List<Float>, o: Options): Result {
        require(lmNorm.size >= 468 * 2) { "landmarks insuficientes" }
        val lm = List(lmNorm.size / 2) { P(lmNorm[2 * it] * w.toDouble(), lmNorm[2 * it + 1] * h.toDouble()) }
        val faceW = dist(lm[LM.CHEEK_A], lm[LM.CHEEK_B]).coerceAtLeast(20.0)
        val eyeW = (dist(lm[LM.EYE_A_OUT], lm[LM.EYE_A_IN]) + dist(lm[LM.EYE_B_OUT], lm[LM.EYE_B_IN])) / 2
        val changes = ArrayList<String>()
        var px = src.copyOf()

        // ---------- Máscara de pele (suave) ----------
        val n = w * h
        val oval = poly(w, h, LM.FACE_OVAL.map { lm[it] })
        val excl = BooleanArray(n)
        listOf(LM.EYE_A_POLY, LM.EYE_B_POLY, LM.BROW_A_POLY, LM.BROW_B_POLY, LM.LIPS_POLY, LM.NOSTRIL_POLY).forEach { fill(excl, w, h, it.map { i -> lm[i] }) }
        val exclD = dilate(excl, w, h, max(2, (eyeW * 0.12).roundToInt()))
        val r0 = IntArray(n); val g0 = IntArray(n); val b0 = IntArray(n)
        for (i in 0 until n) { val c = px[i]; r0[i] = (c shr 16) and 255; g0[i] = (c shr 8) and 255; b0[i] = c and 255 }
        val lum = DoubleArray(n) { 0.299 * r0[it] + 0.587 * g0[it] + 0.114 * b0[it] }
        val skinVals = ArrayList<Double>()
        for (i in 0 until n) if (oval[i] && !exclD[i]) skinVals += lum[i]
        if (skinVals.size < 500) return Result(px, w, h, listOf("Pouca pele visível: projeção não aplicada."))
        skinVals.sort()
        val medL = skinVals[skinVals.size / 2]
        val hard = FloatArray(n)
        for (i in 0 until n) if (oval[i] && !exclD[i] && lum[i] > medL - 38) hard[i] = 1f // pelos escuros (barba) ficam de fora
        val alpha = boxBlurF(hard, w, h, max(2, (faceW * 0.018).roundToInt()))
        for (i in 0 until n) if (!oval[i]) alpha[i] = alpha[i] * 0.4f

        // ---------- Pele: suavização que preserva bordas ----------
        if (o.skin > 0.01) {
            val rad = max(2, (faceW * 0.016).roundToInt())
            val eps = (255.0 * 0.035).pow(2)
            val rs = guided(r0, w, h, rad, eps); val gs = guided(g0, w, h, rad, eps); val bs = guided(b0, w, h, rad, eps)
            val k = o.skin * 0.85
            for (i in 0 until n) {
                val a = alpha[i] * k
                if (a <= 0.001) continue
                r0[i] = (r0[i] + a * (rs[i] - r0[i])).roundToInt().coerceIn(0, 255)
                g0[i] = (g0[i] + a * (gs[i] - g0[i])).roundToInt().coerceIn(0, 255)
                b0[i] = (b0[i] + a * (bs[i] - b0[i])).roundToInt().coerceIn(0, 255)
            }
            changes += "Textura e poros suavizados em ${(k * 100).roundToInt()}% (como após 90 dias de rotina de pele), mantendo barba e sobrancelhas."
        }

        // ---------- Tom: vermelhidão e manchas escuras ----------
        if (o.tone > 0.01) {
            val L = DoubleArray(n); val A = DoubleArray(n); val B = DoubleArray(n)
            for (i in 0 until n) { val lab = toLab(r0[i], g0[i], b0[i]); L[i] = lab[0]; A[i] = lab[1]; B[i] = lab[2] }
            val aVals = ArrayList<Double>(); for (i in 0 until n) if (hard[i] > 0f) aVals += A[i]
            aVals.sort(); val medA = aVals[aVals.size / 2]
            val big = max(4, (faceW * 0.06).roundToInt())
            val Lb = boxBlurD(L, w, h, big)
            var touched = 0
            for (i in 0 until n) {
                val a = alpha[i] * o.tone
                if (a <= 0.001) continue
                val exA = A[i] - (medA + 1.5)
                if (exA > 0) { A[i] -= exA * a * 0.6; touched++ }
                val dL = Lb[i] - L[i]
                if (dL > 2.5) L[i] += (dL - 2.5) * a * 0.85
            }
            for (i in 0 until n) if (alpha[i] * o.tone > 0.001) {
                val c = fromLab(L[i], A[i], B[i]); r0[i] = c[0]; g0[i] = c[1]; b0[i] = c[2]
            }
            changes += "Vermelhidão e manchas reduzidas em ~${(o.tone * 85).roundToInt()}% em relação ao tom médio da sua pele${if (touched == 0) " (pouca diferença: sua pele já é uniforme)" else ""}."
        }

        // ---------- Olheiras ----------
        if (o.underEye > 0.01) {
            val ue = FloatArray(n)
            for ((outer, inner, bot) in listOf(Triple(LM.EYE_A_OUT, LM.EYE_A_IN, LM.EYE_A_BOT), Triple(LM.EYE_B_OUT, LM.EYE_B_IN, LM.EYE_B_BOT))) {
                val x0 = min(lm[outer].x, lm[inner].x) + eyeW * 0.05; val x1 = max(lm[outer].x, lm[inner].x) - eyeW * 0.05
                val y0 = lm[bot].y + eyeW * 0.12; val y1 = lm[bot].y + eyeW * 0.6
                for (y in y0.toInt()..y1.toInt()) for (x in x0.toInt()..x1.toInt()) if (x in 0 until w && y in 0 until h && !excl[y * w + x]) ue[y * w + x] = 1f
            }
            val ueA = boxBlurF(ue, w, h, max(2, (eyeW * 0.18).roundToInt()))
            val cheekL = listOf(lm[LM.CHEEK_CENTER_A], lm[LM.CHEEK_CENTER_B]).map { c -> patch(r0, g0, b0, w, h, c, eyeW * 0.2) }.average()
            for (i in 0 until n) {
                val a = ueA[i] * o.underEye
                if (a <= 0.001) continue
                val l = 0.299 * r0[i] + 0.587 * g0[i] + 0.114 * b0[i]
                val d = cheekL - l
                if (d <= 0) continue
                val gain = (l + d * a) / max(1.0, l)
                r0[i] = (r0[i] * gain).roundToInt().coerceIn(0, 255); g0[i] = (g0[i] * gain).roundToInt().coerceIn(0, 255); b0[i] = (b0[i] * gain).roundToInt().coerceIn(0, 255)
            }
            changes += "Olheiras clareadas ${(o.underEye * 100).roundToInt()}% em direção ao tom da bochecha (sono, hidratação e cuidados)."
        }
        for (i in 0 until n) px[i] = (px[i] and -0x1000000) or (r0[i] shl 16) or (g0[i] shl 8) or b0[i]

        // ---------- Contorno (perda de gordura) ----------
        if (o.jawSlim > 0.0) {
            val center = P(LM.FACE_OVAL.map { lm[it].x }.average(), lm[LM.NOSE_TIP].y)
            val ctrl = ArrayList<Pair<P, P>>() // (alvo, deslocamento original-alvo)
            for (idx in LM.JAW_CONTOUR) {
                val p = lm[idx]
                val v = P(center.x - p.x, (center.y - p.y) * 0.35)
                val nv = hypot(v.x, v.y); if (nv < 1) continue
                val sideFactor = (kotlin.math.abs(p.x - center.x) / (faceW / 2)).coerceIn(0.25, 1.0)
                val amt = faceW * o.jawSlim * sideFactor
                val t = P(p.x + v.x / nv * amt, p.y + v.y / nv * amt)
                ctrl += t to (p - t)
            }
            val sigma = faceW * 0.075
            val s2 = 2 * sigma * sigma
            val minX = max(0, (ctrl.minOf { it.first.x } - sigma * 3).toInt()); val maxX = min(w - 1, (ctrl.maxOf { it.first.x } + sigma * 3).toInt())
            val minY = max(0, (ctrl.minOf { it.first.y } - sigma * 3).toInt()); val maxY = min(h - 1, (ctrl.maxOf { it.first.y } + sigma * 3).toInt())
            val out = px.copyOf()
            for (y in minY..maxY) for (x in minX..maxX) {
                var sw = 0.0; var dx = 0.0; var dy = 0.0
                for ((t, d) in ctrl) {
                    val g = exp(-((x - t.x).pow(2) + (y - t.y).pow(2)) / s2)
                    sw += g; dx += g * d.x; dy += g * d.y
                }
                if (sw < 1e-4) continue
                val f = min(1.0, sw) / sw
                out[y * w + x] = sample(px, w, h, x + dx * f, y + dy * f)
            }
            px = out
            changes += "Contorno da mandíbula ${(o.jawSlim * 100).let { String.format(java.util.Locale.US, "%.1f", it) }}% da largura do rosto mais para dentro, simulando menos gordura e inchaço."
        }
        changes += "Não foram alterados: olhos, nariz, boca, ossos, cabelo, barba e expressão."
        return Result(px, w, h, changes)
    }

    // ---------------- utilitários ----------------
    private fun patch(r: IntArray, g: IntArray, b: IntArray, w: Int, h: Int, c: P, rad: Double): Double {
        var s = 0.0; var k = 0; val rr = max(1, rad.toInt())
        for (dy in -rr..rr) for (dx in -rr..rr) {
            val x = c.x.toInt() + dx; val y = c.y.toInt() + dy
            if (x !in 0 until w || y !in 0 until h) continue
            val i = y * w + x; s += 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i]; k++
        }
        return if (k == 0) 0.0 else s / k
    }

    private fun sample(px: IntArray, w: Int, h: Int, fx: Double, fy: Double): Int {
        val x = fx.coerceIn(0.0, w - 1.001); val y = fy.coerceIn(0.0, h - 1.001)
        val x0 = x.toInt(); val y0 = y.toInt(); val ax = x - x0; val ay = y - y0
        val c00 = px[y0 * w + x0]; val c10 = px[y0 * w + x0 + 1]; val c01 = px[(y0 + 1) * w + x0]; val c11 = px[(y0 + 1) * w + x0 + 1]
        fun ch(sh: Int): Int {
            val v = ((c00 shr sh) and 255) * (1 - ax) * (1 - ay) + ((c10 shr sh) and 255) * ax * (1 - ay) +
                ((c01 shr sh) and 255) * (1 - ax) * ay + ((c11 shr sh) and 255) * ax * ay
            return v.roundToInt().coerceIn(0, 255)
        }
        return (0xFF shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
    }

    fun poly(w: Int, h: Int, pts: List<P>): BooleanArray = BooleanArray(w * h).also { fill(it, w, h, pts) }

    fun fill(m: BooleanArray, w: Int, h: Int, pts: List<P>) {
        val minY = max(0, pts.minOf { it.y }.toInt()); val maxY = min(h - 1, pts.maxOf { it.y }.toInt() + 1)
        val xs = ArrayList<Double>()
        for (y in minY..maxY) {
            xs.clear(); val yc = y + 0.5
            for (i in pts.indices) {
                val a = pts[i]; val b = pts[(i + 1) % pts.size]
                if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) xs += a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x)
            }
            xs.sort()
            var k = 0
            while (k + 1 < xs.size) {
                val x0 = max(0, (xs[k] + 0.5).toInt()); val x1 = min(w - 1, (xs[k + 1] - 0.5).toInt())
                for (x in x0..x1) m[y * w + x] = true
                k += 2
            }
        }
    }

    private fun dilate(m: BooleanArray, w: Int, h: Int, r: Int): BooleanArray {
        val f = FloatArray(m.size) { if (m[it]) 1f else 0f }
        val b = boxBlurF(f, w, h, r)
        return BooleanArray(m.size) { b[it] > 0.001f }
    }

    /** Média em caixa separável (O(n) independente do raio). */
    fun boxBlurD(src: DoubleArray, w: Int, h: Int, r: Int): DoubleArray {
        val tmp = DoubleArray(src.size); val out = DoubleArray(src.size)
        for (y in 0 until h) {
            var s = 0.0; var c = 0
            for (x in -r..r) if (x in 0 until w) { s += src[y * w + x]; c++ }
            for (x in 0 until w) {
                tmp[y * w + x] = s / c
                val xo = x - r; val xi = x + r + 1
                if (xo >= 0) { s -= src[y * w + xo]; c-- }
                if (xi < w) { s += src[y * w + xi]; c++ }
            }
        }
        for (x in 0 until w) {
            var s = 0.0; var c = 0
            for (y in -r..r) if (y in 0 until h) { s += tmp[y * w + x]; c++ }
            for (y in 0 until h) {
                out[y * w + x] = s / c
                val yo = y - r; val yi = y + r + 1
                if (yo >= 0) { s -= tmp[yo * w + x]; c-- }
                if (yi < h) { s += tmp[yi * w + x]; c++ }
            }
        }
        return out
    }

    private fun boxBlurF(src: FloatArray, w: Int, h: Int, r: Int): FloatArray {
        val d = boxBlurD(DoubleArray(src.size) { src[it].toDouble() }, w, h, r)
        return FloatArray(d.size) { d[it].toFloat() }
    }

    /** Filtro guiado (He et al.) com a própria imagem como guia: suaviza mantendo bordas fortes. */
    fun guided(ch: IntArray, w: Int, h: Int, r: Int, eps: Double): DoubleArray {
        val I = DoubleArray(ch.size) { ch[it].toDouble() }
        val II = DoubleArray(ch.size) { I[it] * I[it] }
        val mI = boxBlurD(I, w, h, r); val mII = boxBlurD(II, w, h, r)
        val a = DoubleArray(ch.size); val b = DoubleArray(ch.size)
        for (i in I.indices) { val v = mII[i] - mI[i] * mI[i]; a[i] = v / (v + eps); b[i] = mI[i] - a[i] * mI[i] }
        val ma = boxBlurD(a, w, h, r); val mb = boxBlurD(b, w, h, r)
        return DoubleArray(ch.size) { ma[it] * I[it] + mb[it] }
    }

    // sRGB <-> CIELAB (D65), com tabelas para ser rápido no celular
    private val LIN = DoubleArray(256) { val v = it / 255.0; if (v <= 0.04045) v / 12.92 else ((v + 0.055) / 1.055).pow(2.4) }
    private const val GN = 4096
    private val GAM = IntArray(GN + 1) { val v = it.toDouble() / GN; val c = if (v <= 0.0031308) 12.92 * v else 1.055 * v.pow(1 / 2.4) - 0.055; (c * 255).roundToInt().coerceIn(0, 255) }
    private fun lin(c: Int): Double = LIN[c]
    private fun gam(v: Double): Int = GAM[(v * GN).roundToInt().coerceIn(0, GN)]
    private fun fl(t: Double) = if (t > 0.008856) Math.cbrt(t) else 7.787 * t + 16.0 / 116
    private fun fi(t: Double) = if (t > 0.206893) t * t * t else (t - 16.0 / 116) / 7.787

    fun toLab(r: Int, g: Int, b: Int): DoubleArray {
        val R = lin(r); val G = lin(g); val B = lin(b)
        val x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
        val y = 0.2126 * R + 0.7152 * G + 0.0722 * B
        val z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
        val fx = fl(x); val fy = fl(y); val fz = fl(z)
        return doubleArrayOf(116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
    }

    fun fromLab(L: Double, a: Double, b: Double): IntArray {
        val fy = (L + 16) / 116; val fx = fy + a / 500; val fz = fy - b / 200
        val x = fi(fx) * 0.95047; val y = fi(fy); val z = fi(fz) * 1.08883
        val R = 3.2406 * x - 1.5372 * y - 0.4986 * z
        val G = -0.9689 * x + 1.8758 * y + 0.0415 * z
        val B = 0.0557 * x - 0.2040 * y + 1.0570 * z
        return intArrayOf(gam(R.coerceIn(0.0, 1.0)), gam(G.coerceIn(0.0, 1.0)), gam(B.coerceIn(0.0, 1.0)))
    }
}
