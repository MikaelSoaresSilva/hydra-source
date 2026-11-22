package com.aurea.fit.domain

/**
 * Banco de alimentos comuns no Brasil.
 * Valores por 100 g do alimento PRONTO PARA CONSUMO, aproximados a partir da
 * Tabela Brasileira de Composição de Alimentos (TACO/UNICAMP) e rótulos comuns.
 * Preços: estimativa média de supermercado (R$/kg do produto como é comprado)
 * — variam por região e época, por isso o app sempre mostra como "estimativa".
 */
enum class Role { BK_PROTEIN, BK_CARB, SNACK_PROTEIN, MAIN_PROTEIN, MAIN_CARB, LEGUME, SALAD, COOKED_VEG, FRUIT, FAT, DRINK }

enum class FoodTag { LACTOSE, MILK, GLUTEN, EGG, PEANUT, NUTS, FISH, SOY, RED_MEAT, PORK, POULTRY }

data class Food(
    val id: String,
    val name: String,
    val kcal: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
    val roles: Set<Role>,
    val unitName: String,
    val unitGrams: Double,
    val pricePerKg: Double,
    /** gramas compradas (cru/seco) para cada grama pronta. */
    val rawFactor: Double = 1.0,
    val tags: Set<FoodTag> = emptySet(),
    val practical: Boolean = false,
    val minG: Int = 0,
    val maxG: Int = 300,
    val step: Int = 5,
    val purchaseNote: String = ""
) {
    val isAnimalFlesh get() = FoodTag.RED_MEAT in tags || FoodTag.PORK in tags || FoodTag.POULTRY in tags || FoodTag.FISH in tags
    val isAnimalProduct get() = isAnimalFlesh || FoodTag.EGG in tags || FoodTag.MILK in tags || FoodTag.LACTOSE in tags
    fun macroFor(role: Role): Double = when (role) {
        Role.MAIN_PROTEIN, Role.BK_PROTEIN, Role.SNACK_PROTEIN -> protein
        Role.MAIN_CARB, Role.BK_CARB, Role.LEGUME, Role.FRUIT -> carbs
        Role.FAT -> fat
        else -> kcal
    }
}

