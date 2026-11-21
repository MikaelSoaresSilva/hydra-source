package com.aurea.fit.domain

import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Avaliação de segurança: decide se metas agressivas/restritivas podem ser oferecidas.
 * Regra do projeto: menores de 18, gestantes, lactantes, condições clínicas relevantes
 * ou histórico de transtorno alimentar => nada de déficit calórico agressivo, e o app
 * orienta a procurar acompanhamento profissional.
 */
@Serializable
data class SafetyAssessment(
    val restrictDeficit: Boolean,
    val allowDeficit: Boolean,
    val warnings: List<String>
)

object Safety {
    fun assess(p: UserProfile): SafetyAssessment {
        val w = mutableListOf<String>()
        var noDeficit = false
        var restrict = false
        if (p.age < 18) {
            noDeficit = true
            w += "Você tem menos de 18 anos: o plano usa calorias de manutenção e não traz metas de perda de peso. Procure um(a) nutricionista e um(a) educador(a) físico(a) para acompanhar seu desenvolvimento."
        }
        if (p.pregnant) {
            noDeficit = true
            w += "Gestação: não oferecemos déficit calórico. Treine e altere a alimentação somente com liberação e acompanhamento do seu médico(a) e nutricionista."
        }
        if (p.breastfeeding) {
            noDeficit = true
            w += "Amamentação: as necessidades de energia aumentam. O plano não usa déficit calórico; procure acompanhamento profissional."
        }
        if (p.eatingDisorderHistory) {
            noDeficit = true
            w += "Histórico de transtorno alimentar: o app não mostra metas restritivas. Recomendamos acompanhamento com psicólogo(a) e nutricionista. Se quiser, você pode ocultar a contagem de calorias nas Configurações."
        }
        if (p.conditions.isNotEmpty()) {
            restrict = true
            w += "Você informou uma condição de saúde (${p.conditions.joinToString { it.label.lowercase() }}). Use o plano apenas com liberação médica; o déficit calórico foi limitado a um nível leve."
        }
        if (p.medications.isNotBlank()) {
            restrict = true
            w += "Você usa medicamentos. Confirme com seu médico(a) se há cuidados com exercícios intensos ou com a alimentação."
        }
        val bmi = Nutrition.bmi(p)
        if (bmi < 18.5 && (p.goal == Goal.LOSE_FAT || p.goal == Goal.RECOMP)) {
            noDeficit = true
            w += "Seu IMC (${bmi.dec(1)}) já está abaixo da faixa recomendada. Não aplicamos déficit calórico; o foco passa a ser ganhar força e massa muscular."
        }
        return SafetyAssessment(restrictDeficit = restrict, allowDeficit = !noDeficit, warnings = w)
    }
}

@Serializable
data class NutritionTargets(
    val bmr: Int,
    val tdee: Int,
    val calories: Int,
    val proteinG: Int,
    val carbsG: Int,
    val fatG: Int,
    val waterMl: Int,
    val adjustmentPercent: Int,
    val explanation: List<String>
)

object Nutrition {
    fun bmi(p: UserProfile): Double {
        val h = p.heightCm / 100.0
        return if (h <= 0) 0.0 else p.weightKg / (h * h)
    }

    /** Taxa metabólica basal (Mifflin-St Jeor, 1990). */
    fun bmr(p: UserProfile): Double {
        val base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
        return if (p.sex == Sex.FEMALE) base - 161 else base + 5
    }

    /** Fator de atividade = atividade do dia a dia + contribuição dos treinos. */
    fun activityFactor(p: UserProfile): Double =
        (p.activityLevel.factor + 0.035 * p.daysPerWeek.coerceIn(0, 7)).coerceAtMost(1.9)

    /**
     * Peso de referência para proteína: para IMC > 27 usa o peso equivalente a IMC 25,
     * evitando metas de proteína exageradas.
     */
    fun proteinReferenceWeight(p: UserProfile): Double {
        val h = p.heightCm / 100.0
        return if (bmi(p) > 27) 25 * h * h else p.weightKg
    }

