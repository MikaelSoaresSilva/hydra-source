package com.aurea.fit.domain

import org.junit.Assert.*
import org.junit.Test

class NutritionTest {
    private val base = UserProfile(age = 28, heightCm = 165.0, weightKg = 65.0, daysPerWeek = 4, activityLevel = ActivityLevel.LIGHT)

    @Test fun bmrMifflinFemale() {
        // 10*65 + 6.25*165 - 5*28 - 161 = 1380.25
        assertEquals(1380.25, Nutrition.bmr(base), 0.01)
    }

    @Test fun loseFatHasModerateDeficitAndFloor() {
        val t = Nutrition.targets(base.copy(goal = Goal.LOSE_FAT))
        assertTrue(t.calories < t.tdee)
        assertTrue("déficit não pode passar de 20%", t.calories >= t.tdee * 0.79)
        assertTrue(t.calories >= t.bmr)
        assertEquals(130, t.proteinG) // 2,0 g/kg
        val kcalFromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9
        assertEquals(t.calories.toDouble(), kcalFromMacros.toDouble(), 40.0)
    }

    @Test fun gainMuscleHasSurplus() {
        val t = Nutrition.targets(base.copy(goal = Goal.GAIN_MUSCLE))
        assertTrue(t.calories > t.tdee)
        assertTrue(t.calories <= t.tdee * 1.11)
    }

    @Test fun minorNeverGetsDeficit() {
        val t = Nutrition.targets(base.copy(age = 16, goal = Goal.LOSE_FAT))
        assertTrue(t.calories >= t.tdee - 10)
        assertFalse(Safety.assess(base.copy(age = 16)).allowDeficit)
    }

    @Test fun pregnancyBreastfeedingAndEdHistoryBlockDeficit() {
        listOf(base.copy(pregnant = true), base.copy(breastfeeding = true), base.copy(eatingDisorderHistory = true)).forEach {
            val t = Nutrition.targets(it.copy(goal = Goal.LOSE_FAT))
            assertTrue(t.calories >= t.tdee - 10)
        }
    }

    @Test fun lowBmiBlocksDeficit() {
        val t = Nutrition.targets(base.copy(weightKg = 47.0, goal = Goal.LOSE_FAT))
        assertTrue(t.calories >= t.tdee - 10)
    }

    @Test fun clinicalConditionLimitsDeficit() {
        val p = base.copy(weightKg = 95.0, goal = Goal.LOSE_FAT, conditions = setOf(HealthCondition.DIABETES))
        val t = Nutrition.targets(p)
        assertTrue(t.calories >= t.tdee * 0.89)
    }

    @Test fun proteinUsesReferenceWeightForHighBmi() {
        val p = base.copy(weightKg = 110.0, goal = Goal.LOSE_FAT)
        val t = Nutrition.targets(p)
        assertTrue(t.proteinG < 2.0 * 110)
    }
}

class WorkoutTest {
    @Test fun generatesForAllDayCountsAndLocations() {
        for (days in 1..7) for (loc in Location.entries) for (exp in Experience.entries) {
            val p = UserProfile(daysPerWeek = days, availableDays = (1..7).toSet(), location = loc, experience = exp,
                homeEquipment = setOf(Equipment.BODYWEIGHT))
            val plan = WorkoutGenerator.generate(p)
            assertEquals(days, plan.days.size)
            plan.days.filter { it.type == DayType.STRENGTH }.forEach { d ->
                assertTrue("dia sem exercícios: $days $loc $exp", d.exercises.size >= 3)
                d.exercises.forEach { pe ->
                    val e = ExerciseLibrary.require(pe.exerciseId)
                    assertTrue("${e.id} exige equipamento indisponível", ExerciseLibrary.availableEquipment(p).containsAll(e.equipment))
                    assertTrue(pe.sets in 2..5)
                }
                assertEquals(d.exercises.size, d.exercises.map { it.exerciseId }.toSet().size)
            }
        }
    }

    @Test fun respectsLimitationsAndExclusions() {
        val p = UserProfile(daysPerWeek = 4, location = Location.GYM, experience = Experience.ADVANCED,
            limitations = setOf(Limitation.KNEE, Limitation.LOWER_BACK), excludedExercises = setOf("hip_thrust_barra"))
        val ids = WorkoutGenerator.generate(p).days.flatMap { it.exercises }.map { it.exerciseId }
        ids.forEach { id ->
            val e = ExerciseLibrary.require(id)
            assertFalse("$id não deveria aparecer", e.avoidIf.any { it in p.limitations })
        }
        assertFalse(ids.contains("hip_thrust_barra"))
    }

    @Test fun beginnerCappedAtFourStrengthDays() {
        val p = UserProfile(daysPerWeek = 6, availableDays = (1..6).toSet(), experience = Experience.BEGINNER)
        val plan = WorkoutGenerator.generate(p)
        assertEquals(4, plan.days.count { it.type == DayType.STRENGTH })
        assertEquals(2, plan.days.count { it.type == DayType.ACTIVE_RECOVERY })
    }

