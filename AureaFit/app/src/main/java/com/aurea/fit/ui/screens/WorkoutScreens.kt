package com.aurea.fit.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.aurea.fit.data.Repository
import com.aurea.fit.data.today
import com.aurea.fit.domain.*
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*
import kotlinx.coroutines.delay
import java.time.LocalDate

/** 7. Ficha de treinamento. */
@Composable
fun WorkoutPlanScreen(vm: AppViewModel, nav: (String) -> Unit) {
    val plan by vm.workoutPlan.collectAsState()
    val profile by vm.profile.collectAsState()
    val sessions by vm.sessions.collectAsState()
    val todayW = LocalDate.now().dayOfWeek.value
    val wp = plan
    var selected by rememberSaveable { mutableIntStateOf(-1) }
    var swapFor by remember { mutableStateOf<Pair<Int, PlannedExercise>?>(null) }

    Scaffold(topBar = {
        AureaTopBar("Meu treino", actions = {
            IconButton(onClick = { nav("library") }) { Icon(Icons.Default.MenuBook, "Biblioteca de exercícios") }
            IconButton(onClick = { nav("history") }) { Icon(Icons.Default.History, "Planos anteriores") }
        })
    }) { pad ->
        if (wp == null || profile == null) {
            Box(Modifier.padding(pad)) { EmptyState("Nenhum plano ainda", "Responda o questionário para gerar sua ficha.", "Responder", { nav("editProfile") }) }
            return@Scaffold
        }
        val dayIdx = if (selected >= 0) selected.coerceAtMost(wp.days.lastIndex) else (wp.days.indexOfFirst { it.weekday == todayW }.takeIf { it >= 0 } ?: 0)
        val day = wp.days[dayIdx]
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(wp.days) { i, d ->
                        FilterChip(
                            selected = i == dayIdx, onClick = { selected = i },
                            label = { Text("${WEEKDAY_SHORT[d.weekday]} • ${d.title}") },
                            leadingIcon = if (d.weekday == todayW) ({ Icon(Icons.Default.Today, null, Modifier.size(16.dp)) }) else null
                        )
                    }
                }
            }
            item {
                AureaCard {
                    Text(day.title, style = MaterialTheme.typography.headlineSmall)
                    Text("${WEEKDAY_NAMES[day.weekday]} • ${day.focus} • ~${WorkoutGenerator.estimatedMinutes(day)} min", style = MaterialTheme.typography.bodyMedium)
                    if (day.extra.isNotBlank()) { Spacer(Modifier.height(6.dp)); Text(day.extra, style = MaterialTheme.typography.bodyMedium) }
                    if (wp.setsDelta != 0) { Spacer(Modifier.height(6.dp)); InfoBanner(if (wp.setsDelta < 0) "Volume reduzido (${wp.setsDelta} série) após seu check-in, para recuperação." else "Volume aumentado (+${wp.setsDelta} série) após seu check-in.") }
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = { nav("session/${day.index}") }, modifier = Modifier.fillMaxWidth().testTag("startSession")) {
                        Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(6.dp)); Text("Iniciar e registrar este treino")
                    }
                }
            }
            itemsIndexed(day.exercises) { i, pe ->
                val ex = ExerciseLibrary.get(pe.exerciseId) ?: return@itemsIndexed
                AureaCard(onClick = { nav("exercise/${ex.id}") }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.width(96.dp)) { ExerciseAnimation(ex.anim, animate = false, fixedT = 1f) }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("${i + 1}. ${ex.name}", style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(ex.primary.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                            Text("${pe.sets} séries × ${pe.repsLabel} • descanso ${pe.restSec}s", style = MaterialTheme.typography.bodySmall)
                            if (pe.note.isNotBlank()) Text(pe.note, style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { swapFor = day.index to pe }) { Icon(Icons.Default.SwapHoriz, "Trocar exercício") }
                    }
                }
            }
            item { SectionTitle("Cardio e atividade diária") }
            item { AureaCard { Text(wp.cardio, style = MaterialTheme.typography.bodyMedium) } }
            item { SectionTitle("Orientações") }
            item { AureaCard { wp.notes.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 2.dp)) } } }
            item { SectionTitle("Histórico de treinos") }
            if (sessions.isEmpty()) item { Text("Nenhum treino registrado ainda.", style = MaterialTheme.typography.bodyMedium) }
            items(sessions.take(15), key = { it.id }) { s ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(s.title, style = MaterialTheme.typography.titleSmall)
                        Text("${epochLabel(s.epochDay)} • ${s.durationMin} min", style = MaterialTheme.typography.bodySmall)
                    }
                    IconButton(onClick = { vm.deleteSession(s.id) }) { Icon(Icons.Default.Delete, "Apagar registro") }
                }
            }
        }
    }
    swapFor?.let { (dayIndex, pe) ->
        val options = WorkoutGenerator.swapOptions(pe, profile!!)
        AlertDialog(
            onDismissRequest = { swapFor = null },
            title = { Text("Trocar exercício") },
            text = {
                if (options.isEmpty()) Text("Não há alternativas compatíveis com seus equipamentos e limitações.")
                else LazyColumn { items(options) { o -> SettingRow(o.name, o.equipment.joinToString { it.label }, onClick = { vm.swapExercise(dayIndex, pe.exerciseId, o.id); swapFor = null }) } }
            },
            confirmButton = { TextButton(onClick = { swapFor = null }) { Text("Fechar") } }
        )
    }
}

