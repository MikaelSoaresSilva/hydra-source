package com.aurea.fit.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aurea.fit.domain.*
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*

/** Etapas do questionário inicial (também usado para editar o perfil). */
private enum class Step(val title: String) {
    WELCOME("Boas-vindas"), PERSONAL("Sobre você"), GOAL("Seu objetivo"), EXPERIENCE("Experiência"),
    BODY("Objetivo corporal"), STRUCTURE("Seus treinos"), EXERCISES("Exercícios e limitações"),
    FOOD("Alimentação"), FOOD2("Preferências alimentares"), ROUTINE("Rotina e recuperação"),
    HEALTH("Saúde e segurança"), ASSESSMENT("Avaliação física inicial")
}

@Composable
fun OnboardingScreen(vm: AppViewModel, initial: UserProfile?, editing: Boolean, onFinished: () -> Unit, onBack: (() -> Unit)? = null) {
    val account by vm.account.collectAsState()
    var p by remember { mutableStateOf(initial ?: UserProfile(name = account?.name ?: "")) }
    LaunchedEffect(account) { if (p.name.isBlank() && account != null) p = p.copy(name = account!!.name) }
    val steps = Step.entries.filter { !(editing && it == Step.WELCOME) }
    var index by rememberSaveable { mutableIntStateOf(0) }
    val step = steps[index]
    var saving by remember { mutableStateOf(false) }
    val error = validate(step, p)

    Scaffold(
        topBar = {
            Column(Modifier.background(MaterialTheme.colorScheme.background).statusBarsPadding().padding(horizontal = 20.dp, vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (index > 0 || onBack != null) {
                        TextButton(onClick = { if (index > 0) index-- else onBack?.invoke() }) { Text("Voltar") }
                    }
                    Spacer(Modifier.weight(1f))
                    Text("${index + 1} de ${steps.size}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                LinearProgressIndicator(progress = { (index + 1f) / steps.size }, modifier = Modifier.fillMaxWidth().height(6.dp))
            }
        },
        bottomBar = {
            Column(Modifier.background(MaterialTheme.colorScheme.background).navigationBarsPadding().padding(16.dp)) {
                if (error != null) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 6.dp))
                Button(
                    onClick = {
                        if (index < steps.lastIndex) index++ else {
                            saving = true
                            vm.saveProfile(p, if (editing) "Perfil atualizado" else "Plano inicial criado a partir do questionário") { saving = false; onFinished() }
                        }
                    },
                    enabled = error == null && !saving,
                    modifier = Modifier.fillMaxWidth().height(52.dp).testTag("next")
                ) {
                    Text(
                        when {
                            saving -> "Montando seu plano…"
                            index == steps.lastIndex -> if (editing) "Salvar e atualizar meu plano" else "Criar meu plano personalizado"
                            step == Step.WELCOME -> "Começar avaliação"
                            else -> "Continuar"
                        }
                    )
                }
            }
        }
    ) { pad ->
        AnimatedContent(
            targetState = step, label = "step",
            transitionSpec = { (slideInHorizontally { it / 3 } + fadeIn()) togetherWith (slideOutHorizontally { -it / 3 } + fadeOut()) }
        ) { s ->
            Column(
                Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (s != Step.WELCOME) Text(s.title, style = MaterialTheme.typography.headlineMedium)
                when (s) {
                    Step.WELCOME -> WelcomeStep()
                    Step.PERSONAL -> PersonalStep(p) { p = it }
                    Step.GOAL -> GoalStep(p) { p = it }
                    Step.EXPERIENCE -> ExperienceStep(p) { p = it }
                    Step.BODY -> BodyStep(p) { p = it }
                    Step.STRUCTURE -> StructureStep(p) { p = it }
                    Step.EXERCISES -> ExercisesStep(p) { p = it }
                    Step.FOOD -> FoodStep(p) { p = it }
                    Step.FOOD2 -> Food2Step(p) { p = it }
                    Step.ROUTINE -> RoutineStep(p) { p = it }
                    Step.HEALTH -> HealthStep(p) { p = it }
                    Step.ASSESSMENT -> AssessmentStep(p) { p = it }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

private fun validate(step: Step, p: UserProfile): String? = when (step) {
    Step.PERSONAL -> when {
        p.name.isBlank() -> "Informe seu nome."
        p.age !in 12..90 -> "Idade deve estar entre 12 e 90 anos."
        p.heightCm !in 120.0..220.0 -> "Altura deve estar entre 120 e 220 cm."
        p.weightKg !in 30.0..250.0 -> "Peso deve estar entre 30 e 250 kg."
        else -> null
    }
    Step.STRUCTURE -> if (p.location == Location.HOME && p.homeEquipment.isEmpty()) "Selecione pelo menos uma opção de equipamento." else null
    Step.ROUTINE -> if (minutesOf(p.wakeTime) == minutesOf(p.sleepTime)) "Os horários de acordar e dormir precisam ser diferentes." else null
    else -> null
}

/* ----------------------------------------------------------------- etapas */

@Composable
private fun WelcomeStep() {
    HeroCard {
        Text("Olá! Eu sou a Áurea.", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Vou montar seu treino, sua alimentação e sua rotina com base nas suas respostas. Leva cerca de 5 minutos.", style = MaterialTheme.typography.bodyLarge)
    }
    AureaCard {
        Text("A Meta Áurea", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(6.dp))
        Text(
            "Nossa referência estética é um físico atlético e equilibrado: glúteos desenvolvidos e arredondados, pernas fortes " +
                "(quadríceps, posteriores e panturrilhas), cintura marcada, costas definidas e abdômen firme. " +
                "Por isso o app dá atenção especial a glúteos, pernas, abdômen e costas — sem deixar de treinar o corpo todo.",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(Modifier.height(8.dp))
        InfoBanner("Cada corpo é único: genética, estrutura óssea e rotina influenciam o resultado. O objetivo é a melhor versão do SEU corpo — não uma cópia de fotos. Abdômen muito definido, por exemplo, exige gordura corporal baixa, que nem sempre é saudável ou sustentável para todas.")
    }
    AureaCard {
        Text("Importante", style = MaterialTheme.typography.titleMedium)
        Text("O Áurea é uma ferramenta educativa. Ele não substitui médico(a), nutricionista ou educador(a) físico(a). Em caso de dor, doença, gestação ou dúvidas, procure um profissional.", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun PersonalStep(p: UserProfile, set: (UserProfile) -> Unit) {
    OutlinedTextField(p.name, { set(p.copy(name = it.take(40))) }, label = { Text("Como podemos te chamar?") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    var age by remember { mutableStateOf(p.age.toString()) }
    var h by remember { mutableStateOf(fmt1(p.heightCm)) }
    var w by remember { mutableStateOf(fmt1(p.weightKg)) }
    NumberField("Idade", age, { age = it; set(p.copy(age = it.toIntOrNull() ?: 0)) }, suffix = "anos", decimal = false)
    NumberField("Altura", h, { h = it; set(p.copy(heightCm = it.toDoubleOrNull() ?: 0.0)) }, suffix = "cm")
    NumberField("Peso atual", w, { w = it; set(p.copy(weightKg = it.toDoubleOrNull() ?: 0.0)) }, suffix = "kg")
    Text("Sexo biológico (usado apenas na fórmula de gasto calórico)", style = MaterialTheme.typography.titleSmall)
    SingleChoice(Sex.entries, p.sex, { it.label }, { set(p.copy(sex = it)) })
}

@Composable
private fun GoalStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Text("Escolha o objetivo principal. Você pode mudar quando quiser.", style = MaterialTheme.typography.bodyMedium)
    val icons = mapOf(Goal.LOSE_FAT to Icons.Default.LocalFireDepartment, Goal.GAIN_MUSCLE to Icons.Default.FitnessCenter, Goal.RECOMP to Icons.Default.Autorenew, Goal.MAINTAIN to Icons.Default.Balance, Goal.GAIN_WEIGHT to Icons.Default.TrendingUp)
    Goal.entries.forEach { g -> OptionCard(g.label, g.description, p.goal == g, { set(p.copy(goal = g)) }, icons[g]) }
    InfoBanner("Ganho de massa muscular ≠ ganho de peso: o primeiro foca em construir músculo com superávit pequeno; o segundo aumenta o peso total (músculo e reservas).")
}

@Composable
private fun ExperienceStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Experience.entries.forEach { e -> OptionCard(e.label, e.description, p.experience == e, { set(p.copy(experience = e)) }) }
    Text("Você já treinou anteriormente?", style = MaterialTheme.typography.titleSmall)
    SingleChoice(listOf(true, false), p.trainedBefore, { if (it) "Sim" else "Não" }, { set(p.copy(trainedBefore = it, trainingMonths = if (it) p.trainingMonths else 0)) })
    if (p.trainedBefore) Stepper("Há quanto tempo treina (meses)", p.trainingMonths, 0..240, { set(p.copy(trainingMonths = it)) })
}

@Composable
private fun BodyStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Text("O que você deseja? (pode escolher várias)", style = MaterialTheme.typography.titleSmall)
    MultiChoice(BodyGoal.entries, p.bodyGoals, { it.label }, { set(p.copy(bodyGoals = it)) })
    Text("Quais regiões deseja priorizar?", style = MaterialTheme.typography.titleSmall)
    MultiChoice(Muscle.entries, p.priorityMuscles, { it.label }, { set(p.copy(priorityMuscles = it)) })
    AureaCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Usar a Meta Áurea como referência", style = MaterialTheme.typography.titleMedium)
                Text("Ênfase em glúteos, pernas, abdômen e costas, com treino equilibrado.", style = MaterialTheme.typography.bodySmall)
            }
            Switch(p.aureaReference, { set(p.copy(aureaReference = it)) })
        }
    }
}

@Composable
private fun StructureStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Stepper("Dias de treino por semana", p.daysPerWeek, 1..6, { set(p.copy(daysPerWeek = it)) })
    Text("Quais dias estão disponíveis?", style = MaterialTheme.typography.titleSmall)
    MultiChoice((1..7).toList(), p.availableDays, { WEEKDAY_SHORT[it] }, { set(p.copy(availableDays = it)) })
    if (p.availableDays.size < p.daysPerWeek) Text("Você marcou menos dias que o número de treinos; vamos completar com dias espaçados.", style = MaterialTheme.typography.bodySmall)
    Text("Tempo disponível por treino", style = MaterialTheme.typography.titleSmall)
    SingleChoice(listOf(30, 45, 60, 75, 90), p.minutesPerSession, { "$it min" }, { set(p.copy(minutesPerSession = it)) })
    Text(if (p.minutesPerSession <= 45) "Treinos curtos e objetivos." else "Treinos mais completos.", style = MaterialTheme.typography.bodySmall)
    Text("Onde você treina?", style = MaterialTheme.typography.titleSmall)
    SingleChoice(Location.entries, p.location, { it.label }, { set(p.copy(location = it)) })
    if (p.location == Location.HOME) {
        Text("Quais equipamentos você tem em casa?", style = MaterialTheme.typography.titleSmall)
        val homeEq = Equipment.entries.filter { it != Equipment.MACHINES && it != Equipment.CABLE }
        MultiChoice(homeEq, p.homeEquipment, { it.label }, { set(p.copy(homeEquipment = it)) })
    }
}

@Composable
private fun ExercisesStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Text("Possui dores, lesões ou limitações de movimento?", style = MaterialTheme.typography.titleSmall)
    MultiChoice(Limitation.entries, p.limitations, { it.label }, { set(p.copy(limitations = it)) })
    OutlinedTextField(p.limitationNotes, { set(p.copy(limitationNotes = it.take(300))) }, label = { Text("Detalhes (opcional)") }, modifier = Modifier.fillMaxWidth())
    val main = listOf("hip_thrust_barra", "agachamento_livre", "leg_press_45", "cadeira_extensora", "mesa_flexora", "cadeira_flexora", "stiff_barra",
        "rdl_halter", "cadeira_abdutora", "coice_cabo", "afundo_halter", "bulgaro", "panturrilha_pe", "panturrilha_sentada", "prancha",
        "abdominal_polia", "puxada_alta", "remada_baixa", "desenvolvimento_halter", "elevacao_lateral").mapNotNull { ExerciseLibrary.get(it) }
    Text("Exercícios preferidos (opcional)", style = MaterialTheme.typography.titleSmall)
    MultiChoice(main.map { it.id }.toList(), p.preferredExercises, { ExerciseLibrary.get(it)!!.name }, { set(p.copy(preferredExercises = it, excludedExercises = p.excludedExercises - it)) })
    Text("Exercícios que você NÃO consegue ou não quer fazer", style = MaterialTheme.typography.titleSmall)
    MultiChoice(main.map { it.id }.toList(), p.excludedExercises, { ExerciseLibrary.get(it)!!.name }, { set(p.copy(excludedExercises = it, preferredExercises = p.preferredExercises - it)) })
}

@Composable
private fun FoodStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Stepper("Refeições por dia", p.mealsPerDay, 3..6, { set(p.copy(mealsPerDay = it)) })
    var budget by remember { mutableStateOf(p.monthlyBudget.toString()) }
    NumberField("Orçamento mensal para alimentação", budget, { budget = it; set(p.copy(monthlyBudget = it.toIntOrNull() ?: 0)) }, suffix = "R$", decimal = false, supporting = "Somente da sua alimentação")
    Text("Sabe cozinhar?", style = MaterialTheme.typography.titleSmall)
    SingleChoice(CookSkill.entries, p.cookSkill, { it.label }, { set(p.copy(cookSkill = it)) })
    Text("Tempo disponível para preparar refeições (por dia)", style = MaterialTheme.typography.titleSmall)
    SingleChoice(listOf(10, 15, 30, 45, 60), p.prepMinutes, { "$it min" }, { set(p.copy(prepMinutes = it)) })
    SwitchRow("Quero uma dieta econômica", p.economic) { set(p.copy(economic = it)) }
    SwitchRow("Prefiro alimentos comuns de supermercados brasileiros", p.brazilianCommon) { set(p.copy(brazilianCommon = it)) }
}

@Composable
private fun Food2Step(p: UserProfile, set: (UserProfile) -> Unit) {
    Text("Restrição alimentar", style = MaterialTheme.typography.titleSmall)
    SingleChoice(DietRestriction.entries, p.restriction, { it.label }, { set(p.copy(restriction = it)) })
    Text("Alergias ou intolerâncias", style = MaterialTheme.typography.titleSmall)
    MultiChoice(Allergy.entries, p.allergies, { it.label }, { set(p.copy(allergies = it)) })
    val foods = FoodDb.commonChoices
    Text("Alimentos que você costuma consumir (terão prioridade)", style = MaterialTheme.typography.titleSmall)
    MultiChoice(foods.map { it.id }, p.usualFoods, { FoodDb.get(it)!!.name }, { set(p.copy(usualFoods = it, dislikedFoods = p.dislikedFoods - it)) })
    Text("Alimentos que você NÃO gosta (não aparecerão)", style = MaterialTheme.typography.titleSmall)
    MultiChoice(foods.map { it.id }, p.dislikedFoods, { FoodDb.get(it)!!.name }, { set(p.copy(dislikedFoods = it, usualFoods = p.usualFoods - it)) })
}

@Composable
private fun RoutineStep(p: UserProfile, set: (UserProfile) -> Unit) {
    TimeField("Costumo acordar às", p.wakeTime, { set(p.copy(wakeTime = it)) })
    TimeField("Costumo dormir às", p.sleepTime, { set(p.copy(sleepTime = it)) })
    TimeField("Prefiro treinar às", p.trainTime, { set(p.copy(trainTime = it)) })
    Text("Trabalha ou estuda?", style = MaterialTheme.typography.titleSmall)
    SingleChoice(Occupation.entries, p.occupation, { it.label }, { set(p.copy(occupation = it)) })
    Text("Nível de atividade durante o dia (fora do treino)", style = MaterialTheme.typography.titleSmall)
    ActivityLevel.entries.forEach { a -> OptionCard(a.label, a.description, p.activityLevel == a, { set(p.copy(activityLevel = a)) }) }
    Stepper("Horas de sono por noite", (p.sleepHours * 2).toInt(), 6..24, { set(p.copy(sleepHours = it / 2.0)) }, format = { fmt1(it / 2.0) + " h" })
    if (p.sleepHours < 7) InfoBanner("Dormir menos de 7 horas atrapalha a recuperação muscular e aumenta a fome. Tente, aos poucos, dormir mais.", warning = true)
}

@Composable
private fun HealthStep(p: UserProfile, set: (UserProfile) -> Unit) {
    InfoBanner("Todas as perguntas desta etapa são opcionais. As respostas ficam somente no seu celular e servem apenas para deixar o plano mais seguro.")
    Text("Condições de saúde relevantes", style = MaterialTheme.typography.titleSmall)
    MultiChoice(HealthCondition.entries, p.conditions, { it.label }, { set(p.copy(conditions = it)) })
    OutlinedTextField(p.medications, { set(p.copy(medications = it.take(200))) }, label = { Text("Medicamentos que podem interferir no exercício (opcional)") }, modifier = Modifier.fillMaxWidth())
    if (p.sex == Sex.FEMALE) {
        SwitchRow("Estou grávida", p.pregnant) { set(p.copy(pregnant = it)) }
        SwitchRow("Estou amamentando", p.breastfeeding) { set(p.copy(breastfeeding = it)) }
    }
    SwitchRow("Tenho ou tive transtorno alimentar (anorexia, bulimia, compulsão)", p.eatingDisorderHistory) { set(p.copy(eatingDisorderHistory = it)) }
    OutlinedTextField(p.healthNotes, { set(p.copy(healthNotes = it.take(300))) }, label = { Text("Outras observações (opcional)") }, modifier = Modifier.fillMaxWidth())
    val s = Safety.assess(p)
    s.warnings.forEach { InfoBanner(it, warning = true) }
}

@Composable
private fun AssessmentStep(p: UserProfile, set: (UserProfile) -> Unit) {
    Text("Medidas iniciais (opcional). Use uma fita métrica, sem apertar, sempre no mesmo horário.", style = MaterialTheme.typography.bodyMedium)
    MeasureInput("Cintura (na altura do umbigo)", p.waistCm) { set(p.copy(waistCm = it)) }
    MeasureInput("Quadril (parte mais larga dos glúteos)", p.hipCm) { set(p.copy(hipCm = it)) }
    MeasureInput("Coxa (meio da coxa)", p.thighCm) { set(p.copy(thighCm = it)) }
    MeasureInput("Braço (meio do braço, relaxado)", p.armCm) { set(p.copy(armCm = it)) }
    val bmi = Nutrition.bmi(p)
    val t = Nutrition.targets(p)
    AureaCard {
        Text("Seu resumo", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(6.dp))
        Text("IMC: ${"%.1f".format(bmi)} (${bmiLabel(bmi)}) — o IMC é só uma referência e não mede composição corporal.", style = MaterialTheme.typography.bodyMedium)
        if (p.waistCm != null && p.hipCm != null && p.hipCm > 0) Text("Relação cintura/quadril: ${"%.2f".format(p.waistCm / p.hipCm)}", style = MaterialTheme.typography.bodyMedium)
        Text("Objetivo: ${p.goal.label}", style = MaterialTheme.typography.bodyMedium)
        Text("Meta diária estimada: ${t.calories} kcal • ${t.proteinG} g de proteína • ${t.waterMl / 1000.0} L de água", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

fun bmiLabel(b: Double) = when {
    b < 18.5 -> "abaixo do recomendado"; b < 25 -> "adequado"; b < 30 -> "sobrepeso"; else -> "obesidade"
}

@Composable
private fun MeasureInput(label: String, value: Double?, onChange: (Double?) -> Unit) {
    var text by remember { mutableStateOf(value?.let { fmt1(it) } ?: "") }
    NumberField(label, text, { text = it; onChange(it.toDoubleOrNull()?.takeIf { v -> v in 10.0..250.0 }) }, suffix = "cm")
}

@Composable
fun SwitchRow(text: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Switch(checked, onChange)
    }
}
