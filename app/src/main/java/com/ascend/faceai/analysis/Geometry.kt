package com.ascend.faceai.analysis

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.pow
import kotlin.math.sqrt

data class P(val x: Double, val y: Double, val z: Double = 0.0) {
    operator fun minus(o: P) = P(x - o.x, y - o.y, z - o.z)
    operator fun plus(o: P) = P(x + o.x, y + o.y, z + o.z)
    operator fun times(k: Double) = P(x * k, y * k, z * k)
}

fun dist(a: P, b: P) = hypot(a.x - b.x, a.y - b.y)
fun mid(a: P, b: P) = P((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)

/** Ângulo (graus) em [vertex] formado por a-vertex-b. */
fun angleDeg(a: P, vertex: P, b: P): Double {
    val v1 = a - vertex
    val v2 = b - vertex
    val n = hypot(v1.x, v1.y) * hypot(v2.x, v2.y)
    if (n == 0.0) return 0.0
    val c = (v1.x * v2.x + v1.y * v2.y) / n
    return Math.toDegrees(acos(c.coerceIn(-1.0, 1.0)))
}

/** Distância perpendicular com sinal de p até a reta a->b. */
fun signedDist(p: P, a: P, b: P): Double {
    val dx = b.x - a.x
    val dy = b.y - a.y
    val n = hypot(dx, dy)
    if (n == 0.0) return 0.0
    return ((p.x - a.x) * dy - (p.y - a.y) * dx) / n
}

/**
 * Função de proximidade usada em TODA a pontuação: 100 quando o valor medido coincide com a referência,
 * caindo de forma gaussiana. Em x = ref ± tol a nota é ~61; em ± 2·tol é ~14.
 */
fun closeness(x: Double, ref: Double, tol: Double): Double = 100.0 * exp(-0.5 * ((x - ref) / tol).pow(2))
fun lowerIsBetter(x: Double, good: Double, tol: Double) = if (x <= good) 100.0 else closeness(x, good, tol)
fun higherIsBetter(x: Double, good: Double, tol: Double) = if (x >= good) 100.0 else closeness(x, good, tol)

/** Índices da malha de 478 pontos do MediaPipe Face Landmarker usados pelo app. */
object LM {
    const val FOREHEAD_TOP = 10
    const val GLABELLA = 9
    const val NASION = 168
    const val NOSE_TIP = 1
    const val SUBNASALE = 2
    const val UPPER_LIP = 0
    const val STOMION_UP = 13
    const val STOMION_LOW = 14
    const val LOWER_LIP = 17
    const val CHIN = 152

    // "A" = lado esquerdo da FOTO (lado direito anatômico numa foto não espelhada); "B" = lado direito da foto.
    const val EYE_A_OUT = 33
    const val EYE_A_IN = 133
    const val EYE_A_TOP = 159
    const val EYE_A_BOT = 145
    const val EYE_B_OUT = 263
    const val EYE_B_IN = 362
    const val EYE_B_TOP = 386
    const val EYE_B_BOT = 374
    const val IRIS_A = 468
    const val IRIS_B = 473

    const val CHEEK_A = 234
    const val CHEEK_B = 454
    const val GONION_A = 172
    const val GONION_B = 397
    const val TEMPLE_A = 21
    const val TEMPLE_B = 251
    const val ALAR_A = 64
    const val ALAR_B = 294
    const val MOUTH_A = 61
    const val MOUTH_B = 291
    const val CHIN_A = 176
    const val CHIN_B = 400
    const val CHEEK_CENTER_A = 50
    const val CHEEK_CENTER_B = 280
    const val ZYGO_A = 116
    const val ZYGO_B = 345

    const val BROW_A_IN = 107
    const val BROW_A_MID = 105
    const val BROW_A_TAIL = 70
    const val BROW_B_IN = 336
    const val BROW_B_MID = 334
    const val BROW_B_TAIL = 300

    val MIDLINE = intArrayOf(10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152)

    val PAIRS = arrayOf(
        33 to 263, 133 to 362, 159 to 386, 145 to 374, 160 to 387, 144 to 373,
        70 to 300, 105 to 334, 107 to 336, 46 to 276, 52 to 282,
        129 to 358, 98 to 327, 48 to 278, 61 to 291, 37 to 267, 84 to 314, 40 to 270,
        234 to 454, 93 to 323, 132 to 361, 58 to 288, 172 to 397, 136 to 365, 150 to 379,
        149 to 378, 176 to 400, 148 to 377, 116 to 345, 123 to 352, 50 to 280,
        54 to 284, 103 to 332, 67 to 297, 109 to 338, 21 to 251, 162 to 389, 127 to 356
    )
    val EYE_PAIRS = arrayOf(33 to 263, 133 to 362, 159 to 386, 145 to 374, 160 to 387, 144 to 373)
    val BROW_PAIRS = arrayOf(70 to 300, 105 to 334, 107 to 336, 46 to 276, 52 to 282)
    val MOUTH_NOSE_PAIRS = arrayOf(129 to 358, 98 to 327, 48 to 278, 61 to 291, 37 to 267, 84 to 314, 40 to 270)
    val JAW_PAIRS = arrayOf(132 to 361, 58 to 288, 172 to 397, 136 to 365, 150 to 379, 149 to 378, 176 to 400, 148 to 377)

    val FACE_OVAL = intArrayOf(10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
        152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109)
    val EYE_A_POLY = intArrayOf(33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246)
    val EYE_B_POLY = intArrayOf(263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466)
    val LIPS_POLY = intArrayOf(61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185)
    val BROW_A_POLY = intArrayOf(70, 63, 105, 66, 107, 55, 65, 52, 53, 46)
    val BROW_B_POLY = intArrayOf(300, 293, 334, 296, 336, 285, 295, 282, 283, 276)
    val NOSTRIL_POLY = intArrayOf(129, 98, 97, 2, 326, 327, 358, 4)
    /** Contorno inferior da mandíbula (de um lado ao outro passando pelo queixo). */
    val JAW_CONTOUR = intArrayOf(132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361)
    val FOREHEAD_POLY = intArrayOf(54, 103, 67, 109, 10, 338, 297, 332, 284, 334, 296, 336, 9, 107, 66, 105)
}

/** Linha média ajustada por mínimos quadrados: x = a*y + b. */
class Midline(points: List<P>) {
    val a: Double
    val b: Double

    init {
        val n = points.size.toDouble()
        val my = points.sumOf { it.y } / n
        val mx = points.sumOf { it.x } / n
        var num = 0.0
        var den = 0.0
        for (p in points) {
            num += (p.y - my) * (p.x - mx); den += (p.y - my) * (p.y - my)
        }
        a = if (den == 0.0) 0.0 else num / den
        b = mx - a * my
    }

    /** Reflete o ponto em relação à linha média. */
    fun reflect(p: P): P {
        // Reta: x - a*y - b = 0  -> normal (1, -a)
        val d = (p.x - a * p.y - b) / (1 + a * a)
        return P(p.x - 2 * d, p.y + 2 * d * a, p.z)
    }

    fun offset(p: P): Double = (p.x - a * p.y - b) / sqrt(1 + a * a)
}

data class Pose(val yawDeg: Double, val pitchDeg: Double, val rollDeg: Double, val yawRatio: Double)

object PoseEstimator {
    /**
     * Combina a matriz de transformação 3D do MediaPipe (quando disponível) com uma estimativa geométrica
     * 2D. O sinal do yaw vem da geometria (nariz mais perto de qual lado do rosto).
     */
    fun estimate(lm: List<P>, matrix: FloatArray?): Pose {
        val nose = lm[LM.NOSE_TIP]
        val a = lm[LM.CHEEK_A]
        val b = lm[LM.CHEEK_B]
        val da = abs(nose.x - a.x)
        val db = abs(b.x - nose.x)
        val ratio = if (da + db == 0.0) 0.0 else (da - db) / (da + db)
        val eyeA = mid(lm[LM.EYE_A_OUT], lm[LM.EYE_A_IN])
        val eyeB = mid(lm[LM.EYE_B_OUT], lm[LM.EYE_B_IN])
        val rollGeo = Math.toDegrees(atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x))
        val yawGeo = Math.toDegrees(asin(ratio.coerceIn(-1.0, 1.0)))
        if (matrix != null && matrix.size >= 16) {
            // Matriz 4x4 (coluna-major). Extrai rotação em ordem Z-Y-X.
            val r00 = matrix[0].toDouble(); val r10 = matrix[1].toDouble(); val r20 = matrix[2].toDouble()
            val r21 = matrix[6].toDouble(); val r22 = matrix[10].toDouble()
            val yaw = Math.toDegrees(asin((-r20).coerceIn(-1.0, 1.0)))
            var pitch = Math.toDegrees(atan2(r21, r22))
            if (pitch > 90) pitch -= 180.0 else if (pitch < -90) pitch += 180.0
            val roll = Math.toDegrees(atan2(r10, r00))
            val yawMag = maxOf(abs(yaw), abs(yawGeo))
            val sign = if (ratio >= 0) 1.0 else -1.0
            return Pose(sign * yawMag, pitch, rollGeo, ratio)
        }
        return Pose(yawGeo, 0.0, rollGeo, ratio)
    }
}
