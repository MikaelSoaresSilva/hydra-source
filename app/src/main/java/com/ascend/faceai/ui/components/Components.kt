package com.ascend.faceai.ui.components

import android.graphics.Bitmap
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ascend.faceai.analysis.CategoryResult
import com.ascend.faceai.ui.theme.Ac
import com.ascend.faceai.ui.theme.Grotesk
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: Dp = 18.dp,
    highlight: Boolean = false,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(22.dp)
    Column(
        modifier
            .clip(shape)
            .background(Brush.verticalGradient(listOf(Ac.SurfaceHi, Ac.Surface)))
            .border(BorderStroke(1.dp, if (highlight) Brush.linearGradient(listOf(Ac.Blue.copy(0.7f), Ac.Violet.copy(0.5f))) else Brush.linearGradient(listOf(Ac.StrokeHi, Ac.Stroke))), shape)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(padding),
        content = content
    )
}

@Composable
fun PrimaryButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier
            .height(54.dp)
            .clip(shape)
            .background(if (enabled) Ac.accentH else Brush.horizontalGradient(listOf(Ac.SurfaceHi, Ac.SurfaceHi)))
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (enabled) Color.White else Ac.TextLow)
    }
}

@Composable
fun SecondaryButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier.height(50.dp).clip(shape).background(Ac.Surface).border(1.dp, Ac.StrokeHi, shape).clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center
    ) { Text(text, style = MaterialTheme.typography.labelLarge, color = if (enabled) Ac.TextHi else Ac.TextLow) }
}

@Composable
fun DangerButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier.height(50.dp).clip(shape).background(Ac.Bad.copy(alpha = 0.10f)).border(1.dp, Ac.Bad.copy(alpha = 0.5f), shape).clickable { onClick() },
        contentAlignment = Alignment.Center
    ) { Text(text, style = MaterialTheme.typography.labelLarge, color = Ac.Bad) }
}

@Composable
fun Eyebrow(text: String, color: Color = Ac.Metal) =
    Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = color)

@Composable
fun TopBar(title: String, onBack: (() -> Unit)?, actions: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar", tint = Ac.TextHi) }
        else Spacer(Modifier.width(12.dp))
        Text(title, style = MaterialTheme.typography.titleLarge, color = Ac.TextHi, modifier = Modifier.weight(1f))
        actions()
    }
}

@Composable
fun Tag(text: String, color: Color = Ac.Metal, modifier: Modifier = Modifier) {
    Box(modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.12f)).border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp)) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = color)
    }
}

/** Anel de nota animado. */
@Composable
fun ScoreRing(score: Int?, size: Dp, stroke: Dp = 10.dp, label: String? = null, sub: String? = null) {
    val anim = remember { Animatable(0f) }
    LaunchedEffect(score) { anim.animateTo((score ?: 0) / 100f, tween(1200, easing = FastOutSlowInEasing)) }
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val s = stroke.toPx()
            val arcSize = Size(this.size.width - s, this.size.height - s)
            drawArc(Ac.SurfaceHi, 135f, 270f, false, Offset(s / 2, s / 2), arcSize, style = Stroke(s, cap = StrokeCap.Round))
            drawArc(Brush.sweepGradient(listOf(Ac.Cyan, Ac.Blue, Ac.Violet, Ac.Cyan)), 135f, 270f * anim.value, false, Offset(s / 2, s / 2), arcSize, style = Stroke(s, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(score?.let { "${(anim.value * 100).toInt()}" } ?: "—", fontFamily = Grotesk, fontWeight = FontWeight.Bold,
                fontSize = (size.value * 0.30f).sp, color = Ac.TextHi)
            if (label != null) Text(label, style = MaterialTheme.typography.labelSmall, color = Ac.Metal)
            if (sub != null) Text(sub, style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
        }
    }
}

@Composable
fun ScoreBar(label: String, score: Int?, confidence: Double?, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    Column(modifier.then(if (onClick != null) Modifier.clickable { onClick() } else Modifier).padding(vertical = 7.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.titleSmall, color = Ac.TextHi, modifier = Modifier.weight(1f))
            if (confidence != null) Text("conf. ${(confidence * 100).toInt()}%", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            Spacer(Modifier.width(10.dp))
            Text(score?.toString() ?: "n/d", style = MaterialTheme.typography.titleMedium, color = Ac.scoreColor(score))
        }
        Spacer(Modifier.height(6.dp))
        val anim = remember { Animatable(0f) }
        LaunchedEffect(score) { anim.animateTo((score ?: 0) / 100f, tween(900)) }
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(Ac.SurfaceHi)) {
            Box(Modifier.fillMaxWidth(anim.value).height(6.dp).clip(RoundedCornerShape(3.dp)).background(Brush.horizontalGradient(listOf(Ac.Blue, Ac.scoreColor(score)))))
        }
    }
}

