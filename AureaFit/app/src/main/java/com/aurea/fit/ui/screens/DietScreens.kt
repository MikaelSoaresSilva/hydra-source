package com.aurea.fit.ui.screens

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.aurea.fit.data.today
import com.aurea.fit.domain.*
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*
import com.aurea.fit.ui.theme.LocalExtras
import java.time.LocalDate
import kotlin.math.roundToInt

/** 9. Dieta personalizada. */
@Composable
fun DietScreen(vm: AppViewModel, nav: (String) -> Unit) {
    val plan by vm.dietPlan.collectAsState()
    val profile by vm.profile.collectAsState()
    val checks by vm.mealChecks.collectAsState()
    val settings by vm.settings.collectAsState()
    val todayIdx = LocalDate.now().dayOfWeek.value - 1
    var dayIdx by rememberSaveable { mutableIntStateOf(todayIdx) }
    var swap by remember { mutableStateOf<Triple<Int, Int, MealItem>?>(null) }
    var showWhy by remember { mutableStateOf(false) }

    Scaffold(topBar = {
        AureaTopBar("Minha dieta", actions = {
            IconButton(onClick = { nav("recipes") }) { Icon(Icons.Default.RestaurantMenu, "Receitas e substituições") }
            IconButton(onClick = { nav("shopping") }) { Icon(Icons.Default.ShoppingCart, "Lista de compras") }
        })
    }) { pad ->
        val dp = plan
        if (dp == null || profile == null) { Box(Modifier.padding(pad)) { EmptyState("Sem dieta", "Responda o questionário para gerar seu cardápio.") }; return@Scaffold }
        val t = dp.targets
        val day = dp.days[dayIdx.coerceIn(0, dp.days.lastIndex)]
        val dm = day.macros()
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                HeroCard {
                    Text("Meta diária", style = MaterialTheme.typography.labelLarge)
                    if (!settings.hideCalories) Text("${t.calories} kcal", style = MaterialTheme.typography.headlineLarge)
                    Text("Proteína ${t.proteinG} g • Carboidratos ${t.carbsG} g • Gorduras ${t.fatG} g", style = MaterialTheme.typography.bodyMedium)
                    Text("Água ${"%.2f".format(t.waterMl / 1000.0)} L", style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { showWhy = !showWhy }, colors = ButtonDefaults.textButtonColors(contentColor = androidx.compose.ui.graphics.Color.White)) {
                        Text(if (showWhy) "Ocultar cálculo" else "Como isso foi calculado?")
                    }
                    if (showWhy) t.explanation.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
                }
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(7) { i ->
                        FilterChip(i == dayIdx, { dayIdx = i }, label = { Text(WEEKDAY_SHORT[i + 1] + if (i == todayIdx) " (hoje)" else "") })
                    }
                }
            }
            item {
                AureaCard {
                    Text("Total do dia (cardápio)", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(4.dp))
                    MacroPills(dm.kcal.roundToInt(), dm.protein.roundToInt(), dm.carbs.roundToInt(), dm.fat.roundToInt(), settings.hideCalories)
                }
            }
            itemsIndexed(day.meals) { mi, meal ->
                val mm = meal.macros()
                val done = dayIdx == todayIdx && checks.any { it.mealIndex == mi }
                AureaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${meal.time} • ${meal.title}", style = MaterialTheme.typography.titleMedium)
                            if (meal.note.isNotBlank()) Text(meal.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (dayIdx == todayIdx) {
                            FilterChip(done, { vm.toggleMeal(mi, !done) }, label = { Text(if (done) "Feita" else "Marcar") },
                                leadingIcon = if (done) ({ Icon(Icons.Default.Check, null, Modifier.size(16.dp)) }) else null,
                                modifier = Modifier.testTag("meal_$mi"))
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    meal.items.forEachIndexed { ii, item ->
                        val f = FoodDb.get(item.foodId) ?: return@forEachIndexed
                        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(f.name, style = MaterialTheme.typography.bodyLarge, textDecoration = if (done) TextDecoration.LineThrough else null)
                                Text("${item.grams} g • ${FoodDb.measure(f, item.grams)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            IconButton(onClick = { swap = Triple(mi, ii, item) }) { Icon(Icons.Default.SwapHoriz, "Substituir ${f.name}") }
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    MacroPills(mm.kcal.roundToInt(), mm.protein.roundToInt(), mm.carbs.roundToInt(), mm.fat.roundToInt(), settings.hideCalories)
                }
            }
            item {
                AureaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Savings, null, tint = LocalExtras.current.gold)
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text("Custo estimado: ${brl(dp.monthlyCost)}/mês", style = MaterialTheme.typography.titleMedium)
                            Text("Orçamento informado: ${brl(dp.budget.toDouble())}. Preços médios aproximados; variam por região.", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item { dp.notes.forEach { InfoBanner(it); Spacer(Modifier.height(6.dp)) } }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile("Receitas e substituições", "", Modifier.weight(1f), Icons.Default.RestaurantMenu) { nav("recipes") }
                    StatTile("Lista de compras", "", Modifier.weight(1f), Icons.Default.ShoppingCart) { nav("shopping") }
                    StatTile("Água", "", Modifier.weight(1f), Icons.Default.WaterDrop) { nav("water") }
                }
            }
        }
    }
    swap?.let { (mi, ii, item) ->
        val subs = remember(item) { DietGenerator.substitutes(item, profile!!) }
        var allDays by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { swap = null },
            title = { Text("Substituir ${FoodDb.get(item.foodId)?.name}") },
            text = {
                Column {
                    Text("Quantidades equivalentes calculadas pelo nutriente principal.", style = MaterialTheme.typography.bodySmall)
                    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(allDays, { allDays = it }); Text("Trocar em todos os dias") }
                    if (subs.isEmpty()) Text("Nenhuma substituição compatível com suas restrições.")
                    LazyColumn(Modifier.heightIn(max = 360.dp)) {
                        items(subs) { s ->
                            val f = FoodDb.get(s.foodId)!!
                            SettingRow(f.name, "${s.grams} g • ${FoodDb.measure(f, s.grams)} • ${s.macros().kcal.roundToInt()} kcal", onClick = {
                                vm.swapFood(dayIdx, mi, ii, s, allDays); swap = null
                            })
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { swap = null }) { Text("Fechar") } }
        )
    }
}