    @Test fun glutePriorityStartsLowerDayWithHipExtension() {
        val p = UserProfile(daysPerWeek = 3, bodyGoals = setOf(BodyGoal.GLUTES), location = Location.GYM)
        val first = WorkoutGenerator.generate(p).days.first()
        assertEquals(Slot.HIP_THRUST, ExerciseLibrary.require(first.exercises.first().exerciseId).slot)
    }

    @Test fun usesAvailableWeekdays() {
        val p = UserProfile(daysPerWeek = 3, availableDays = setOf(2, 4, 6))
        assertEquals(listOf(2, 4, 6), WorkoutGenerator.generate(p).days.map { it.weekday })
    }

    @Test fun shortSessionsHaveFewerExercises() {
        val short = WorkoutGenerator.generate(UserProfile(minutesPerSession = 30))
        val long = WorkoutGenerator.generate(UserProfile(minutesPerSession = 90))
        assertTrue(short.days.first().exercises.size < long.days.first().exercises.size)
    }

    @Test fun allExercisesHaveCompleteData() {
        ExerciseLibrary.all.forEach { e ->
            assertTrue(e.id, e.steps.size >= 3 && e.tips.isNotEmpty())
            e.alternatives.forEach { assertNotNull("alternativa inexistente $it em ${e.id}", ExerciseLibrary.get(it)) }
        }
        assertEquals(ExerciseLibrary.all.size, ExerciseLibrary.all.map { it.id }.toSet().size)
    }
}

class ProgressionTest {
    private val planned = PlannedExercise("hip_thrust_barra", 3, 8, 12, 90)

    @Test fun increasesLoadWhenTopRepsWithMargin() {
        val s = Progression.suggest(planned, List(3) { SetEntry(40.0, 12) }, rpe = 7, goodForm = true, pain = false)
        assertEquals(42.5, s.weightKg!!, 0.01)
        assertEquals(8, s.targetReps)
    }

    @Test fun keepsLoadWhenEffortTooHigh() {
        val s = Progression.suggest(planned, List(3) { SetEntry(40.0, 12) }, rpe = 10, goodForm = true, pain = false)
        assertEquals(40.0, s.weightKg!!, 0.01)
    }

    @Test fun keepsLoadOnPoorFormOrRecovery() {
        assertEquals(40.0, Progression.suggest(planned, List(3) { SetEntry(40.0, 12) }, 6, goodForm = false, pain = false).weightKg!!, 0.01)
        assertEquals(40.0, Progression.suggest(planned, List(3) { SetEntry(40.0, 12) }, 6, true, false, recoveredWell = false).weightKg!!, 0.01)
    }

    @Test fun reducesOnPain() {
        val s = Progression.suggest(planned, List(3) { SetEntry(40.0, 10) }, 8, true, pain = true)
        assertTrue(s.weightKg!! < 40.0)
    }

    @Test fun addRepWithinRange() {
        val s = Progression.suggest(planned, listOf(SetEntry(40.0, 10), SetEntry(40.0, 9)), 8, true, false)
        assertEquals(40.0, s.weightKg!!, 0.01)
        assertEquals(10, s.targetReps)
    }

    @Test fun firstTimeHasNoWeight() {
        assertNull(Progression.suggest(planned, emptyList(), null, true, false).weightKg)
    }
}

class DietTest {
    private val base = UserProfile(age = 30, heightCm = 160.0, weightKg = 68.0, goal = Goal.LOSE_FAT, mealsPerDay = 5)

    @Test fun dailyTotalsCloseToTargets() {
        for (goal in Goal.entries) for (meals in 3..6) {
            val p = base.copy(goal = goal, mealsPerDay = meals)
            val plan = DietGenerator.generate(p)
            assertEquals(7, plan.days.size)
            plan.days.forEach { d ->
                assertEquals(meals, d.meals.size)
                val m = d.macros()
                val t = plan.targets
                assertEquals("kcal $goal $meals dia ${d.dayIndex}", t.calories.toDouble(), m.kcal, t.calories * 0.12)
                assertTrue("proteína baixa $goal $meals ${m.protein}", m.protein >= t.proteinG * 0.85)
                assertTrue("proteína alta $goal $meals ${m.protein}", m.protein <= t.proteinG * 1.25)
            }
        }
    }

    @Test fun respectsVeganAndAllergies() {
        val p = base.copy(restriction = DietRestriction.VEGAN, allergies = setOf(Allergy.GLUTEN, Allergy.PEANUT))
        val plan = DietGenerator.generate(p)
        plan.days.flatMap { it.meals }.flatMap { it.items }.forEach { i ->
            val f = FoodDb.require(i.foodId)
            assertFalse(f.name, f.isAnimalProduct)
            assertFalse(f.name, FoodTag.GLUTEN in f.tags || FoodTag.PEANUT in f.tags)
        }
    }

