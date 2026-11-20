package com.aurea.fit.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.aurea.fit.domain.Anim
import com.aurea.fit.ui.theme.LocalExtras
import kotlin.math.*

/*
 * Animações demonstrativas desenhadas por código (vetor), leves e offline.
 * Convenção de ângulos: 0° = para baixo, 90° = para frente (direita), 180° = para cima.
 * Comprimentos em "unidades" (u) relativas à altura do quadro.
 */

private const val TORSO = 0.28f
private const val NECK = 0.045f
private const val HEAD = 0.055f
private const val UA = 0.15f
private const val FA = 0.14f
private const val THIGH = 0.21f
private const val SHIN = 0.21f
private const val FOOT = 0.06f

enum class J { HIP, ANKLE, TOE, SHOULDER, WRIST, KNEE }
enum class Jt { HIP, WRIST, WRIST2, ANKLE, ANKLE2, KNEE, KNEE2, SHOULDER }
enum class WeightKind { DUMBBELL, PLATE, BAR }

data class P(
    val torso: Float = 180f, val thigh: Float = 0f, val shin: Float = 0f, val foot: Float = 90f,
    val ua: Float = 0f, val fa: Float = 0f,
    val thigh2: Float? = null, val shin2: Float? = null, val foot2: Float? = null,
    val ua2: Float? = null, val fa2: Float? = null,
    val ankle: Offset? = null, val ankle2: Offset? = null,
    val wrist: Offset? = null, val wrist2: Offset? = null,
    val rot: Float = 0f
)

sealed class Prop {
    data class Box(val x: Float, val y: Float, val w: Float, val h: Float) : Prop()
    data class Line(val x1: Float, val y1: Float, val x2: Float, val y2: Float, val width: Float = 0.03f) : Prop()
    data class Cable(val x: Float, val y: Float, val to: Jt) : Prop()
    data class Weight(val at: Jt, val kind: WeightKind = WeightKind.DUMBBELL) : Prop()
    data class Pad(val at: Jt, val r: Float = 0.035f) : Prop()
    data class StaticPad(val x: Float, val y: Float, val r: Float = 0.04f) : Prop()
}

data class Motion(
    val anchor: J, val fx: Float, val dy: Float,
    val a: P, val b: P,
    val front: Boolean = false,
    val props: List<Prop> = emptyList(),
    val thighScale: Float = 1f,
    val kneeSign: Float = 1f,
    val elbowSign: Float = -1f,
    val hold: Boolean = false
)

private fun dir(deg: Float): Offset { val r = Math.toRadians(deg.toDouble()); return Offset(sin(r).toFloat(), cos(r).toFloat()) }
private fun angleOf(v: Offset): Float = Math.toDegrees(atan2(v.x.toDouble(), v.y.toDouble())).toFloat()
private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t
private fun lerpN(a: Float?, b: Float?, t: Float, fb: Float): Float = lerp(a ?: fb, b ?: fb, t)
private fun lerpO(a: Offset?, b: Offset?, t: Float): Offset? = if (a == null || b == null) a ?: b else Offset(lerp(a.x, b.x, t), lerp(a.y, b.y, t))

/** IK de 2 segmentos: retorna (ângulo1, ângulo2). sign escolhe para que lado o joelho/cotovelo dobra. */
private fun ik(from: Offset, to: Offset, l1: Float, l2: Float, sign: Float): Pair<Float, Float> {
    val v = to - from
    val d = v.getDistance().coerceIn(0.0001f, l1 + l2 - 0.0001f)
    val base = angleOf(v)
    val cosA = ((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)).coerceIn(-1f, 1f)
    val a = Math.toDegrees(acos(cosA.toDouble())).toFloat()
    val first = base + sign * a
    val elbow = from + dir(first) * l1
    val second = angleOf(to - elbow)
    return first to second
}

class Skeleton(val pts: Map<String, Offset>, val front: Boolean)

