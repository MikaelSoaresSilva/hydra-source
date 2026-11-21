package com.aurea.fit.domain

import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.roundToInt

@Serializable
enum class MealType(val label: String) {
    BREAKFAST("Café da manhã"), MORNING_SNACK("Lanche da manhã"), LUNCH("Almoço"),
    AFTERNOON_SNACK("Lanche da tarde"), PRE_WORKOUT("Pré-treino"), POST_WORKOUT("Pós-treino"),
    DINNER("Jantar"), SUPPER("Ceia")
}

@Serializable
data class MealItem(val foodId: String, val grams: Int, val role: String = "")

@Serializable
data class Meal(
    val type: MealType,
    val title: String,
    val time: String,
    val items: List<MealItem>,
    val note: String = ""
)

data class Macros(val kcal: Double = 0.0, val protein: Double = 0.0, val carbs: Double = 0.0, val fat: Double = 0.0) {
    operator fun plus(o: Macros) = Macros(kcal + o.kcal, protein + o.protein, carbs + o.carbs, fat + o.fat)
}

fun MealItem.macros(): Macros {
    val f = FoodDb.get(foodId) ?: return Macros()
    val k = grams / 100.0
    return Macros(f.kcal * k, f.protein * k, f.carbs * k, f.fat * k)
}

fun Meal.macros(): Macros = items.fold(Macros()) { a, i -> a + i.macros() }

@Serializable
data class DietDay(val dayIndex: Int, val meals: List<Meal>)

fun DietDay.macros(): Macros = meals.fold(Macros()) { a, m -> a + m.macros() }

@Serializable
data class DietPlan(
    val targets: NutritionTargets,
    val days: List<DietDay>,
    val weeklyCost: Double,
    val monthlyCost: Double,
    val budget: Int,
    val notes: List<String>,
    val calorieOffset: Int = 0,
    val economicMode: Boolean = false
)

@Serializable
data class ShoppingItem(val foodId: String, val name: String, val quantity: String, val grams: Int, val cost: Double)

/**
 * Gerador de cardápio. Para cada refeição define metas de calorias/macros e calcula
 * as porções de cada componente (proteína, carboidrato, gordura) com um solver simples.
 */
object DietGenerator {

    private data class Component(val role: Role, val solve: Boolean, val optional: Boolean = false)

    private fun template(type: MealType): List<Component> = when (type) {
        MealType.BREAKFAST -> listOf(
            Component(Role.BK_PROTEIN, true), Component(Role.BK_CARB, true),
            Component(Role.FRUIT, false), Component(Role.DRINK, false), Component(Role.FAT, true, optional = true)
        )
        MealType.MORNING_SNACK, MealType.AFTERNOON_SNACK -> listOf(
            Component(Role.SNACK_PROTEIN, true), Component(Role.FRUIT, false), Component(Role.FAT, true, optional = true)
        )
        MealType.SUPPER -> listOf(Component(Role.SNACK_PROTEIN, true), Component(Role.FAT, true, optional = true))
        MealType.PRE_WORKOUT -> listOf(Component(Role.FRUIT, false), Component(Role.BK_CARB, true, optional = true), Component(Role.SNACK_PROTEIN, true))
        MealType.POST_WORKOUT -> listOf(Component(Role.SNACK_PROTEIN, true), Component(Role.BK_CARB, true, optional = true), Component(Role.FRUIT, false))
        MealType.LUNCH, MealType.DINNER -> listOf(
            Component(Role.MAIN_PROTEIN, true), Component(Role.MAIN_CARB, true), Component(Role.LEGUME, false),
            Component(Role.SALAD, false), Component(Role.COOKED_VEG, false), Component(Role.FAT, true, optional = true)
        )
    }