    @Test fun lactoseAndDislikesRespected() {
        val p = base.copy(allergies = setOf(Allergy.LACTOSE), dislikedFoods = setOf("ovo", "arroz", "frango_peito"))
        DietGenerator.generate(p).days.flatMap { it.meals }.flatMap { it.items }.forEach { i ->
            val f = FoodDb.require(i.foodId)
            assertFalse(FoodTag.LACTOSE in f.tags)
            assertFalse(i.foodId in p.dislikedFoods)
        }
    }

    @Test fun preAndPostWorkoutAroundTraining() {
        val p = base.copy(mealsPerDay = 6, wakeTime = "06:00", sleepTime = "23:00", trainTime = "17:30")
        val types = DietGenerator.mealStructure(p).map { it.first }
        assertTrue(types.toString(), MealType.PRE_WORKOUT in types || MealType.POST_WORKOUT in types)
    }

    @Test fun substitutesKeepKeyMacro() {
        val item = MealItem("frango_peito", 120, Role.MAIN_PROTEIN.name)
        val subs = DietGenerator.substitutes(item, base)
        assertTrue(subs.isNotEmpty())
        val key = item.macros().protein
        subs.filter { it.foodId == "tilapia" }.forEach { assertEquals(key, it.macros().protein, 4.0) }
    }

    @Test fun shoppingListHasCosts() {
        val plan = DietGenerator.generate(base)
        val list = DietGenerator.shoppingList(plan.days)
        assertTrue(list.isNotEmpty())
        assertTrue(plan.monthlyCost > 100 && plan.monthlyCost < 3000)
        assertEquals(plan.weeklyCost, list.sumOf { it.cost }, 0.01)
    }

    @Test fun measuresAreReadable() {
        assertEquals("2 ovos", FoodDb.measure(FoodDb.require("ovo"), 100))
        assertEquals("4 colheres de sopa cheias", FoodDb.measure(FoodDb.require("arroz"), 100))
    }
}

class AdjustmentTest {
    private val p = UserProfile(goal = Goal.LOSE_FAT, weightKg = 70.0)

    @Test fun noCalorieChangeWithFewDays() {
        val w = listOf(WeightPoint(0, 70.0), WeightPoint(2, 70.0), WeightPoint(4, 70.1))
        val recs = AdjustmentEngine.recommend(CheckInAnswers(dietAdherence = 5), p, w, 0)
        assertTrue(recs.none { it.action == ActionType.CALORIES_DOWN || it.action == ActionType.CALORIES_UP })
    }

    @Test fun reduceCaloriesOnlyAfterPlateauWithAdherence() {
        val w = (0..21 step 3).map { WeightPoint(it.toLong(), 70.0) }
        val recs = AdjustmentEngine.recommend(CheckInAnswers(dietAdherence = 5), p, w, 0)
        assertTrue(recs.any { it.action == ActionType.CALORIES_DOWN })
        val lowAdh = AdjustmentEngine.recommend(CheckInAnswers(dietAdherence = 2), p, w, 0)
        assertTrue(lowAdh.none { it.action == ActionType.CALORIES_DOWN })
    }

    @Test fun fastLossRaisesCalories() {
        val w = (0..21 step 3).map { WeightPoint(it.toLong(), 70.0 - it * 0.15) }
        val recs = AdjustmentEngine.recommend(CheckInAnswers(), p, w, 0)
        assertTrue(recs.any { it.action == ActionType.CALORIES_UP })
    }

    @Test fun poorRecoveryNeverAddsVolume() {
        val recs = AdjustmentEngine.recommend(CheckInAnswers(sleep = 1, difficulty = 1, trainingAdherence = 5), p, emptyList(), 0)
        assertTrue(recs.none { it.action == ActionType.ADD_SETS })
        assertTrue(recs.any { it.action == ActionType.DELOAD })
    }

    @Test fun painSuggestsAdaptationAndProfessional() {
        val recs = AdjustmentEngine.recommend(CheckInAnswers(pain = true, painArea = Limitation.KNEE), p, emptyList(), 0)
        assertTrue(recs.any { it.action == ActionType.ADD_LIMITATION && it.limitation == Limitation.KNEE })
        assertTrue(recs.any { it.action == ActionType.SEE_PROFESSIONAL })
    }

    @Test fun deficitNotAllowedNeverCutsCalories() {
        val teen = p.copy(age = 16)
        val w = (0..21 step 3).map { WeightPoint(it.toLong(), 70.0) }
        val recs = AdjustmentEngine.recommend(CheckInAnswers(dietAdherence = 5), teen, w, 0)
        assertTrue(recs.none { it.action == ActionType.CALORIES_DOWN })
    }
}