private fun interpolate(m: Motion, t: Float): P {
    val a = m.a; val b = m.b
    return P(
        torso = lerp(a.torso, b.torso, t), thigh = lerp(a.thigh, b.thigh, t), shin = lerp(a.shin, b.shin, t),
        foot = lerp(a.foot, b.foot, t), ua = lerp(a.ua, b.ua, t), fa = lerp(a.fa, b.fa, t),
        thigh2 = lerpN(a.thigh2, b.thigh2, t, lerp(a.thigh, b.thigh, t)),
        shin2 = lerpN(a.shin2, b.shin2, t, lerp(a.shin, b.shin, t)),
        foot2 = lerpN(a.foot2, b.foot2, t, lerp(a.foot, b.foot, t)),
        ua2 = lerpN(a.ua2, b.ua2, t, lerp(a.ua, b.ua, t)),
        fa2 = lerpN(a.fa2, b.fa2, t, lerp(a.fa, b.fa, t)),
        ankle = lerpO(a.ankle, b.ankle, t), ankle2 = lerpO(a.ankle2, b.ankle2, t),
        wrist = lerpO(a.wrist, b.wrist, t), wrist2 = lerpO(a.wrist2, b.wrist2, t),
        rot = lerp(a.rot, b.rot, t)
    )
}

/** Calcula as posições das articulações (em unidades, relativas ao ponto de ancoragem). */
fun solve(m: Motion, t: Float): Skeleton {
    val p = interpolate(m, t)
    val pts = mutableMapOf<String, Offset>()
    val hip = Offset.Zero
    val shoulder = hip + dir(p.torso) * TORSO
    if (!m.front) {
        pts["hip"] = hip; pts["shoulder"] = shoulder
        val knee = hip + dir(p.thigh) * THIGH; val ankle = knee + dir(p.shin) * SHIN
        pts["knee"] = knee; pts["ankle"] = ankle; pts["toe"] = ankle + dir(p.foot) * FOOT
        val elbow = shoulder + dir(p.ua) * UA; val wrist = elbow + dir(p.fa) * FA
        pts["elbow"] = elbow; pts["wrist"] = wrist
        val knee2 = hip + dir(p.thigh2!!) * THIGH; val ankle2 = knee2 + dir(p.shin2!!) * SHIN
        pts["knee2"] = knee2; pts["ankle2"] = ankle2; pts["toe2"] = ankle2 + dir(p.foot2!!) * FOOT
        val elbow2 = shoulder + dir(p.ua2!!) * UA; val wrist2 = elbow2 + dir(p.fa2!!) * FA
        pts["elbow2"] = elbow2; pts["wrist2"] = wrist2
    } else {
        val hw = 0.045f; val sw = 0.075f
        pts["hip"] = hip; pts["shoulder"] = shoulder
        val hipR = hip + Offset(hw, 0f); val hipL = hip + Offset(-hw, 0f)
        val shR = shoulder + Offset(sw, 0f); val shL = shoulder + Offset(-sw, 0f)
        pts["hipR"] = hipR; pts["hipL"] = hipL; pts["shR"] = shR; pts["shL"] = shL
        val kR = hipR + dir(p.thigh) * THIGH * m.thighScale; val aR = kR + dir(p.shin) * SHIN
        val kL = hipL + dir(-p.thigh2!!) * THIGH * m.thighScale; val aL = kL + dir(-p.shin2!!) * SHIN
        pts["knee"] = kR; pts["ankle"] = aR; pts["knee2"] = kL; pts["ankle2"] = aL
        pts["toe"] = aR + Offset(0.02f, 0.01f); pts["toe2"] = aL + Offset(-0.02f, 0.01f)
        val eR = shR + dir(p.ua) * UA; val wR = eR + dir(p.fa) * FA
        val eL = shL + dir(-p.ua2!!) * UA; val wL = eL + dir(-p.fa2!!) * FA
        pts["elbow"] = eR; pts["wrist"] = wR; pts["elbow2"] = eL; pts["wrist2"] = wL
    }
    pts["neck"] = shoulder + dir(p.torso) * NECK
    pts["head"] = shoulder + dir(p.torso) * (NECK + HEAD)

    // translada para a âncora
    val anchorKey = when (m.anchor) { J.HIP -> "hip"; J.ANKLE -> "ankle"; J.TOE -> "toe"; J.SHOULDER -> "shoulder"; J.WRIST -> "wrist"; J.KNEE -> "knee" }
    val shift = -(pts[anchorKey] ?: Offset.Zero)
    val moved = pts.mapValues { it.value + shift }.toMutableMap()

    // IK (alvos relativos à âncora)
    if (!m.front) {
        p.ankle?.let { target ->
            val (t1, t2) = ik(moved["hip"]!!, target, THIGH, SHIN, m.kneeSign)
            moved["knee"] = moved["hip"]!! + dir(t1) * THIGH; moved["ankle"] = target; moved["toe"] = target + dir(p.foot) * FOOT
        }
        p.ankle2?.let { target ->
            val (t1, _) = ik(moved["hip"]!!, target, THIGH, SHIN, m.kneeSign)
            val knee2 = moved["hip"]!! + dir(t1) * THIGH
            val reach = (target - moved["hip"]!!).getDistance()
            val end = if (reach > THIGH + SHIN) knee2 + dir(angleOf(target - knee2)) * SHIN else target
            moved["knee2"] = knee2; moved["ankle2"] = end; moved["toe2"] = end + dir(p.foot2 ?: p.foot) * FOOT
        }
        p.wrist?.let { target ->
            val (t1, _) = ik(moved["shoulder"]!!, target, UA, FA, m.elbowSign)
            moved["elbow"] = moved["shoulder"]!! + dir(t1) * UA; moved["wrist"] = target
        }
        p.wrist2?.let { target ->
            val (t1, _) = ik(moved["shoulder"]!!, target, UA, FA, m.elbowSign)
            moved["elbow2"] = moved["shoulder"]!! + dir(t1) * UA; moved["wrist2"] = target
        }
    }
    // rotação global (para posições deitadas de lado)
    if (p.rot != 0f) {
        val r = Math.toRadians(p.rot.toDouble()); val c = cos(r).toFloat(); val s = sin(r).toFloat()
        moved.keys.toList().forEach { k -> val v = moved[k]!!; moved[k] = Offset(v.x * c - v.y * s, v.x * s + v.y * c) }
    }
    return Skeleton(moved, m.front)
}