object FoodDb {
    val all: List<Food> = listOf(
        // ---------- PROTEÍNAS PRINCIPAIS ----------
        Food("frango_peito", "Peito de frango grelhado", 159.0, 32.0, 0.0, 2.5, setOf(Role.MAIN_PROTEIN), "filé médio", 100.0, 22.0, 1.35, setOf(FoodTag.POULTRY), minG = 80, maxG = 250, step = 10),
        Food("frango_coxa", "Sobrecoxa de frango assada (sem pele)", 215.0, 26.0, 0.0, 12.0, setOf(Role.MAIN_PROTEIN), "unidade", 90.0, 14.0, 1.6, setOf(FoodTag.POULTRY), minG = 80, maxG = 220, step = 10),
        Food("frango_assado", "Frango assado de padaria (sem pele)", 190.0, 28.0, 0.0, 8.0, setOf(Role.MAIN_PROTEIN), "pedaço médio", 100.0, 40.0, 1.0, setOf(FoodTag.POULTRY), practical = true, minG = 80, maxG = 220, step = 10, purchaseNote = "pronto"),
        Food("carne_moida", "Carne moída (patinho) refogada", 219.0, 35.9, 0.0, 7.3, setOf(Role.MAIN_PROTEIN), "colher de sopa cheia", 25.0, 42.0, 1.35, setOf(FoodTag.RED_MEAT), minG = 80, maxG = 200, step = 10),
        Food("alcatra", "Bife de alcatra grelhado", 241.0, 31.9, 0.0, 11.6, setOf(Role.MAIN_PROTEIN), "bife médio", 100.0, 50.0, 1.35, setOf(FoodTag.RED_MEAT), minG = 80, maxG = 200, step = 10),
        Food("lombo", "Lombo suíno assado", 210.0, 35.7, 0.0, 6.4, setOf(Role.MAIN_PROTEIN), "fatia média", 80.0, 28.0, 1.4, setOf(FoodTag.PORK), minG = 80, maxG = 200, step = 10),
        Food("tilapia", "Filé de tilápia grelhado", 128.0, 26.0, 0.0, 2.6, setOf(Role.MAIN_PROTEIN), "filé médio", 120.0, 45.0, 1.3, setOf(FoodTag.FISH), minG = 90, maxG = 240, step = 10),
        Food("sardinha", "Sardinha em lata ao molho de tomate", 180.0, 17.0, 1.0, 12.0, setOf(Role.MAIN_PROTEIN), "lata (escorrida)", 85.0, 50.0, 1.0, setOf(FoodTag.FISH), practical = true, minG = 80, maxG = 170, step = 5),
        Food("atum", "Atum em lata em água", 113.0, 26.0, 0.0, 1.0, setOf(Role.MAIN_PROTEIN, Role.SNACK_PROTEIN), "lata (escorrida)", 120.0, 70.0, 1.0, setOf(FoodTag.FISH), practical = true, minG = 60, maxG = 200, step = 10),
        Food("ovo_main", "Omelete / ovos mexidos", 155.0, 13.0, 1.0, 11.0, setOf(Role.MAIN_PROTEIN), "ovo", 50.0, 15.0, 1.0, setOf(FoodTag.EGG), practical = true, minG = 100, maxG = 200, step = 50),
        Food("tofu", "Tofu grelhado", 85.0, 9.0, 2.0, 5.0, setOf(Role.MAIN_PROTEIN, Role.BK_PROTEIN), "fatia", 50.0, 40.0, 1.0, setOf(FoodTag.SOY), minG = 80, maxG = 250, step = 10),
        Food("pts", "Proteína texturizada de soja (peso seco)", 330.0, 50.0, 30.0, 1.0, setOf(Role.MAIN_PROTEIN), "colher de sopa (seca)", 10.0, 25.0, 1.0, setOf(FoodTag.SOY), minG = 30, maxG = 80, step = 5),
        // ---------- PROTEÍNAS DE CAFÉ / LANCHE ----------
        Food("ovo", "Ovo cozido ou mexido", 146.0, 13.3, 0.6, 9.5, setOf(Role.BK_PROTEIN, Role.SNACK_PROTEIN), "ovo", 50.0, 15.0, 1.0, setOf(FoodTag.EGG), practical = true, minG = 50, maxG = 200, step = 50),
        Food("iogurte", "Iogurte natural integral", 51.0, 4.1, 1.9, 3.0, setOf(Role.BK_PROTEIN, Role.SNACK_PROTEIN), "pote", 170.0, 14.0, 1.0, setOf(FoodTag.LACTOSE, FoodTag.MILK), practical = true, minG = 100, maxG = 200, step = 10),
        Food("iogurte_desnatado", "Iogurte natural desnatado", 41.0, 4.0, 5.5, 0.3, setOf(Role.BK_PROTEIN, Role.SNACK_PROTEIN), "pote", 170.0, 15.0, 1.0, setOf(FoodTag.LACTOSE, FoodTag.MILK), practical = true, minG = 100, maxG = 200, step = 10),
        Food("queijo_minas", "Queijo minas frescal", 264.0, 17.4, 3.2, 20.2, setOf(Role.BK_PROTEIN, Role.SNACK_PROTEIN), "fatia média", 30.0, 45.0, 1.0, setOf(FoodTag.LACTOSE, FoodTag.MILK), practical = true, minG = 20, maxG = 60, step = 10),
        Food("leite_desnatado", "Leite desnatado", 35.0, 3.4, 4.9, 0.1, setOf(Role.SNACK_PROTEIN, Role.DRINK), "copo (200 ml)", 200.0, 5.5, 1.0, setOf(FoodTag.LACTOSE, FoodTag.MILK), practical = true, minG = 150, maxG = 400, step = 50),
        Food("leite_sem_lactose", "Leite sem lactose semidesnatado", 44.0, 3.2, 4.8, 1.3, setOf(Role.SNACK_PROTEIN, Role.DRINK), "copo (200 ml)", 200.0, 6.5, 1.0, setOf(FoodTag.MILK), practical = true, minG = 150, maxG = 400, step = 50),
        Food("bebida_soja", "Bebida de soja sem açúcar", 40.0, 3.3, 2.5, 1.8, setOf(Role.SNACK_PROTEIN, Role.DRINK), "copo (200 ml)", 200.0, 10.0, 1.0, setOf(FoodTag.SOY), practical = true, minG = 150, maxG = 400, step = 50),
        Food("whey", "Whey protein (opcional)", 380.0, 78.0, 8.0, 5.0, setOf(Role.SNACK_PROTEIN), "scoop", 30.0, 140.0, 1.0, setOf(FoodTag.MILK, FoodTag.LACTOSE), practical = true, minG = 15, maxG = 40, step = 5),
        // ---------- CARBOIDRATOS DE CAFÉ / LANCHE ----------
        Food("pao_frances", "Pão francês", 300.0, 8.0, 58.6, 3.1, setOf(Role.BK_CARB), "unidade", 50.0, 18.0, 1.0, setOf(FoodTag.GLUTEN), practical = true, minG = 25, maxG = 100, step = 25),
        Food("pao_integral", "Pão de forma integral", 253.0, 9.4, 49.9, 3.7, setOf(Role.BK_CARB), "fatia", 25.0, 22.0, 1.0, setOf(FoodTag.GLUTEN), practical = true, minG = 25, maxG = 100, step = 25),
        Food("tapioca", "Tapioca (goma hidratada)", 240.0, 0.0, 60.0, 0.0, setOf(Role.BK_CARB), "colher de sopa", 20.0, 12.0, 1.0, minG = 20, maxG = 100, step = 10),
        Food("cuscuz", "Cuscuz de milho cozido", 113.0, 2.2, 25.3, 0.7, setOf(Role.BK_CARB, Role.MAIN_CARB), "fatia média", 100.0, 6.0, 0.45, minG = 50, maxG = 300, step = 10),
        Food("aveia", "Aveia em flocos", 394.0, 13.9, 66.6, 8.5, setOf(Role.BK_CARB), "colher de sopa", 15.0, 18.0, 1.0, setOf(FoodTag.GLUTEN), practical = true, minG = 15, maxG = 80, step = 5),
        // ---------- CARBOIDRATOS DO ALMOÇO / JANTAR ----------
        Food("arroz", "Arroz branco cozido", 128.0, 2.5, 28.1, 0.2, setOf(Role.MAIN_CARB), "colher de sopa cheia", 25.0, 6.0, 0.4, minG = 50, maxG = 350, step = 10),
        Food("arroz_integral", "Arroz integral cozido", 124.0, 2.6, 25.8, 1.0, setOf(Role.MAIN_CARB), "colher de sopa cheia", 25.0, 8.0, 0.4, minG = 50, maxG = 350, step = 10),
        Food("batata", "Batata inglesa cozida", 52.0, 1.2, 11.9, 0.0, setOf(Role.MAIN_CARB), "unidade média", 140.0, 6.0, 1.1, minG = 100, maxG = 500, step = 10),
        Food("batata_doce", "Batata-doce cozida", 77.0, 0.6, 18.4, 0.1, setOf(Role.MAIN_CARB, Role.BK_CARB), "unidade pequena", 130.0, 7.0, 1.1, minG = 80, maxG = 400, step = 10),
        Food("mandioca", "Mandioca (aipim) cozida", 125.0, 0.6, 30.1, 0.3, setOf(Role.MAIN_CARB), "pedaço médio", 80.0, 7.0, 1.2, minG = 60, maxG = 300, step = 10),
        Food("macarrao", "Macarrão cozido", 158.0, 5.8, 30.9, 0.9, setOf(Role.MAIN_CARB), "pegador", 80.0, 9.0, 0.43, setOf(FoodTag.GLUTEN), minG = 60, maxG = 300, step = 10),
        // ---------- LEGUMINOSAS ----------
        Food("feijao", "Feijão carioca cozido", 76.0, 4.8, 13.6, 0.5, setOf(Role.LEGUME), "concha média", 86.0, 8.0, 0.42, minG = 60, maxG = 200, step = 10),
        Food("feijao_preto", "Feijão preto cozido", 77.0, 4.5, 14.0, 0.5, setOf(Role.LEGUME), "concha média", 86.0, 9.0, 0.42, minG = 60, maxG = 200, step = 10),
        Food("lentilha", "Lentilha cozida", 93.0, 6.3, 16.3, 0.5, setOf(Role.LEGUME), "concha média", 86.0, 12.0, 0.42, minG = 60, maxG = 200, step = 10),
        Food("grao_de_bico", "Grão-de-bico cozido", 130.0, 7.0, 21.0, 2.0, setOf(Role.LEGUME), "concha média", 86.0, 14.0, 0.45, minG = 60, maxG = 200, step = 10),
        // ---------- VEGETAIS ----------
        Food("salada", "Salada de folhas e tomate", 15.0, 1.2, 2.6, 0.2, setOf(Role.SALAD), "prato de sobremesa", 80.0, 10.0, 1.1, practical = true, minG = 60, maxG = 200, step = 10),
        Food("legumes", "Legumes cozidos (cenoura, abobrinha, chuchu)", 30.0, 1.2, 6.0, 0.3, setOf(Role.COOKED_VEG), "colher de servir", 50.0, 8.0, 1.1, minG = 50, maxG = 200, step = 10),
        Food("brocolis", "Brócolis cozido", 25.0, 2.1, 4.4, 0.5, setOf(Role.COOKED_VEG), "ramo médio", 30.0, 15.0, 1.2, minG = 50, maxG = 200, step = 10),
        // ---------- FRUTAS ----------
        Food("banana", "Banana prata", 98.0, 1.3, 26.0, 0.1, setOf(Role.FRUIT), "unidade", 70.0, 7.0, 1.4, practical = true, minG = 70, maxG = 140, step = 35),
        Food("maca", "Maçã", 56.0, 0.3, 15.2, 0.0, setOf(Role.FRUIT), "unidade", 130.0, 11.0, 1.1, practical = true, minG = 130, maxG = 130, step = 130),
        Food("mamao", "Mamão papaia", 40.0, 0.5, 10.4, 0.1, setOf(Role.FRUIT), "fatia média", 170.0, 8.0, 1.4, practical = true, minG = 170, maxG = 170, step = 170),
        Food("laranja", "Laranja", 37.0, 1.0, 8.9, 0.1, setOf(Role.FRUIT), "unidade", 180.0, 5.0, 1.4, practical = true, minG = 180, maxG = 180, step = 180),
        Food("melancia", "Melancia", 33.0, 0.9, 8.1, 0.0, setOf(Role.FRUIT), "fatia", 200.0, 3.5, 1.6, practical = true, minG = 200, maxG = 200, step = 200),
        Food("morango", "Morango", 30.0, 0.9, 6.8, 0.3, setOf(Role.FRUIT), "xícara", 150.0, 25.0, 1.05, practical = true, minG = 150, maxG = 150, step = 150),
        // ---------- GORDURAS ----------
        Food("azeite", "Azeite de oliva", 884.0, 0.0, 0.0, 100.0, setOf(Role.FAT), "colher de sopa", 13.0, 55.0, 1.0, minG = 0, maxG = 13, step = 1),
        Food("pasta_amendoim", "Pasta de amendoim integral", 588.0, 25.0, 20.0, 50.0, setOf(Role.FAT), "colher de sopa", 15.0, 35.0, 1.0, setOf(FoodTag.PEANUT), practical = true, minG = 0, maxG = 30, step = 5),
        Food("amendoim", "Amendoim torrado sem sal", 606.0, 22.5, 18.7, 54.0, setOf(Role.FAT), "punhado", 20.0, 25.0, 1.0, setOf(FoodTag.PEANUT), practical = true, minG = 0, maxG = 30, step = 5),
        Food("castanha", "Castanha-do-pará", 643.0, 14.5, 15.1, 63.5, setOf(Role.FAT), "unidade", 4.0, 100.0, 1.0, setOf(FoodTag.NUTS), practical = true, minG = 0, maxG = 16, step = 4),
        Food("abacate", "Abacate", 96.0, 1.2, 6.0, 8.4, setOf(Role.FAT), "colher de sopa", 30.0, 10.0, 1.4, practical = true, minG = 0, maxG = 60, step = 10),
        // ---------- BEBIDA ----------
        Food("cafe", "Café sem açúcar (ou chá)", 2.0, 0.1, 0.3, 0.0, setOf(Role.DRINK), "xícara", 100.0, 3.5, 1.0, practical = true, minG = 100, maxG = 100, step = 100)
    )

