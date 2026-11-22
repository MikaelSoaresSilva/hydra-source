package com.aurea.fit.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.aurea.fit.AureaApp
import com.aurea.fit.MainActivity
import com.aurea.fit.domain.*
import com.aurea.fit.ui.nav.TestNav
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Abre o app já configurado e captura telas em diferentes tamanhos e no modo escuro. */
abstract class VariantBase(private val prefix: String) {
    val rule = createAndroidComposeRule<MainActivity>()

    /** Garante isolamento: apaga qualquer dado de testes anteriores antes de abrir o app. */
    @get:Rule val chain: org.junit.rules.RuleChain = org.junit.rules.RuleChain
        .outerRule(object : org.junit.rules.ExternalResource() {
            override fun before() {
                runBlocking { androidx.test.core.app.ApplicationProvider.getApplicationContext<com.aurea.fit.AureaApp>().container.repository.deleteEverything() }
            }
        }).around(rule)

    @Test fun screens() {
        val repo = ApplicationProvider.getApplicationContext<AureaApp>().container.repository
        runBlocking {
            repo.register("Júlia Fernanda", "j@x.com", "123456")
            repo.saveProfile(UserProfile(name = "Júlia Fernanda", goal = Goal.LOSE_FAT, location = Location.HOME,
                homeEquipment = setOf(Equipment.BODYWEIGHT, Equipment.BANDS, Equipment.DUMBBELLS), daysPerWeek = 4,
                restriction = DietRestriction.VEGETARIAN, allergies = setOf(Allergy.LACTOSE)), "teste")
        }
        // recria a navegação após o cadastro
        rule.runOnUiThread { TestNav.controller?.navigate("splash") { popUpTo(0) { inclusive = true } } }
        rule.mainClock.advanceTimeBy(4000); rule.waitForIdle()
        rule.onNodeWithTag("todayCard").assertExists()
        fun shot(n: String) { rule.waitForIdle(); rule.mainClock.advanceTimeBy(1500); rule.waitForIdle(); snap(rule.activity.window.decorView, "${prefix}_$n") }
        shot("painel")
        listOf("workout", "diet", "evolution", "calendar", "library", "exercise/agachamento_goblet").forEach { r ->
            rule.runOnUiThread { TestNav.controller?.navigate(r) }
            shot(r.replace("/", "_"))
        }
    }
}

@RunWith(AndroidJUnit4::class) @GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w320dp-h568dp-mdpi")
class SmallScreenTest : VariantBase("pequena")

@RunWith(AndroidJUnit4::class) @GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h891dp-night-xhdpi")
class DarkModeTest : VariantBase("escuro")

@RunWith(AndroidJUnit4::class) @GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w800dp-h1280dp-mdpi")
class TabletTest : VariantBase("tablet")