/* ------------------------------------------------------------------ Biblioteca de movimentos */

private val SEAT = listOf(Prop.Box(-0.10f, 0.03f, 0.24f, 0.33f), Prop.Line(-0.10f, 0.03f, -0.14f, -0.32f, 0.035f))
private val STAND = P(torso = 180f, thigh = 0f, shin = 0f, ua = 4f, fa = 8f, thigh2 = 0f, shin2 = 0f)

val MOTIONS: Map<Anim, Motion> = mapOf(
    Anim.SQUAT to Motion(J.ANKLE, 0.5f, -0.015f,
        P(torso = 180f, thigh = 0f, shin = 0f, ua = 85f, fa = 90f),
        P(torso = 145f, thigh = 85f, shin = -35f, ua = 85f, fa = 95f)),
    Anim.HIP_THRUST to Motion(J.SHOULDER, 0.3f, -0.25f,
        P(torso = 235f, ua = 55f, fa = 55f, ankle = Offset(0.485f, 0.235f), ankle2 = Offset(0.485f, 0.235f)),
        P(torso = 262f, ua = 82f, fa = 82f, ankle = Offset(0.485f, 0.235f), ankle2 = Offset(0.485f, 0.235f)),
        props = listOf(Prop.Box(-0.2f, 0.02f, 0.22f, 0.23f), Prop.Weight(Jt.HIP, WeightKind.PLATE))),
    Anim.BRIDGE to Motion(J.SHOULDER, 0.25f, -0.03f,
        P(torso = 270f, ua = 90f, fa = 90f, ankle = Offset(0.55f, 0.015f), ankle2 = Offset(0.55f, 0.015f)),
        P(torso = 300f, ua = 90f, fa = 90f, ankle = Offset(0.55f, 0.015f), ankle2 = Offset(0.55f, 0.015f))),
    Anim.HINGE to Motion(J.ANKLE, 0.45f, -0.015f,
        P(torso = 180f, thigh = 0f, shin = 0f, ua = 0f, fa = 0f),
        P(torso = 100f, thigh = 20f, shin = -10f, ua = 0f, fa = 0f),
        props = listOf(Prop.Weight(Jt.WRIST))),
    Anim.LEG_PRESS to Motion(J.HIP, 0.3f, -0.22f,
        P(torso = 232f, ua = 30f, fa = 70f, foot = 180f, ankle = Offset(0.12f, -0.17f), ankle2 = Offset(0.12f, -0.17f)),
        P(torso = 232f, ua = 30f, fa = 70f, foot = 180f, ankle = Offset(0.29f, -0.29f), ankle2 = Offset(0.29f, -0.29f)),
        props = listOf(Prop.Line(0.05f, 0.05f, -0.22f, -0.18f, 0.05f), Prop.Pad(Jt.ANKLE, 0.03f))),
    Anim.LEG_EXTENSION to Motion(J.HIP, 0.4f, -0.36f,
        P(torso = 185f, thigh = 90f, shin = 5f, ua = 10f, fa = 40f),
        P(torso = 185f, thigh = 90f, shin = 82f, ua = 10f, fa = 40f),
        props = SEAT + Prop.Pad(Jt.ANKLE)),
    Anim.LEG_CURL_LYING to Motion(J.HIP, 0.5f, -0.42f,
        P(torso = 270f, thigh = 90f, shin = 90f, ua = 235f, fa = 215f, foot = 0f),
        P(torso = 270f, thigh = 92f, shin = 205f, ua = 235f, fa = 215f, foot = 110f),
        props = listOf(Prop.Box(-0.34f, 0.035f, 0.56f, 0.39f), Prop.Pad(Jt.ANKLE))),
    Anim.LEG_CURL_SEATED to Motion(J.HIP, 0.38f, -0.36f,
        P(torso = 192f, thigh = 90f, shin = 80f, ua = 10f, fa = 40f),
        P(torso = 192f, thigh = 90f, shin = -15f, ua = 10f, fa = 40f),
        props = SEAT + Prop.Pad(Jt.ANKLE) + Prop.Pad(Jt.KNEE, 0.03f)),
    Anim.LUNGE to Motion(J.ANKLE, 0.62f, -0.015f,
        P(torso = 180f, thigh = 35f, shin = -5f, ua = 0f, fa = 0f, foot2 = 30f, ankle2 = Offset(-0.34f, -0.06f)),
        P(torso = 172f, thigh = 90f, shin = -10f, ua = 0f, fa = 0f, foot2 = 30f, ankle2 = Offset(-0.34f, -0.06f)),
        props = listOf(Prop.Weight(Jt.WRIST))),
    Anim.STEP_UP to Motion(J.ANKLE, 0.58f, -0.25f,
        P(torso = 160f, thigh = 80f, shin = -20f, ua = 0f, fa = 0f, ankle2 = Offset(-0.25f, 0.235f)),
        P(torso = 180f, thigh = 5f, shin = 0f, ua = 0f, fa = 0f, ankle2 = Offset(-0.06f, 0.10f)),
        props = listOf(Prop.Box(-0.1f, 0.015f, 0.26f, 0.235f))),
    Anim.ABDUCTION_SEATED to Motion(J.HIP, 0.5f, -0.36f,
        P(torso = 180f, thigh = 12f, shin = 0f, thigh2 = 12f, shin2 = 0f, ua = 18f, fa = 5f),
        P(torso = 180f, thigh = 48f, shin = -10f, thigh2 = 48f, shin2 = -10f, ua = 18f, fa = 5f),
        front = true, thighScale = 0.45f,
        props = listOf(Prop.Box(-0.13f, 0.02f, 0.26f, 0.34f), Prop.Pad(Jt.KNEE, 0.03f), Prop.Pad(Jt.KNEE2, 0.03f))),
    Anim.ABDUCTION_STANDING to Motion(J.HIP, 0.5f, -0.44f,
        P(torso = 180f, thigh = 2f, shin = 0f, thigh2 = 2f, shin2 = 0f, ua = 20f, fa = 10f, ua2 = 35f, fa2 = 60f),
        P(torso = 180f, thigh = 38f, shin = 38f, thigh2 = 2f, shin2 = 0f, ua = 20f, fa = 10f, ua2 = 35f, fa2 = 60f),
        front = true, props = listOf(Prop.Cable(-0.45f, 0.40f, Jt.ANKLE), Prop.Line(-0.45f, 0.44f, -0.45f, -0.45f, 0.04f))),
    Anim.ABDUCTION_LYING to Motion(J.HIP, 0.5f, -0.07f,
        P(torso = 180f, thigh = 0f, shin = 0f, thigh2 = 0f, shin2 = 0f, ua = 150f, fa = 200f, ua2 = 10f, fa2 = 10f, rot = -90f),
        P(torso = 180f, thigh = 40f, shin = 40f, thigh2 = 0f, shin2 = 0f, ua = 150f, fa = 200f, ua2 = 10f, fa2 = 10f, rot = -90f),
        front = true),
    Anim.KICKBACK_STANDING to Motion(J.ANKLE, 0.45f, -0.015f,
        P(torso = 150f, thigh = 8f, shin = -5f, ua = 115f, fa = 100f, thigh2 = 12f, shin2 = -15f),
        P(torso = 150f, thigh = 8f, shin = -5f, ua = 115f, fa = 100f, thigh2 = -45f, shin2 = -55f),
        props = listOf(Prop.Cable(0.32f, -0.02f, Jt.ANKLE2), Prop.Line(0.4f, 0.015f, 0.4f, -0.75f, 0.04f))),
    Anim.DONKEY_KICK to Motion(J.HIP, 0.5f, -0.24f,
        P(torso = 85f, thigh = 0f, shin = -90f, foot = 180f, thigh2 = 8f, shin2 = -82f, foot2 = 180f, wrist = Offset(0.28f, 0.225f), wrist2 = Offset(0.28f, 0.225f)),
        P(torso = 85f, thigh = 0f, shin = -90f, foot = 180f, thigh2 = -112f, shin2 = -180f, foot2 = -90f, wrist = Offset(0.28f, 0.225f), wrist2 = Offset(0.28f, 0.225f)),
        elbowSign = -1f),
    Anim.HYPEREXT to Motion(J.HIP, 0.45f, -0.42f,
        P(torso = 60f, thigh = -40f, shin = -40f, foot = 50f, ua = 70f, fa = 200f),
        P(torso = 135f, thigh = -40f, shin = -40f, foot = 50f, ua = 145f, fa = 275f),
        props = listOf(Prop.StaticPad(0.03f, 0.03f, 0.045f), Prop.Line(0.03f, 0.07f, -0.2f, 0.42f, 0.03f))),
    Anim.CALF_STANDING to Motion(J.TOE, 0.5f, -0.06f,
        P(torso = 180f, foot = 115f, ua = 3f, fa = 5f),
        P(torso = 180f, foot = 50f, ua = 3f, fa = 5f),
        props = listOf(Prop.Box(-0.05f, 0.0f, 0.2f, 0.06f), Prop.Weight(Jt.WRIST))),
    Anim.CALF_SEATED to Motion(J.HIP, 0.38f, -0.36f,
        P(torso = 180f, foot = 110f, ua = 20f, fa = 90f, ankle = Offset(0.21f, 0.27f), ankle2 = Offset(0.21f, 0.27f)),
        P(torso = 180f, foot = 55f, ua = 20f, fa = 90f, ankle = Offset(0.21f, 0.22f), ankle2 = Offset(0.21f, 0.22f)),
        props = SEAT + Prop.Pad(Jt.KNEE, 0.035f) + Prop.Box(0.2f, 0.3f, 0.12f, 0.06f)),
    Anim.PLANK to Motion(J.ANKLE, 0.15f, -0.03f,
        P(torso = 102.4f, thigh = -77.6f, shin = -77.6f, foot = 0f, ua = 0f, fa = 90f),
        P(torso = 103.5f, thigh = -78.6f, shin = -78.6f, foot = 0f, ua = 0f, fa = 90f), hold = true),
    Anim.SIDE_PLANK to Motion(J.ANKLE, 0.18f, -0.03f,
        P(torso = 180f, thigh = 2f, shin = 0f, thigh2 = 2f, shin2 = 0f, ua = 75f, fa = 165f, ua2 = 8f, fa2 = 8f, rot = 75f),
        P(torso = 180f, thigh = 2f, shin = 0f, thigh2 = 2f, shin2 = 0f, ua = 75f, fa = 165f, ua2 = 8f, fa2 = 8f, rot = 77f),
        front = true, hold = true),
    Anim.CRUNCH to Motion(J.HIP, 0.5f, -0.03f,
        P(torso = 270f, ua = 225f, fa = 110f, ankle = Offset(0.34f, 0.015f), ankle2 = Offset(0.34f, 0.015f)),
        P(torso = 248f, ua = 205f, fa = 90f, ankle = Offset(0.34f, 0.015f), ankle2 = Offset(0.34f, 0.015f))),
    Anim.CABLE_CRUNCH to Motion(J.KNEE, 0.45f, -0.02f,
        P(torso = 172f, thigh = 0f, shin = -90f, foot = -90f, ua = 150f, fa = 10f),
        P(torso = 112f, thigh = 18f, shin = -90f, foot = -90f, ua = 95f, fa = -40f),
        props = listOf(Prop.Cable(0.3f, -0.9f, Jt.WRIST), Prop.Line(0.35f, 0.02f, 0.35f, -0.95f, 0.04f))),
    Anim.LEG_RAISE to Motion(J.HIP, 0.42f, -0.03f,
        P(torso = 270f, thigh = 93f, shin = 93f, foot = 180f, ua = 90f, fa = 90f),
        P(torso = 270f, thigh = 175f, shin = 175f, foot = 270f, ua = 90f, fa = 90f)),
    Anim.DEAD_BUG to Motion(J.HIP, 0.5f, -0.03f,
        P(torso = 270f, thigh = 180f, shin = 90f, foot = 180f, thigh2 = 180f, shin2 = 90f, ua = 180f, fa = 180f, ua2 = 180f, fa2 = 180f),
        P(torso = 270f, thigh = 100f, shin = 100f, foot = 180f, thigh2 = 180f, shin2 = 90f, ua = 180f, fa = 180f, ua2 = 255f, fa2 = 260f)),
    Anim.SUPERMAN to Motion(J.HIP, 0.45f, -0.04f,
        P(torso = 90f, thigh = -90f, shin = -90f, foot = 0f, ua = 90f, fa = 90f),
        P(torso = 102f, thigh = -101f, shin = -102f, foot = 0f, ua = 108f, fa = 108f)),
    Anim.PULLDOWN to Motion(J.HIP, 0.42f, -0.36f,
        P(torso = 190f, thigh = 90f, shin = 0f, ua = 172f, fa = 176f),
        P(torso = 196f, thigh = 90f, shin = 0f, ua = -12f, fa = 158f),
        props = SEAT + Prop.StaticPad(0.17f, -0.05f, 0.035f) + Prop.Cable(0.03f, -0.95f, Jt.WRIST)),
    Anim.ROW_SEATED to Motion(J.HIP, 0.32f, -0.3f,
        P(torso = 162f, thigh = 78f, shin = 50f, ua = 92f, fa = 92f),
        P(torso = 184f, thigh = 78f, shin = 50f, ua = -25f, fa = 90f),
        props = listOf(Prop.Box(-0.12f, 0.03f, 0.25f, 0.27f), Prop.Line(0.52f, 0.3f, 0.52f, -0.1f, 0.04f), Prop.Cable(0.52f, -0.08f, Jt.WRIST))),
    Anim.ROW_BENT to Motion(J.ANKLE, 0.42f, -0.015f,
        P(torso = 100f, thigh = 20f, shin = -10f, ua = 2f, fa = 2f),
        P(torso = 100f, thigh = 20f, shin = -10f, ua = -150f, fa = 5f),
        props = listOf(Prop.Weight(Jt.WRIST))),
    Anim.SHOULDER_PRESS to Motion(J.HIP, 0.5f, -0.36f,
        P(torso = 180f, thigh = 14f, shin = 0f, thigh2 = 14f, shin2 = 0f, ua = 90f, fa = 178f),
        P(torso = 180f, thigh = 14f, shin = 0f, thigh2 = 14f, shin2 = 0f, ua = 162f, fa = 176f),
        front = true, thighScale = 0.4f,
        props = listOf(Prop.Box(-0.13f, 0.02f, 0.26f, 0.34f), Prop.Weight(Jt.WRIST), Prop.Weight(Jt.WRIST2))),
    Anim.LATERAL_RAISE to Motion(J.HIP, 0.5f, -0.44f,
        P(torso = 180f, thigh = 4f, shin = 0f, thigh2 = 4f, shin2 = 0f, ua = 10f, fa = 14f),
        P(torso = 180f, thigh = 4f, shin = 0f, thigh2 = 4f, shin2 = 0f, ua = 86f, fa = 92f),
        front = true, props = listOf(Prop.Weight(Jt.WRIST), Prop.Weight(Jt.WRIST2))),
    Anim.CHEST_PRESS to Motion(J.HIP, 0.55f, -0.3f,
        P(torso = 270f, ua = 15f, fa = 180f, ankle = Offset(0.24f, 0.285f), ankle2 = Offset(0.24f, 0.285f)),
        P(torso = 270f, ua = 180f, fa = 180f, ankle = Offset(0.24f, 0.285f), ankle2 = Offset(0.24f, 0.285f)),
        props = listOf(Prop.Box(-0.4f, 0.03f, 0.48f, 0.255f), Prop.Weight(Jt.WRIST))),
    Anim.PRESS_SEATED to Motion(J.HIP, 0.38f, -0.36f,
        P(torso = 186f, thigh = 90f, shin = 0f, ua = -25f, fa = 92f),
        P(torso = 186f, thigh = 90f, shin = 0f, ua = 90f, fa = 90f),
        props = SEAT),
    Anim.PUSHUP to Motion(J.ANKLE, 0.15f, -0.03f,
        P(torso = 114.5f, thigh = -65.5f, shin = -65.5f, foot = 0f, wrist = Offset(0.637f, 0.025f), wrist2 = Offset(0.637f, 0.025f)),
        P(torso = 98.5f, thigh = -81.5f, shin = -81.5f, foot = 0f, wrist = Offset(0.637f, 0.025f), wrist2 = Offset(0.637f, 0.025f)),
        elbowSign = 1f),
    Anim.CURL to Motion(J.ANKLE, 0.5f, -0.015f,
        STAND.copy(ua = 2f, fa = 2f), STAND.copy(ua = 8f, fa = 155f), props = listOf(Prop.Weight(Jt.WRIST))),
    Anim.PUSHDOWN to Motion(J.ANKLE, 0.45f, -0.015f,
        STAND.copy(torso = 172f, ua = 4f, fa = 125f), STAND.copy(torso = 172f, ua = 4f, fa = 6f),
        props = listOf(Prop.Cable(0.18f, -0.95f, Jt.WRIST), Prop.Line(0.24f, 0.015f, 0.24f, -0.95f, 0.04f))),
    Anim.OVERHEAD_EXT to Motion(J.HIP, 0.45f, -0.36f,
        P(torso = 180f, thigh = 90f, shin = 0f, ua = 172f, fa = -15f),
        P(torso = 180f, thigh = 90f, shin = 0f, ua = 172f, fa = 178f),
        props = SEAT + Prop.Weight(Jt.WRIST)),
    Anim.DIP to Motion(J.WRIST, 0.35f, -0.29f,
        P(torso = 180f, ua = -8f, fa = -8f, ankle = Offset(0.48f, 0.275f), ankle2 = Offset(0.48f, 0.275f)),
        P(torso = 176f, ua = -82f, fa = 12f, ankle = Offset(0.48f, 0.275f), ankle2 = Offset(0.48f, 0.275f)),
        props = listOf(Prop.Box(-0.26f, 0.0f, 0.28f, 0.29f)))
)