private class SetState(weight: String, reps: String) {
    var weight by mutableStateOf(weight)
    var reps by mutableStateOf(reps)
    var done by mutableStateOf(false)
}

private class ExState(val planned: PlannedExercise, val ex: Exercise) {
    val sets = mutableStateListOf<SetState>()
    var rpe by mutableFloatStateOf(8f)
    var goodForm by mutableStateOf(true)
    var pain by mutableStateOf(false)
    var suggestion by mutableStateOf<ProgressionSuggestion?>(null)
}

/** Registro do treino: cargas, repetições, esforço percebido e técnica. */
@Composable
fun WorkoutSessionScreen(vm: AppViewModel, dayIndex: Int, onBack: () -> Unit) {
    val plan by vm.workoutPlan.collectAsState()
    val day = plan?.days?.firstOrNull { it.index == dayIndex }
    val states = remember(day) { day?.exercises?.mapNotNull { pe -> ExerciseLibrary.get(pe.exerciseId)?.let { ExState(pe, it) } } ?: emptyList() }
    var loaded by remember(day) { mutableStateOf(false) }
    val startedAt = remember { System.currentTimeMillis() }
    var elapsed by remember { mutableLongStateOf(0L) }
    var rest by remember { mutableIntStateOf(0) }
    var confirmExit by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { while (true) { elapsed = (System.currentTimeMillis() - startedAt) / 1000; if (rest > 0) rest--; delay(1000) } }
    LaunchedEffect(day) {
        if (day == null) return@LaunchedEffect
        val recovered = vm.lastRecovery()
        states.forEach { s ->
            val last = vm.lastSets(s.ex.id)
            val fb = vm.lastFeedback(s.ex.id)
            val sug = Progression.suggest(s.planned, last, fb?.rpe, fb?.goodForm ?: true, fb?.pain ?: false, recovered, s.ex.loadStep)
            s.suggestion = sug
            val w = sug.weightKg?.let { fmt1(it) } ?: ""
            repeat(s.planned.sets) { s.sets += SetState(w, if (s.planned.timeBased) s.planned.repMin.toString() else sug.targetReps.toString()) }
        }
        loaded = true
    }
    if (day == null) { EmptyState("Treino não encontrado", "Volte e escolha um dia da sua ficha.", "Voltar", onBack); return }

    Scaffold(
        topBar = { AureaTopBar(day.title, onBack = { confirmExit = true }) },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Row(Modifier.navigationBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Tempo: %02d:%02d".format(elapsed / 60, elapsed % 60), style = MaterialTheme.typography.titleMedium)
                        if (rest > 0) Text("Descanso: ${rest}s", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    }
                    Button(
                        onClick = {
                            val logged = states.mapNotNull { s ->
                                val sets = s.sets.filter { it.done || it.reps.isNotBlank() && it.done }.mapNotNull { st ->
                                    val r = st.reps.toIntOrNull() ?: return@mapNotNull null
                                    SetEntry(st.weight.toDoubleOrNull() ?: 0.0, r)
                                }
                                if (sets.isEmpty()) null else Repository.LoggedExercise(s.ex.id, sets, s.rpe.toInt(), s.goodForm, s.pain)
                            }
                            vm.saveSession(day.index, day.title, logged, (elapsed / 60).toInt().coerceAtLeast(1)) { onBack() }
                        },
                        enabled = loaded && states.any { s -> s.sets.any { it.done } },
                        modifier = Modifier.testTag("finishSession")
                    ) { Text("Concluir treino") }
                }
            }
        }
    ) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { InfoBanner("Marque ✓ em cada série concluída. A sugestão de carga usa seu último registro, o esforço percebido e a qualidade da execução.") }
            items(states, key = { it.ex.id }) { s ->
                AureaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.width(110.dp)) { ExerciseAnimation(s.ex.anim) }
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(s.ex.name, style = MaterialTheme.typography.titleMedium)
                            Text("${s.planned.sets} × ${s.planned.repsLabel} • descanso ${s.planned.restSec}s", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    s.suggestion?.let { Spacer(Modifier.height(6.dp)); Text("💡 ${it.message}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary) }
                    Spacer(Modifier.height(6.dp))
                    s.sets.forEachIndexed { i, st ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("${i + 1}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.width(20.dp))
                            OutlinedTextField(
                                st.weight, { st.weight = it.replace(',', '.').filter { c -> c.isDigit() || c == '.' }.take(6) },
                                label = { Text("kg") }, singleLine = true, modifier = Modifier.weight(1f),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                            )
                            OutlinedTextField(
                                st.reps, { st.reps = it.filter { c -> c.isDigit() }.take(3) },
                                label = { Text(if (s.planned.timeBased) "seg" else "reps") }, singleLine = true, modifier = Modifier.weight(1f),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )
                            FilledIconToggleButton(
                                checked = st.done,
                                onCheckedChange = { st.done = it; if (it) rest = s.planned.restSec },
                                modifier = Modifier.testTag("set_${s.ex.id}_$i")
                            ) { Icon(Icons.Default.Check, "Série concluída") }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("Esforço percebido: ${s.rpe.toInt()}/10 ${rpeLabel(s.rpe.toInt())}", style = MaterialTheme.typography.labelLarge)
                    Slider(s.rpe, { s.rpe = it }, valueRange = 1f..10f, steps = 8)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(s.goodForm, { s.goodForm = it }); Text("Boa execução", style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.width(12.dp))
                        Checkbox(s.pain, { s.pain = it }); Text("Senti dor", style = MaterialTheme.typography.bodyMedium)
                    }
                    if (s.pain) InfoBanner("Dor articular ou aguda não é normal. Reduza a carga, troque o exercício e, se persistir, procure um profissional.", warning = true)
                }
            }
        }
    }
    if (confirmExit) ConfirmDialog("Sair do treino?", "Os registros desta sessão não concluída serão descartados.", "Sair", true, { confirmExit = false }) { confirmExit = false; onBack() }
}

