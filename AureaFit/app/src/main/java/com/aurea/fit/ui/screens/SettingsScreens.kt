package com.aurea.fit.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.aurea.fit.data.AppJson
import com.aurea.fit.data.AuthResult
import com.aurea.fit.domain.*
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Menu "Mais". */
@Composable
fun MoreScreen(vm: AppViewModel, nav: (String) -> Unit) {
    val unread by vm.unread.collectAsState()
    Scaffold(topBar = { AureaTopBar("Mais") }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp)) {
            item { SectionTitle("Rotina") }
            item { SettingRow("Calendário e rotina diária", "Horários de refeições, treino, água e sono", Icons.Default.CalendarMonth, { nav("calendar") }) }
            item { SettingRow("Controle de água", null, Icons.Default.WaterDrop, { nav("water") }) }
            item { SettingRow("Central de notificações", if (unread > 0) "$unread nova(s)" else null, Icons.Default.Notifications, { nav("notifications") }) }
            item { SectionTitle("Plano") }
            item { SettingRow("Check-in semanal", "Ajuste seu plano conforme você se sente", Icons.Default.Favorite, { nav("checkin") }) }
            item { SettingRow("Alterar objetivo", "Emagrecer, ganhar massa, recompor…", Icons.Default.Flag, { nav("goal") }) }
            item { SettingRow("Avaliação física", "Atualizar peso e medidas", Icons.Default.Straighten, { nav("assessment") }) }
            item { SettingRow("Histórico de planos", "Consulte e restaure planos anteriores", Icons.Default.History, { nav("history") }) }
            item { SettingRow("Biblioteca de exercícios", null, Icons.Default.MenuBook, { nav("library") }) }
            item { SettingRow("Receitas e substituições", null, Icons.Default.RestaurantMenu, { nav("recipes") }) }
            item { SettingRow("Lista de compras", null, Icons.Default.ShoppingCart, { nav("shopping") }) }
            item { SettingRow("Gráficos de progresso", null, Icons.Default.ShowChart, { nav("charts") }) }
            item { SectionTitle("Conta") }
            item { SettingRow("Meu perfil", "Dados pessoais e respostas do questionário", Icons.Default.Person, { nav("profile") }) }
            item { SettingRow("Configurações", "Tema, lembretes, privacidade, backup", Icons.Default.Settings, { nav("settings") }) }
        }
    }
}

/** 17. Perfil da usuária. */
@Composable
fun ProfileScreen(vm: AppViewModel, nav: (String) -> Unit, onBack: () -> Unit) {
    val p by vm.profile.collectAsState()
    val acc by vm.account.collectAsState()
    val prof = p ?: return
    Scaffold(topBar = { AureaTopBar("Meu perfil", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                HeroCard {
                    Text(prof.name, style = MaterialTheme.typography.headlineMedium)
                    Text(acc?.email ?: "", style = MaterialTheme.typography.bodyMedium)
                    Text("${prof.goal.label} • ${prof.experience.label}", style = MaterialTheme.typography.titleSmall)
                }
            }
            item {
                AureaCard {
                    Info("Idade", "${prof.age} anos"); Info("Altura", "${fmt1(prof.heightCm)} cm"); Info("Peso", "${fmt1(prof.weightKg)} kg")
                    Info("IMC", "%.1f (%s)".format(Nutrition.bmi(prof), bmiLabel(Nutrition.bmi(prof))))
                    Info("Treinos", "${prof.daysPerWeek}x/semana • ${prof.minutesPerSession} min • ${prof.location.label}")
                    Info("Dias", prof.availableDays.sorted().joinToString { WEEKDAY_SHORT[it] })
                    Info("Prioridades", (prof.bodyGoals.map { it.label } + prof.priorityMuscles.map { it.label }).joinToString().ifBlank { "—" })
                    Info("Limitações", prof.limitations.joinToString { it.label }.ifBlank { "nenhuma" })
                    Info("Refeições", "${prof.mealsPerDay}/dia • orçamento R$ ${prof.monthlyBudget}/mês")
                    Info("Restrição", prof.restriction.label)
                    Info("Alergias", prof.allergies.joinToString { it.label }.ifBlank { "nenhuma" })
                    Info("Rotina", "acorda ${prof.wakeTime} • dorme ${prof.sleepTime} • treina ${prof.trainTime}")
                }
            }
            item { Button(onClick = { nav("editProfile") }, modifier = Modifier.fillMaxWidth().testTag("editProfile")) { Icon(Icons.Default.Edit, null); Spacer(Modifier.width(8.dp)); Text("Refazer questionário / editar") } }
            item { OutlinedButton(onClick = { nav("goal") }, modifier = Modifier.fillMaxWidth()) { Text("Alterar apenas o objetivo") } }
        }
    }
}