/* ------------------------------------------------------------------ Desenho */

@Composable
fun ExerciseAnimation(anim: Anim, modifier: Modifier = Modifier, animate: Boolean = true, fixedT: Float? = null) {
    val motion = MOTIONS[anim] ?: return
    if (fixedT != null || !animate) {
        StaticMotion(motion, fixedT ?: 0.5f, modifier)
        return
    }
    val transition = rememberInfiniteTransition(label = "exercise")
    val tAnim by transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            keyframes {
                durationMillis = if (motion.hold) 3000 else 2600
                0f at 0; 0f at 350 using FastOutSlowInEasing
                1f at 1250 using LinearEasing
                1f at 1650 using FastOutSlowInEasing
                0f at (if (motion.hold) 3000 else 2600)
            }, repeatMode = RepeatMode.Restart
        ), label = "t"
    )
    StaticMotion(motion, tAnim, modifier)
}

@Composable
private fun StaticMotion(motion: Motion, t: Float, modifier: Modifier) {
    val figure = MaterialTheme.colorScheme.primary
    val prop = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)
    val weight = LocalExtras.current.gold
    val floor = MaterialTheme.colorScheme.outlineVariant
    Canvas(modifier.fillMaxWidth().aspectRatio(1.45f).semantics { contentDescription = "Animação demonstrativa do exercício" }) {
        drawMotion(motion, t, figure, prop, weight, floor)
    }
}