/** 10. Receitas e substituições. */
@Composable
fun RecipesScreen(vm: AppViewModel, onBack: () -> Unit) {
    val profile by vm.profile.collectAsState()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var filter by remember { mutableStateOf<String?>(null) }
    var open by remember { mutableStateOf<Recipe?>(null) }
    val tags = listOf("Sem fogão", "Dias corridos", "Econômica", "Café da manhã", "Almoço", "Lanche", "Vegana")
    Scaffold(topBar = { AureaTopBar("Receitas e substituições", onBack) }) { pad ->
        Column(Modifier.padding(pad)) {
            TabRow(selectedTabIndex = tab) {
                Tab(tab == 0, { tab = 0 }, text = { Text("Receitas") })
                Tab(tab == 1, { tab = 1 }, text = { Text("Substituições") })
            }
            if (tab == 0) {
                val list = Recipes.all.filter { filter == null || filter in it.tags || (filter == "Sem fogão" && it.noCook) }
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item { FilterChip(filter == null, { filter = null }, label = { Text("Todas") }) }
                            items(tags) { t -> FilterChip(filter == t, { filter = if (filter == t) null else t }, label = { Text(t) }) }
                        }
                    }
                    items(list) { r ->
                        AureaCard(onClick = { open = r }) {
                            Text(r.title, style = MaterialTheme.typography.titleMedium)
                            Text("${r.minutes} min • ~${r.kcal} kcal • ${r.protein} g proteína/porção", style = MaterialTheme.typography.bodySmall)
                            Text(r.tags.joinToString(" • "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            } else {
                val p = profile
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item { InfoBanner("Troque alimentos do mesmo grupo mantendo o plano coerente. As quantidades abaixo equivalem à porção de referência.") }
                    val groups = listOf(
                        Triple("Proteínas (≈ 30 g de proteína)", Role.MAIN_PROTEIN, MealItem("frango_peito", 100, Role.MAIN_PROTEIN.name)),
                        Triple("Carboidratos do almoço (≈ 40 g de carboidrato)", Role.MAIN_CARB, MealItem("arroz", 140, Role.MAIN_CARB.name)),
                        Triple("Carboidratos do café/lanche (≈ 30 g)", Role.BK_CARB, MealItem("pao_frances", 50, Role.BK_CARB.name)),
                        Triple("Proteínas do café/lanche (≈ 13 g)", Role.SNACK_PROTEIN, MealItem("ovo", 100, Role.SNACK_PROTEIN.name)),
                        Triple("Frutas (≈ 18 g de carboidrato)", Role.FRUIT, MealItem("banana", 70, Role.FRUIT.name)),
                        Triple("Gorduras (≈ 8 g de gordura)", Role.FAT, MealItem("azeite", 8, Role.FAT.name))
                    )
                    groups.forEach { (title, _, ref) ->
                        item {
                            AureaCard {
                                Text(title, style = MaterialTheme.typography.titleMedium)
                                val rf = FoodDb.get(ref.foodId)!!
                                val allowedRef = p == null || FoodDb.isAllowed(rf, p)
                                if (allowedRef) Text("• ${rf.name}: ${ref.grams} g (${FoodDb.measure(rf, ref.grams)})", style = MaterialTheme.typography.bodyMedium)
                                (if (p != null) DietGenerator.substitutes(ref, p) else emptyList()).take(8).forEach { s ->
                                    val f = FoodDb.get(s.foodId)!!
                                    Text("• ${f.name}: ${s.grams} g (${FoodDb.measure(f, s.grams)})", style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    open?.let { r ->
        AlertDialog(
            onDismissRequest = { open = null },
            title = { Text(r.title) },
            text = {
                LazyColumn(Modifier.heightIn(max = 420.dp)) {
                    item { Text("${r.minutes} min • ~${r.kcal} kcal • ${r.protein} g de proteína por porção", style = MaterialTheme.typography.labelLarge) }
                    item { Text("Ingredientes", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }
                    items(r.ingredients) { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
                    item { Text("Modo de preparo", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }
                    itemsIndexed(r.steps) { i, s -> Text("${i + 1}. $s", style = MaterialTheme.typography.bodyMedium) }
                }
            },
            confirmButton = { TextButton(onClick = { open = null }) { Text("Fechar") } }
        )
    }
}

/** 11. Lista de compras semanal. */
@Composable
fun ShoppingScreen(vm: AppViewModel, onBack: () -> Unit) {
    val plan by vm.dietPlan.collectAsState()
    val ctx = LocalContext.current
    val items = remember(plan) { plan?.let { DietGenerator.shoppingList(it.days) } ?: emptyList() }
    val checked = remember { mutableStateMapOf<String, Boolean>() }
    Scaffold(topBar = {
        AureaTopBar("Lista de compras", onBack, actions = {
            IconButton(onClick = {
                val text = buildString {
                    appendLine("Lista de compras da semana — Áurea")
                    items.forEach { appendLine("☐ ${it.name}: ${it.quantity}") }
                    appendLine("Custo estimado: ${brl(items.sumOf { it.cost })}")
                }
                ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Compartilhar lista"))
            }) { Icon(Icons.Default.Share, "Compartilhar lista") }
        })
    }) { pad ->
        if (items.isEmpty()) { Box(Modifier.padding(pad)) { EmptyState("Lista vazia", "Gere sua dieta para criar a lista.") }; return@Scaffold }
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            item {
                AureaCard {
                    Text("Semana: ${brl(items.sumOf { it.cost })}", style = MaterialTheme.typography.headlineSmall)
                    Text("Mês (≈ 4,3 semanas): ${brl(items.sumOf { it.cost } * 4.3)}", style = MaterialTheme.typography.titleMedium)
                    Text("Estimativa com preços médios de supermercado. Quantidades já convertidas para o peso cru/seco quando necessário.", style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(8.dp))
            }
            items(items, key = { it.foodId }) { it ->
                val on = checked[it.foodId] == true
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(on, { v -> checked[it.foodId] = v })
                    Column(Modifier.weight(1f)) {
                        Text(it.name, style = MaterialTheme.typography.bodyLarge, textDecoration = if (on) TextDecoration.LineThrough else null)
                        Text(it.quantity, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(brl(it.cost), style = MaterialTheme.typography.labelLarge)
                }
            }
            item {
                Spacer(Modifier.height(8.dp))
                InfoBanner("Dicas para economizar: compre frutas da estação, carnes em promoção para congelar, arroz e feijão em pacotes maiores e prepare marmitas no fim de semana.")
            }
        }
    }
}

/** 12. Controle de água. */
@Composable
fun WaterScreen(vm: AppViewModel, onBack: () -> Unit) {
    val water by vm.waterToday.collectAsState()
    val week by vm.waterWeek.collectAsState()
    val goal by vm.waterGoal.collectAsState()
    val settings by vm.settings.collectAsState()
    val total = water.sumOf { it.ml }
    var custom by remember { mutableStateOf("") }
    val blue = LocalExtras.current.water
    Scaffold(topBar = { AureaTopBar("Controle de água", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            item {
                ProgressRing(total / goal.toFloat().coerceAtLeast(1f), size = 200.dp, stroke = 18.dp, color = blue) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${total} ml", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.testTag("waterTotal"))
                        Text("de ${goal} ml", style = MaterialTheme.typography.bodyMedium)
                        if (total >= goal) Text("Meta batida! 🎉", style = MaterialTheme.typography.labelLarge, color = blue)
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(150, settings.glassMl, 500).distinct().forEach { ml ->
                        Button(onClick = { vm.addWater(ml) }, colors = ButtonDefaults.buttonColors(containerColor = blue), modifier = Modifier.testTag("water_$ml")) { Text("+$ml ml") }
                    }
                }
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    NumberField("Outra quantidade", custom, { custom = it }, Modifier.weight(1f), "ml", decimal = false)
                    Spacer(Modifier.width(8.dp))
                    FilledTonalButton(onClick = { custom.toIntOrNull()?.takeIf { it in 1..3000 }?.let { vm.addWater(it); custom = "" } }) { Text("Adicionar") }
                }
            }
            item {
                AureaCard {
                    Text("Últimos 7 dias", style = MaterialTheme.typography.titleMedium)
                    val start = today() - 6
                    val values = (0..6).map { d -> week.filter { it.epochDay == start + d }.sumOf { it.ml } / 1000.0 }
                    val labels = (0..6).map { d -> WEEKDAY_SHORT[LocalDate.ofEpochDay(start + d).dayOfWeek.value] }
                    BarChart(labels, values, "L", color = blue, goal = goal / 1000.0)
                }
            }
            item {
                AureaCard {
                    Text("Meta diária", style = MaterialTheme.typography.titleMedium)
                    Text("Calculada como 35 ml por kg de peso. Em dias quentes ou de treino intenso, beba um pouco mais.", style = MaterialTheme.typography.bodySmall)
                    Stepper("Meta (ml)", goal, 1000..5000, { g -> vm.updateSettings { it.copy(waterGoalOverride = g) } }, step = 250)
                    Stepper("Tamanho do seu copo", settings.glassMl, 100..1000, { g -> vm.updateSettings { it.copy(glassMl = g) } }, step = 50, format = { "$it ml" })
                    if (settings.waterGoalOverride > 0) TextButton(onClick = { vm.updateSettings { it.copy(waterGoalOverride = 0) } }) { Text("Voltar para a meta automática") }
                }
            }
            item { SectionTitle("Registros de hoje") }
            if (water.isEmpty()) item { Text("Nenhum registro hoje.", style = MaterialTheme.typography.bodyMedium) }
            items(water, key = { it.id }) { w ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.WaterDrop, null, tint = blue)
                    Spacer(Modifier.width(8.dp))
                    Text("${w.ml} ml", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Text(java.text.SimpleDateFormat("HH:mm", java.util.Locale("pt", "BR")).format(java.util.Date(w.timeMillis)), style = MaterialTheme.typography.bodySmall)
                    IconButton(onClick = { vm.deleteWater(w.id) }) { Icon(Icons.Default.Delete, "Apagar") }
                }
            }
        }
    }
}
