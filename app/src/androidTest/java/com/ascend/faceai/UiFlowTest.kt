package com.ascend.faceai

import android.Manifest
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.data.PreparedPhoto
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Percorre o app inteiro como um usuário: onboarding, consentimento, todas as abas e telas, câmera, exclusão. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class UiFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    @get:Rule val camera: GrantPermissionRule = GrantPermissionRule.grant(Manifest.permission.CAMERA)

    private val inst = InstrumentationRegistry.getInstrumentation()
    private val app get() = inst.targetContext.applicationContext as AscendApp

    private fun shot(name: String) {
        compose.waitForIdle()
        Thread.sleep(700)
        runCatching {
            val b: Bitmap = inst.uiAutomation.takeScreenshot()
            val dir = inst.targetContext.getExternalFilesDir("shots")!!
            File(dir, "$name.png").outputStream().use { b.compress(Bitmap.CompressFormat.PNG, 90, it) }
        }.onFailure { Log.e("AscendTest", "screenshot", it) }
    }

    private fun waitText(t: String, ms: Long = 15_000) = compose.waitUntil(ms) { compose.onAllNodesWithText(t, substring = true).fetchSemanticsNodes().isNotEmpty() }
    private fun waitTag(t: String, ms: Long = 15_000) = compose.waitUntil(ms) { compose.onAllNodes(hasTestTag(t)).fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun fullUserJourney() {
        runBlocking { app.container.repo.deleteAllLocal(); app.container.settings.clearAll() }
        val scenario = ActivityScenario.launch(MainActivity::class.java)

        // Onboarding
        waitTag("onboarding_next"); shot("01_onboarding")
        compose.onNodeWithTag("onboarding_next").performClick()
        compose.onNodeWithTag("onboarding_next").performClick()
        compose.onNodeWithTag("onboarding_next").performClick()

        // Consentimento
        waitTag("consent_accept"); shot("02_consent")
        compose.onNodeWithTag("c_process").performScrollTo().performClick()
        compose.onNodeWithTag("c_adult").performScrollTo().performClick()
        compose.onNodeWithTag("consent_accept").performScrollTo().performClick()

        // Login opcional
        waitTag("login_skip"); shot("03_login")
        compose.onNodeWithTag("login_skip").performScrollTo().performClick()

        // Dashboard vazio
        waitText("Faça sua primeira análise"); shot("04_home_empty")

        // Scanner + câmera real do emulador (cena sem rosto -> deve pedir para repetir)
        compose.onNodeWithText("Iniciar análise facial").performScrollTo().performClick()
        waitTag("slot_FRONTAL"); shot("05_scanner")
        compose.onNodeWithTag("cam_FRONTAL").performScrollTo().performClick()
        waitTag("shutter"); Thread.sleep(3500); shot("06_camera")
        compose.onNodeWithTag("shutter").performClick()
        compose.waitUntil(30_000) { compose.onAllNodes(hasText("Repita a foto") or hasText("Foto aprovada", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        shot("07_after_capture")
        Log.i("AscendTest", "camera capture produced a quality result")

        // Injeta a foto de teste como se viesse da galeria e analisa
        val bmp = inst.context.assets.open("portrait.jpg").use { BitmapFactory.decodeStream(it) }
        val p = app.container.engine.prepare(bmp, CaptureType.FRONTAL)
        inst.runOnMainSync { app.scan.photos[CaptureType.FRONTAL] = PreparedPhoto(p.type, p.frame, p.crop, p.quality.copy(ok = true, issues = emptyList())) }
        compose.waitForIdle(); shot("08_scanner_ready")
        compose.onNodeWithTag("analyze").performClick()
        waitTag("report", 60_000); shot("09_report")
        compose.onNodeWithTag("cat_pele").performScrollTo(); shot("10_report_ranking")
        compose.onNodeWithTag("cat_pele").performClick()
        waitText("Medido:"); shot("11_category_skin")
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        waitTag("report")
        compose.onNodeWithTag("export_pdf").performScrollTo()
        shot("12_report_bottom")
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }

        // Abas
        waitTag("tab_home"); compose.onNodeWithTag("tab_home").performClick(); waitText("Seu painel"); shot("13_home")
        compose.onNodeWithTag("tab_history").performClick(); waitText("Sua evolução"); shot("14_history")
        compose.onNodeWithTag("tab_plan").performClick(); waitText("Glow up"); shot("15_plan")
        compose.onNodeWithTag("phase_30").performClick(); shot("16_plan_30")
        compose.onNodeWithTag("tab_assistant").performClick(); waitText("ASCEND AI")
        compose.onNodeWithTag("chat_input").performTextInput("Quais são meus maiores pontos fortes?")
        compose.onNodeWithContentDescription("Enviar").performClick()
        waitText("MOTOR LOCAL"); shot("17_assistant")
        compose.onNodeWithTag("tab_settings").performClick(); waitText("Inteligência artificial"); shot("18_settings")

        // Simulador (sem backend: deve mostrar indisponível honestamente)
        compose.onNodeWithTag("tab_home").performClick(); waitText("Seu painel")
        compose.onNodeWithText("Simulador").performScrollTo().performClick(); waitText("Indisponível"); shot("19_simulator")
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }

        // Exclusão de tudo
        compose.onNodeWithTag("tab_settings").performClick(); waitText("Seus dados")
        compose.onNodeWithTag("del_all").performScrollTo().performClick()
        waitTag("confirm_danger"); shot("20_delete_dialog")
        compose.onNodeWithTag("confirm_danger").performClick()
        waitText("Todos os dados locais foram excluídos")
        runBlocking { check(app.container.repo.all().isEmpty()) { "dados não foram excluídos" } }
        shot("21_deleted")
        scenario.close()
    }
}
