package com.aurea.fit.domain

import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.roundToInt

@Serializable
data class PlannedExercise(
    val exerciseId: String,
    val sets: Int,
    val repMin: Int,
    val repMax: Int,
    val restSec: Int,
    val timeBased: Boolean = false,
    val note: String = ""
) {
    val repsLabel: String get() = if (timeBased) "$repMin–$repMax s" else "$repMin–$repMax"
}

@Serializable
enum class DayType { STRENGTH, ACTIVE_RECOVERY }

@Serializable
data class WorkoutDay(
    val index: Int,
    val title: String,
    val focus: String,
    val weekday: Int, // 1 = segunda ... 7 = domingo
    val type: DayType = DayType.STRENGTH,
    val exercises: List<PlannedExercise> = emptyList(),
    val extra: String = ""
)

@Serializable
data class WorkoutPlan(
    val days: List<WorkoutDay>,
    val cardio: String,
    val notes: List<String>,
    val setsDelta: Int = 0
)

val WEEKDAY_NAMES = listOf("", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo")
val WEEKDAY_SHORT = listOf("", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom")

/**
 * Gerador de ficha individualizada.
 * Considera: dias e tempo disponíveis, experiência, local/equipamentos, objetivos e
 * regiões prioritárias, exercícios preferidos/excluídos e limitações físicas.
 */
object WorkoutGenerator {

    private data class Template(val title: String, val focus: String, val slots: List<Slot>)

    private val LOWER_GLUTE = Template(
        "Inferiores A", "Glúteos e posteriores de coxa",
        listOf(Slot.HIP_THRUST, Slot.HINGE, Slot.LUNGE, Slot.ABDUCTION, Slot.KNEE_FLEX, Slot.KICKBACK, Slot.CALF, Slot.CORE)
    )
    private val LOWER_QUAD = Template(
        "Inferiores B", "Quadríceps e glúteos",
        listOf(Slot.SQUAT, Slot.HIP_THRUST, Slot.LEG_PRESS, Slot.KNEE_EXT, Slot.ABDUCTION, Slot.KNEE_FLEX, Slot.CALF, Slot.CORE)
    )
    private val UPPER = Template(
        "Superiores A", "Costas, ombros, peito e braços",
        listOf(Slot.VERTICAL_PULL, Slot.HORIZONTAL_PULL, Slot.VERTICAL_PUSH, Slot.LATERAL_RAISE, Slot.HORIZONTAL_PUSH, Slot.TRICEPS, Slot.BICEPS, Slot.CORE)
    )
    private val UPPER_BACK = Template(
        "Superiores B", "Costas, ombros e abdômen",
        listOf(Slot.HORIZONTAL_PULL, Slot.VERTICAL_PULL, Slot.LATERAL_RAISE, Slot.VERTICAL_PUSH, Slot.CORE, Slot.BICEPS, Slot.TRICEPS, Slot.CORE)
    )
    private val GLUTE_ISO = Template(
        "Glúteos C", "Glúteos, glúteo médio e core",
        listOf(Slot.HIP_THRUST, Slot.KICKBACK, Slot.ABDUCTION, Slot.HINGE, Slot.LUNGE, Slot.CORE, Slot.CALF, Slot.CORE)
    )
    private val FULL_A = Template(
        "Corpo inteiro A", "Pernas, glúteos, costas e peito",
        listOf(Slot.SQUAT, Slot.HIP_THRUST, Slot.VERTICAL_PULL, Slot.HORIZONTAL_PUSH, Slot.KNEE_FLEX, Slot.LATERAL_RAISE, Slot.CORE, Slot.CALF)
    )
    private val FULL_B = Template(
        "Corpo inteiro B", "Posteriores, glúteos, costas e ombros",
        listOf(Slot.HINGE, Slot.LUNGE, Slot.HORIZONTAL_PULL, Slot.VERTICAL_PUSH, Slot.ABDUCTION, Slot.CORE, Slot.CALF, Slot.BICEPS)
    )
    private val FULL_C = Template(
        "Corpo inteiro C", "Glúteos, quadríceps e costas",
        listOf(Slot.HIP_THRUST, Slot.LEG_PRESS, Slot.HORIZONTAL_PULL, Slot.LATERAL_RAISE, Slot.KICKBACK, Slot.KNEE_EXT, Slot.CORE, Slot.TRICEPS)
    )

    private val LOWER_SLOTS = setOf(
        Slot.HIP_THRUST, Slot.SQUAT, Slot.LEG_PRESS, Slot.HINGE, Slot.LUNGE, Slot.KNEE_FLEX,
        Slot.KNEE_EXT, Slot.ABDUCTION, Slot.KICKBACK, Slot.CALF
    )
    private val COMPOUND_SLOTS = setOf(
        Slot.HIP_THRUST, Slot.SQUAT, Slot.LEG_PRESS, Slot.HINGE, Slot.LUNGE,
        Slot.VERTICAL_PULL, Slot.HORIZONTAL_PULL, Slot.VERTICAL_PUSH, Slot.HORIZONTAL_PUSH
    )

    fun exercisesPerSession(minutes: Int): Int = when {
        minutes <= 30 -> 4
        minutes <= 45 -> 5
        minutes <= 60 -> 6
        minutes <= 75 -> 7
        else -> 8
    }

    fun lowerPriority(p: UserProfile): Boolean =
        BodyGoal.GLUTES in p.bodyGoals || BodyGoal.LEGS in p.bodyGoals || BodyGoal.PROPORTION in p.bodyGoals ||
            p.priorityMuscles.any { it in setOf(Muscle.GLUTE_MAX, Muscle.GLUTE_MED, Muscle.QUADS, Muscle.HAMSTRINGS, Muscle.CALVES) } ||
            p.aureaReference

    private fun split(strengthDays: Int, p: UserProfile): List<Template> = when (strengthDays) {
        1 -> listOf(FULL_A)
        2 -> listOf(FULL_A, FULL_B)
        3 -> if (lowerPriority(p)) listOf(LOWER_GLUTE, UPPER, LOWER_QUAD) else listOf(FULL_A, FULL_B, FULL_C)
        4 -> listOf(LOWER_GLUTE, UPPER, LOWER_QUAD, UPPER_BACK)
        5 -> listOf(LOWER_GLUTE, UPPER, LOWER_QUAD, UPPER_BACK, GLUTE_ISO)
        else -> listOf(LOWER_GLUTE, UPPER, LOWER_QUAD, UPPER_BACK, GLUTE_ISO, FULL_C)
    }

    /** Escolhe os dias da semana: usa os dias disponíveis e espalha os treinos. */
    fun chooseWeekdays(p: UserProfile): List<Int> {
        val n = p.daysPerWeek.coerceIn(1, 7)
        val avail = p.availableDays.filter { it in 1..7 }.sorted()
        if (avail.size == n) return avail
        if (avail.size > n) {
            // espalha de forma uniforme dentro dos disponíveis
            return (0 until n).map { i -> avail[(i * avail.size) / n] }.distinct().let { chosen ->
                if (chosen.size == n) chosen else (chosen + avail.filter { it !in chosen }).take(n).sorted()
            }
        }
        // poucos dias marcados: completa com dias padrão espaçados
        val defaults = when (n) {
            1 -> listOf(3); 2 -> listOf(2, 5); 3 -> listOf(1, 3, 5); 4 -> listOf(1, 2, 4, 5)
            5 -> listOf(1, 2, 3, 5, 6); 6 -> listOf(1, 2, 3, 4, 5, 6); else -> (1..7).toList()
        }
        return (avail + defaults.filter { it !in avail }).take(n).sorted()
    }

    fun generate(p: UserProfile, setsDelta: Int = 0): WorkoutPlan {
        val weekdays = chooseWeekdays(p)
        val maxStrength = if (p.experience == Experience.BEGINNER) 4 else 6
        val strengthDays = weekdays.size.coerceAtMost(maxStrength)
        val templates = split(strengthDays, p)
        val perSession = exercisesPerSession(p.minutesPerSession)
        val equipment = ExerciseLibrary.availableEquipment(p)
        val usage = mutableMapOf<Slot, Int>()
        val notes = mutableListOf<String>()

        // Distribui os dias de força primeiro, intercalando recuperação ativa quando houver.
        val days = mutableListOf<WorkoutDay>()
        var tIndex = 0
        weekdays.forEachIndexed { i, wd ->
            if (tIndex < templates.size && (i < strengthDays)) {
                val t = templates[tIndex++]
                val ex = buildDay(t, p, perSession, equipment, usage, setsDelta)
                days += WorkoutDay(i, "${t.title}", t.focus, wd, DayType.STRENGTH, ex)
            } else {
                days += WorkoutDay(
                    i, "Recuperação ativa", "Cardio leve e mobilidade", wd, DayType.ACTIVE_RECOVERY,
                    exercises = listOf(PlannedExercise("prancha", 2, 20, 40, 45, timeBased = true), PlannedExercise("dead_bug", 2, 8, 12, 45)),
                    extra = "25–35 min de caminhada rápida, bicicleta ou elíptico em ritmo confortável (dá para conversar), seguido de 10 min de alongamento e mobilidade de quadril."
                )
            }
        }
        if (weekdays.size > strengthDays) {
            notes += "Como você está começando, limitamos a 4 treinos de força por semana para garantir boa recuperação. Os outros dias são de recuperação ativa."
        }

        val cardio = when (p.goal) {
            Goal.LOSE_FAT -> "Caminhe de 7.000 a 10.000 passos por dia e faça 2–3 sessões de 20–30 min de cardio leve a moderado (caminhada inclinada, bicicleta). O treino de força continua sendo prioridade para preservar os músculos."
            Goal.RECOMP -> "Busque 7.000 a 9.000 passos por dia e 1–2 sessões de 20 min de cardio leve após o treino ou em dias livres."
            Goal.GAIN_MUSCLE, Goal.GAIN_WEIGHT -> "Cardio leve 1–2x por semana (15–20 min) para saúde do coração, sem atrapalhar a recuperação."
            Goal.MAINTAIN -> "Mantenha-se ativa: 6.000 a 9.000 passos por dia e 1–2 sessões de cardio de 20–30 min."
        }
        notes += "Aquecimento antes de cada treino: 5 min de cardio leve + 1–2 séries leves do primeiro exercício."
        notes += "Escolha cargas que deixem 1 a 3 repetições \"sobrando\" no fim de cada série (esforço 7–9 de 10)."
        if (p.limitations.isNotEmpty()) {
            notes += "Exercícios que podem forçar ${p.limitations.joinToString { it.label.lowercase() }} foram substituídos. Se sentir dor (diferente de cansaço muscular), pare e procure um profissional."
        }
        if (lowerPriority(p)) {
            notes += "Ênfase em glúteos e pernas, mantendo costas, ombros e core treinados para um físico equilibrado."
        }
        return WorkoutPlan(days, cardio, notes, setsDelta)
    }

    private fun buildDay(
        t: Template, p: UserProfile, n: Int, equipment: Set<Equipment>,
        usage: MutableMap<Slot, Int>, setsDelta: Int
    ): List<PlannedExercise> {
        val slots = t.slots.toMutableList()
        // Prioridades: abdômen garante um exercício de core; costas garante as duas puxadas.
        val chosenSlots = slots.take(n).toMutableList()
        if ((BodyGoal.ABS in p.bodyGoals || Muscle.CORE in p.priorityMuscles) && Slot.CORE !in chosenSlots && Slot.CORE in slots) {
            chosenSlots[chosenSlots.lastIndex] = Slot.CORE
        }
        if ((BodyGoal.BACK in p.bodyGoals || Muscle.BACK in p.priorityMuscles) && Slot.VERTICAL_PULL in slots && Slot.HORIZONTAL_PULL in slots) {
            listOf(Slot.VERTICAL_PULL, Slot.HORIZONTAL_PULL).forEach { s ->
                if (s !in chosenSlots) chosenSlots[chosenSlots.lastIndex - 1] = s
            }
        }
        val usedIds = mutableSetOf<String>()
        val result = mutableListOf<PlannedExercise>()
        for (slot in chosenSlots) {
            val ex = pick(slot, p, equipment, usage, usedIds) ?: continue
            usedIds += ex.id
            result += prescribe(ex, p, setsDelta)
        }
        return result
    }

    private fun pick(slot: Slot, p: UserProfile, equipment: Set<Equipment>, usage: MutableMap<Slot, Int>, used: Set<String>): Exercise? {
        var candidates = ExerciseLibrary.all.filter { it.slot == slot && it.id !in used && ExerciseLibrary.isAllowed(it, p, equipment) }
        if (candidates.isEmpty()) {
            // Fallback: algo seguro que trabalhe os mesmos músculos.
            val target = ExerciseLibrary.all.firstOrNull { it.slot == slot }?.primary ?: return null
            candidates = ExerciseLibrary.all.filter { it.primary == target && it.id !in used && ExerciseLibrary.isAllowed(it, p, equipment) }
        }
        if (candidates.isEmpty()) return null
        val sorted = candidates.sortedWith(
            compareByDescending<Exercise> { it.id in p.preferredExercises }
                .thenByDescending { if (p.experience == Experience.BEGINNER) -it.minLevel.ordinal else 0 }
        )
        val preferred = sorted.filter { it.id in p.preferredExercises }
        val count = usage.getOrDefault(slot, 0)
        usage[slot] = count + 1
        return if (preferred.isNotEmpty()) preferred[count % preferred.size] else sorted[count % sorted.size]
    }

    fun prescribe(ex: Exercise, p: UserProfile, setsDelta: Int = 0): PlannedExercise {
        val priority = ex.primary in p.priorityMuscles ||
            (ex.primary in setOf(Muscle.GLUTE_MAX, Muscle.GLUTE_MED) && (BodyGoal.GLUTES in p.bodyGoals || p.aureaReference)) ||
            (ex.primary in setOf(Muscle.QUADS, Muscle.HAMSTRINGS) && BodyGoal.LEGS in p.bodyGoals) ||
            (ex.primary == Muscle.BACK && BodyGoal.BACK in p.bodyGoals) ||
            (ex.primary == Muscle.CORE && BodyGoal.ABS in p.bodyGoals)
        val baseSets = when (p.experience) {
            Experience.BEGINNER -> if (ex.compound) 3 else 2
            Experience.INTERMEDIATE -> if (ex.compound) 3 else 3
            Experience.ADVANCED -> if (ex.compound) 4 else 3
        }
        val sets = (baseSets + (if (priority && p.experience != Experience.BEGINNER) 1 else 0) + setsDelta).coerceIn(2, 5)
        if (ex.timeBased) {
            val (a, b) = when (p.experience) {
                Experience.BEGINNER -> 20 to 30; Experience.INTERMEDIATE -> 30 to 45; Experience.ADVANCED -> 40 to 60
            }
            return PlannedExercise(ex.id, sets.coerceAtMost(3), a, b, 45, timeBased = true)
        }
        val (rMin, rMax) = when {
            ex.slot == Slot.ABDUCTION -> 15 to 20
            ex.slot == Slot.CORE -> 12 to 15
            ex.slot == Slot.CALF -> 12 to 15
            ex.compound && ex.slot in COMPOUND_SLOTS -> when (p.experience) {
                Experience.BEGINNER -> 10 to 12; Experience.INTERMEDIATE -> 8 to 12; Experience.ADVANCED -> 6 to 10
            }
            else -> 10 to 15
        }
        val rest = when {
            ex.compound && ex.slot in setOf(Slot.SQUAT, Slot.HINGE, Slot.HIP_THRUST, Slot.LEG_PRESS) ->
                if (p.experience == Experience.ADVANCED) 120 else 90
            ex.compound -> 75
            ex.slot == Slot.CORE -> 45
            else -> 60
        }
        val note = if (ex.slot == Slot.LUNGE || ex.anim == Anim.ABDUCTION_LYING || ex.id == "ponte_unilateral" || ex.id == "stiff_unilateral")
            "Repetições por perna." else ""
        return PlannedExercise(ex.id, sets, rMin, rMax, rest, note = note)
    }

    /** Troca um exercício do plano por uma alternativa permitida (mesmo encaixe). */
    fun swapOptions(planned: PlannedExercise, p: UserProfile): List<Exercise> {
        val ex = ExerciseLibrary.get(planned.exerciseId) ?: return emptyList()
        return ExerciseLibrary.all.filter { it.slot == ex.slot && it.id != ex.id && ExerciseLibrary.isAllowed(it, p) }
    }

    fun estimatedMinutes(day: WorkoutDay): Int {
        if (day.type == DayType.ACTIVE_RECOVERY) return 45
        val sec = day.exercises.sumOf { pe ->
            val work = if (pe.timeBased) pe.repMax else pe.repMax * 4
            pe.sets * (work + pe.restSec + 15)
        }
        return max(15, (sec / 60.0 + 8).roundToInt())
    }
}

/* ------------------------------------------------------------------
 * Progressão de cargas (dupla progressão com esforço percebido).
 * ------------------------------------------------------------------ */

@Serializable
data class SetEntry(val weightKg: Double, val reps: Int)

data class ProgressionSuggestion(val weightKg: Double?, val targetReps: Int, val message: String)

object Progression {
    /**
     * @param rpe esforço percebido de 1 a 10 informado ao final do exercício.
     * @param goodForm a usuária marcou que conseguiu boa execução.
     * @param recoveredWell resposta mais recente sobre recuperação (check-in).
     */
    fun suggest(
        planned: PlannedExercise,
        lastSets: List<SetEntry>,
        rpe: Int?,
        goodForm: Boolean,
        pain: Boolean,
        recoveredWell: Boolean = true,
        loadStep: Double = 2.5
    ): ProgressionSuggestion {
        if (lastSets.isEmpty()) {
            return ProgressionSuggestion(
                null, planned.repMin,
                "Primeira vez: escolha uma carga em que você consiga ${planned.repsLabel} repetições com boa técnica, deixando 2–3 repetições \"sobrando\"."
            )
        }
        val workWeight = lastSets.maxOf { it.weightKg }
        val topSets = lastSets.filter { it.weightKg == workWeight }
        val minReps = topSets.minOf { it.reps }
        if (pain) {
            val w = roundTo(workWeight * 0.9, loadStep)
            return ProgressionSuggestion(w, planned.repMin, "Você relatou dor: reduza ~10% a carga e priorize a técnica. Se a dor persistir, troque o exercício e procure um profissional.")
        }
        if (!goodForm) {
            return ProgressionSuggestion(workWeight, planned.repMin, "Mantenha a carga até a execução ficar firme e controlada em todas as séries.")
        }
        if (!recoveredWell) {
            return ProgressionSuggestion(workWeight, minReps.coerceAtMost(planned.repMax), "Recuperação baixa: repita a mesma carga hoje. Progredimos quando você estiver mais descansada.")
        }
        val effort = rpe ?: 8
        return when {
            minReps >= planned.repMax && effort <= 8 -> {
                val inc = max(loadStep, roundTo(workWeight * 0.05, loadStep))
                ProgressionSuggestion(roundTo(workWeight + inc, loadStep), planned.repMin, "Ótimo! Você completou o topo das repetições com folga. Aumente para ${fmtKg(workWeight + inc)} e recomece em ${planned.repMin} repetições.")
            }
            minReps >= planned.repMax && effort >= 9 ->
                ProgressionSuggestion(workWeight, planned.repMax, "Você bateu as repetições, mas com esforço muito alto. Repita a carga até ficar mais confortável.")
            minReps < planned.repMin && effort >= 9 -> {
                val w = roundTo(workWeight * 0.95, loadStep)
                ProgressionSuggestion(w, planned.repMin, "A carga ficou pesada demais. Reduza um pouco (${fmtKg(w)}) para completar ${planned.repMin}+ repetições.")
            }
            else -> ProgressionSuggestion(workWeight, (minReps + 1).coerceAtMost(planned.repMax), "Mantenha ${fmtKg(workWeight)} e tente fazer 1 repetição a mais por série.")
        }
    }

    fun roundTo(v: Double, step: Double): Double = if (step <= 0) v else (Math.round(v / step) * step)
    fun fmtKg(v: Double): String = if (v % 1.0 == 0.0) "${v.toInt()} kg" else "${"%.1f".format(v)} kg"
}
