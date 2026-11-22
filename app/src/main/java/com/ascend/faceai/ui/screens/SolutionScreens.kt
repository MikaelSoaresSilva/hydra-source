package com.ascend.faceai.ui.screens

import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bedtime
import androidx.compose.material.icons.outlined.ContentCut
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Spa
import androidx.compose.material.icons.outlined.TouchApp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.analysis.Changeable
import com.ascend.faceai.analysis.Defect
import com.ascend.faceai.analysis.Evidence
import com.ascend.faceai.analysis.LinkType
import com.ascend.faceai.analysis.SolKind
import com.ascend.faceai.analysis.Solution
import com.ascend.faceai.analysis.Solutions
import com.ascend.faceai.data.AnalysisRepository
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.components.BeforeAfter
import com.ascend.faceai.ui.components.BulletList
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.SecondaryButton
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.components.Tier
import com.ascend.faceai.ui.components.TopBar
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun kindIcon(k: SolKind): ImageVector = when (k) {
    SolKind.MASSAGEM -> Icons.Outlined.TouchApp
    SolKind.SKINCARE -> Icons.Outlined.Spa
    SolKind.GROOMING -> Icons.Outlined.ContentCut
    SolKind.HABITO -> Icons.Outlined.Bedtime
    SolKind.TREINO -> Icons.Outlined.FitnessCenter
    SolKind.PROFISSIONAL -> Icons.Outlined.LocalHospital
}

private fun sevColor(s: Int) = when (s) { 3 -> Ac.Bad; 2 -> Ac.Warn; else -> Ac.Cyan }
private fun changeColor(c: Changeable) = when (c) { Changeable.SIM -> Ac.Good; Changeable.PARCIAL -> Ac.Warn; Changeable.NAO -> Ac.Metal }
private fun evColor(e: Evidence) = when (e) { Evidence.FORTE -> Ac.Good; Evidence.MODERADA -> Ac.Cyan; Evidence.FRACA -> Ac.Warn }

