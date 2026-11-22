package com.aurea.fit.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.aurea.fit.AureaApp
import com.aurea.fit.MainActivity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import com.aurea.fit.ui.nav.TestNav
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import android.app.AlarmManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider

/**
 * Teste de ponta a ponta: cadastro → questionário → painel → todas as telas.
 * Salva capturas em app/build/screens/.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w393dp-h851dp-xxhdpi")
class FullFlowTest {
    val rule = createAndroidComposeRule<MainActivity>()

    /** Garante isolamento: apaga qualquer dado de testes anteriores antes de abrir o app. */
    @get:Rule val chain: org.junit.rules.RuleChain = org.junit.rules.RuleChain
        .outerRule(object : org.junit.rules.ExternalResource() {
            override fun before() {
                runBlocking { androidx.test.core.app.ApplicationProvider.getApplicationContext<com.aurea.fit.AureaApp>().container.repository.deleteEverything() }
            }
        }).around(rule)

    private fun shot(name: String) { rule.waitForIdle(); rule.mainClock.advanceTimeBy(1500); rule.waitForIdle(); snap(rule.activity.window.decorView, name) }
    private fun tap(tag: String) { rule.onNodeWithTag(tag).performClick(); rule.waitForIdle() }
    private fun tapText(t: String) { rule.onNodeWithText(t, substring = true).performScrollTo().performClick(); rule.waitForIdle() }

    @Test fun fullJourney() {
        // Abertura: espera a tela de cadastro aparecer
        awaitDb { rule.onAllNodesWithTag("name").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithTag("name").assertExists()
        shot("02_cadastro")
        rule.onNodeWithTag("name").performTextInput("Mariana")
        rule.onNodeWithTag("email").performTextInput("mariana@exemplo.com")
        rule.onNodeWithTag("password").performTextInput("senha123")
        tap("authSubmit")
        rule.mainClock.advanceTimeBy(2000)
        rule.waitUntil(10_000) { rule.onAllNodesWithTag("next").fetchSemanticsNodes().isNotEmpty() }
        shot("03_questionario_boasvindas")
        // Questionário: percorre todas as etapas
        var step = 0
        while (step < 12) {
            if (step == 2) shot("04_selecao_objetivo")
            if (step == 4) { tapText("Desenvolver as costas"); shot("05_objetivo_corporal") }
            if (step == 11) shot("06_avaliacao_fisica")
            rule.onNodeWithTag("next").performClick(); rule.waitForIdle(); rule.mainClock.advanceTimeBy(600)
            step++
        }
        rule.waitUntil(15_000) { rule.onAllNodesWithTag("todayCard").fetchSemanticsNodes().isNotEmpty() }
        shot("07_painel")

        val app = ApplicationProvider.getApplicationContext<AureaApp>()
        val repo = app.container.repository
        runBlocking {
            assertNotNull(repo.currentProfile())
            assertNotNull(repo.activeWorkoutPlan())
            assertNotNull(repo.activeDietPlan())
            assertTrue(repo.db.schedule().all().size > 8)
        }
        // Lembretes agendados no AlarmManager
        val am = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        assertTrue("lembretes não foram agendados", shadowOf(am).scheduledAlarms.size > 8)

        // Água pelo painel
        tap("addWaterHome")
        awaitDb { repo.db.water().all().isNotEmpty() }
        runBlocking { assertEquals(250, repo.db.water().all().sumOf { it.ml }) }

        // Treino
        tap("tab_workout"); shot("08_ficha_treino")
        tap("startSession"); shot("09_registro_treino")
        rule.onAllNodes(hasTestTagStartingWith("set_")).onFirst().performClick(); rule.waitForIdle()
        rule.onNodeWithTag("finishSession").assertIsEnabled()
        tap("finishSession")
        shot("09b_apos_concluir")
        awaitDb { repo.db.workouts().allFeedback().isNotEmpty() }
        runBlocking { assertEquals(1, repo.db.workouts().allSessions().size); assertTrue(repo.db.workouts().allSets().isNotEmpty()) }

        rule.activity.runOnUiThread { }
        // Biblioteca e detalhe
        navigateTo("library"); shot("10_biblioteca")
        navigateTo("exercise/hip_thrust_barra"); shot("11_detalhe_exercicio")
        navigateTo("diet"); shot("12_dieta")
        navigateTo("recipes"); shot("13_receitas")
        navigateTo("shopping"); shot("14_lista_compras")
        navigateTo("water"); shot("15_agua")
        navigateTo("calendar"); shot("16_calendario")
        navigateTo("evolution"); shot("17_evolucao")
        // (Diálogos travam o "idle" do Robolectric; a medida é registrada via ViewModel, mesma função usada pelo diálogo.)
        rule.runOnUiThread { rule.activity.let { a -> androidx.lifecycle.ViewModelProvider(a)[AppViewModel::class.java] }
            .addMeasurement(com.aurea.fit.data.MeasurementEntity(epochDay = com.aurea.fit.data.today() - 14, weightKg = 62.4, waistCm = 74.0, hipCm = 98.0))
            .invokeOnCompletion { } }
        awaitDb { repo.db.progress().allMeasurements().isNotEmpty() }
        rule.runOnUiThread { androidx.lifecycle.ViewModelProvider(rule.activity)[AppViewModel::class.java]
            .addMeasurement(com.aurea.fit.data.MeasurementEntity(epochDay = com.aurea.fit.data.today(), weightKg = 61.5, waistCm = 72.5, hipCm = 99.0)) }
        awaitDb { repo.db.progress().allMeasurements().size == 2 }
        shot("17b_evolucao_com_dados")
        runBlocking { assertEquals(61.5, repo.db.progress().allMeasurements().last().weightKg!!, 0.01) }
        navigateTo("charts"); shot("18_graficos")
        navigateTo("settings"); shot("19_configuracoes")
        navigateTo("profile"); shot("20_perfil")
        navigateTo("notifications"); shot("21_notificacoes")
        navigateTo("checkin"); shot("22_checkin")
        rule.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(hasTestTag("submitCheckin")); tap("submitCheckin")
        awaitDb { repo.db.checkins().all().isNotEmpty() }
        rule.onNodeWithText("Recomendações").assertExists()
        shot("23_checkin_recomendacoes")
        navigateTo("goal"); shot("24_objetivo")
        rule.onNodeWithText("Ganho de massa muscular").performClick(); rule.waitForIdle()
        tap("saveGoal")
        awaitDb { repo.db.plans().all().count { it.kind == "DIET" } == 2 }
        awaitDb { TestNav.controller?.currentDestination?.route != "goal" }
        runBlocking {
            assertEquals(com.aurea.fit.domain.Goal.GAIN_MUSCLE, repo.currentProfile()!!.goal)
            assertEquals(2, repo.db.plans().all().count { it.kind == "DIET" })
        }
        navigateTo("history"); shot("25_historico_planos")
        navigateTo("home"); tap("tab_more"); rule.onNodeWithText("Calendário e rotina diária").assertExists(); shot("26_mais")
        navigateTo("assessment"); shot("27_avaliacao")
    }

    private fun awaitDb(cond: suspend () -> Boolean) {
        repeat(400) {
            rule.mainClock.advanceTimeBy(200); rule.waitForIdle()
            org.robolectric.shadows.ShadowLooper.idleMainLooper()
            Thread.sleep(20)
            if (runBlocking { cond() }) return
        }
        snap(rule.activity.window.decorView, "zz_falha_awaitDb"); fail("condição do banco não satisfeita")
    }

    private fun navigateTo(route: String) {
        rule.runOnUiThread {
            try { navController()?.navigate(route) } catch (t: Throwable) { println("NAVERR $route: $t") }
            println("NAVDBG $route -> ${navController()?.currentDestination?.route} stack=${navController()?.currentBackStack?.value?.map { it.destination.route }}")
        }
        rule.waitForIdle(); rule.mainClock.advanceTimeBy(800); rule.waitForIdle()
    }

    private fun navController(): androidx.navigation.NavController? = TestNav.controller

    private fun hasTestTagStartingWith(prefix: String) = SemanticsMatcher("tag starts with $prefix") {
        it.config.getOrElseNullable(androidx.compose.ui.semantics.SemanticsProperties.TestTag) { null }?.startsWith(prefix) == true
    }
}
