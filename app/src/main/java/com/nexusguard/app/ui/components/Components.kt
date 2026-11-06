package com.nexusguard.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexusguard.app.security.CheckStatus
import com.nexusguard.app.security.Severity
import com.nexusguard.app.ui.theme.Grotesk
import com.nexusguard.app.ui.theme.NX

@Composable
fun NexusCard(modifier: Modifier = Modifier, glow: Boolean = false, onClick: (() -> Unit)? = null, padding: Dp = 16.dp, content: @Composable ColumnScope.() -> Unit) {
    val c = NX.c
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(c.surface)
            .border(1.dp, if (glow) Brush.linearGradient(listOf(c.blue.copy(alpha = .7f), c.purple.copy(alpha = .5f))) else Brush.linearGradient(listOf(c.stroke, c.stroke)), shape)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(padding),
        content = content
    )
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(top = 18.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.weight(1f))
        action?.invoke()
    }
}

@Composable
fun scoreColor(score: Int?): Color {
    val c = NX.c
    return when {
        score == null -> c.muted
        score >= 80 -> c.success
        score >= 55 -> c.warn
        else -> c.danger
    }
}

/** Anel de pontuação animado com gradiente azul → roxo e brilho. */
@Composable
fun ScoreRing(score: Int?, label: String, modifier: Modifier = Modifier, size: Dp = 180.dp, caption: String? = null, scanning: Boolean = false) {
    val c = NX.c
    val target = (score ?: 0) / 100f
    val anim by animateFloatAsState(target, tween(1200, easing = FastOutSlowInEasing), label = "ring")
    val inf = rememberInfiniteTransition(label = "spin")
    val spin by inf.animateFloat(0f, 360f, infiniteRepeatable(tween(1600)), label = "spin")
    val pulse by inf.animateFloat(.35f, .8f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "pulse")
    val col = scoreColor(score)
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        androidx.compose.foundation.Canvas(Modifier.size(size)) {
            val stroke = size.toPx() * 0.065f
            val inset = stroke / 2 + 6.dp.toPx()
            val arcSize = Size(this.size.width - inset * 2, this.size.height - inset * 2)
            val tl = Offset(inset, inset)
            // brilho
            drawCircle(Brush.radialGradient(listOf(c.blue.copy(alpha = .18f * pulse), Color.Transparent)), radius = this.size.minDimension / 2)
            drawArc(c.stroke, 0f, 360f, false, tl, arcSize, style = Stroke(stroke))
            if (scanning) {
                drawArc(Brush.sweepGradient(listOf(Color.Transparent, c.cyan, c.purple)), spin, 120f, false, tl, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            } else if (score != null) {
                drawArc(Brush.sweepGradient(listOf(c.blue, c.purple, c.cyan, c.blue)), -90f, 360f * anim, false, tl, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            }
            // marcas
            val r = this.size.minDimension / 2 - inset - stroke * 1.4f
            for (i in 0 until 60) {
                val a = Math.toRadians(i * 6.0)
                val len = if (i % 5 == 0) 7.dp.toPx() else 3.dp.toPx()
                val cx = center.x; val cy = center.y
                drawLine(c.muted.copy(alpha = .25f), Offset(cx + (r * Math.cos(a)).toFloat(), cy + (r * Math.sin(a)).toFloat()),
                    Offset(cx + ((r - len) * Math.cos(a)).toFloat(), cy + ((r - len) * Math.sin(a)).toFloat()), strokeWidth = 1.dp.toPx())
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (scanning) "···" else score?.toString() ?: "--", fontFamily = Grotesk, fontWeight = FontWeight.Bold,
                fontSize = (size.value * 0.26f).sp, color = if (scanning) c.cyan else col)
            Text(label, style = MaterialTheme.typography.labelMedium, color = c.text, textAlign = TextAlign.Center)
            caption?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = c.muted, textAlign = TextAlign.Center) }
        }
    }
}