    /** Estrutura das refeições do dia (tipos, horários e % das calorias). */
    fun mealStructure(p: UserProfile): List<Triple<MealType, String, Double>> {
        val n = p.mealsPerDay.coerceIn(3, 6)
        val base: List<Pair<MealType, Double>> = when (n) {
            3 -> listOf(MealType.BREAKFAST to 0.30, MealType.LUNCH to 0.40, MealType.DINNER to 0.30)
            4 -> listOf(MealType.BREAKFAST to 0.25, MealType.LUNCH to 0.35, MealType.AFTERNOON_SNACK to 0.15, MealType.DINNER to 0.25)
            5 -> listOf(MealType.BREAKFAST to 0.20, MealType.MORNING_SNACK to 0.10, MealType.LUNCH to 0.30, MealType.AFTERNOON_SNACK to 0.15, MealType.DINNER to 0.25)
            else -> listOf(MealType.BREAKFAST to 0.20, MealType.MORNING_SNACK to 0.10, MealType.LUNCH to 0.28, MealType.AFTERNOON_SNACK to 0.12, MealType.DINNER to 0.22, MealType.SUPPER to 0.08)
        }
        var wake = minutesOf(p.wakeTime)
        var sleep = minutesOf(p.sleepTime)
        if (sleep <= wake) sleep += 1440
        val first = wake + 30
        val last = (sleep - 90).coerceAtLeast(first + 60 * (n - 1))
        val gap = (last - first) / (n - 1).toDouble()
        val times = (0 until n).map { (first + it * gap).roundToInt() }
        val train = minutesOf(p.trainTime).let { if (it < wake) it + 1440 else it }

        val result = base.mapIndexed { i, (t, share) -> Triple(t, formatMinutes(roundTo15(times[i])), share) }.toMutableList()
        // Ajuste pré/pós-treino: lanche anterior ao treino vira pré-treino, refeição seguinte vira pós-treino.
        val before = times.indices.lastOrNull { times[it] <= train - 45 }
        val after = times.indices.firstOrNull { times[it] >= train + 45 }
        if (before != null) {
            val (type, time, share) = result[before]
            if (type in setOf(MealType.MORNING_SNACK, MealType.AFTERNOON_SNACK, MealType.SUPPER)) result[before] = Triple(MealType.PRE_WORKOUT, time, share)
        }
        if (after != null) {
            val (type, time, share) = result[after]
            if (type in setOf(MealType.MORNING_SNACK, MealType.AFTERNOON_SNACK, MealType.SUPPER)) result[after] = Triple(MealType.POST_WORKOUT, time, share)
        }
        return result
    }

    private fun roundTo15(m: Int) = ((m + 7) / 15) * 15

    private fun title(type: MealType, original: MealType?): String = type.label

    fun candidates(role: Role, p: UserProfile, economic: Boolean): List<Food> {
        val practicalNeeded = p.cookSkill == CookSkill.NO || p.prepMinutes <= 15
        val list = FoodDb.all.filter { role in it.roles && FoodDb.isAllowed(it, p) }
            .filter { !(it.id == "whey" && p.age < 18) }
            .filter { f ->
                // Bebidas alternativas só para quem precisa ou já consome.
                val needsAlt = p.restriction == DietRestriction.VEGAN || p.allergies.any { it == Allergy.LACTOSE || it == Allergy.MILK }
                when (f.id) {
                    "leite_sem_lactose" -> Allergy.LACTOSE in p.allergies || f.id in p.usualFoods
                    "bebida_soja" -> needsAlt || f.id in p.usualFoods
                    else -> true
                }
            }
        val sorted = list.sortedWith(
            compareByDescending<Food> { it.id in p.usualFoods }
                .thenByDescending { if (practicalNeeded) it.practical else false }
                .thenBy { if (economic) it.pricePerKg * it.rawFactor else 0.0 }
        )
        // No modo econômico usa somente a metade mais barata (mantendo os preferidos).
        return if (economic && sorted.size > 3) {
            val keep = sorted.filter { it.id in p.usualFoods }
            (keep + sorted.take((sorted.size + 1) / 2)).distinct()
        } else sorted
    }

    fun generate(p: UserProfile, calorieOffset: Int = 0, forceEconomic: Boolean? = null): DietPlan {
        val targets = Nutrition.targets(p, calorieOffset)
        val economic = forceEconomic ?: p.economic
        var plan = build(p, targets, economic, calorieOffset)
        if (!economic && plan.monthlyCost > p.monthlyBudget && forceEconomic == null) {
            val cheaper = build(p, targets, true, calorieOffset)
            if (cheaper.monthlyCost < plan.monthlyCost) {
                plan = cheaper.copy(notes = cheaper.notes + "O cardápio foi ajustado para opções mais econômicas para caber melhor no seu orçamento.")
            }
        }
        if (plan.monthlyCost > p.monthlyBudget) {
            plan = plan.copy(
                notes = plan.notes + "Custo estimado (R$ ${plan.monthlyCost.dec(0)}/mês) acima do seu orçamento (R$ ${p.monthlyBudget}). Dicas: priorize ovos, frango, feijão, arroz, banana e aveia; compre a granel e congele porções."
            )
        }
        return plan
    }

