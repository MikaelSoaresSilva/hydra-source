package com.aurea.fit.domain

import kotlinx.serialization.Serializable

/* ------------------------------------------------------------------
 * Modelos de domínio (puro Kotlin, sem dependência de Android).
 * Tudo é @Serializable para poder ser salvo no banco e exportado.
 * ------------------------------------------------------------------ */

@Serializable
enum class Sex(val label: String) { FEMALE("Feminino"), MALE("Masculino") }

@Serializable
enum class Goal(val label: String, val description: String) {
    LOSE_FAT("Emagrecimento", "Reduzir gordura aos poucos, preservando seus músculos."),
    GAIN_MUSCLE("Ganho de massa muscular", "Construir glúteos, pernas, costas e ombros mais fortes."),
    RECOMP("Recomposição corporal", "Ganhar músculo enquanto reduz gordura, no seu ritmo."),
    MAINTAIN("Manutenção do peso", "Manter o peso e melhorar forma, força e disposição."),
    GAIN_WEIGHT("Ganho de peso", "Aumentar o peso total (músculo + reservas), com saúde.")
}

@Serializable
enum class Experience(val label: String, val description: String) {
    BEGINNER("Iniciante", "Nunca treinei ou treino há menos de 6 meses"),
    INTERMEDIATE("Intermediária", "Treino com regularidade entre 6 meses e 2 anos"),
    ADVANCED("Avançada", "Treino com regularidade há mais de 2 anos")
}

@Serializable
enum class Location(val label: String) { GYM("Academia"), HOME("Em casa") }

@Serializable
enum class Equipment(val label: String) {
    BODYWEIGHT("Peso do corpo"),
    BANDS("Elásticos / mini band"),
    DUMBBELLS("Halteres"),
    BENCH("Banco / step / cadeira firme"),
    KETTLEBELL("Kettlebell"),
    BARBELL("Barra e anilhas"),
    PULLUP_BAR("Barra fixa"),
    // Somente academia:
    MACHINES("Máquinas"),
    CABLE("Polia / cabo")
}

@Serializable
enum class BodyGoal(val label: String) {
    GLUTES("Aumentar os glúteos"),
    LEGS("Desenvolver as pernas"),
    ABS("Mais definição abdominal"),
    BACK("Desenvolver as costas"),
    PROPORTION("Melhorar proporção cintura / quadril / pernas"),
    FULL_BODY("Ganhar massa muscular no corpo inteiro"),
    KEEP_MUSCLE("Perder gordura sem perder músculo")
}

@Serializable
enum class Muscle(val label: String) {
    GLUTE_MAX("Glúteo máximo"),
    GLUTE_MED("Glúteo médio"),
    QUADS("Quadríceps"),
    HAMSTRINGS("Posteriores de coxa"),
    CALVES("Panturrilhas"),
    CORE("Abdômen e core"),
    BACK("Costas"),
    SHOULDERS("Ombros"),
    CHEST("Peitoral"),
    BICEPS("Bíceps"),
    TRICEPS("Tríceps")
}

@Serializable
enum class Limitation(val label: String) {
    KNEE("Joelho"),
    LOWER_BACK("Lombar / coluna"),
    SHOULDER("Ombro"),
    WRIST("Punho"),
    HIP("Quadril"),
    ANKLE("Tornozelo")
}

@Serializable
enum class ActivityLevel(val label: String, val description: String, val factor: Double) {
    SEDENTARY("Sedentária", "Passo a maior parte do dia sentada", 1.2),
    LIGHT("Pouco ativa", "Caminho um pouco durante o dia", 1.3),
    MODERATE("Ativa", "Fico bastante em pé / caminho bastante", 1.4),
    HIGH("Muito ativa", "Trabalho físico ou muito movimento", 1.5)
}

@Serializable
enum class Occupation(val label: String) { WORK("Trabalho"), STUDY("Estudo"), BOTH("Trabalho e estudo"), NONE("Nenhum dos dois") }

@Serializable
enum class CookSkill(val label: String) { NO("Não sei / não gosto de cozinhar"), BASIC("Sei o básico"), GOOD("Cozinho bem") }