@Composable
fun PrimaryButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, tag: String? = null, onClick: () -> Unit) {
    val c = NX.c
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier
            .then(if (tag != null) Modifier.testTag(tag) else Modifier)
            .height(54.dp)
            .clip(shape)
            .background(if (enabled) c.accentH else Brush.horizontalGradient(listOf(c.surfaceHigh, c.surfaceHigh)))
            .clickable(enabled = enabled) { onClick() }
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            icon?.let { Icon(it, null, tint = Color.White, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)) }
            Text(text, style = MaterialTheme.typography.labelLarge, color = if (enabled) Color.White else c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun SecondaryButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null, tag: String? = null, onClick: () -> Unit) {
    val c = NX.c
    val shape = RoundedCornerShape(14.dp)
    Box(
        modifier
            .then(if (tag != null) Modifier.testTag(tag) else Modifier)
            .height(46.dp)
            .clip(shape)
            .border(1.dp, if (enabled) c.blue.copy(alpha = .6f) else c.stroke, shape)
            .clickable(enabled = enabled) { onClick() }
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            icon?.let { Icon(it, null, tint = c.cyan, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)) }
            Text(text, style = MaterialTheme.typography.labelLarge, color = if (enabled) c.text else c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun Pill(text: String, color: Color, modifier: Modifier = Modifier) {
    Box(modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = .14f)).border(1.dp, color.copy(alpha = .35f), RoundedCornerShape(50))
        .padding(horizontal = 10.dp, vertical = 4.dp)) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = color, maxLines = 1)
    }
}

@Composable
fun PulseDot(color: Color, modifier: Modifier = Modifier) {
    val inf = rememberInfiniteTransition(label = "dot")
    val a by inf.animateFloat(.3f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "a")
    Box(modifier.size(10.dp).drawBehind {
        drawCircle(color.copy(alpha = .25f * a), radius = size.minDimension)
        drawCircle(color, radius = size.minDimension / 2.6f)
    })
}

@Composable
fun MetricTile(label: String, value: String, unit: String = "", modifier: Modifier = Modifier, icon: ImageVector? = null, color: Color? = null, tag: String? = null) {
    val c = NX.c
    Column(modifier
        .then(if (tag != null) Modifier.testTag(tag) else Modifier)
        .clip(RoundedCornerShape(16.dp)).background(c.surfaceHigh).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            icon?.let { Icon(it, null, tint = c.cyan, modifier = Modifier.size(14.dp)); Spacer(Modifier.width(6.dp)) }
            Text(label, style = MaterialTheme.typography.labelSmall, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = if (value.length > 9) 14.sp else 22.sp, color = color ?: c.text,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (unit.isNotEmpty() && value != NA) { Spacer(Modifier.width(4.dp)); Text(unit, style = MaterialTheme.typography.labelSmall, color = c.muted, modifier = Modifier.padding(bottom = 3.dp)) }
        }
    }
}

const val NA = "não disponível"

@Composable
fun TileRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
fun severityColor(s: Severity): Color {
    val c = NX.c
    return when (s) { Severity.CRITICAL, Severity.HIGH -> c.danger; Severity.MEDIUM -> c.warn; Severity.LOW -> c.cyan; Severity.INFO -> c.muted }
}

@Composable
fun FindingRow(severity: Severity, title: String, text: String) {
    val c = NX.c
    val col = severityColor(severity)
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Icon(when (severity) { Severity.CRITICAL, Severity.HIGH -> Icons.Filled.ErrorOutline; Severity.MEDIUM -> Icons.Filled.WarningAmber; Severity.LOW -> Icons.Filled.Info; Severity.INFO -> Icons.Filled.CheckCircle },
            null, tint = col, modifier = Modifier.size(20.dp).padding(top = 2.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f, fill = false))
                if (severity != Severity.INFO) { Spacer(Modifier.width(8.dp)); Pill(severity.label, col) }
            }
            Spacer(Modifier.height(3.dp))
            Text(text, style = MaterialTheme.typography.bodySmall, color = c.muted)
        }
    }
}

@Composable
fun statusColor(s: CheckStatus): Color {
    val c = NX.c
    return when (s) { CheckStatus.PASS -> c.success; CheckStatus.WARN -> c.warn; CheckStatus.FAIL -> c.danger; CheckStatus.UNKNOWN -> c.muted; CheckStatus.INFO -> c.cyan }
}

