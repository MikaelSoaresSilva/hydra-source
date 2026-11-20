package com.aurea.fit.domain

import kotlinx.serialization.Serializable

/** Respostas do check-in periódico. Escalas de 1 (ruim) a 5 (ótimo) quando aplicável. */
@Serializable
data class CheckInAnswers(
    val trainingAdherence: Int = 3,     // 1 = quase nenhum treino ... 5 = todos
    val pain: Boolean = false,
    val painArea: Limitation? = null,
    val dietAdherence: Int = 3,         // consegue se alimentar adequadamente
    val sleep: Int = 3,
    val recovery: Int = 3,
    val satisfaction: Int = 3,
    val dietDifficulty: Int = 3,        // 1 = muito difícil ... 5 = fácil
    val hunger: Int = 3,                // 1 = sem fome ... 5 = muita fome
    val difficulty: Int = 3             // 1 = muito fácil ... 3 = adequado ... 5 = muito difícil
)

@Serializable
enum class ActionType {
    NONE, DELOAD, ADD_SETS, REDUCE_SETS, ADD_LIMITATION, REDUCE_DAYS, SHORTER_SESSIONS,
    CALORIES_UP, CALORIES_DOWN, SIMPLIFY_DIET, SEE_PROFESSIONAL
}

@Serializable
data class Recommendation(
    val title: String,
    val reason: String,
    val action: ActionType,
    val value: Int = 0,
    val limitation: Limitation? = null
)

data class WeightPoint(val epochDay: Long, val kg: Double)

/**
 * Motor de ajuste. Princípios:
 *  - Nunca aumentar volume se a recuperação/sono estão ruins.
 *  - Nunca mexer nas calorias por oscilações de poucos dias: exige ≥ 14 dias e ≥ 4 pesagens.
 *  - Cada recomendação traz o motivo; a usuária decide aplicar.
 */
object AdjustmentEngine {

    fun weeklyChangePercent(points: List<WeightPoint>): Double? {
        if (points.size < 4) return null
        val sorted = points.sortedBy { it.epochDay }
        val span = sorted.last().epochDay - sorted.first().epochDay
        if (span < 14) return null
        // regressão linear simples (kg por dia)
        val n = sorted.size
        val xs = sorted.map { (it.epochDay - sorted.first().epochDay).toDouble() }
        val ys = sorted.map { it.kg }
        val mx = xs.average(); val my = ys.average()
        val num = xs.indices.sumOf { (xs[it] - mx) * (ys[it] - my) }
        val den = xs.indices.sumOf { (xs[it] - mx) * (xs[it] - mx) }
        if (den == 0.0 || n < 2) return null
        val slopePerDay = num / den
        return slopePerDay * 7 / my * 100
    }