    private fun build(p: UserProfile, t: NutritionTargets, economic: Boolean, offset: Int): DietPlan {
        val structure = mealStructure(p)
        val days = (0 until 7).map { d ->
            val meals = structure.mapIndexed { mi, (type, time, share) ->
                buildMeal(type, time, share, t, p, economic, d, mi)
            }
            DietDay(d, meals)
        }
        val weekly = shoppingList(days).sumOf { it.cost }
        val notes = mutableListOf<String>()
        notes += "Cardápio de 7 dias com alimentos comuns no Brasil. Você pode trocar qualquer alimento por uma substituição equivalente."
        notes += "Quantidades em gramas referem-se ao alimento pronto (cozido). A lista de compras converte para o peso cru."
        notes += "Tempere à vontade com alho, cebola, ervas, limão e especiarias. Use pouco sal e pouco óleo no preparo."
        notes += "Este plano é uma orientação educativa e não substitui o acompanhamento de um(a) nutricionista."
        return DietPlan(t, days, weekly, weekly * 4.3, p.monthlyBudget, notes, offset, economic)
    }

    private fun buildMeal(
        type: MealType, time: String, share: Double, t: NutritionTargets, p: UserProfile,
        economic: Boolean, day: Int, mealIndex: Int
    ): Meal {
        val target = Macros(t.calories * share, t.proteinG * share, t.carbsG * share, t.fatG * share)
        val comps = template(type)
        val chosen = mutableListOf<Pair<Component, Food>>()
        for ((ci, c) in comps.withIndex()) {
            val cands = candidates(c.role, p, economic)
            if (cands.isEmpty()) continue
            // Rotação para variar: dia + refeição + componente.
            val idx = (day * 3 + mealIndex + ci * 2) % cands.size
            var food = cands[idx]
            // evita repetir o mesmo alimento na mesma refeição
            if (chosen.any { it.second.id == food.id }) food = cands[(idx + 1) % cands.size]
            if (chosen.any { it.second.id == food.id }) continue
            // Alguns alimentos não combinam com café da manhã/lanches (ex.: batata-doce é opção, mas não com café).
            chosen += c to food
        }
        var grams = solve(chosen, target)
        // Complemento de proteína: se a refeição ficou mais de 6 g abaixo da meta,
        // adiciona uma segunda fonte prática (iogurte, leite, queijo, ovo...).
        val proteinNow = chosen.indices.sumOf { chosen[it].second.protein * grams[it] / 100.0 }
        if (target.protein - proteinNow > 6) {
            val extraRole = if (type == MealType.LUNCH || type == MealType.DINNER) Role.MAIN_PROTEIN else Role.SNACK_PROTEIN
            val extra = (candidates(Role.SNACK_PROTEIN, p, economic) + candidates(extraRole, p, economic))
                .firstOrNull { f -> chosen.none { it.second.id == f.id } && f.protein >= 8 }
            if (extra != null) {
                chosen += Component(Role.SNACK_PROTEIN, true, optional = true) to extra
                grams = solve(chosen, target)
            }
        }
        grams = trim(chosen, grams, target)
        val items = chosen.mapIndexedNotNull { i, (c, f) ->
            val g = grams[i]
            if (g <= 0 && c.optional) null else MealItem(f.id, g, c.role.name)
        }
        val note = when (type) {
            MealType.PRE_WORKOUT -> "Coma de 45 min a 1h30 antes do treino."
            MealType.POST_WORKOUT -> "Até 2 horas após o treino."
            MealType.SUPPER -> "Opcional se estiver com fome antes de dormir."
            else -> ""
        }
        return Meal(type, title(type, null), time, items, note)
    }