@Composable
private fun Info(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(110.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

/** 4. Seleção (e troca) do objetivo. */
@Composable
fun GoalScreen(vm: AppViewModel, onBack: () -> Unit) {
    val p by vm.profile.collectAsState()
    val prof = p ?: return
    var goal by remember(prof) { mutableStateOf(prof.goal) }
    val preview = Nutrition.targets(prof.copy(goal = goal))
    val safety = Safety.assess(prof.copy(goal = goal))
    Scaffold(topBar = { AureaTopBar("Seu objetivo", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(Goal.entries) { g -> OptionCard(g.label, g.description, goal == g, { goal = g }) }
            item {
                AureaCard {
                    Text("Prévia do novo plano", style = MaterialTheme.typography.titleMedium)
                    Text("${preview.calories} kcal • ${preview.proteinG} g proteína • ${preview.carbsG} g carboidratos • ${preview.fatG} g gorduras", style = MaterialTheme.typography.bodyMedium)
                    Text(preview.explanation.getOrNull(2) ?: "", style = MaterialTheme.typography.bodySmall)
                }
            }
            items(safety.warnings) { InfoBanner(it, warning = true) }
            item {
                Button(
                    onClick = { vm.saveProfile(prof.copy(goal = goal), "Objetivo alterado para ${goal.label}") { onBack() } },
                    enabled = goal != prof.goal, modifier = Modifier.fillMaxWidth().testTag("saveGoal")
                ) { Text("Aplicar e gerar novo plano") }
                Text("Seu plano anterior fica salvo no histórico.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** 5. Avaliação física (atualização de medidas). */
@Composable
fun AssessmentScreen(vm: AppViewModel, onBack: () -> Unit) {
    val p by vm.profile.collectAsState()
    val ms by vm.measurements.collectAsState()
    val prof = p ?: return
    var open by remember { mutableStateOf(false) }
    val last = ms.lastOrNull()
    Scaffold(topBar = { AureaTopBar("Avaliação física", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                AureaCard {
                    val bmi = Nutrition.bmi(prof)
                    Text("Situação atual", style = MaterialTheme.typography.titleLarge)
                    Text("Peso ${fmt1(prof.weightKg)} kg • Altura ${fmt1(prof.heightCm)} cm", style = MaterialTheme.typography.bodyLarge)
                    Text("IMC ${"%.1f".format(bmi)} — ${bmiLabel(bmi)}", style = MaterialTheme.typography.bodyLarge)
                    val waist = last?.waistCm ?: prof.waistCm; val hip = last?.hipCm ?: prof.hipCm
                    if (waist != null) Text("Cintura ${fmt1(waist)} cm" + (if (waist / prof.heightCm > 0.5) " (relação cintura/altura acima de 0,5)" else ""), style = MaterialTheme.typography.bodyLarge)
                    if (waist != null && hip != null) Text("Relação cintura/quadril ${"%.2f".format(waist / hip)}", style = MaterialTheme.typography.bodyLarge)
                    Spacer(Modifier.height(6.dp))
                    Text("Estes indicadores são apenas referências populacionais e não substituem uma avaliação profissional (bioimpedância, dobras cutâneas, exames).", style = MaterialTheme.typography.bodySmall)
                }
            }
            item {
                AureaCard {
                    Text("Como medir", style = MaterialTheme.typography.titleMedium)
                    listOf("Pela manhã, em jejum, após ir ao banheiro.", "Fita métrica firme, sem apertar a pele.", "Cintura: na altura do umbigo, relaxada.", "Quadril: na parte mais larga dos glúteos.", "Coxa e braço: no ponto médio, sempre do mesmo lado.", "Meça a cada 2–4 semanas.")
                        .forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
                }
            }
            item { Button(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) { Text("Registrar nova avaliação") } }
            item {
                OutlinedButton(onClick = { vm.saveProfile(prof, "Plano recalculado com o peso atual (${fmt1(prof.weightKg)} kg)") { onBack() } }, modifier = Modifier.fillMaxWidth()) {
                    Text("Recalcular meu plano com o peso atual")
                }
            }
        }
    }
    if (open) MeasurementDialog(last, { open = false }) { vm.addMeasurement(it); open = false }
}

/** Check-in periódico com recomendações explicadas. */
@Composable
fun CheckInScreen(vm: AppViewModel, onBack: () -> Unit) {
    var a by remember { mutableStateOf(CheckInAnswers()) }
    var result by remember { mutableStateOf<Pair<Long, List<Recommendation>>?>(null) }
    val selected = remember { mutableStateMapOf<Int, Boolean>() }
    var applied by remember { mutableStateOf<String?>(null) }
    val history by vm.checkIns.collectAsState()
    val scope = rememberCoroutineScope()
    Scaffold(topBar = { AureaTopBar("Check-in", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (result == null) {
                item { Text("Como foi sua última semana?", style = MaterialTheme.typography.headlineSmall) }
                item { ScaleQuestion("Está conseguindo cumprir os treinos?", a.trainingAdherence, { a = a.copy(trainingAdherence = it) }, "quase nenhum", "todos") }
                item { ScaleQuestion("Os exercícios estão…", a.difficulty, { a = a.copy(difficulty = it) }, "muito fáceis", "muito difíceis") }
                item { ScaleQuestion("Está conseguindo recuperar os músculos?", a.recovery, { a = a.copy(recovery = it) }, "muito dolorida/cansada", "bem recuperada") }
                item { ScaleQuestion("Está dormindo bem?", a.sleep, { a = a.copy(sleep = it) }, "muito mal", "muito bem") }
                item { ScaleQuestion("Está conseguindo se alimentar adequadamente?", a.dietAdherence, { a = a.copy(dietAdherence = it) }, "não", "sim, sempre") }
                item { ScaleQuestion("Seguir a dieta está…", a.dietDifficulty, { a = a.copy(dietDifficulty = it) }, "muito difícil", "fácil") }
                item { ScaleQuestion("Como está sua fome?", a.hunger, { a = a.copy(hunger = it) }, "pouca", "muita") }
                item { ScaleQuestion("Está satisfeita com a evolução?", a.satisfaction, { a = a.copy(satisfaction = it) }, "nada", "muito") }
                item { SwitchRow("Está sentindo dores (articulares/lesão)?", a.pain) { a = a.copy(pain = it, painArea = if (it) a.painArea else null) } }
                if (a.pain) item { SingleChoice(Limitation.entries, a.painArea, { it.label }, { a = a.copy(painArea = it) }) }
                item {
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = { scope.launch { result = vm.submitCheckIn(a); result?.second?.forEachIndexed { i, r -> selected[i] = r.action != ActionType.NONE && r.action != ActionType.SEE_PROFESSIONAL } } },
                        modifier = Modifier.fillMaxWidth().testTag("submitCheckin")) { Text("Ver recomendações") }
                }
            } else {
                val (id, recs) = result!!
                item { Text("Recomendações", style = MaterialTheme.typography.headlineSmall) }
                item { Text("Escolha quais ajustes aplicar. Cada alteração cria uma nova versão do plano e a anterior fica no histórico.", style = MaterialTheme.typography.bodyMedium) }
                recs.forEachIndexed { i, r ->
                    item {
                        AureaCard(Modifier.padding(vertical = 4.dp)) {
                            Row(verticalAlignment = Alignment.Top) {
                                val actionable = r.action != ActionType.NONE && r.action != ActionType.SEE_PROFESSIONAL
                                if (actionable && applied == null) Checkbox(selected[i] == true, { selected[i] = it })
                                Column(Modifier.weight(1f)) {
                                    Text(r.title, style = MaterialTheme.typography.titleMedium)
                                    Text(r.reason, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
                item {
                    if (applied == null) {
                        Button(onClick = {
                            scope.launch { applied = vm.applyRecommendations(id, recs.filterIndexed { i, _ -> selected[i] == true }).ifBlank { "Nenhuma alteração aplicada." } }
                        }, modifier = Modifier.fillMaxWidth().testTag("applyRecs")) { Text("Aplicar selecionadas") }
                    } else {
                        InfoBanner("Feito: $applied")
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Voltar") }
                    }
                }
            }
            if (history.isNotEmpty()) {
                item { SectionTitle("Check-ins anteriores") }
                items(history.take(10), key = { it.id }) { c ->
                    SettingRow(epochLabel(c.epochDay), c.appliedSummary.ifBlank { "Sem ajustes aplicados" }, Icons.Default.Favorite)
                }
            }
        }
    }
}

/** Histórico de planos: consultar e restaurar versões anteriores. */
@Composable
fun PlanHistoryScreen(vm: AppViewModel, onBack: () -> Unit) {
    val list by vm.planHistory.collectAsState()
    val fmt = remember { SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")) }
    var view by remember { mutableStateOf<com.aurea.fit.data.PlanEntity?>(null) }
    Scaffold(topBar = { AureaTopBar("Histórico de planos", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Text("Cada alteração gera uma versão com o motivo. Você pode consultar ou voltar para qualquer uma.", style = MaterialTheme.typography.bodyMedium) }
            items(list, key = { it.id }) { e ->
                AureaCard(onClick = { view = e }, container = if (e.active) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer) {
                    Text((if (e.kind == "WORKOUT") "Treino" else "Dieta") + if (e.active) " • ATIVO" else "", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    Text(e.reason.ifBlank { "Atualização" }, style = MaterialTheme.typography.titleSmall)
                    Text(fmt.format(Date(e.createdAt)), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
    view?.let { e ->
        val summary = remember(e) {
            runCatching {
                if (e.kind == "WORKOUT") AppJson.decodeFromString<WorkoutPlan>(e.json).days.joinToString("\n") { d -> "${WEEKDAY_SHORT[d.weekday]} — ${d.title}: " + d.exercises.joinToString { "${ExerciseLibrary.get(it.exerciseId)?.name} ${it.sets}×${it.repsLabel}" } }
                else AppJson.decodeFromString<DietPlan>(e.json).targets.let { "${it.calories} kcal • P ${it.proteinG} g • C ${it.carbsG} g • G ${it.fatG} g\n" + it.explanation.joinToString("\n") }
            }.getOrDefault("Não foi possível ler este plano.")
        }
        AlertDialog(
            onDismissRequest = { view = null },
            title = { Text(e.reason.ifBlank { "Plano" }) },
            text = { LazyColumn(Modifier.heightIn(max = 400.dp)) { item { Text(summary, style = MaterialTheme.typography.bodySmall) } } },
            confirmButton = { if (!e.active) TextButton(onClick = { vm.restorePlan(e); view = null }) { Text("Restaurar este plano") } },
            dismissButton = { TextButton(onClick = { view = null }) { Text("Fechar") } }
        )
    }
}

/** 18. Central de notificações. */
@Composable
fun NotificationsScreen(vm: AppViewModel, nav: (String) -> Unit, onBack: () -> Unit) {
    val list by vm.notifications.collectAsState()
    val fmt = remember { SimpleDateFormat("dd/MM HH:mm", Locale("pt", "BR")) }
    LaunchedEffect(list.size) { vm.markNotificationsRead() }
    Scaffold(topBar = {
        AureaTopBar("Notificações", onBack, actions = {
            IconButton(onClick = { nav("calendar") }) { Icon(Icons.Default.Tune, "Configurar lembretes") }
            if (list.isNotEmpty()) IconButton(onClick = { vm.clearNotifications() }) { Icon(Icons.Default.DeleteSweep, "Limpar tudo") }
        })
    }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (list.isEmpty()) item { EmptyState("Nenhuma notificação ainda", "Os lembretes da sua rotina aparecerão aqui quando chegarem.", "Enviar notificação de teste") { vm.testNotification() } }
            items(list, key = { it.id }) { n ->
                AureaCard(container = if (!n.read) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer) {
                    Text(n.title, style = MaterialTheme.typography.titleSmall)
                    Text(n.body, style = MaterialTheme.typography.bodyMedium)
                    Text(fmt.format(Date(n.timeMillis)), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

/** 16. Configurações: tema, lembretes, privacidade, backup, exportação e exclusão. */
@Composable
fun SettingsScreen(vm: AppViewModel, onLoggedOut: () -> Unit, onDeleted: () -> Unit, onBack: () -> Unit) {
    val s by vm.settings.collectAsState()
    val scope = rememberCoroutineScope()
    var msg by remember { mutableStateOf<String?>(null) }
    var includePhotos by remember { mutableStateOf(true) }
    var confirmDelete by remember { mutableStateOf(false) }
    var confirmImport by remember { mutableStateOf<android.net.Uri?>(null) }
    var pwDialog by remember { mutableStateOf(false) }
    val notifPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        msg = if (granted) "Notificações permitidas." else "Sem permissão, os lembretes não aparecem na barra do celular."
    }
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        if (uri != null) scope.launch {
            msg = vm.exportTo(uri, includePhotos).fold({ "Backup salvo com sucesso ($it foto(s))." }, { "Erro ao exportar: ${it.message}" })
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) confirmImport = uri }
    val host = remember { SnackbarHostState() }
    LaunchedEffect(msg) { msg?.let { host.showSnackbar(it); msg = null } }

    Scaffold(topBar = { AureaTopBar("Configurações", onBack) }, snackbarHost = { SnackbarHost(host) }) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp)) {
            item { SectionTitle("Aparência") }
            item { SingleChoice(listOf(0, 1, 2), s.themeMode, { listOf("Automático", "Claro", "Escuro")[it] }, { m -> vm.updateSettings { it.copy(themeMode = m) } }) }
            item { SectionTitle("Lembretes") }
            item {
                SettingRow("Notificações da rotina", "Refeições, treino, água, descanso e sono", Icons.Default.Notifications, trailing = {
                    Switch(s.notificationsEnabled, { on ->
                        vm.updateSettings { it.copy(notificationsEnabled = on) }
                        if (on && Build.VERSION.SDK_INT >= 33) notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }, modifier = Modifier.testTag("notifSwitch"))
                })
            }
            item {
                SettingRow("Enviar notificação de teste", "Confere se os lembretes aparecem no seu celular", Icons.Default.NotificationsActive, onClick = {
                    if (Build.VERSION.SDK_INT >= 33) notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
                    vm.testNotification(); msg = "Notificação de teste enviada."
                })
            }
            item { SectionTitle("Privacidade e bem-estar") }
            item { SettingRow("Ocultar calorias", "Mostra só porções e macronutrientes (útil para quem prefere não contar calorias)", Icons.Default.VisibilityOff, trailing = { Switch(s.hideCalories, { v -> vm.updateSettings { it.copy(hideCalories = v) } }) }) }
            item { SettingRow("Bloquear capturas de tela", "Protege fotos e dados de aparecerem em prints e na tela de apps recentes", Icons.Default.Lock, trailing = { Switch(s.secureScreen, { v -> vm.updateSettings { it.copy(secureScreen = v) } }) }) }
            item { SectionTitle("Backup e exportação") }
            item {
                AureaCard {
                    Text("Seus dados ficam só neste celular. Para ter uma cópia de segurança, exporte um arquivo .zip e salve onde quiser (memória, cartão, Google Drive…). Nenhum envio automático é feito.", style = MaterialTheme.typography.bodySmall)
                    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(includePhotos, { includePhotos = it }); Text("Incluir fotos de progresso") }
                    Button(onClick = { exportLauncher.launch("aurea-backup-${java.time.LocalDate.now()}.zip") }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Backup, null); Spacer(Modifier.width(8.dp)); Text("Exportar meus dados / fazer backup") }
                    OutlinedButton(onClick = { importLauncher.launch(arrayOf("application/zip", "application/octet-stream")) }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Restore, null); Spacer(Modifier.width(8.dp)); Text("Restaurar backup") }
                }
            }
            item { SectionTitle("Conta") }
            item { SettingRow("Alterar senha", null, Icons.Default.Password, { pwDialog = true }) }
            item { SettingRow("Sair da conta", "Seus dados continuam salvos neste celular", Icons.Default.Logout, { vm.logout(); onLoggedOut() }) }
            item { SettingRow("Excluir conta e todos os dados", "Apaga permanentemente perfil, planos, registros, fotos e lembretes", Icons.Default.DeleteForever, { confirmDelete = true }) }
            item { SectionTitle("Sobre") }
            item {
                Text("Áurea 1.0 — aplicativo educativo de treino e alimentação. Não substitui médico(a), nutricionista ou educador(a) físico(a). Cálculos: Mifflin-St Jeor (gasto basal), recomendações de proteína para praticantes de musculação (1,6–2,2 g/kg), tabela TACO (alimentos).",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
    if (confirmDelete) ConfirmDialog("Excluir tudo?", "Esta ação não pode ser desfeita. Faça um backup antes, se quiser guardar seus dados.", "Excluir definitivamente", true, { confirmDelete = false }) {
        confirmDelete = false; vm.deleteEverything { onDeleted() }
    }
    confirmImport?.let { uri ->
        ConfirmDialog("Restaurar backup?", "Os dados atuais deste celular serão substituídos pelos do arquivo.", "Restaurar", true, { confirmImport = null }) {
            confirmImport = null
            scope.launch { msg = vm.importFrom(uri).fold({ "Backup restaurado." }, { "Erro ao restaurar: ${it.message}" }) }
        }
    }
    if (pwDialog) {
        var old by remember { mutableStateOf("") }; var new by remember { mutableStateOf("") }; var err by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { pwDialog = false },
            title = { Text("Alterar senha") },
            text = {
                Column {
                    OutlinedTextField(old, { old = it }, label = { Text("Senha atual") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                    OutlinedTextField(new, { new = it }, label = { Text("Nova senha") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                    err?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = { TextButton(onClick = { scope.launch { when (val r = vm.changePassword(old, new)) { is AuthResult.Ok -> { pwDialog = false; msg = "Senha alterada." }; is AuthResult.Error -> err = r.message } } }) { Text("Salvar") } },
            dismissButton = { TextButton(onClick = { pwDialog = false }) { Text("Cancelar") } }
        )
    }
}