    fun recommend(
        a: CheckInAnswers,
        p: UserProfile,
        weights: List<WeightPoint>,
        currentSetsDelta: Int,
        safety: SafetyAssessment = Safety.assess(p)
    ): List<Recommendation> {
        val r = mutableListOf<Recommendation>()
        val poorRecovery = a.sleep <= 2 || a.recovery <= 2

        if (a.pain) {
            val area = a.painArea
            if (area != null && area !in p.limitations) {
                r += Recommendation(
                    "Adaptar exercícios para ${area.label.lowercase()}",
                    "Você relatou dor. Vamos trocar exercícios que costumam sobrecarregar essa região. Dor muscular leve após o treino é normal; dor articular ou aguda não.",
                    ActionType.ADD_LIMITATION, limitation = area
                )
            }
            r += Recommendation(
                "Procure avaliação se a dor persistir",
                "Se a dor durar mais de alguns dias, piorar ou atrapalhar o dia a dia, consulte um(a) médico(a) ou fisioterapeuta antes de continuar os exercícios que a provocam.",
                ActionType.SEE_PROFESSIONAL
            )
        }

        if (poorRecovery) {
            r += Recommendation(
                "Semana de recuperação (deload)",
                "Sono e/ou recuperação ruins. Reduzir 1 série por exercício nesta semana ajuda o corpo a se recuperar sem perder o progresso. Tente dormir 7–9 horas.",
                ActionType.DELOAD, value = -1
            )
        } else if (a.difficulty <= 2 && a.trainingAdherence >= 4 && currentSetsDelta < 1) {
            r += Recommendation(
                "Aumentar um pouco o volume",
                "Os treinos estão fáceis, você está cumprindo a rotina e se recuperando bem. Acrescentar 1 série por exercício cria um novo estímulo.",
                ActionType.ADD_SETS, value = 1
            )
        } else if (a.difficulty >= 5) {
            r += Recommendation(
                "Reduzir o volume",
                "Os treinos estão muito difíceis. Menos séries com boa técnica geram mais resultado do que muitas séries mal executadas.",
                ActionType.REDUCE_SETS, value = -1
            )
        } else if (currentSetsDelta < 0 && !poorRecovery && a.recovery >= 4) {
            r += Recommendation(
                "Voltar ao volume normal",
                "Sua recuperação melhorou. Podemos voltar ao número normal de séries.",
                ActionType.ADD_SETS, value = 1
            )
        }

        if (a.trainingAdherence <= 2) {
            if (p.daysPerWeek > 2) {
                r += Recommendation(
                    "Treinar menos dias, com constância",
                    "Você está tendo dificuldade para cumprir os treinos. Um plano com 1 dia a menos, que você consiga seguir, traz mais resultado.",
                    ActionType.REDUCE_DAYS, value = -1
                )
            }
            if (p.minutesPerSession > 30) {
                r += Recommendation(
                    "Treinos mais curtos",
                    "Sessões mais curtas (15 min a menos) facilitam encaixar o treino na rotina.",
                    ActionType.SHORTER_SESSIONS, value = -15
                )
            }
        }

        if (a.dietDifficulty <= 2 || a.dietAdherence <= 2) {
            r += Recommendation(
                "Simplificar a alimentação",
                "Seguir a dieta está difícil. Vamos usar alimentos mais práticos e econômicos e uma refeição a menos, mantendo a proteína.",
                ActionType.SIMPLIFY_DIET
            )
        }

        // Calorias: somente com dados suficientes.
        val change = weeklyChangePercent(weights)
        val inDeficit = p.goal == Goal.LOSE_FAT || p.goal == Goal.RECOMP
        if (change == null) {
            if (r.none { it.action == ActionType.CALORIES_DOWN || it.action == ActionType.CALORIES_UP }) {
                r += Recommendation(
                    "Calorias mantidas",
                    "Ainda não há dados suficientes (pelo menos 4 pesagens em 14 dias). O peso oscila no dia a dia por água, sal e ciclo menstrual, então não mudamos as calorias antes disso.",
                    ActionType.NONE
                )
            }
        } else if (inDeficit) {
            when {
                change < -1.0 -> r += Recommendation(
                    "Comer um pouco mais",
                    "Você está perdendo mais de 1%% do peso por semana (%.1f%%). Uma perda rápida aumenta o risco de perder músculo. Vamos acrescentar 150 kcal.".format(change),
                    ActionType.CALORIES_UP, value = 150
                )
                a.hunger >= 5 && change < -0.25 -> r += Recommendation(
                    "Reduzir a fome",
                    "Você relatou muita fome e o peso está caindo. Acrescentar 100 kcal (de preferência em proteína e fibras) torna o plano mais sustentável.",
                    ActionType.CALORIES_UP, value = 100
                )
                change > -0.1 && a.dietAdherence >= 4 && p.goal == Goal.LOSE_FAT && safety.allowDeficit -> r += Recommendation(
                    "Pequeno ajuste nas calorias",
                    "Com boa adesão, o peso está estável há mais de duas semanas (%.2f%%/semana). Reduzir 100 kcal ajuda a retomar a perda de forma gradual. Medidas de cintura também contam: se estiverem diminuindo, está funcionando!".format(change),
                    ActionType.CALORIES_DOWN, value = -100
                )
                change > -0.1 && a.dietAdherence < 4 -> r += Recommendation(
                    "Foco na constância antes de cortar calorias",
                    "O peso está estável, mas a adesão à dieta não está alta. Antes de reduzir calorias, vale seguir o plano atual com mais regularidade.",
                    ActionType.NONE
                )
                else -> r += Recommendation("Ritmo adequado", "Seu peso está mudando num ritmo saudável (%.2f%% por semana). Continue assim!".format(change), ActionType.NONE)
            }
        } else if (p.goal == Goal.GAIN_MUSCLE || p.goal == Goal.GAIN_WEIGHT) {
            when {
                change < 0.05 && a.dietAdherence >= 4 -> r += Recommendation(
                    "Aumentar as calorias",
                    "O peso não subiu nas últimas semanas mesmo com boa adesão. Mais 150 kcal ajudam a construir músculo.",
                    ActionType.CALORIES_UP, value = 150
                )
                change > 0.6 -> r += Recommendation(
                    "Desacelerar o ganho",
                    "O ganho de peso está acima de 0,5%% por semana (%.2f%%), o que tende a acumular mais gordura. Reduzir 100 kcal.".format(change),
                    ActionType.CALORIES_DOWN, value = -100
                )
                else -> r += Recommendation("Ritmo adequado", "Ganho de peso gradual (%.2f%% por semana). Continue!".format(change), ActionType.NONE)
            }
        }

        if (a.satisfaction <= 2) {
            r += Recommendation(
                "Sobre a sua evolução",
                "Resultados visíveis costumam levar de 8 a 12 semanas. Compare medidas e cargas, não só o espelho. Cada corpo responde de um jeito, e a referência é sempre a sua melhor versão.",
                ActionType.NONE
            )
        }
        return r
    }
}
