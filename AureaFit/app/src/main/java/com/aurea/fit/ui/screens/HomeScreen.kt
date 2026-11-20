package com.aurea.fit.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.aurea.fit.data.today
import com.aurea.fit.domain.*
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*
import com.aurea.fit.ui.theme.LocalExtras
import java.time.LocalDate
import java.time.LocalTime

/** 6. Painel principal com metas diárias. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(vm: AppViewModel, nav: (String) -> Unit) {
    val profile by vm.profile.collectAsState()
    val plan by vm.workoutPlan.collectAsState()
    val diet by vm.dietPlan.collectAsState()
    val sessions by vm.sessions.collectAsState()
    val water by vm.waterToday.collectAsState()
    val waterGoal by vm.waterGoal.collectAsState()
    val checks by vm.mealChecks.collectAsState()
    val schedule by vm.schedule.collectAsState()
    val unread by vm.unread.collectAsState()
    val measurements by vm.measurements.collectAsState()
    val settings by vm.settings.collectAsState()
    var lastCheckIn by remember { mutableStateOf<Long?>(-1) }
    LaunchedEffect(Unit) { vm.refreshDay(); lastCheckIn = vm.lastCheckInDay() }

    val p = profile ?: return
    val todayDate = LocalDate.now()
    val weekday = todayDate.dayOfWeek.value
    val todayWorkout = plan?.days?.firstOrNull { it.weekday == weekday }
    val doneToday = sessions.any { it.epochDay == today() }
    val dietDay = diet?.days?.getOrNull(todayDate.dayOfWeek.value - 1)
    val eaten = dietDay?.meals?.filterIndexed { i, _ -> checks.any { it.mealIndex == i } }?.fold(Macros()) { a, m -> a + m.macros() } ?: Macros()
    val waterMl = water.sumOf { it.ml }
    val weekStart = today() - (weekday - 1)
    val weekSessions = sessions.count { it.epochDay >= weekStart }
    val planned = plan?.days?.size ?: p.daysPerWeek
    val hour = LocalTime.now().hour
    val greeting = when (hour) { in 5..11 -> "Bom dia"; in 12..17 -> "Boa tarde"; else -> "Boa noite" }
    val nowMin = LocalTime.now().let { it.hour * 60 + it.minute }
    val next = schedule.filter { it.enabled && (it.daysMask and (1 shl (weekday - 1))) != 0 && minutesOf(it.time) > nowMin }.minByOrNull { minutesOf(it.time) }
    val checkInDue = lastCheckIn != -1L && (lastCheckIn == null && sessions.size >= 3 || (lastCheckIn != null && today() - lastCheckIn!! >= 7))
    val safety = Safety.assess(p)

    Scaffold(topBar = {
        TopAppBar(
            title = {
                Column {
                    Text("$greeting, ${p.name.substringBefore(" ")}", style = MaterialTheme.typography.headlineSmall)
                    Text(todayDate.let { "${WEEKDAY_NAMES[weekday]}, ${it.dayOfMonth}/${"%02d".format(it.monthValue)}" }, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
            actions = {
                IconButton(onClick = { nav("notifications") }, modifier = Modifier.testTag("bell")) {
                    BadgedBox(badge = { if (unread > 0) Badge { Text("$unread") } }) { Icon(Icons.Default.Notifications, "Central de notificações") }
                }
                IconButton(onClick = { nav("profile") }) { Icon(Icons.Default.AccountCircle, "Perfil") }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
        )
    }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                HeroCard(Modifier.testTag("todayCard")) {
                    Text("Treino de hoje", style = MaterialTheme.typography.labelLarge, color = Color.White.copy(alpha = 0.85f))
                    if (todayWorkout == null) {
                        Text("Dia de descanso", style = MaterialTheme.typography.headlineMedium)
                        Text("Descansar também faz o músculo crescer. Caminhe, alongue-se e hidrate-se.", style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(onClick = { nav("workout") }, colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)) { Text("Ver minha ficha") }
                    } else {
                        Text(todayWorkout.title, style = MaterialTheme.typography.headlineMedium)
                        Text("${todayWorkout.focus} • ~${WorkoutGenerator.estimatedMinutes(todayWorkout)} min", style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(10.dp))
                        if (doneToday) Text("✓ Treino concluído hoje. Parabéns!", style = MaterialTheme.typography.titleMedium)
                        else Button(
                            onClick = { nav("session/${todayWorkout.index}") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = MaterialTheme.colorScheme.primary)
                        ) { Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(6.dp)); Text("Começar treino") }
                    }
                }
            }
            if (checkInDue) item {
                AureaCard(onClick = { nav("checkin") }, container = MaterialTheme.colorScheme.tertiaryContainer) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Favorite, null, tint = MaterialTheme.colorScheme.tertiary)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Hora do check-in semanal", style = MaterialTheme.typography.titleMedium)
                            Text("Conte como você está para ajustarmos seu plano.", style = MaterialTheme.typography.bodySmall)
                        }
                        Icon(Icons.Default.ChevronRight, null)
                    }
                }
            }
            item { SectionTitle("Metas de hoje") }
            item {
                AureaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ProgressRing(waterMl / waterGoal.toFloat().coerceAtLeast(1f), size = 92.dp, color = LocalExtras.current.water) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.WaterDrop, null, tint = LocalExtras.current.water, modifier = Modifier.size(18.dp))
                                Text("${"%.1f".format(waterMl / 1000.0)} L", style = MaterialTheme.typography.labelLarge)
                            }
                        }
                        Spacer(Modifier.width(16.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Água: ${waterMl} / ${waterGoal} ml", style = MaterialTheme.typography.titleSmall)
                            Spacer(Modifier.height(6.dp))
                            FilledTonalButton(onClick = { vm.addWater(settings.glassMl) }, modifier = Modifier.testTag("addWaterHome")) { Text("+ ${settings.glassMl} ml", maxLines = 1) }
                            TextButton(onClick = { nav("water") }) { Text("Ver detalhes", maxLines = 1) }
                        }
                    }
                }
            }
            item {
                AureaCard(onClick = { nav("diet") }) {
                    Text("Alimentação (refeições marcadas como feitas)", style = MaterialTheme.typography.titleSmall)
                    val t = diet?.targets
                    if (t != null) {
                        if (!settings.hideCalories) LinearMeter("Calorias", eaten.kcal, t.calories.toDouble(), "kcal")
                        LinearMeter("Proteína", eaten.protein, t.proteinG.toDouble(), "g", LocalExtras.current.plum)
                        Text("${checks.size} de ${dietDay?.meals?.size ?: 0} refeições feitas • toque para ver o cardápio", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile("treinos nesta semana", "$weekSessions/$planned", Modifier.weight(1f), Icons.Default.FitnessCenter) { nav("workout") }
                    val lastW = measurements.lastOrNull { it.weightKg != null }?.weightKg ?: p.weightKg
                    StatTile("peso atual (kg)", fmt1(lastW), Modifier.weight(1f), Icons.Default.MonitorWeight) { nav("evolution") }
                }
            }
            next?.let { n ->
                item {
                    AureaCard(onClick = { nav("calendar") }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Schedule, null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Próximo na sua rotina", style = MaterialTheme.typography.labelMedium)
                                Text("${n.time} — ${n.label}", style = MaterialTheme.typography.titleMedium)
                            }
                            Icon(Icons.Default.ChevronRight, null)
                        }
                    }
                }
            }
            item { SectionTitle("Atalhos") }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile("Biblioteca de exercícios", "", Modifier.weight(1f), Icons.Default.MenuBook) { nav("library") }
                    StatTile("Lista de compras", "", Modifier.weight(1f), Icons.Default.ShoppingCart) { nav("shopping") }
                    StatTile("Check-in", "", Modifier.weight(1f), Icons.Default.Favorite) { nav("checkin") }
                }
            }
            if (safety.warnings.isNotEmpty()) item { safety.warnings.forEach { InfoBanner(it, warning = true); Spacer(Modifier.height(6.dp)) } }
            item {
                Text(
                    "Lembrete: o Áurea é educativo e não substitui profissionais de saúde.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