@Serializable
enum class DietRestriction(val label: String) {
    NONE("Nenhuma"),
    VEGETARIAN("Vegetariana (come ovos e laticínios)"),
    VEGAN("Vegana"),
    NO_PORK("Não como carne de porco"),
    NO_RED_MEAT("Não como carne vermelha")
}

@Serializable
enum class Allergy(val label: String) {
    LACTOSE("Intolerância à lactose"),
    MILK("Alergia à proteína do leite"),
    GLUTEN("Glúten / doença celíaca"),
    EGG("Ovo"),
    PEANUT("Amendoim"),
    NUTS("Castanhas"),
    FISH("Peixes e frutos do mar"),
    SOY("Soja")
}

@Serializable
enum class HealthCondition(val label: String) {
    HYPERTENSION("Pressão alta"),
    DIABETES("Diabetes"),
    HEART("Problema cardíaco"),
    THYROID("Tireoide"),
    KIDNEY("Problema renal"),
    PCOS("Síndrome dos ovários policísticos"),
    OTHER("Outra condição relevante")
}

@Serializable
data class UserProfile(
    // Dados pessoais
    val name: String = "",
    val age: Int = 25,
    val heightCm: Double = 162.0,
    val weightKg: Double = 62.0,
    val sex: Sex = Sex.FEMALE,
    // Objetivo e experiência
    val goal: Goal = Goal.RECOMP,
    val experience: Experience = Experience.BEGINNER,
    val trainedBefore: Boolean = false,
    val trainingMonths: Int = 0,
    // Estrutura de treino
    val daysPerWeek: Int = 3,
    val availableDays: Set<Int> = setOf(1, 3, 5), // 1 = segunda ... 7 = domingo
    val minutesPerSession: Int = 60,
    val location: Location = Location.GYM,
    val homeEquipment: Set<Equipment> = setOf(Equipment.BODYWEIGHT),
    val bodyGoals: Set<BodyGoal> = setOf(BodyGoal.GLUTES, BodyGoal.LEGS),
    val priorityMuscles: Set<Muscle> = setOf(Muscle.GLUTE_MAX, Muscle.GLUTE_MED),
    val preferredExercises: Set<String> = emptySet(),
    val excludedExercises: Set<String> = emptySet(),
    val limitations: Set<Limitation> = emptySet(),
    val limitationNotes: String = "",
    // Alimentação
    val mealsPerDay: Int = 5,
    val monthlyBudget: Int = 600,
    val usualFoods: Set<String> = emptySet(),
    val dislikedFoods: Set<String> = emptySet(),
    val allergies: Set<Allergy> = emptySet(),
    val restriction: DietRestriction = DietRestriction.NONE,
    val cookSkill: CookSkill = CookSkill.BASIC,
    val prepMinutes: Int = 30,
    val economic: Boolean = true,
    val brazilianCommon: Boolean = true,
    // Rotina
    val wakeTime: String = "06:30",
    val sleepTime: String = "22:30",
    val trainTime: String = "18:00",
    val occupation: Occupation = Occupation.WORK,
    val activityLevel: ActivityLevel = ActivityLevel.LIGHT,
    val sleepHours: Double = 7.0,
    // Saúde e segurança (opcional)
    val conditions: Set<HealthCondition> = emptySet(),
    val medications: String = "",
    val pregnant: Boolean = false,
    val breastfeeding: Boolean = false,
    val eatingDisorderHistory: Boolean = false,
    val healthNotes: String = "",
    // Avaliação física inicial (opcional)
    val waistCm: Double? = null,
    val hipCm: Double? = null,
    val thighCm: Double? = null,
    val armCm: Double? = null,
    // Usa a "Meta Áurea" (referência visual) como ênfase
    val aureaReference: Boolean = true
)

fun parseTime(t: String): Pair<Int, Int> {
    val p = t.split(":")
    val h = p.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 0
    val m = p.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
    return h to m
}

fun minutesOf(t: String): Int = parseTime(t).let { it.first * 60 + it.second }

fun formatMinutes(total: Int): String {
    val m = ((total % 1440) + 1440) % 1440
    return "${(m / 60).pad2()}:${(m % 60).pad2()}"
}
