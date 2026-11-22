package com.aurea.fit.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.aurea.fit.data.ScheduleEntity
import com.aurea.fit.domain.*
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*
import java.time.LocalDate
import java.time.YearMonth

private val MONTHS = listOf("Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro")

fun scheduleIcon(type: String): ImageVector = when (type) {
    "WAKE" -> Icons.Default.WbSunny; "MEAL" -> Icons.Default.Restaurant; "TRAINING" -> Icons.Default.FitnessCenter
    "WATER" -> Icons.Default.WaterDrop; "REST" -> Icons.Default.SelfImprovement; "SLEEP" -> Icons.Default.Bedtime
    "CHECKIN" -> Icons.Default.Favorite; else -> Icons.Default.Event
}

/** 13. Calendário e rotina diária (todos os horários editáveis). */
@Composable
fun CalendarScreen(vm: AppViewModel, onBack: () -> Unit) {
    val schedule by vm.schedule.collectAsState()
    val plan by vm.workoutPlan.collectAsState()
    val sessions by vm.sessions.collectAsState()
    var month by remember { mutableStateOf(YearMonth.now()) }
    var selected by remember { mutableStateOf(LocalDate.now()) }
    var editing by remember { mutableStateOf<ScheduleEntity?>(null) }
    var adding by remember { mutableStateOf(false) }
    var confirmReset by remember { mutableStateOf(false) }
    val trainingDays = plan?.days?.map { it.weekday }?.toSet() ?: emptySet()
    val doneDays = sessions.map { it.epochDay }.toSet()
    val dow = selected.dayOfWeek.value
    val itemsOfDay = schedule.filter { (it.daysMask and (1 shl (dow - 1))) != 0 }.sortedBy { minutesOf(it.time) }

    Scaffold(
        topBar = { AureaTopBar("Calendário e rotina", onBack, actions = { IconButton(onClick = { confirmReset = true }) { Icon(Icons.Default.RestartAlt, "Recriar rotina a partir do perfil") } }) },
        floatingActionButton = { FloatingActionButton(onClick = { adding = true }) { Icon(Icons.Default.Add, "Adicionar lembrete") } }
    ) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                AureaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { month = month.minusMonths(1) }) { Icon(Icons.Default.ChevronLeft, "Mês anterior") }
                        Text("${MONTHS[month.monthValue - 1]} ${month.year}", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
                        IconButton(onClick = { month = month.plusMonths(1) }) { Icon(Icons.Default.ChevronRight, "Próximo mês") }
                    }
                    Row { (1..7).forEach { Text(WEEKDAY_SHORT[it], Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelMedium) } }
                    val first = month.atDay(1)
                    val offset = first.dayOfWeek.value - 1
                    val cells = offset + month.lengthOfMonth()
                    val rows = (cells + 6) / 7
                    for (r in 0 until rows) {
                        Row {
                            for (c in 0 until 7) {
                                val dayNum = r * 7 + c - offset + 1
                                Box(Modifier.weight(1f).aspectRatio(1f).padding(2.dp), contentAlignment = Alignment.Center) {
                                    if (dayNum in 1..month.lengthOfMonth()) {
                                        val date = month.atDay(dayNum)
                                        val isSel = date == selected
                                        val isTrain = date.dayOfWeek.value in trainingDays
                                        val isDone = date.toEpochDay() in doneDays
                                        val cs = MaterialTheme.colorScheme
                                        Box(
                                            Modifier.fillMaxSize().clip(CircleShape)
                                                .background(when { isSel -> cs.primary; isDone -> cs.primaryContainer; else -> cs.surfaceContainer })
                                                .clickable { selected = date },
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("$dayNum", color = if (isSel) cs.onPrimary else cs.onSurface, style = MaterialTheme.typography.labelLarge)
                                                if (isTrain) Box(Modifier.size(5.dp).clip(CircleShape).background(if (isSel) cs.onPrimary else cs.primary))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    Text("● dia de treino   ■ treino concluído", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item {
                val w = plan?.days?.firstOrNull { it.weekday == dow }
                Text("${WEEKDAY_NAMES[dow]}, ${selected.dayOfMonth}/${"%02d".format(selected.monthValue)}" + (w?.let { " • ${it.title}" } ?: " • descanso"), style = MaterialTheme.typography.titleLarge)
            }
            if (itemsOfDay.isEmpty()) item { Text("Nenhum compromisso neste dia.", style = MaterialTheme.typography.bodyMedium) }
            items(itemsOfDay, key = { it.id }) { s ->
                AureaCard(onClick = { editing = s }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(scheduleIcon(s.type), null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(s.time, style = MaterialTheme.typography.titleMedium)
                            Text(s.label, style = MaterialTheme.typography.bodyMedium)
                        }
                        Switch(s.enabled, { vm.updateSchedule(s.copy(enabled = it)) })
                    }
                }
            }
            item { Text("Toque em um item para editar horário, texto e dias. Os lembretes chegam como notificações.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
    editing?.let { item -> ScheduleEditor(item, isNew = false, onDismiss = { editing = null }, onDelete = { vm.deleteSchedule(item); editing = null }) { vm.updateSchedule(it); editing = null } }
    if (adding) ScheduleEditor(ScheduleEntity(type = "CUSTOM", label = "Novo lembrete", time = "12:00"), isNew = true, onDismiss = { adding = false }, onDelete = {}) { vm.addSchedule(it); adding = false }
    if (confirmReset) ConfirmDialog("Recriar rotina?", "Os horários voltam a ser calculados a partir do seu perfil. Suas edições serão substituídas.", "Recriar", false, { confirmReset = false }) { vm.resetSchedule(); confirmReset = false }
}

@Composable
private fun ScheduleEditor(item: ScheduleEntity, isNew: Boolean, onDismiss: () -> Unit, onDelete: () -> Unit, onSave: (ScheduleEntity) -> Unit) {
    var label by remember { mutableStateOf(item.label) }
    var time by remember { mutableStateOf(item.time) }
    var days by remember { mutableStateOf((1..7).filter { item.daysMask and (1 shl (it - 1)) != 0 }.toSet()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isNew) "Novo lembrete" else "Editar lembrete") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(label, { label = it.take(60) }, label = { Text("Texto") }, singleLine = true)
                TimeField("Horário", time, { time = it })
                Text("Dias", style = MaterialTheme.typography.titleSmall)
                MultiChoice((1..7).toList(), days, { WEEKDAY_SHORT[it] }, { days = it })
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(item.copy(label = label.ifBlank { "Lembrete" }, time = time, daysMask = days.fold(0) { a, d -> a or (1 shl (d - 1)) })) }, enabled = days.isNotEmpty()) { Text("Salvar") }
        },
        dismissButton = {
            Row {
                if (!isNew) TextButton(onClick = onDelete, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Excluir") }
                TextButton(onClick = onDismiss) { Text("Cancelar") }
            }
        }
    )
}