    private val byId = all.associateBy { it.id }
    fun get(id: String): Food? = byId[id]
    fun require(id: String): Food = byId[id] ?: error("Alimento desconhecido: $id")

    /** Alimentos que a pessoa pode comer de acordo com restrição, alergias e preferências. */
    fun isAllowed(f: Food, p: UserProfile): Boolean {
        if (f.id in p.dislikedFoods) return false
        val t = f.tags
        val r = p.restriction
        if (r == DietRestriction.VEGETARIAN && f.isAnimalFlesh) return false
        if (r == DietRestriction.VEGAN && f.isAnimalProduct) return false
        if (r == DietRestriction.NO_PORK && FoodTag.PORK in t) return false
        if (r == DietRestriction.NO_RED_MEAT && (FoodTag.RED_MEAT in t || FoodTag.PORK in t)) return false
        for (a in p.allergies) {
            val blocked = when (a) {
                Allergy.LACTOSE -> FoodTag.LACTOSE in t
                Allergy.MILK -> FoodTag.MILK in t || FoodTag.LACTOSE in t
                Allergy.GLUTEN -> FoodTag.GLUTEN in t
                Allergy.EGG -> FoodTag.EGG in t
                Allergy.PEANUT -> FoodTag.PEANUT in t
                Allergy.NUTS -> FoodTag.NUTS in t
                Allergy.FISH -> FoodTag.FISH in t
                Allergy.SOY -> FoodTag.SOY in t
            }
            if (blocked) return false
        }
        return true
    }

