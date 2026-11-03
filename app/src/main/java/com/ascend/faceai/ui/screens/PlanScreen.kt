package com.ascend.faceai.ui.screens

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.analysis.PlanGenerator
import com.ascend.faceai.analysis.PlanTask
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.EmptyState
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.util.Date

@Composable
fun PlanScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val scope = rememberCoroutineScope()
    val reports by c.repo.reports.collectAsState(initial = null)
    val latest = reports?.firstOrNull()
    var phase by remember { mutableIntStateOf(7) }
    val plan = remember(latest?.id) { latest?.let { PlanGenerator.generate(it) } }
    val state by remember(latest?.id) { latest?.let { c.repo.planState(it.id) } ?: flowOf(emptyList()) }.collectAsState(initial = emptyList())
    val done = state.filter { it.done }.map { it.taskKey }.toSet()

    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding()) {
        Column(Modifier.padding(horizontal = 18.dp, vertical = 14.dp)) {
            Eyebrow("Plano personalizado", Ac.Cyan)
            Text("Glow up em 90 dias", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
        }
        if (reports != null && latest == null) {
            Box(Modifier.padding(18.dp)) { EmptyState("Sem plano ainda", "O plano é montado a partir das suas medições. Faça uma análise primeiro.", "Fazer análise") { nav.navigate(Routes.SCAN) } }
            return@Column
        }
        if (plan == null) return@Column
        Text("Baseado na análise de ${ptDate.format(Date(latest!!.createdAt))}. Cada tarefa existe por causa de uma medição sua.",
            style = MaterialTheme.typography.bodySmall, color = Ac.TextMid, modifier = Modifier.padding(horizontal = 18.dp))
        val total = plan.tasks.size; val completed = plan.tasks.count { it.key in done }
        Column(Modifier.padding(18.dp)) {
            LinearProgressIndicator(progress = { if (total == 0) 0f else completed / total.toFloat() }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = Ac.Blue, trackColor = Ac.SurfaceHi)
            Text("$completed de $total tarefas concluídas", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid, modifier = Modifier.padding(top = 6.dp))
        }
        Row(Modifier.padding(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(7, 30, 60, 90).forEach { p ->
                Box(Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).background(if (p == phase) Ac.Blue.copy(alpha = 0.25f) else Ac.Surface)
                    .clickable { phase = p }.padding(vertical = 10.dp).testTag("phase_$p"), contentAlignment = Alignment.Center) {
                    Text("$p dias", style = MaterialTheme.typography.titleSmall, color = if (p == phase) Ac.TextHi else Ac.TextMid)
                }
            }
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(plan.phase(phase), key = { it.key }) { t ->
                TaskCard(t, t.key in done) { v -> scope.launch { c.repo.setTask(latest.id, t.key, v) } }
            }
        }
    }
}

@Composable
private fun TaskCard(t: PlanTask, done: Boolean, onToggle: (Boolean) -> Unit) {
    var open by remember { mutableStateOf(false) }
    GlassCard(Modifier.fillMaxWidth().animateContentSize(), onClick = { open = !open }, padding = 14.dp, highlight = t.priority == "Alta" && !done) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(done, onToggle, colors = CheckboxDefaults.colors(checkedColor = Ac.Good, uncheckedColor = Ac.Metal))
            Column(Modifier.weight(1f)) {
                Text(t.title, style = MaterialTheme.typography.titleMedium, color = if (done) Ac.TextLow else Ac.TextHi)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                    Tag(t.priority, when (t.priority) { "Alta" -> Ac.Bad; "Média" -> Ac.Warn; else -> Ac.Metal })
                    Tag(t.difficulty, Ac.Metal)
                }
            }
        }
        if (open) {
            Spacer(Modifier.height(10.dp))
            Detail("Descrição", t.description)
            Detail("Objetivo", t.objective)
            Detail("Frequência", t.frequency)
            Detail("Custo estimado", t.cost)
            Detail("Cuidados e contraindicações", t.cautions)
        } else Text("Toque para ver detalhes", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow, modifier = Modifier.padding(start = 48.dp))
    }
}

@Composable
private fun Detail(label: String, text: String) {
    Text(label, style = MaterialTheme.typography.labelMedium, color = Ac.Cyan, modifier = Modifier.padding(top = 6.dp))
    Text(text, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi)
}
