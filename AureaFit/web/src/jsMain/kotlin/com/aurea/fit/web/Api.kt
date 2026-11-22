@file:OptIn(ExperimentalJsExport::class)

package com.aurea.fit.web

import com.aurea.fit.domain.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val J = Json { ignoreUnknownKeys = true; encodeDefaults = true }

@Serializable data class ExerciseDto(
    val id: String, val name: String, val slot: String, val primary: String, val primaryLabel: String,
    val muscles: List<String>, val equipment: List<String>, val anim: String, val compound: Boolean,
    val avoidIf: List<String>, val steps: List<String>, val tips: List<String>, val alternatives: List<String>,
    val timeBased: Boolean, val gymOnly: Boolean, val loadStep: Double, val videoQuery: String
)
@Serializable data class FoodDto(
    val id: String, val name: String, val kcal: Double, val protein: Double, val carbs: Double, val fat: Double,
    val unitName: String, val unitGrams: Double, val roles: List<String>
)
@Serializable data class RecipeDto(
    val id: String, val title: String, val minutes: Int, val tags: List<String>, val ingredients: List<String>,
    val steps: List<String>, val kcal: Int, val protein: Int, val noCook: Boolean
)
@Serializable data class Plans(
    val targets: NutritionTargets, val safety: SafetyAssessment, val workout: WorkoutPlan, val diet: DietPlan
)
@Serializable data class Suggestion(val weightKg: Double?, val targetReps: Int, val message: String)
@Serializable data class Pt(val x: Float, val y: Float)
@Serializable data class PropDto(val kind: String, val a: Float = 0f, val b: Float = 0f, val c: Float = 0f, val d: Float = 0f, val w: Float = 0f, val joint: String = "", val weight: String = "")
@Serializable data class PoseDto(val front: Boolean, val fx: Float, val dy: Float, val pts: Map<String, Pt>, val props: List<PropDto>, val hold: Boolean)
@Serializable data class Opt(val id: String, val label: String, val description: String = "")
@Serializable data class MealSlot(val type: String, val label: String, val time: String, val share: Double)

/** Ponte entre a interface web (JavaScript) e as regras do app (Kotlin). Tudo trafega em JSON. */
@JsExport
object AureaCore {
    private fun profile(json: String) = J.decodeFromString<UserProfile>(json)

    fun defaultProfile(): String = J.encodeToString(UserProfile())

    fun generate(profileJson: String, setsDelta: Int, calorieOffset: Int): String {
        val p = profile(profileJson)
        return J.encodeToString(Plans(Nutrition.targets(p, calorieOffset), Safety.assess(p), WorkoutGenerator.generate(p, setsDelta), DietGenerator.generate(p, calorieOffset)))
    }

    fun workout(profileJson: String, setsDelta: Int): String = J.encodeToString(WorkoutGenerator.generate(profile(profileJson), setsDelta))
    fun diet(profileJson: String, calorieOffset: Int): String = J.encodeToString(DietGenerator.generate(profile(profileJson), calorieOffset))
    fun targets(profileJson: String, calorieOffset: Int): String = J.encodeToString(Nutrition.targets(profile(profileJson), calorieOffset))
    fun safety(profileJson: String): String = J.encodeToString(Safety.assess(profile(profileJson)))
    fun bmi(profileJson: String): Double = Nutrition.bmi(profile(profileJson))

    fun exercises(): String = J.encodeToString(ExerciseLibrary.all.map { e ->
        ExerciseDto(e.id, e.name, e.slot.name, e.primary.name, e.primary.label, e.muscles.map { it.label }, e.equipment.map { it.label },
            e.anim.name, e.compound, e.avoidIf.map { it.label }, e.steps, e.tips, e.alternatives, e.timeBased, e.gymOnly, e.loadStep, e.videoQuery)
    })

    fun alternatives(exerciseId: String, profileJson: String): String {
        val e = ExerciseLibrary.get(exerciseId) ?: return "[]"
        return J.encodeToString(ExerciseLibrary.alternativesFor(e, profile(profileJson)).map { it.id })
    }

    fun swapOptions(plannedJson: String, profileJson: String): String =
        J.encodeToString(WorkoutGenerator.swapOptions(J.decodeFromString<PlannedExercise>(plannedJson), profile(profileJson)).map { it.id })

    fun prescribe(exerciseId: String, profileJson: String, setsDelta: Int): String =
        J.encodeToString(WorkoutGenerator.prescribe(ExerciseLibrary.require(exerciseId), profile(profileJson), setsDelta))

    fun estimatedMinutes(dayJson: String): Int = WorkoutGenerator.estimatedMinutes(J.decodeFromString<WorkoutDay>(dayJson))