@Composable
fun ConfidenceMeter(confidence: Double) {
    val label = when { confidence >= 0.7 -> "Alta"; confidence >= 0.45 -> "Média"; else -> "Baixa" }
    Row(verticalAlignment = Alignment.CenterVertically) {
        repeat(5) { i ->
            Box(Modifier.padding(end = 3.dp).size(width = 14.dp, height = 6.dp).clip(RoundedCornerShape(2.dp))
                .background(if (confidence * 5 > i + 0.25) Ac.Cyan else Ac.SurfaceHi))
        }
        Spacer(Modifier.width(6.dp))
        Text("Confiança $label (${(confidence * 100).toInt()}%)", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
    }
}

/** Gráfico radar das categorias com nota. */
@Composable
fun RadarChart(cats: List<CategoryResult>, modifier: Modifier = Modifier, compare: List<CategoryResult>? = null) {
    val items = cats.filter { it.score != null }
    if (items.size < 3) { Text("Dados insuficientes para o gráfico.", color = Ac.TextLow); return }
    val anim = remember { Animatable(0f) }
    LaunchedEffect(items) { anim.animateTo(1f, tween(1000)) }
    val labelStyle = MaterialTheme.typography.labelSmall
    BoxWithConstraints(modifier.aspectRatio(1f)) {
        val w = constraints.maxWidth.toFloat()
        Canvas(Modifier.fillMaxSize()) {
            val c = Offset(size.width / 2, size.height / 2)
            val r = min(size.width, size.height) * 0.36f
            val n = items.size
            fun pt(i: Int, v: Float): Offset {
                val a = -PI / 2 + 2 * PI * i / n
                return Offset(c.x + (r * v * cos(a)).toFloat(), c.y + (r * v * sin(a)).toFloat())
            }
            for (ring in 1..4) {
                val p = Path(); for (i in 0 until n) { val o = pt(i, ring / 4f); if (i == 0) p.moveTo(o.x, o.y) else p.lineTo(o.x, o.y) }; p.close()
                drawPath(p, Ac.Stroke, style = Stroke(1.dp.toPx()))
            }
            for (i in 0 until n) drawLine(Ac.Stroke, c, pt(i, 1f), 1.dp.toPx())
            compare?.let { prev ->
                val p = Path()
                items.forEachIndexed { i, cat -> val v = (prev.firstOrNull { it.id == cat.id }?.score ?: 0) / 100f; val o = pt(i, v); if (i == 0) p.moveTo(o.x, o.y) else p.lineTo(o.x, o.y) }
                p.close(); drawPath(p, Ac.Metal.copy(alpha = 0.6f), style = Stroke(1.5.dp.toPx()))
            }
            val p = Path()
            items.forEachIndexed { i, cat -> val o = pt(i, cat.score!! / 100f * anim.value); if (i == 0) p.moveTo(o.x, o.y) else p.lineTo(o.x, o.y) }
            p.close()
            drawPath(p, Brush.radialGradient(listOf(Ac.Blue.copy(0.45f), Ac.Violet.copy(0.25f)), c, r))
            drawPath(p, Ac.Blue, style = Stroke(2.dp.toPx()))
            items.forEachIndexed { i, cat -> drawCircle(Ac.Cyan, 3.dp.toPx(), pt(i, cat.score!! / 100f * anim.value)) }
        }
        items.forEachIndexed { i, cat ->
            val a = -PI / 2 + 2 * PI * i / items.size
            val rr = w * 0.45f
            val x = w / 2 + (rr * cos(a)).toFloat(); val y = w / 2 + (rr * sin(a)).toFloat()
            Text(cat.name.substringBefore(" ").take(11), style = labelStyle, color = Ac.TextMid, textAlign = TextAlign.Center,
                modifier = Modifier.offset { IntOffset((x - 38.dp.toPx()).toInt(), (y - 7.dp.toPx()).toInt()) }.width(76.dp))
        }
    }
}


/** Gráfico de linha da evolução (somente dados reais). */
@Composable
fun LineChart(values: List<Int>, labels: List<String>, modifier: Modifier = Modifier) {
    if (values.size < 2) { Text("São necessárias pelo menos 2 análises para mostrar a evolução.", style = MaterialTheme.typography.bodyMedium, color = Ac.TextLow); return }
    val anim = remember { Animatable(0f) }
    LaunchedEffect(values) { anim.animateTo(1f, tween(900)) }
    Column(modifier) {
        Canvas(Modifier.fillMaxWidth().height(150.dp)) {
            val minV = (values.min() - 5).coerceAtLeast(0); val maxV = (values.max() + 5).coerceAtMost(100)
            val range = (maxV - minV).coerceAtLeast(1)
            fun pt(i: Int) = Offset(size.width * i / (values.size - 1), size.height - size.height * (values[i] - minV) / range)
            for (g in 0..3) { val y = size.height * g / 3; drawLine(Ac.Stroke, Offset(0f, y), Offset(size.width, y), 1.dp.toPx()) }
            val path = Path(); val fill = Path()
            values.indices.forEach { i -> val o = pt(i); if (i == 0) { path.moveTo(o.x, o.y); fill.moveTo(o.x, size.height); fill.lineTo(o.x, o.y) } else { path.lineTo(o.x, o.y); fill.lineTo(o.x, o.y) } }
            fill.lineTo(size.width, size.height); fill.close()
            drawPath(fill, Brush.verticalGradient(listOf(Ac.Blue.copy(0.35f * anim.value), Color.Transparent)))
            drawPath(path, Ac.accentH, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
            values.indices.forEach { i -> drawCircle(Ac.Bg, 5.dp.toPx(), pt(i)); drawCircle(Ac.Cyan, 3.5.dp.toPx(), pt(i)) }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(labels.first(), style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            Text("${values.first()} → ${values.last()}", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            Text(labels.last(), style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
        }
    }
}

/** Foto com a malha de pontos medida e marcadores clicáveis em cada região analisada. */
@Composable
fun FaceMap(photo: Bitmap, landmarks: List<Float>, cats: List<CategoryResult>, onRegion: (CategoryResult) -> Unit, modifier: Modifier = Modifier) {
    val pulse = rememberInfiniteTransition(label = "pulse")
    val p by pulse.animateFloat(0.6f, 1f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "p")
    val regions = cats.filter { it.regionX != null && it.regionY != null }
    Box(modifier.aspectRatio(photo.width.toFloat() / photo.height).clip(RoundedCornerShape(22.dp))) {
        Image(photo.asImageBitmap(), "Sua foto analisada", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
        Canvas(Modifier.fillMaxSize().pointerInput(regions) {
            detectTapGestures { o ->
                val hit = regions.minByOrNull { hypot(it.regionX!! * size.width - o.x, it.regionY!! * size.height - o.y) }
                if (hit != null && hypot(hit.regionX!! * size.width - o.x, hit.regionY!! * size.height - o.y) < size.width * 0.12) onRegion(hit)
            }
        }) {
            drawRect(Brush.verticalGradient(listOf(Color.Transparent, Ac.Bg.copy(alpha = 0.55f))))
            var i = 0
            while (i + 1 < landmarks.size) {
                drawCircle(Ac.Cyan.copy(alpha = 0.35f), 0.9.dp.toPx(), Offset(landmarks[i] * size.width, landmarks[i + 1] * size.height)); i += 2
            }
            regions.forEach { c ->
                val o = Offset((c.regionX!! * size.width).toFloat(), (c.regionY!! * size.height).toFloat())
                drawCircle(Ac.scoreColor(c.score).copy(alpha = 0.25f * p), 16.dp.toPx() * p, o)
                drawCircle(Ac.scoreColor(c.score), 5.dp.toPx(), o)
                drawCircle(Color.White, 2.dp.toPx(), o)
            }
        }
    }
}

@Composable
fun BulletList(items: List<String>, color: Color = Ac.TextMid, bullet: Color = Ac.Blue) {
    items.forEach {
        Row(Modifier.padding(vertical = 3.dp)) {
            Box(Modifier.padding(top = 7.dp, end = 10.dp).size(5.dp).clip(CircleShape).background(bullet))
            Text(it, style = MaterialTheme.typography.bodyMedium, color = color)
        }
    }
}

@Composable
fun EmptyState(title: String, text: String, action: String? = null, onAction: () -> Unit = {}) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
        Spacer(Modifier.height(6.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid)
        if (action != null) { Spacer(Modifier.height(14.dp)); PrimaryButton(action, Modifier.fillMaxWidth(), onClick = onAction) }
    }
}

@Composable
fun GlowOrb(modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "orb")
    val a by t.animateFloat(0f, 360f, infiniteRepeatable(tween(14000)), label = "a")
    Canvas(modifier) {
        val c = Offset(size.width / 2, size.height / 2)
        val r = size.minDimension / 2
        drawCircle(Brush.radialGradient(listOf(Ac.Violet.copy(0.35f), Color.Transparent), c, r))
        rotate(a) {
            drawCircle(Brush.sweepGradient(listOf(Ac.Blue, Ac.Violet, Ac.Cyan, Ac.Blue), c), r * 0.55f, c, style = Stroke(1.5.dp.toPx()))
            drawCircle(Ac.Blue.copy(0.3f), r * 0.75f, c, style = Stroke(0.8.dp.toPx()))
        }
    }
}


val ScreenPadding = PaddingValues(horizontal = 18.dp)