fun rpeLabel(r: Int) = when {
    r <= 4 -> "(fácil)"; r <= 6 -> "(moderado)"; r <= 8 -> "(difícil, 2–3 reps sobrando)"; r == 9 -> "(1 rep sobrando)"; else -> "(máximo)"
}

/** 8. Biblioteca de exercícios. */
@Composable
fun LibraryScreen(vm: AppViewModel, nav: (String) -> Unit, onBack: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var muscle by remember { mutableStateOf<Muscle?>(null) }
    var homeOnly by remember { mutableStateOf(false) }
    val list = ExerciseLibrary.all.filter {
        (query.isBlank() || it.name.contains(query, true) || it.primary.label.contains(query, true)) &&
            (muscle == null || it.primary == muscle || muscle in it.secondary) && (!homeOnly || !it.gymOnly)
    }
    Scaffold(topBar = { AureaTopBar("Biblioteca de exercícios", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                OutlinedTextField(query, { query = it }, leadingIcon = { Icon(Icons.Default.Search, null) }, label = { Text("Buscar exercício ou músculo") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("search"))
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item { FilterChip(homeOnly, { homeOnly = !homeOnly }, label = { Text("Dá para fazer em casa") }) }
                    item { FilterChip(muscle == null, { muscle = null }, label = { Text("Todos") }) }
                    items(Muscle.entries) { m -> FilterChip(muscle == m, { muscle = if (muscle == m) null else m }, label = { Text(m.label) }) }
                }
            }
            item { Text("${list.size} exercícios", style = MaterialTheme.typography.labelLarge) }
            items(list, key = { it.id }) { ex ->
                AureaCard(onClick = { nav("exercise/${ex.id}") }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.width(88.dp)) { ExerciseAnimation(ex.anim, animate = false, fixedT = 1f) }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(ex.name, style = MaterialTheme.typography.titleMedium)
                            Text(ex.muscles.joinToString { it.label }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(ex.equipment.joinToString { it.label }, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
    }
}

/** Detalhe do exercício: animação, execução, dicas, alternativas e evolução de carga. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ExerciseDetailScreen(vm: AppViewModel, id: String, nav: (String) -> Unit, onBack: () -> Unit) {
    val ex = ExerciseLibrary.get(id) ?: run { EmptyState("Exercício não encontrado", "", "Voltar", onBack); return }
    val plan by vm.workoutPlan.collectAsState()
    val profile by vm.profile.collectAsState()
    val logs by vm.setLogs.collectAsState()
    val planned = plan?.days?.flatMap { it.exercises }?.firstOrNull { it.exerciseId == id }
    val ctx = LocalContext.current
    val history = logs.filter { it.exerciseId == id }.groupBy { it.epochDay }.map { (d, l) -> ChartPoint(d, l.maxOf { it.weightKg }) }
    Scaffold(topBar = { AureaTopBar(ex.name, onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { AureaCard { ExerciseAnimation(ex.anim, Modifier.testTag("exerciseAnim")) } }
            item {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill("Principal: ${ex.primary.label}", MaterialTheme.colorScheme.primary)
                    ex.secondary.forEach { Pill(it.label, MaterialTheme.colorScheme.secondary) }
                    ex.equipment.forEach { Pill(it.label, MaterialTheme.colorScheme.tertiary) }
                }
            }
            planned?.let { pe ->
                item {
                    AureaCard(container = MaterialTheme.colorScheme.primaryContainer) {
                        Text("Na sua ficha", style = MaterialTheme.typography.titleMedium)
                        Text("${pe.sets} séries • ${pe.repsLabel} ${if (pe.timeBased) "" else "repetições"} • descanso de ${pe.restSec} s", style = MaterialTheme.typography.bodyLarge)
                        if (pe.note.isNotBlank()) Text(pe.note, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            item {
                AureaCard {
                    Text("Execução correta", style = MaterialTheme.typography.titleLarge)
                    ex.steps.forEachIndexed { i, s -> Text("${i + 1}. $s", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 3.dp)) }
                }
            }
            item {
                AureaCard {
                    Text("Dicas de técnica", style = MaterialTheme.typography.titleLarge)
                    ex.tips.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 3.dp)) }
                    if (ex.avoidIf.isNotEmpty()) Text("Cuidado se você tem limitação em: ${ex.avoidIf.joinToString { it.label.lowercase() }}.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
            item {
                OutlinedButton(
                    onClick = {
                        val uri = Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(ex.videoQuery))
                        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Icon(Icons.Default.OndemandVideo, null); Spacer(Modifier.width(8.dp)); Text("Ver vídeos de execução (requer internet)") }
            }
            item { SectionTitle("Alternativas (sem o equipamento)") }
            items(ExerciseLibrary.alternativesFor(ex, profile)) { alt ->
                SettingRow(alt.name, alt.equipment.joinToString { it.label }, Icons.Default.SwapHoriz, onClick = { nav("exercise/${alt.id}") })
            }
            item { SectionTitle("Sua evolução de carga") }
            item { AureaCard { LineChart(history, "kg") } }
        }
    }
}