    fun measure(food: Food, grams: Int): String {
        if (grams <= 0) return "a gosto"
        val n = grams / food.unitGrams
        val rounded = (roundHalfUp(n * 2) / 2.0)
        val num = when {
            rounded <= 0.0 -> "½"
            rounded % 1.0 == 0.0 -> rounded.toInt().toString()
            rounded < 1 -> "½"
            else -> "${rounded.toInt()} e ½"
        }
        val unit = if (rounded > 1.0) pluralize(food.unitName) else food.unitName
        return "$num $unit"
    }

    private fun pluralize(u: String): String {
        val parts = u.split(" ")
        val first = parts.first()
        val pl = when {
            first.endsWith("ão") -> first.dropLast(2) + "ões"
            first.endsWith("r") || first.endsWith("z") -> first + "es"
            first.endsWith("l") -> first.dropLast(1) + "is"
            first.endsWith("s") -> first
            else -> first + "s"
        }
        val rest = parts.drop(1).map {
            when (it) {
                "médio" -> "médios"; "média" -> "médias"; "cheia" -> "cheias"; "pequena" -> "pequenas"; "grande" -> "grandes"
                else -> it
            }
        }
        return (listOf(pl) + rest).joinToString(" ")
    }

    val commonChoices: List<Food> get() = all.filter { it.id != "cafe" }
}