@Composable
fun DefectCard(d: Defect, startExpanded: Boolean = false, modifier: Modifier = Modifier) {
    var open by remember(d.id) { mutableStateOf(startExpanded) }
    GlassCard(modifier.fillMaxWidth().animateContentSize().testTag("defect_${d.id}"), onClick = { open = !open }, padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(RoundedCornerShape(50)).background(sevColor(d.severity)))
            Spacer(Modifier.width(10.dp))
            Text(d.title, style = MaterialTheme.typography.titleMedium, color = Ac.TextHi, modifier = Modifier.weight(1f))
            Icon(if (open) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null, tint = Ac.TextMid)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Tag(d.severityLabel, sevColor(d.severity)); Tag(d.changeable.label, changeColor(d.changeable))
        }
        if (!open) {
            Text("${d.solutions.size} soluções · toque para ver o passo a passo e os links", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow, modifier = Modifier.padding(top = 8.dp))
            return@GlassCard
        }
        Spacer(Modifier.height(10.dp))
        Text(d.why, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi)
        if (d.measured.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text("Medido na sua foto:\n" + d.measured, style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
        }
        d.honestNote?.let {
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Ac.Warn.copy(alpha = 0.08f)).border(1.dp, Ac.Warn.copy(alpha = 0.3f), RoundedCornerShape(12.dp)).padding(10.dp)) {
                Text("Sinceridade: $it", style = MaterialTheme.typography.bodySmall, color = Ac.TextHi)
            }
        }
        d.solutions.forEach { s -> Spacer(Modifier.height(12.dp)); SolutionBlock(s) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SolutionBlock(s: Solution) {
    val uri = LocalUriHandler.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Ac.Bg.copy(alpha = 0.6f)).border(1.dp, Ac.Stroke, RoundedCornerShape(16.dp)).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(kindIcon(s.kind), null, tint = Ac.Cyan, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Eyebrow(s.kind.label, Ac.Cyan)
                Text(s.title, style = MaterialTheme.typography.titleSmall, color = Ac.TextHi)
            }
        }
        Spacer(Modifier.height(6.dp))
        Tag(s.evidence.label, evColor(s.evidence))
        Spacer(Modifier.height(8.dp))
        Eyebrow("O que fazer")
        s.steps.forEachIndexed { i, st ->
            Row(Modifier.padding(top = 4.dp)) {
                Text("${i + 1}.", style = MaterialTheme.typography.bodySmall, color = Ac.Blue, modifier = Modifier.width(20.dp))
                Text(st, style = MaterialTheme.typography.bodySmall, color = Ac.TextHi)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text("Frequência: ${s.frequency}\nResultado em: ${s.timeToResult}\nCusto: ${s.cost}", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
        if (s.cautions.isNotBlank() && s.cautions != "—") Text("Cuidados: ${s.cautions}", style = MaterialTheme.typography.bodySmall, color = Ac.Warn, modifier = Modifier.padding(top = 4.dp))
        if (s.links.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                s.links.forEach { l ->
                    val icon = when (l.type) { LinkType.VIDEO -> Icons.Outlined.PlayCircle; LinkType.PRODUTO -> Icons.Outlined.ShoppingCart; LinkType.GUIA -> Icons.Outlined.MenuBook }
                    val col = when (l.type) { LinkType.VIDEO -> Color(0xFFFF5A5A); LinkType.PRODUTO -> Ac.Good; LinkType.GUIA -> Ac.Blue }
                    Row(
                        Modifier.clip(RoundedCornerShape(50)).background(col.copy(alpha = 0.12f)).border(1.dp, col.copy(alpha = 0.4f), RoundedCornerShape(50))
                            .clickable { runCatching { uri.openUri(l.url) } }.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(icon, null, tint = col, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(l.label, style = MaterialTheme.typography.labelMedium, color = Ac.TextHi)
                    }
                }
            }
        }
    }
}

@Composable
fun SolutionsScreen(nav: NavHostController, id: String) {
    val r = rememberReport(id)
    val defects = remember(r) { r?.let { Solutions.forReport(it) } }
    var filter by remember { mutableStateOf<SolKind?>(null) }
    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar("Defeitos e soluções", { nav.popBackStack() })
        if (defects == null) { Text("Carregando…", color = Ac.TextMid, modifier = Modifier.padding(20.dp)); return@Column }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).testTag("solutions")) {
            val fixable = defects.count { it.changeable != Changeable.NAO }
            GlassCard(Modifier.fillMaxWidth(), highlight = true) {
                Eyebrow("Avaliação sincera")
                Text(if (defects.isEmpty()) "Nenhuma medição ficou abaixo do limite. Mantenha a rotina e refaça a análise em 30 dias."
                    else "${defects.size} pontos a melhorar · $fixable dá para mudar com cuidados",
                    style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
                Spacer(Modifier.height(6.dp))
                Text("Ordem: do mais urgente ao mais leve. Cada solução diz o que fazer, com que frequência, em quanto tempo aparece e a força da evidência. Os links abrem vídeos no YouTube e produtos no Mercado Livre/Amazon já buscados pelo nome.",
                    style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                (listOf<SolKind?>(null) + listOf(SolKind.MASSAGEM, SolKind.SKINCARE, SolKind.GROOMING)).forEach { k ->
                    val sel = filter == k
                    Box(Modifier.clip(RoundedCornerShape(50)).background(if (sel) Ac.Blue.copy(0.3f) else Ac.Surface).clickable { filter = k }.padding(horizontal = 11.dp, vertical = 7.dp)) {
                        Text(k?.label?.substringBefore(",")?.substringBefore(" facial") ?: "Tudo", style = MaterialTheme.typography.labelMedium, color = if (sel) Ac.TextHi else Ac.TextMid)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            val shown = defects.mapNotNull { d -> if (filter == null) d else d.solutions.filter { it.kind == filter }.takeIf { it.isNotEmpty() }?.let { d.copy(solutions = it) } }
            if (shown.isEmpty() && defects.isNotEmpty()) Text("Nenhuma solução desse tipo para os seus pontos.", color = Ac.TextLow, style = MaterialTheme.typography.bodySmall)
            shown.forEachIndexed { i, d -> DefectCard(d, startExpanded = i == 0); Spacer(Modifier.height(10.dp)) }
            Spacer(Modifier.height(8.dp))
            PrimaryButton("Ver como ficarei em 90 dias", Modifier.fillMaxWidth().testTag("open_projection")) { nav.navigate(com.ascend.faceai.ui.Routes.projection(id)) }
            Spacer(Modifier.height(10.dp))
            Text("O app não recomenda remédios, hormônios, procedimentos ou cirurgias. Quando o caso pede, ele indica o profissional certo.",
                style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            Spacer(Modifier.height(28.dp))
        }
    }
}

private const val AI_90 = "Mostre esta mesma pessoa daqui a 90 dias seguindo uma rotina de pele, sono e grooming: pele mais uniforme, menos espinhas e vermelhidão, olheiras mais leves, contorno do rosto um pouco mais definido. Mantenha EXATAMENTE a identidade, o formato dos olhos, nariz, boca, ossos, cabelo, roupas, fundo, luz e expressão. Fotorrealista, sem filtro de beleza."

@Composable
fun ProjectionScreen(nav: NavHostController, id: String) {
    val c = LocalContainer.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val r = rememberReport(id)
    val s by c.settings.flow.collectAsState(initial = AppSettings())
    val aiOn = s.aiConfigured && s.externalAiConsent
    var fatLoss by remember { mutableStateOf(true) }
    var out by remember { mutableStateOf<AnalysisRepository.ProjectionOut?>(null) }
    var aiImg by remember { mutableStateOf<Bitmap?>(null) }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(id, fatLoss) {
        busy = true; msg = null
        runCatching { c.repo.project90(id, fatLoss) }.onSuccess { out = it }.onFailure { msg = it.message ?: "Falha ao gerar a projeção." }
        busy = false
    }

    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar("Você em 90 dias", { nav.popBackStack() })
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).testTag("projection")) {
            val o = out
            if (o == null) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text(if (busy) "Gerando sua projeção no aparelho…" else (msg ?: "—"), color = if (msg != null) Ac.Bad else Ac.TextMid)
                }
                return@Column
            }
            BeforeAfter(o.before, aiImg ?: o.after, leftLabel = "Hoje", rightLabel = if (aiImg != null) "90 dias (IA)" else "90 dias")
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Ac.Warn.copy(alpha = 0.08f)).padding(10.dp)) {
                Text("Simulação ilustrativa feita no seu celular a partir das suas medições — mostra um resultado provável se você seguir o plano, não uma garantia. Ossos, olhos, nariz e cabelo não são alterados.",
                    style = MaterialTheme.typography.bodySmall, color = Ac.TextHi)
            }
            Spacer(Modifier.height(12.dp))
            GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Incluir perda de gordura", style = MaterialTheme.typography.titleSmall, color = Ac.TextHi)
                        Text("Ligue se você vai seguir dieta e treino (afina o contorno do rosto).", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
                    }
                    Switch(fatLoss, { if (!busy) { fatLoss = it; aiImg = null } }, enabled = !busy, modifier = Modifier.testTag("fat_toggle"),
                        colors = SwitchDefaults.colors(checkedTrackColor = Ac.Blue))
                }
            }
            Spacer(Modifier.height(12.dp))
            if (o.scoresBefore.isNotEmpty() && o.scoresAfter.isNotEmpty()) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Eyebrow("Notas medidas pelo app nas duas fotos")
                    Spacer(Modifier.height(6.dp))
                    listOf("geral" to "Geral", "pele" to "Qualidade da pele", "mandibula" to "Mandíbula", "macas" to "Maçãs do rosto", "masculinidade" to "Masculinidade", "olhos" to "Olhos").forEach { (k, label) ->
                        val a = o.scoresBefore[k]; val b = o.scoresAfter[k]
                        if (a != null && b != null) Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(label, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi, modifier = Modifier.weight(1f))
                            Text("$a", style = MaterialTheme.typography.titleMedium, color = Tier.color(a))
                            Text("  →  ", color = Ac.TextLow)
                            Text("$b", style = MaterialTheme.typography.titleMedium, color = Tier.color(b))
                            Text(if (b - a >= 0) "  +${b - a}" else "  ${b - a}", style = MaterialTheme.typography.labelMedium, color = if (b >= a) Ac.Good else Ac.Bad)
                        }
                    }
                    Text("As duas fotos passam pelo mesmo processo de análise; a diferença mostra só o efeito do que foi simulado.",
                        style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
                }
                Spacer(Modifier.height(12.dp))
            }
            GlassCard(Modifier.fillMaxWidth()) {
                Eyebrow("O que mudou na simulação")
                Spacer(Modifier.height(6.dp))
                BulletList(o.changes, Ac.TextHi, Ac.Cyan)
            }
            Spacer(Modifier.height(12.dp))
            PrimaryButton("Ver o que fazer para chegar lá", Modifier.fillMaxWidth()) { nav.navigate(com.ascend.faceai.ui.Routes.solutions(id)) }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SecondaryButton("Compartilhar imagem", Modifier.weight(1f).testTag("share_projection")) {
                    scope.launch {
                        msg = runCatching {
                            val f = withContext(Dispatchers.IO) { c.repo.exportProjection(o.before, aiImg ?: o.after) }
                            val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
                            ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                                type = "image/jpeg"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }, "Compartilhar projeção"))
                            null
                        }.getOrElse { "Falha ao compartilhar: ${it.message}" }
                    }
                }
                SecondaryButton(if (busy) "Gerando…" else "Versão por IA", Modifier.weight(1f), enabled = aiOn && !busy) {
                    busy = true; msg = null
                    scope.launch {
                        runCatching { c.ai.simulate(o.before, AI_90) }.onSuccess { aiImg = it }.onFailure { msg = it.message }
                        busy = false
                    }
                }
            }
            if (!aiOn) Text("Versão por IA (mais realista, inclui cabelo e barba) fica disponível ao configurar o backend em Ajustes. A projeção acima funciona offline.",
                style = MaterialTheme.typography.bodySmall, color = Ac.TextLow, modifier = Modifier.padding(top = 6.dp))
            msg?.let { Text(it, color = Ac.Bad, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
            Spacer(Modifier.height(28.dp))
        }
    }
}