@Composable
fun ExpandableRow(title: String, status: CheckStatus, detail: String, recommendation: String?, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    val c = NX.c
    var open by rememberSaveable(title) { mutableStateOf(status == CheckStatus.FAIL) }
    val col = statusColor(status)
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { open = !open }.padding(vertical = 10.dp, horizontal = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(when (status) { CheckStatus.PASS -> Icons.Filled.CheckCircle; CheckStatus.WARN -> Icons.Filled.WarningAmber; CheckStatus.FAIL -> Icons.Filled.ErrorOutline; CheckStatus.UNKNOWN -> Icons.Filled.HelpOutline; CheckStatus.INFO -> Icons.Filled.Info },
                null, tint = col, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Text(title, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
            Pill(status.label, col)
            Icon(if (open) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, null, tint = c.muted)
        }
        AnimatedVisibility(open) {
            Column(Modifier.padding(start = 32.dp, top = 6.dp)) {
                Text(detail, style = MaterialTheme.typography.bodySmall, color = c.muted)
                recommendation?.let {
                    Spacer(Modifier.height(6.dp))
                    Text("O que fazer: $it", style = MaterialTheme.typography.bodySmall, color = c.text)
                }
                if (actionLabel != null && onAction != null) {
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton(actionLabel, onClick = onAction)
                }
            }
        }
    }
}

@Composable
fun NavRow(title: String, subtitle: String, icon: ImageVector, modifier: Modifier = Modifier, badge: String? = null, badgeColor: Color? = null, tag: String? = null, onClick: () -> Unit) {
    val c = NX.c
    Row(modifier.fillMaxWidth()
        .then(if (tag != null) Modifier.testTag(tag) else Modifier)
        .clip(RoundedCornerShape(16.dp)).background(c.surface).border(1.dp, c.stroke, RoundedCornerShape(16.dp))
        .clickable { onClick() }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(c.blue.copy(alpha = .25f), c.purple.copy(alpha = .25f)))),
            contentAlignment = Alignment.Center) { Icon(icon, null, tint = c.cyan, modifier = Modifier.size(22.dp)) }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = c.text)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        badge?.let { Spacer(Modifier.width(8.dp)); Pill(it, badgeColor ?: c.cyan) }
        Icon(Icons.Filled.ChevronRight, null, tint = c.muted)
    }
}

@Composable
fun ScreenHeader(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null) {
    val c = NX.c
    Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.testTag("back")) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar", tint = c.text) }
        }
        Column(Modifier.weight(1f).padding(start = if (onBack == null) 4.dp else 0.dp)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, color = c.text)
            subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.muted) }
        }
    }
}

@Composable
fun ToggleRow(title: String, subtitle: String, checked: Boolean, enabled: Boolean = true, tag: String? = null, onChange: (Boolean) -> Unit) {
    val c = NX.c
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp).alpha(if (enabled) 1f else .5f), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = c.text)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted)
        }
        Spacer(Modifier.width(12.dp))
        Switch(checked, onChange, enabled = enabled, modifier = if (tag != null) Modifier.testTag(tag) else Modifier,
            colors = SwitchDefaults.colors(checkedTrackColor = c.blue, checkedThumbColor = Color.White, uncheckedTrackColor = c.surfaceHigh, uncheckedBorderColor = c.stroke))
    }
}

@Composable
fun ProgressBlock(label: String, fraction: Float?, detail: String? = null) {
    val c = NX.c
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PulseDot(c.cyan); Spacer(Modifier.width(10.dp))
            Text(label, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
            detail?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = c.cyan) }
        }
        Spacer(Modifier.height(10.dp))
        if (fraction != null) LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape), color = c.blue, trackColor = c.surfaceHigh)
        else LinearProgressIndicator(modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape), color = c.blue, trackColor = c.surfaceHigh)
    }
}

@Composable
fun InfoBox(text: String, modifier: Modifier = Modifier, color: Color? = null) {
    val c = NX.c
    val col = color ?: c.cyan
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(col.copy(alpha = .08f)).border(1.dp, col.copy(alpha = .25f), RoundedCornerShape(14.dp)).padding(12.dp)) {
        Icon(Icons.Filled.Info, null, tint = col, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = c.text)
    }
}

@Composable
fun KeyValue(key: String, value: String?, modifier: Modifier = Modifier) {
    val c = NX.c
    Row(modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Text(key, style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.weight(.45f))
        Text(value ?: NA, style = MaterialTheme.typography.bodySmall, color = if (value == null) c.muted else c.text, modifier = Modifier.weight(.55f), textAlign = TextAlign.End)
    }
}

@Composable
fun EmptyState(title: String, text: String, modifier: Modifier = Modifier) {
    val c = NX.c
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = c.text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = c.muted, textAlign = TextAlign.Center)
    }
}

val ScreenPadding = PaddingValues(horizontal = 18.dp)

@Composable
fun Centered(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) { Box(Modifier.widthIn(max = 640.dp)) { content() } }
}

@Composable
fun rememberToggle(initial: Boolean = false) = remember { mutableStateOf(initial) }
