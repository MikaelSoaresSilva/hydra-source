package com.ascend.faceai.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.analysis.CategoryResult
import com.ascend.faceai.analysis.FaceReport
import com.ascend.faceai.data.PdfExporter
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.BulletList
import com.ascend.faceai.ui.components.ConfidenceMeter
import com.ascend.faceai.ui.components.DangerButton
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.FaceMap
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.RadarChart
import com.ascend.faceai.ui.components.ScoreBar
import com.ascend.faceai.ui.components.ScoreRing
import com.ascend.faceai.ui.components.SecondaryButton
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.components.TopBar
import com.ascend.faceai.ui.goTab
import com.ascend.faceai.ui.onMain
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Date

@Composable
fun rememberReport(id: String): FaceReport? {
    val c = LocalContainer.current
    val r by produceState<FaceReport?>(null, id) { value = c.repo.get(id) }
    return r
}

@Composable
fun ReportScreen(nav: NavHostController, id: String) {
    val c = LocalContainer.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val r = rememberReport(id)
    val photo = rememberPhoto(id)
    var confirmDelete by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar("Relatório", { nav.popBackStack() })
        if (r == null) { Text("Carregando…", color = Ac.TextMid, modifier = Modifier.padding(20.dp)); return@Column }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).testTag("report")) {
            Eyebrow(ptDate.format(Date(r.createdAt)) + " · metodologia v${r.methodologyVersion}")
            Spacer(Modifier.height(10.dp))
            if (photo != null) {
                FaceMap(photo, r.frontalLandmarks, r.categories, onRegion = { nav.navigate(Routes.category(id, it.id)) }, modifier = Modifier.fillMaxWidth())
                Text("Toque nos pontos coloridos para ver cada região.", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow, modifier = Modifier.padding(top = 6.dp))
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth(), highlight = true) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ScoreRing(r.overall, 128.dp, 11.dp, "APRESENTAÇÃO")
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Eyebrow("Potencial de evolução")
                        Text("+${r.potential} pts", style = MaterialTheme.typography.headlineMedium, color = Ac.Violet)
                        Text("margem em fatores modificáveis", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
                        Spacer(Modifier.height(8.dp))
                        Tag("Rosto ${r.faceShape.lowercase()}", Ac.Cyan)
                    }
                }
                Spacer(Modifier.height(12.dp))
                ConfidenceMeter(r.overallConfidence)
                Spacer(Modifier.height(10.dp))
                Text(r.summary, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi)
                Spacer(Modifier.height(8.dp))
                Text(r.faceShapeExplanation, style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Harmonia facial — gráfico")
                RadarChart(r.categories, Modifier.fillMaxWidth().padding(6.dp))
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                GlassCard(Modifier.weight(1f), padding = 14.dp) {
                    Eyebrow("Pontos fortes", Ac.Good)
                    Spacer(Modifier.height(6.dp))
                    if (r.strengths.isEmpty()) Text("—", color = Ac.TextLow) else BulletList(r.strengths, Ac.TextHi, Ac.Good)
                }
                GlassCard(Modifier.weight(1f), padding = 14.dp) {
                    Eyebrow("Para melhorar", Ac.Warn)
                    Spacer(Modifier.height(6.dp))
                    if (r.improvements.isEmpty()) Text("—", color = Ac.TextLow) else BulletList(r.improvements, Ac.TextHi, Ac.Warn)
                }
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Ranking das categorias")
                Spacer(Modifier.height(4.dp))
                r.categories.sortedByDescending { it.score ?: -1 }.forEach { cat ->
                    ScoreBar(cat.name, cat.score, cat.confidence, Modifier.testTag("cat_${cat.id}")) { nav.navigate(Routes.category(id, cat.id)) }
                }
                Text("Toque numa categoria para ver métricas, justificativa e limitações.", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("O que dá para mudar")
                Spacer(Modifier.height(6.dp))
                ModGroup("Pouco modificáveis", r.lowModifiable, Ac.Metal)
                ModGroup("Cuidados pessoais", r.selfCareModifiable, Ac.Good)
                ModGroup("Penteado e grooming", r.groomingModifiable, Ac.Cyan)
                ModGroup("Dependem de avaliação profissional", r.professionalDependent, Ac.Warn)
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Fotos usadas")
                r.photos.forEach { p ->
                    Text("${p.type.label}: ${if (p.used) "usada" else "não usada"} · qualidade ${(p.quality.qualityScore * 100).toInt()}%", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
                }
                if (!r.profileAvailable) Text("Sem foto de perfil aprovada: projeção do perfil não avaliada.", style = MaterialTheme.typography.bodySmall, color = Ac.Warn)
            }
            Spacer(Modifier.height(14.dp))
            Text("Notas são estimativas visuais baseadas em proporções de referência — não definem o seu valor nem são verdade universal sobre beleza.",
                style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            Spacer(Modifier.height(14.dp))
            PrimaryButton("Ver plano de evolução", Modifier.fillMaxWidth()) { nav.goTab(Routes.PLAN) }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SecondaryButton("Exportar PDF", Modifier.weight(1f).testTag("export_pdf")) {
                    scope.launch {
                        status = runCatching {
                            val f = withContext(Dispatchers.IO) { PdfExporter.export(ctx, r, photo) }
                            val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
                            ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                                type = "application/pdf"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }, "Compartilhar relatório"))
                            "PDF gerado: ${f.name}"
                        }.getOrElse { "Falha ao gerar PDF: ${it.message}" }
                    }
                }
                SecondaryButton("Perguntar à IA", Modifier.weight(1f)) { nav.goTab(Routes.ASSISTANT) }
            }
            status?.let { Text(it, color = Ac.Cyan, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
            Spacer(Modifier.height(10.dp))
            DangerButton("Excluir esta análise e fotos", Modifier.fillMaxWidth()) { confirmDelete = true }
            Spacer(Modifier.height(28.dp))
        }
    }
    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false },
        title = { Text("Excluir análise?") },
        text = { Text("O relatório, o plano dessa análise e as fotos criptografadas serão apagados deste aparelho. Não dá para desfazer.") },
        confirmButton = { TextButton(onClick = { scope.launch { c.repo.delete(id); onMain { confirmDelete = false; nav.popBackStack() } } }) { Text("Excluir", color = Ac.Bad) } },
        dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancelar") } },
        containerColor = Ac.SurfaceHi
    )
}