    /** Calcula as gramas de cada alimento para chegar perto das metas da refeição. */
    private fun solve(chosen: List<Pair<Component, Food>>, target: Macros): List<Int> {
        val g = DoubleArray(chosen.size) { i ->
            val (c, f) = chosen[i]
            if (c.solve) f.minG.toDouble().coerceAtLeast(if (c.optional) 0.0 else f.step.toDouble()) else defaultFixed(c.role, f)
        }
        fun total(exclude: Int): Macros {
            var m = Macros()
            for (j in chosen.indices) if (j != exclude) {
                val f = chosen[j].second; val k = g[j] / 100.0
                m += Macros(f.kcal * k, f.protein * k, f.carbs * k, f.fat * k)
            }
            return m
        }
        repeat(6) {
            for (i in chosen.indices) {
                val (c, f) = chosen[i]
                if (!c.solve) continue
                val others = total(i)
                val need = when (c.role) {
                    Role.MAIN_PROTEIN, Role.BK_PROTEIN, Role.SNACK_PROTEIN -> (target.protein - others.protein) / (f.protein / 100.0).coerceAtLeast(0.01)
                    Role.MAIN_CARB, Role.BK_CARB -> (target.carbs - others.carbs) / (f.carbs / 100.0).coerceAtLeast(0.01)
                    Role.FAT -> (target.fat - others.fat) / (f.fat / 100.0).coerceAtLeast(0.01)
                    else -> g[i]
                }
                val min = if (c.optional) 0.0 else f.minG.toDouble()
                g[i] = need.coerceIn(min, f.maxG.toDouble())
            }
        }
        return chosen.mapIndexed { i, (c, f) ->
            val step = f.step.coerceAtLeast(1)
            var v = (roundHalfUp(g[i] / step) * step).toInt()
            val min = if (c.optional) 0 else f.minG
            v = v.coerceIn(min, f.maxG)
            v
        }
    }

    /**
     * Ajuste fino: se a refeição passou mais de 5% das calorias-alvo (por causa de porções
     * mínimas e alimentos fixos), reduz primeiro gorduras opcionais, depois carboidratos,
     * leguminosas e, por último, proteína (somente se acima da meta).
     */
    private fun trim(chosen: List<Pair<Component, Food>>, start: List<Int>, target: Macros): List<Int> {
        val g = start.toMutableList()
        fun macros(): Macros {
            var m = Macros()
            for (i in chosen.indices) { val f = chosen[i].second; val k = g[i] / 100.0; m += Macros(f.kcal * k, f.protein * k, f.carbs * k, f.fat * k) }
            return m
        }
        fun minOf(i: Int): Int {
            val (c, f) = chosen[i]
            return when {
                c.optional -> 0
                c.role == Role.LEGUME -> 60
                c.role == Role.SALAD || c.role == Role.COOKED_VEG || c.role == Role.FRUIT || c.role == Role.DRINK -> g[i]
                else -> f.minG
            }
        }
        val order = listOf(
            { i: Int -> chosen[i].first.role == Role.FAT && chosen[i].first.optional },
            { i: Int -> chosen[i].first.role == Role.BK_CARB || chosen[i].first.role == Role.MAIN_CARB },
            { i: Int -> chosen[i].first.role == Role.LEGUME },
            { i: Int -> chosen[i].first.role == Role.FAT },
            { i: Int -> chosen[i].first.role in setOf(Role.MAIN_PROTEIN, Role.BK_PROTEIN, Role.SNACK_PROTEIN) && macros().protein > target.protein * 1.05 }
        )
        var guard = 0
        while (macros().kcal > target.kcal * 1.05 && guard++ < 200) {
            var reduced = false
            for (rule in order) {
                val idx = chosen.indices.filter { rule(it) && g[it] - chosen[it].second.step.coerceAtLeast(1) >= minOf(it) }
                    .maxByOrNull { g[it] * chosen[it].second.kcal }
                if (idx != null) {
                    g[idx] -= chosen[idx].second.step.coerceAtLeast(1)
                    reduced = true
                    break
                }
            }
            if (!reduced) break
        }
        return g
    }

