package com.nexusguard.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nexusguard.app.ui.theme.NX

/**
 * Gráfico de linha. Valores nulos são desenhados como marcas vermelhas na base (ex.: falha de conexão).
 */
@Composable
fun LineChart(values: List<Double?>, modifier: Modifier = Modifier, height: Dp = 140.dp, color: Color? = null, unit: String = "", maxHint: Double? = null) {
    val c = NX.c
    val line = color ?: c.cyan
    val present = values.filterNotNull()
    Column(modifier.fillMaxWidth()) {
        if (present.isEmpty()) {
            Text("Sem dados ainda", style = MaterialTheme.typography.bodySmall, color = c.muted)
            return@Column
        }
        val maxV = maxOf(present.max(), maxHint ?: 0.0) * 1.15
        Row { Text("máx ${present.max().let { if (it >= 100) it.toInt().toString() else String.format("%.1f", it) }} $unit", style = MaterialTheme.typography.labelSmall, color = c.muted) }
        Canvas(Modifier.fillMaxWidth().height(height)) {
            val w = size.width; val h = size.height
            for (i in 1..3) {
                val y = h * i / 4f
                drawLine(c.stroke, Offset(0f, y), Offset(w, y), strokeWidth = 1f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f)))
            }
            val n = values.size
            if (n == 1) {
                val y = h - (present[0] / maxV * h).toFloat()
                drawCircle(line, 5.dp.toPx(), Offset(w / 2, y))
                return@Canvas
            }
            val stepX = w / (n - 1)
            val path = Path(); val fill = Path()
            var started = false
            var lastX = 0f
            values.forEachIndexed { i, v ->
                val x = i * stepX
                if (v == null) {
                    drawLine(c.danger, Offset(x, h), Offset(x, h - 10.dp.toPx()), strokeWidth = 3f, cap = StrokeCap.Round)
                    started = false
                } else {
                    val y = h - (v / maxV * h).toFloat()
                    if (!started) { path.moveTo(x, y); if (fill.isEmpty) fill.moveTo(x, h); fill.lineTo(x, y); started = true } else { path.lineTo(x, y); fill.lineTo(x, y) }
                    lastX = x
                }
            }
            fill.lineTo(lastX, h); fill.close()
            drawPath(fill, Brush.verticalGradient(listOf(line.copy(alpha = .28f), Color.Transparent)))
            drawPath(path, line, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
        }
    }
}

/** Barras horizontais simples (ex.: comparação de DNS). */
@Composable
fun HBar(fraction: Float, color: Color, modifier: Modifier = Modifier) {
    val c = NX.c
    Canvas(modifier.fillMaxWidth().height(8.dp)) {
        drawRoundRect(c.surfaceHigh, size = size, cornerRadius = CornerRadius(8f, 8f))
        drawRoundRect(color, size = Size(size.width * fraction.coerceIn(0.02f, 1f), size.height), cornerRadius = CornerRadius(8f, 8f))
    }
}

/** Gráfico de barras verticais para histórico (ex.: download por teste). */
@Composable
fun BarChart(values: List<Double>, modifier: Modifier = Modifier, height: Dp = 120.dp, color: Color? = null) {
    val c = NX.c
    val col = color ?: c.blue
    if (values.isEmpty()) { Text("Sem dados ainda", style = MaterialTheme.typography.bodySmall, color = c.muted); return }
    Canvas(modifier.fillMaxWidth().height(height)) {
        val maxV = (values.max() * 1.15).coerceAtLeast(0.001)
        val slot = size.width / values.size
        val bw = (slot * .6f).coerceAtMost(28.dp.toPx())
        values.forEachIndexed { i, v ->
            val bh = (v / maxV * size.height).toFloat()
            drawRoundRect(Brush.verticalGradient(listOf(col, c.purple)), Offset(i * slot + (slot - bw) / 2, size.height - bh), Size(bw, bh), CornerRadius(6f, 6f))
        }
    }
}
