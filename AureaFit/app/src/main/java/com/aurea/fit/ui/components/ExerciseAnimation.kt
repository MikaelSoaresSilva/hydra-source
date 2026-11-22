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
import com.aurea.fit.domain.*
import com.aurea.fit.ui.theme.LocalExtras
import kotlin.math.*

/*
 * Animações demonstrativas desenhadas por código (vetor), leves e offline.
 * Convenção de ângulos: 0° = para baixo, 90° = para frente (direita), 180° = para cima.
 * Comprimentos em "unidades" (u) relativas à altura do quadro.
 */

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
    fun px(o: V) = anchor + Offset(o.x * u, o.y * u)
    // chão
    drawLine(floorColor, Offset(size.width * 0.04f, floorY), Offset(size.width * 0.96f, floorY), 3f, cap = StrokeCap.Round)
    val sk = solve(m, t)
    val pts = sk.pts
    fun pt(j: Jt): V? = when (j) {
        Jt.HIP -> pts["hip"]; Jt.WRIST -> pts["wrist"]; Jt.WRIST2 -> pts["wrist2"]; Jt.ANKLE -> pts["ankle"]
        Jt.ANKLE2 -> pts["ankle2"]; Jt.KNEE -> pts["knee"]; Jt.KNEE2 -> pts["knee2"]; Jt.SHOULDER -> pts["shoulder"]
    }
    // acessórios estáticos (atrás da figura)
    m.props.forEach { pr ->
        when (pr) {
            is Prop.Box -> drawRoundRect(prop, px(V(pr.x, pr.y)), Size(pr.w * u, pr.h * u), CornerRadius(0.02f * u))
            is Prop.Line -> drawLine(prop, px(V(pr.x1, pr.y1)), px(V(pr.x2, pr.y2)), pr.width * u, cap = StrokeCap.Round)
            is Prop.StaticPad -> drawCircle(prop, pr.r * u, px(V(pr.x, pr.y)))
            is Prop.Cable -> pt(pr.to)?.let { drawLine(prop, px(V(pr.x, pr.y)), px(it), 0.008f * u); drawCircle(prop, 0.022f * u, px(V(pr.x, pr.y))) }
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