    private fun defaultFixed(role: Role, f: Food): Double = when (role) {
        Role.FRUIT -> f.unitGrams.coerceAtLeast(f.minG.toDouble())
        Role.LEGUME -> 86.0
        Role.SALAD -> 80.0
        Role.COOKED_VEG -> 80.0
        Role.DRINK -> f.minG.toDouble().coerceAtLeast(100.0)
        else -> f.minG.toDouble()
    }

    /** Substituições equivalentes (mesmo papel, quantidade ajustada pelo macronutriente principal). */
    fun substitutes(item: MealItem, p: UserProfile): List<MealItem> {
        val food = FoodDb.get(item.foodId) ?: return emptyList()
        val role = runCatching { Role.valueOf(item.role) }.getOrNull() ?: food.roles.first()
        val key = food.macroFor(role) * item.grams / 100.0
        return FoodDb.all.filter { role in it.roles && it.id != food.id && FoodDb.isAllowed(it, p) }
            .map { alt ->
                val density = alt.macroFor(role)
                val grams = if (density <= 0.01 || key <= 0.01) item.grams.toDouble() else key / density * 100
                val step = alt.step.coerceAtLeast(1)
                val g = (roundHalfUp(grams / step) * step).toInt().coerceIn(maxOf(alt.minG, step), maxOf(alt.maxG, alt.minG) * 2)
                MealItem(alt.id, g, item.role)
            }
            .sortedBy { abs(it.macros().kcal - item.macros().kcal) }
    }

    /** Lista de compras semanal agregada, convertida para peso de compra (cru/seco). */
    fun shoppingList(days: List<DietDay>): List<ShoppingItem> {
        val grams = mutableMapOf<String, Double>()
        days.forEach { d -> d.meals.forEach { m -> m.items.forEach { grams[it.foodId] = (grams[it.foodId] ?: 0.0) + it.grams } } }
        return grams.mapNotNull { (id, g) ->
            val f = FoodDb.get(id) ?: return@mapNotNull null
            val raw = g * f.rawFactor
            val cost = raw / 1000.0 * f.pricePerKg
            val qty = when {
                f.id.startsWith("ovo") -> "${kotlin.math.ceil(g / 50.0).toInt()} ovos"
                f.unitName.startsWith("copo") || f.id == "cafe" -> "${(raw / 1000.0).dec(1)} L"
                f.id in setOf("banana", "maca", "laranja") -> "${kotlin.math.ceil(g / f.unitGrams).toInt()} unidades"
                raw >= 1000 -> "${(raw / 1000.0).dec(1)} kg"
                else -> "${(kotlin.math.ceil(raw / 50.0) * 50).toInt()} g"
            }
            val label = if (f.rawFactor < 0.9) "${f.name.substringBefore(" cozid")} (cru/seco)" else f.name
            ShoppingItem(f.id, label, qty, raw.roundToInt(), cost)
        }.sortedBy { it.name }
    }
}

/* ------------------------------------------------------------------ Receitas */

data class Recipe(
    val id: String,
    val title: String,
    val minutes: Int,
    val tags: List<String>,
    val ingredients: List<String>,
    val steps: List<String>,
    val kcal: Int,
    val protein: Int,
    val noCook: Boolean = false
)