    fun targets(p: UserProfile, calorieOffset: Int = 0): NutritionTargets {
        val safety = Safety.assess(p)
        val bmr = bmr(p)
        val tdee = bmr * activityFactor(p)
        val why = mutableListOf<String>()
        why += "Gasto basal estimado (Mifflin-St Jeor): ${bmr.roundToInt()} kcal."
        why += "Gasto diário estimado com sua rotina e ${p.daysPerWeek} treinos/semana: ${tdee.roundToInt()} kcal."

        var pct = when (p.goal) {
            Goal.LOSE_FAT -> if (bmi(p) >= 30) -20 else -15
            Goal.RECOMP -> if (bmi(p) >= 25) -10 else -5
            Goal.MAINTAIN -> 0
            Goal.GAIN_MUSCLE -> when (p.experience) {
                Experience.BEGINNER -> 10; Experience.INTERMEDIATE -> 8; Experience.ADVANCED -> 5
            }
            Goal.GAIN_WEIGHT -> 12
        }
        if (!safety.allowDeficit && pct < 0) {
            pct = 0
            why += "Por segurança, o plano usa calorias de manutenção (sem déficit)."
        } else if (safety.restrictDeficit && pct < -10) {
            pct = -10
            why += "Por causa das informações de saúde, o déficit foi limitado a 10%."
        }
        if (p.age < 18 && pct > 10) pct = 10
        if ((p.pregnant || p.breastfeeding) && pct > 0) pct = 0

        var kcal = tdee * (1 + pct / 100.0) + calorieOffset
        // Piso de segurança: nunca abaixo da taxa basal nem de 1200 kcal.
        val floor = max(bmr, 1200.0)
        if (kcal < floor) {
            kcal = floor
            why += "As calorias não ficam abaixo do seu gasto basal (${floor.roundToInt()} kcal)."
        }
        if (!safety.allowDeficit && kcal < tdee) kcal = tdee
        kcal = (kcal / 10).roundToInt() * 10.0

        when {
            pct < 0 -> why += "Objetivo ${p.goal.label.lowercase()}: déficit moderado de ${-pct}%. Perda esperada de cerca de 0,25 a 0,75% do peso por semana."
            pct > 0 -> why += "Objetivo ${p.goal.label.lowercase()}: superávit de $pct% para dar energia à construção muscular."
            else -> why += "Calorias próximas da manutenção."
        }
        if (calorieOffset != 0) why += "Ajuste aplicado nos check-ins: ${if (calorieOffset > 0) "+" else ""}$calorieOffset kcal."

        val refW = proteinReferenceWeight(p)
        val proteinPerKg = when (p.goal) {
            Goal.LOSE_FAT -> 2.0; Goal.RECOMP -> 2.0; Goal.GAIN_MUSCLE -> 1.8
            Goal.GAIN_WEIGHT -> 1.7; Goal.MAINTAIN -> 1.6
        }
        val protein = (refW * proteinPerKg).roundToInt()
        val fatMin = (p.weightKg * 0.7)
        val fat = max(fatMin, kcal * 0.27 / 9).roundToInt()
        val carbs = max(0.0, (kcal - protein * 4 - fat * 9) / 4).roundToInt()
        why += "Proteína: ${proteinPerKg.dec(1)} g por kg de peso de referência (${refW.roundToInt()} kg) para preservar e construir músculo."
        why += "Gorduras: cerca de 27% das calorias (importantes para hormônios). Carboidratos completam o restante e dão energia ao treino."

        val water = (35 * p.weightKg).roundToInt().let { ((it + 499) / 250) * 250 }
        return NutritionTargets(
            bmr = bmr.roundToInt(), tdee = tdee.roundToInt(), calories = kcal.roundToInt(),
            proteinG = protein, carbsG = carbs, fatG = fat, waterMl = water,
            adjustmentPercent = pct, explanation = why
        )
    }
}