fun DrawScope.drawMotion(m: Motion, t: Float, figure: Color, prop: Color, weight: Color, floorColor: Color) {
    val u = size.height * 0.95f
    val floorY = size.height * 0.92f
    val anchor = Offset(size.width * m.fx, floorY + m.dy * u)
    fun px(o: Offset) = anchor + o * u
    // chão
    drawLine(floorColor, Offset(size.width * 0.04f, floorY), Offset(size.width * 0.96f, floorY), 3f, cap = StrokeCap.Round)
    val sk = solve(m, t)
    val pts = sk.pts
    fun pt(j: Jt): Offset? = when (j) {
        Jt.HIP -> pts["hip"]; Jt.WRIST -> pts["wrist"]; Jt.WRIST2 -> pts["wrist2"]; Jt.ANKLE -> pts["ankle"]
        Jt.ANKLE2 -> pts["ankle2"]; Jt.KNEE -> pts["knee"]; Jt.KNEE2 -> pts["knee2"]; Jt.SHOULDER -> pts["shoulder"]
    }
    // acessórios estáticos (atrás da figura)
    m.props.forEach { pr ->
        when (pr) {
            is Prop.Box -> drawRoundRect(prop, px(Offset(pr.x, pr.y)), Size(pr.w * u, pr.h * u), CornerRadius(0.02f * u))
            is Prop.Line -> drawLine(prop, px(Offset(pr.x1, pr.y1)), px(Offset(pr.x2, pr.y2)), pr.width * u, cap = StrokeCap.Round)
            is Prop.StaticPad -> drawCircle(prop, pr.r * u, px(Offset(pr.x, pr.y)))
            is Prop.Cable -> pt(pr.to)?.let { drawLine(prop, px(Offset(pr.x, pr.y)), px(it), 0.008f * u); drawCircle(prop, 0.022f * u, px(Offset(pr.x, pr.y))) }
            else -> Unit
        }
    }
    val sw = 0.045f * u
    val back = figure.copy(alpha = 0.45f)
    fun seg(a: String, b: String, c: Color, w: Float = sw) {
        val p1 = pts[a] ?: return; val p2 = pts[b] ?: return
        drawLine(c, px(p1), px(p2), w, cap = StrokeCap.Round)
    }
    if (!sk.front) {
        // membros de trás
        seg("hip", "knee2", back); seg("knee2", "ankle2", back); seg("ankle2", "toe2", back, sw * 0.8f)
        seg("shoulder", "elbow2", back); seg("elbow2", "wrist2", back)
        // tronco e cabeça
        seg("hip", "shoulder", figure, sw * 1.35f); seg("shoulder", "neck", figure, sw * 0.9f)
        drawCircle(figure, HEAD * u, px(pts["head"]!!))
        // membros da frente
        seg("hip", "knee", figure); seg("knee", "ankle", figure); seg("ankle", "toe", figure, sw * 0.8f)
        seg("shoulder", "elbow", figure); seg("elbow", "wrist", figure)
    } else {
        seg("hipL", "hipR", figure, sw * 1.2f); seg("shL", "shR", figure, sw * 1.2f)
        seg("hip", "shoulder", figure, sw * 1.6f); seg("shoulder", "neck", figure, sw * 0.9f)
        drawCircle(figure, HEAD * u, px(pts["head"]!!))
        seg("hipL", "knee2", figure); seg("knee2", "ankle2", figure); seg("ankle2", "toe2", figure, sw * 0.8f)
        seg("hipR", "knee", figure); seg("knee", "ankle", figure); seg("ankle", "toe", figure, sw * 0.8f)
        seg("shL", "elbow2", figure); seg("elbow2", "wrist2", figure)
        seg("shR", "elbow", figure); seg("elbow", "wrist", figure)
    }
    // acessórios que acompanham o corpo
    m.props.forEach { pr ->
        when (pr) {
            is Prop.Weight -> pt(pr.at)?.let { c ->
                val center = px(c)
                when (pr.kind) {
                    WeightKind.DUMBBELL -> {
                        drawLine(weight, center - Offset(0.035f * u, 0f), center + Offset(0.035f * u, 0f), 0.02f * u, cap = StrokeCap.Round)
                        drawCircle(weight, 0.028f * u, center - Offset(0.035f * u, 0f)); drawCircle(weight, 0.028f * u, center + Offset(0.035f * u, 0f))
                    }
                    WeightKind.PLATE -> { drawCircle(weight, 0.075f * u, center - Offset(0f, 0.05f * u)); drawCircle(prop, 0.02f * u, center - Offset(0f, 0.05f * u)) }
                    WeightKind.BAR -> drawLine(weight, center - Offset(0.1f * u, 0f), center + Offset(0.1f * u, 0f), 0.02f * u)
                }
            }
            is Prop.Pad -> pt(pr.at)?.let { drawCircle(weight.copy(alpha = 0.85f), pr.r * u, px(it)) }
            else -> Unit
        }
    }
}