@Composable
private fun ModGroup(title: String, items: List<String>, color: androidx.compose.ui.graphics.Color) {
    if (items.isEmpty()) return
    Text(title, style = MaterialTheme.typography.titleSmall, color = color, modifier = Modifier.padding(top = 6.dp))
    Text(items.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
}

@Composable
fun CategoryScreen(nav: NavHostController, id: String, catId: String) {
    val r = rememberReport(id)
    val cat: CategoryResult? = r?.category(catId)
    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar(cat?.name ?: "Categoria", { nav.popBackStack() })
        if (cat == null) return@Column
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
            GlassCard(Modifier.fillMaxWidth(), highlight = true) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ScoreRing(cat.score, 104.dp, 9.dp, "NOTA")
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(cat.name.uppercase(), style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
                        Spacer(Modifier.height(6.dp))
                        ConfidenceMeter(cat.confidence)
                        Spacer(Modifier.height(6.dp))
                        cat.modifiability.forEach { Tag(it.label, Ac.Cyan, Modifier.padding(bottom = 4.dp)) }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Eyebrow("Análise")
                Text(cat.justification, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi)
            }
            Spacer(Modifier.height(12.dp))
            if (cat.contributors.isNotEmpty()) Section("O que mais pesou na nota", cat.contributors, Ac.Blue)
            if (cat.strengths.isNotEmpty()) Section("Ponto forte", cat.strengths, Ac.Good)
            if (cat.opportunities.isNotEmpty()) Section("Oportunidade", cat.opportunities, Ac.Warn)
            if (cat.recommendations.isNotEmpty()) Section("Recomendação", cat.recommendations, Ac.Violet)
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("Medições")
                Spacer(Modifier.height(6.dp))
                cat.metrics.forEach { m ->
                    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Text(m.label, style = MaterialTheme.typography.titleSmall, color = Ac.TextHi)
                            Text("Medido: ${m.display} · Referência: ${m.reference}", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
                            if (m.note.isNotBlank()) Text(m.note, style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
                        }
                        Box(Modifier.padding(start = 8.dp)) {
                            Text(m.score?.toInt()?.toString() ?: "desc.", style = MaterialTheme.typography.titleMedium, color = Ac.scoreColor(m.score?.toInt()))
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Section("Limitações da medição", cat.limitations, Ac.Metal)
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Section(title: String, items: List<String>, color: androidx.compose.ui.graphics.Color) {
    GlassCard(Modifier.fillMaxWidth()) {
        Eyebrow(title, color)
        Spacer(Modifier.height(6.dp))
        BulletList(items, Ac.TextHi, color)
    }
    Spacer(Modifier.height(12.dp))
}
