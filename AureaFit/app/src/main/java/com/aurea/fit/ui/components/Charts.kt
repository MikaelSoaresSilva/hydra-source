package com.aurea.fit.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlin.math.abs

data class ChartPoint(val x: Long, val y: Double)

private val dayFmt = DateTimeFormatter.ofPattern("dd/MM")
fun epochLabel(day: Long): String = LocalDate.ofEpochDay(day).format(dayFmt)

/**
 * Gráfico de linha interativo: toque ou arraste para ver o valor de cada ponto.
 * Eixo X em dias (epochDay).
 */
@Composable
fun LineChart(
    points: List<ChartPoint>,
    unit: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
    goal: Double? = null
) {
    if (points.isEmpty()) {
        Text("Sem dados ainda. Registre para ver o gráfico.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier.padding(16.dp))
        return
    }
    val sorted = remember(points) { points.sortedBy { it.x } }
    var selected by remember(points) { mutableIntStateOf(sorted.lastIndex) }
    val reveal = remember(points) { Animatable(0f) }
    LaunchedEffect(points) { reveal.animateTo(1f, tween(900)) }
    val tm = rememberTextMeasurer()
    val onVar = MaterialTheme.colorScheme.onSurfaceVariant
    val grid = MaterialTheme.colorScheme.outlineVariant
    val labelStyle = MaterialTheme.typography.labelSmall.copy(color = onVar)
    val tipStyle = MaterialTheme.typography.labelLarge.copy(color = MaterialTheme.colorScheme.onPrimary)
    val sel = sorted.getOrNull(selected)

    Column(modifier) {
        if (sel != null) {
            Text("${fmt1(sel.y)} $unit  •  ${epochLabel(sel.x)}", style = MaterialTheme.typography.titleMedium, color = color)
        }
        Canvas(
            Modifier.fillMaxWidth().height(200.dp).padding(top = 8.dp)
                .semantics { contentDescription = "Gráfico com ${sorted.size} registros. Último: ${fmt1(sorted.last().y)} $unit" }
                .pointerInput(sorted) {
                    detectTapGestures { pos -> selected = nearest(sorted, pos.x, size.width.toFloat()) }
                }
                .pointerInput(sorted) {
                    detectDragGestures { change, _ -> selected = nearest(sorted, change.position.x, size.width.toFloat()) }
                }
        ) {
            val left = 40.dp.toPx(); val bottom = 22.dp.toPx(); val top = 8.dp.toPx(); val right = 8.dp.toPx()
            val w = size.width - left - right; val h = size.height - top - bottom
            val ys = sorted.map { it.y } + listOfNotNull(goal)
            var minY = ys.min(); var maxY = ys.max()
            if (maxY - minY < 1e-6) { minY -= 1; maxY += 1 }
            val pad = (maxY - minY) * 0.12; minY -= pad; maxY += pad
            val minX = sorted.first().x; val maxX = sorted.last().x
            fun px(x: Long) = left + if (maxX == minX) w / 2 else (x - minX).toFloat() / (maxX - minX) * w
            fun py(y: Double) = top + h - ((y - minY) / (maxY - minY)).toFloat() * h

            // grade + rótulos
            for (i in 0..3) {
                val v = minY + (maxY - minY) * i / 3
                val y = py(v)
                drawLine(grid, Offset(left, y), Offset(left + w, y), 1f)
                drawLabel(tm, fmt1(v), Offset(2f, y - 8.dp.toPx()), labelStyle)
            }
            drawLabel(tm, epochLabel(minX), Offset(left, top + h + 4.dp.toPx()), labelStyle)
            if (maxX != minX) drawLabel(tm, epochLabel(maxX), Offset(left + w - 34.dp.toPx(), top + h + 4.dp.toPx()), labelStyle)

            goal?.let {
                drawLine(color.copy(alpha = 0.5f), Offset(left, py(it)), Offset(left + w, py(it)), 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f)))
            }

            val path = Path(); val fill = Path()
            val visible = (sorted.size * reveal.value).toInt().coerceIn(1, sorted.size)
            sorted.take(visible).forEachIndexed { i, p ->
                val x = px(p.x); val y = py(p.y)
                if (i == 0) { path.moveTo(x, y); fill.moveTo(x, top + h); fill.lineTo(x, y) } else { path.lineTo(x, y); fill.lineTo(x, y) }
            }
            fill.lineTo(px(sorted[visible - 1].x), top + h); fill.close()
            drawPath(fill, Brush.verticalGradient(listOf(color.copy(alpha = 0.28f), Color.Transparent), startY = top, endY = top + h))
            drawPath(path, color, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round))
            sorted.take(visible).forEach { p -> drawCircle(color, 4.dp.toPx(), Offset(px(p.x), py(p.y))) }

            sel?.let { s ->
                val x = px(s.x); val y = py(s.y)
                drawLine(color.copy(alpha = 0.4f), Offset(x, top), Offset(x, top + h), 2f)
                drawCircle(Color.White, 7.dp.toPx(), Offset(x, y))
                drawCircle(color, 5.dp.toPx(), Offset(x, y))
                val text = "${fmt1(s.y)}"
                val layout = tm.measure(text, tipStyle)
                val bx = (x - layout.size.width / 2 - 8).coerceIn(left, left + w - layout.size.width - 16)
                val by = (y - layout.size.height - 18).coerceAtLeast(0f)
                drawRoundRect(color, Offset(bx, by), Size(layout.size.width + 16f, layout.size.height + 8f), CornerRadius(12f, 12f))
                drawText(layout, topLeft = Offset(bx + 8, by + 4))
            }
        }
    }
}

