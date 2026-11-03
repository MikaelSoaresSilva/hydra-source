package com.ascend.faceai.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.analysis.FaceReport
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.EmptyState
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.LineChart
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.RadarChart
import com.ascend.faceai.ui.components.SecondaryButton
import com.ascend.faceai.ui.components.TopBar
import com.ascend.faceai.ui.theme.Ac
import java.util.Date

@Composable
fun HistoryScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val reports by c.repo.reports.collectAsState(initial = null)
    val list = reports ?: emptyList()
    var metric by remember { mutableStateOf("geral") }
    val selected = remember { mutableStateListOf<String>() }
    var compareMode by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
        Spacer(Modifier.height(14.dp))
        Eyebrow("Histórico", Ac.Cyan)
        Text("Sua evolução", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
        Spacer(Modifier.height(14.dp))
        if (reports != null && list.isEmpty()) {
            EmptyState("Nenhuma análise salva", "Suas análises aparecerão aqui em ordem cronológica, com gráficos de evolução.", "Fazer análise") { nav.navigate(Routes.SCAN) }
            return@Column
        }
        val asc = list.sortedBy { it.createdAt }
        GlassCard(Modifier.fillMaxWidth()) {
            Eyebrow("Histórico de pontuações")
            Spacer(Modifier.height(8.dp))
            val options = listOf("geral" to "Geral") + (list.firstOrNull()?.categories?.map { it.id to it.name.substringBefore(" ") } ?: emptyList())
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                options.forEach { (k, label) ->
                    Box(Modifier.clip(RoundedCornerShape(50)).background(if (metric == k) Ac.Blue.copy(0.25f) else Ac.SurfaceHi).clickable { metric = k }.padding(horizontal = 12.dp, vertical = 6.dp)) {
                        Text(label, style = MaterialTheme.typography.labelMedium, color = if (metric == k) Ac.TextHi else Ac.TextMid)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            val points = asc.mapNotNull { r -> (if (metric == "geral") r.overall else r.category(metric)?.score)?.let { it to r } }
            LineChart(points.map { it.first }, points.map { ptShort.format(Date(it.second.createdAt)) })
        }
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Análises (${list.size})", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi, modifier = Modifier.weight(1f))
            if (list.size >= 2) SecondaryButton(if (compareMode) "Cancelar" else "Comparar datas", Modifier.width(150.dp).testTag("compare_mode")) { compareMode = !compareMode; selected.clear() }
        }
        if (compareMode) Text("Selecione duas análises.", style = MaterialTheme.typography.bodySmall, color = Ac.Cyan)
        Spacer(Modifier.height(10.dp))
        list.forEach { r ->
            HistoryRow(r, compareMode && r.id in selected) {
                if (compareMode) {
                    if (r.id in selected) selected.remove(r.id) else if (selected.size < 2) selected.add(r.id)
                } else nav.navigate(Routes.report(r.id))
            }
            Spacer(Modifier.height(8.dp))
        }
        if (compareMode && selected.size == 2) {
            val (a, b) = selected.map { id -> list.first { it.id == id } }.sortedBy { it.createdAt }.map { it.id }
            PrimaryButton("Comparar", Modifier.fillMaxWidth().testTag("compare_go")) { nav.navigate(Routes.compare(a, b)); compareMode = false; selected.clear() }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun HistoryRow(r: FaceReport, selected: Boolean, onClick: () -> Unit) {
    val photo = rememberPhoto(r.id)
    GlassCard(Modifier.fillMaxWidth().then(if (selected) Modifier.border(2.dp, Ac.Blue, RoundedCornerShape(22.dp)) else Modifier), onClick = onClick, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).background(Ac.SurfaceHi)) {
                photo?.let { Image(it.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(ptDate.format(Date(r.createdAt)), style = MaterialTheme.typography.titleMedium, color = Ac.TextHi)
                Text("Rosto ${r.faceShape.lowercase()} · potencial +${r.potential} · conf. ${(r.overallConfidence * 100).toInt()}%", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            }
            Text("${r.overall}", style = MaterialTheme.typography.headlineSmall, color = Ac.scoreColor(r.overall))
        }
    }
}

@Composable
fun CompareScreen(nav: NavHostController, aId: String, bId: String) {
    val a = rememberReport(aId); val b = rememberReport(bId)
    val pa = rememberPhoto(aId); val pb = rememberPhoto(bId)
    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar("Comparação", { nav.popBackStack() })
        if (a == null || b == null) return@Column
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(a to pa, b to pb).forEach { (r, p) ->
                    Column(Modifier.weight(1f)) {
                        Box(Modifier.fillMaxWidth().aspectRatio(0.78f).clip(RoundedCornerShape(18.dp)).background(Ac.SurfaceHi)) {
                            p?.let { Image(it.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                        }
                        Text(ptDate.format(Date(r.createdAt)), style = MaterialTheme.typography.titleSmall, color = Ac.TextHi, modifier = Modifier.padding(top = 6.dp))
                        Text("Geral ${r.overall}", style = MaterialTheme.typography.headlineSmall, color = Ac.scoreColor(r.overall))
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Sobreposição (cinza = data antiga)")
                RadarChart(b.categories, Modifier.fillMaxWidth().padding(6.dp), compare = a.categories)
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Diferença por categoria")
                Spacer(Modifier.height(6.dp))
                DeltaRow("Nota geral", a.overall, b.overall)
                b.categories.forEach { cat -> DeltaRow(cat.name, a.category(cat.id)?.score, cat.score) }
                Spacer(Modifier.height(8.dp))
                Text("Variações de até ±3 pontos podem vir de diferenças de luz, distância e ângulo entre as fotos.", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun DeltaRow(label: String, a: Int?, b: Int?) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi, modifier = Modifier.weight(1f))
        Text("${a ?: "—"} → ${b ?: "—"}", style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid)
        Spacer(Modifier.width(10.dp))
        val d = if (a != null && b != null) b - a else null
        Text(d?.let { if (it > 0) "+$it" else "$it" } ?: "", style = MaterialTheme.typography.titleSmall,
            color = when { d == null -> Ac.TextLow; d > 3 -> Ac.Good; d < -3 -> Ac.Bad; else -> Ac.Metal }, modifier = Modifier.width(36.dp))
    }
}