    fun suggest(plannedJson: String, lastSetsJson: String, rpe: Int, goodForm: Boolean, pain: Boolean, recovered: Boolean, loadStep: Double): String {
        val s = Progression.suggest(J.decodeFromString(plannedJson), J.decodeFromString<List<SetEntry>>(lastSetsJson), if (rpe <= 0) null else rpe, goodForm, pain, recovered, loadStep)
        return J.encodeToString(Suggestion(s.weightKg, s.targetReps, s.message))
    }

    fun foods(): String = J.encodeToString(FoodDb.all.map { FoodDto(it.id, it.name, it.kcal, it.protein, it.carbs, it.fat, it.unitName, it.unitGrams, it.roles.map { r -> r.name }) })
    fun foodChoices(): String = J.encodeToString(FoodDb.commonChoices.map { Opt(it.id, it.name) })
    fun measure(foodId: String, grams: Int): String = FoodDb.get(foodId)?.let { FoodDb.measure(it, grams) } ?: ""
    fun substitutes(itemJson: String, profileJson: String): String = J.encodeToString(DietGenerator.substitutes(J.decodeFromString(itemJson), profile(profileJson)))
    fun shopping(daysJson: String): String = J.encodeToString(DietGenerator.shoppingList(J.decodeFromString<List<DietDay>>(daysJson)))
    fun mealStructure(profileJson: String): String = J.encodeToString(DietGenerator.mealStructure(profile(profileJson)).map { (t, time, share) -> MealSlot(t.name, t.label, time, share) })
    fun recipes(): String = J.encodeToString(Recipes.all.map { RecipeDto(it.id, it.title, it.minutes, it.tags, it.ingredients, it.steps, it.kcal, it.protein, it.noCook) })

    fun recommend(answersJson: String, profileJson: String, weightsJson: String, setsDelta: Int): String {
        val w = J.decodeFromString<List<Pt>>(weightsJson).map { WeightPoint(it.x.toLong(), it.y.toDouble()) }
        return J.encodeToString(AdjustmentEngine.recommend(J.decodeFromString(answersJson), profile(profileJson), w, setsDelta))
    }

    fun pose(anim: String, t: Double): String {
        val m = MOTIONS[Anim.valueOf(anim)] ?: return "null"
        val sk = solve(m, t.toFloat())
        val props = m.props.map { pr ->
            when (pr) {
                is Prop.Box -> PropDto("box", pr.x, pr.y, pr.w, pr.h)
                is Prop.Line -> PropDto("line", pr.x1, pr.y1, pr.x2, pr.y2, pr.width)
                is Prop.Cable -> PropDto("cable", pr.x, pr.y, joint = pr.to.name)
                is Prop.Weight -> PropDto("weight", joint = pr.at.name, weight = pr.kind.name)
                is Prop.Pad -> PropDto("pad", pr.r, joint = pr.at.name)
                is Prop.StaticPad -> PropDto("spad", pr.x, pr.y, pr.r)
            }
        }
        return J.encodeToString(PoseDto(sk.front, m.fx, m.dy, sk.pts.mapValues { Pt(it.value.x, it.value.y) }, props, m.hold))
    }

    /** Opções do questionário (nome interno → rótulo em português). */
    fun options(): String {
        fun <E : Enum<E>> l(v: Array<E>, label: (E) -> String, desc: (E) -> String = { "" }) = v.map { Opt(it.name, label(it), desc(it)) }
        val map = mapOf(
            "sex" to l(Sex.entries.toTypedArray(), { it.label }),
            "goal" to l(Goal.entries.toTypedArray(), { it.label }, { it.description }),
            "experience" to l(Experience.entries.toTypedArray(), { it.label }, { it.description }),
            "location" to l(Location.entries.toTypedArray(), { it.label }),
            "equipment" to l(Equipment.entries.filter { it != Equipment.MACHINES && it != Equipment.CABLE }.toTypedArray(), { it.label }),
            "bodyGoal" to l(BodyGoal.entries.toTypedArray(), { it.label }),
            "muscle" to l(Muscle.entries.toTypedArray(), { it.label }),
            "limitation" to l(Limitation.entries.toTypedArray(), { it.label }),
            "activity" to l(ActivityLevel.entries.toTypedArray(), { it.label }, { it.description }),
            "occupation" to l(Occupation.entries.toTypedArray(), { it.label }),
            "cook" to l(CookSkill.entries.toTypedArray(), { it.label }),
            "restriction" to l(DietRestriction.entries.toTypedArray(), { it.label }),
            "allergy" to l(Allergy.entries.toTypedArray(), { it.label }),
            "condition" to l(HealthCondition.entries.toTypedArray(), { it.label })
        )
        return J.encodeToString(map)
    }
}