object Recipes {
    val all = listOf(
        Recipe("crepioca", "Crepioca de frango", 10, listOf("Café da manhã", "Rápida", "Econômica"),
            listOf("1 ovo", "2 colheres de sopa de goma de tapioca", "2 colheres de sopa de frango desfiado", "Sal e orégano"),
            listOf("Bata o ovo com a tapioca e uma pitada de sal.", "Despeje em frigideira antiaderente aquecida.", "Vire, recheie com frango e dobre."), 260, 22),
        Recipe("overnight", "Aveia de geladeira (overnight oats)", 5, listOf("Café da manhã", "Sem fogão", "Dias corridos"),
            listOf("3 colheres de sopa de aveia", "1 pote de iogurte natural", "½ banana em rodelas", "Canela a gosto"),
            listOf("Misture tudo num pote com tampa.", "Leve à geladeira de um dia para o outro.", "Coma gelado pela manhã."), 330, 14, noCook = true),
        Recipe("marmita_frango", "Marmitas de frango, arroz e feijão (5 dias)", 60, listOf("Almoço", "Econômica", "Congelável"),
            listOf("750 g de peito de frango", "2 xícaras de arroz cru", "1 ½ xícara de feijão cru", "Legumes picados", "Alho, cebola, sal, limão"),
            listOf("Cozinhe o feijão na pressão (25–30 min) e tempere.", "Faça o arroz.", "Tempere o frango com alho, limão e sal; grelhe e corte em tiras.", "Divida em 5 potes com legumes cozidos e congele."), 520, 45),
        Recipe("omelete_forno", "Omelete de forno com legumes", 30, listOf("Jantar", "Vegetariana", "Econômica"),
            listOf("6 ovos", "1 cenoura ralada", "1 abobrinha ralada", "½ cebola", "Sal e cheiro-verde"),
            listOf("Bata os ovos com sal.", "Misture os legumes.", "Asse em forma untada a 200 °C por 20–25 min.", "Rende 3 porções."), 250, 18),
        Recipe("atum_salada", "Salada completa de atum (sem fogão)", 10, listOf("Almoço", "Sem fogão", "Dias corridos"),
            listOf("1 lata de atum em água", "Folhas e tomate", "4 colheres de sopa de grão-de-bico pronto", "1 colher de sopa de azeite", "Limão"),
            listOf("Escorra o atum.", "Monte a salada com folhas, tomate e grão-de-bico.", "Tempere com azeite, limão e sal."), 420, 38, noCook = true),
        Recipe("sanduiche", "Sanduíche natural de frango", 10, listOf("Lanche", "Dias corridos"),
            listOf("2 fatias de pão integral", "3 colheres de sopa de frango desfiado", "1 colher de sopa de iogurte natural", "Cenoura ralada e folhas"),
            listOf("Misture frango, iogurte e cenoura.", "Monte o sanduíche com as folhas."), 300, 25),
        Recipe("escondidinho", "Escondidinho de mandioca com carne moída", 45, listOf("Almoço", "Jantar"),
            listOf("500 g de mandioca cozida", "400 g de carne moída (patinho)", "Tomate, cebola, alho", "Leite (ou água do cozimento)"),
            listOf("Amasse a mandioca com um pouco de leite e sal.", "Refogue a carne com temperos.", "Monte em camadas e leve ao forno por 15 min."), 480, 35),
        Recipe("tofu_mexido", "Tofu mexido (vegano)", 10, listOf("Café da manhã", "Vegana"),
            listOf("150 g de tofu", "Cúrcuma, sal, cebola", "Tomate picado"),
            listOf("Amasse o tofu com um garfo.", "Refogue a cebola, junte o tofu e os temperos.", "Finalize com tomate."), 190, 15),
        Recipe("pts_bolonhesa", "Macarrão à bolonhesa de soja", 25, listOf("Almoço", "Vegana", "Econômica"),
            listOf("½ xícara de PTS", "Molho de tomate caseiro", "Macarrão", "Alho e cebola"),
            listOf("Hidrate a PTS em água quente por 10 min e esprema.", "Refogue com alho, cebola e molho.", "Sirva com macarrão cozido."), 450, 28),
        Recipe("vitamina", "Vitamina de banana com aveia", 5, listOf("Lanche", "Pré-treino", "Sem fogão"),
            listOf("1 copo de leite (ou bebida vegetal)", "1 banana", "2 colheres de sopa de aveia"),
            listOf("Bata tudo no liquidificador.", "Sirva gelada."), 300, 11, noCook = true),
        Recipe("cuscuz_ovo", "Cuscuz nordestino com ovo", 15, listOf("Café da manhã", "Econômica", "Sem glúten"),
            listOf("½ xícara de flocão de milho", "Água e sal", "2 ovos"),
            listOf("Hidrate o flocão com água e sal por 10 min.", "Cozinhe na cuscuzeira por 8 min.", "Sirva com ovos mexidos."), 330, 16),
        Recipe("iogurte_frutas", "Iogurte com frutas e castanha", 3, listOf("Lanche", "Sem fogão", "Dias corridos"),
            listOf("1 pote de iogurte natural", "Frutas picadas", "1 castanha-do-pará picada"),
            listOf("Monte num pote e consuma."), 180, 8, noCook = true)
    )
}
