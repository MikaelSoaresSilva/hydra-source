package com.ascend.faceai.ui.screens

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.analysis.FaceReport
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.ConfidenceMeter
import com.ascend.faceai.ui.components.EmptyState
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.LineChart
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.RadarChart
import com.ascend.faceai.ui.components.ScoreRing
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.goTab
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

val ptDate = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))
val ptShort = SimpleDateFormat("dd/MM", Locale("pt", "BR"))

@Composable
fun rememberPhoto(id: String?): Bitmap? {
    val c = LocalContainer.current
    val bmp by produceState<Bitmap?>(null, id) { value = id?.let { withContext(Dispatchers.IO) { c.repo.photo(it) } } }
    return bmp
}

@Composable
fun HomeScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val reports by c.repo.reports.collectAsState(initial = null)
    val settings by c.settings.flow.collectAsState(initial = AppSettings())
    val list = reports ?: emptyList()
    val latest = list.firstOrNull()
    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Eyebrow("Ascend Face AI", Ac.Cyan)
                Text("Seu painel", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
            }
            Tag(if (settings.loggedIn) "Nuvem: conectado" else "Modo local", if (settings.loggedIn) Ac.Good else Ac.Metal)
        }
        Spacer(Modifier.height(16.dp))
        if (reports != null && latest == null) {
            EmptyState("Faça sua primeira análise",
                "Tire uma foto frontal (e, se quiser, de 45° e de perfil). A análise leva poucos segundos e acontece toda no seu celular.",
                "Iniciar análise facial") { c.repo.let { nav.navigate(Routes.SCAN) } }
        }
        if (latest != null) {
            LatestCard(latest) { nav.navigate(Routes.report(latest.id)) }
            Spacer(Modifier.height(14.dp))
            PrimaryButton("Nova análise", Modifier.fillMaxWidth().testTag("home_scan")) { nav.navigate(Routes.SCAN) }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                QuickAction("Plano", Icons.Outlined.Checklist, Modifier.weight(1f)) { nav.goTab(Routes.PLAN) }
                QuickAction("Simulador", Icons.Outlined.Face, Modifier.weight(1f)) { nav.navigate(Routes.SIMULATOR) }
                QuickAction("Ascend AI", Icons.Outlined.AutoAwesome, Modifier.weight(1f)) { nav.goTab(Routes.ASSISTANT) }
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Harmonia por categoria")
                RadarChart(latest.categories, Modifier.fillMaxWidth().padding(8.dp), compare = list.getOrNull(1)?.categories)
                if (list.size > 1) Text("Linha cinza: análise anterior (${ptDate.format(Date(list[1].createdAt))})", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Evolução da nota geral")
                Spacer(Modifier.height(10.dp))
                val asc = list.sortedBy { it.createdAt }
                LineChart(asc.map { it.overall }, asc.map { ptShort.format(Date(it.createdAt)) })
            }
            Spacer(Modifier.height(14.dp))
            val first = list.minBy { it.createdAt }
            val days = TimeUnit.MILLISECONDS.toDays(System.currentTimeMillis() - first.createdAt)
            val next = listOf(7, 30, 60, 90).firstOrNull { it > days }
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Próxima reavaliação")
                Spacer(Modifier.height(6.dp))
                Text(if (next != null) "Dia $next do plano — em ${next - days} dia(s)" else "Ciclo de 90 dias concluído. Faça uma nova análise e gere um novo plano.",
                    style = MaterialTheme.typography.titleMedium, color = Ac.TextHi)
                Text("Use sempre a mesma luz e distância para comparar de forma justa.", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun LatestCard(r: FaceReport, onClick: () -> Unit) {
    val photo = rememberPhoto(r.id)
    GlassCard(Modifier.fillMaxWidth(), onClick = onClick, highlight = true) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(96.dp).clip(RoundedCornerShape(18.dp)).background(Ac.SurfaceHi)) {
                photo?.let { Image(it.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Eyebrow("Última análise · ${ptDate.format(Date(r.createdAt))}")
                Spacer(Modifier.height(4.dp))
                Text("Rosto ${r.faceShape.lowercase()}", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
                Spacer(Modifier.height(4.dp))
                Tag("Potencial +${r.potential}", Ac.Violet)
            }
            ScoreRing(r.overall, 86.dp, 8.dp, "GERAL")
        }
        Spacer(Modifier.height(12.dp))
        ConfidenceMeter(r.overallConfidence)
        Spacer(Modifier.height(8.dp))
        Text(r.summary, style = MaterialTheme.typography.bodySmall, color = Ac.TextMid, maxLines = 4)
    }
}

@Composable
private fun QuickAction(label: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    GlassCard(modifier, onClick = onClick, padding = 14.dp) {
        Icon(icon, null, tint = Ac.Cyan)
        Spacer(Modifier.height(8.dp))
        Text(label, style = MaterialTheme.typography.titleSmall, color = Ac.TextHi)
    }
}

@Suppress("unused")
private val camIcon = Icons.Outlined.CameraAlt