private fun nearest(points: List<ChartPoint>, x: Float, width: Float): Int {
    if (points.size <= 1) return 0
    val left = width * 0.1f
    val minX = points.first().x; val maxX = points.last().x
    if (maxX == minX) return points.lastIndex
    val target = minX + ((x - left) / (width - left)).coerceIn(0f, 1f) * (maxX - minX)
    return points.indices.minBy { abs(points[it].x - target) }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawLabel(tm: TextMeasurer, text: String, at: Offset, style: androidx.compose.ui.text.TextStyle) {
    drawText(tm, text, topLeft = at, style = style)
}

/** Gráfico de barras simples e interativo. */
@Composable
fun BarChart(labels: List<String>, values: List<Double>, unit: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary, goal: Double? = null) {
    if (values.isEmpty()) return
    var selected by remember(values) { mutableIntStateOf(values.lastIndex) }
    val reveal = remember(values) { Animatable(0f) }
    LaunchedEffect(values) { reveal.animateTo(1f, tween(700)) }
    val tm = rememberTextMeasurer()
    val labelStyle = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
    val track = MaterialTheme.colorScheme.surfaceVariant
    Column(modifier) {
        Text("${labels.getOrNull(selected) ?: ""}: ${fmt1(values.getOrNull(selected))} $unit", style = MaterialTheme.typography.titleMedium, color = color)
        Canvas(
            Modifier.fillMaxWidth().height(160.dp).padding(top = 8.dp)
                .semantics { contentDescription = "Gráfico de barras com ${values.size} períodos" }
                .pointerInput(values) {
                    detectTapGestures { pos ->
                        val slot = size.width / values.size.toFloat()
                        selected = (pos.x / slot).toInt().coerceIn(0, values.lastIndex)
                    }
                }
        ) {
            val bottom = 20.dp.toPx()
            val h = size.height - bottom
            val maxV = (values + listOfNotNull(goal)).max().coerceAtLeast(1.0)
            val slot = size.width / values.size
            val bw = slot * 0.6f
            values.forEachIndexed { i, v ->
                val x = i * slot + (slot - bw) / 2
                drawRoundRect(track, Offset(x, 0f), Size(bw, h), CornerRadius(10f, 10f))
                val bh = (v / maxV).toFloat() * h * reveal.value
                drawRoundRect(if (i == selected) color else color.copy(alpha = 0.55f), Offset(x, h - bh), Size(bw, bh), CornerRadius(10f, 10f))
                val l = tm.measure(labels[i], labelStyle)
                drawText(l, topLeft = Offset(i * slot + (slot - l.size.width) / 2, h + 4.dp.toPx()))
            }
            goal?.let {
                val y = h - (it / maxV).toFloat() * h
                drawLine(color, Offset(0f, y), Offset(size.width, y), 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
            }
        }
    }
}
