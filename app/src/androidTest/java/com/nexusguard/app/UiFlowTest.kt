package com.nexusguard.app

import android.Manifest
import android.content.Intent
import android.graphics.Bitmap
import android.util.Log
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import org.junit.FixMethodOrder
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File

/** Percorre as telas reais, executa as funções principais pela interface e salva capturas de tela. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class UiFlowTest {
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: RuleChain = RuleChain.outerRule(GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS)).around(compose)

    private val inst get() = InstrumentationRegistry.getInstrumentation()

    private fun shot(name: String) {
        compose.waitForIdle()
        Thread.sleep(700)
        runCatching {
            val bmp: Bitmap = inst.uiAutomation.takeScreenshot() ?: return
            val dir = File(inst.targetContext.getExternalFilesDir(null), "shots").apply { mkdirs() }
            File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 90, it) }
            Log.i("NexusTest", "screenshot $name")
        }
    }

    private fun has(tag: String) = compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
    private fun hasTxt(t: String) = compose.onAllNodesWithText(t, substring = true, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
    private fun waitTag(tag: String, ms: Long = 15_000) = compose.waitUntil(ms) { has(tag) }
    private fun waitText(t: String, ms: Long = 15_000) = compose.waitUntil(ms) { hasTxt(t) }
    private fun tag(t: String): SemanticsNodeInteraction = compose.onNodeWithTag(t, useUnmergedTree = true)

    /** Rola até o elemento (se estiver fora da tela) e toca nele. */
    private fun click(t: String) {
        val n = tag(t)
        runCatching { n.performScrollTo() }
        compose.waitForIdle()
        n.performClick()
        compose.waitForIdle()
    }

    private fun clickIn(list: String, target: String) {
        waitTag(list)
        tag(list).performScrollToNode(hasTestTag(target))
        compose.waitForIdle()
        click(target)
    }

    private fun back() { if (has("back")) click("back") else inst.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK); compose.waitForIdle() }

    private fun passOnboarding() {
        compose.waitUntil(10_000) { has("btn_start") || has("btn_scan") }
        if (has("btn_start")) {
            shot("01_onboarding")
            click("sw_accept")
            click("btn_start")
        }
        waitTag("btn_scan", 15_000)
    }

    @Test fun a_home_and_scan() {
        passOnboarding()
        shot("02_home")
        click("btn_scan")
        waitText("Ver detalhes da verificação", 40_000)
        shot("03_home_after_scan")
        tag("home_list").performScrollToNode(hasText("Alertas recentes", substring = true))
        shot("04_home_alerts")
    }

    @Test fun b_security_tools() {
        passOnboarding()
        click("tab_security")
        waitTag("security_list")
        shot("05_security")
        clickIn("security_list", "nav_scan")
        waitTag("scan_list"); shot("06_scan_details"); back()

        clickIn("security_list", "nav_apps")
        compose.waitUntil(60_000) { hasTxt("apps •") && !hasTxt("Analisando…") }
        shot("07_apps"); back()

        clickIn("security_list", "nav_phishing")
        waitTag("url_input")
        tag("url_input").performTextInput("Seu Nubank foi bloqueado. Regularize em http://nubank-seguranca-conta.xyz/login?cpf=1")
        click("btn_analyze_url")
        waitTag("phish_level")
        shot("08_phishing_result"); back()

        clickIn("security_list", "nav_wifi_sec")
        waitText("O que encontramos"); shot("09_wifi_security"); back()

        clickIn("security_list", "nav_files")
        waitTag("btn_pick_file"); shot("10_files"); back()

        clickIn("security_list", "nav_sec_history")
        waitText("Histórico de ameaças"); shot("11_security_history"); back()
    }

    @Test fun c_internet_tools() {
        passOnboarding()
        click("tab_internet")
        waitTag("internet_list")
        shot("12_internet")
        click("btn_quick_ping")
        compose.waitUntil(40_000) { hasTxt("medir ping") }
        shot("13_internet_ping")

        clickIn("internet_list", "nav_dns")
        click("btn_dns")
        waitTag("dns_best", 40_000)
        shot("14_dns"); back()

        clickIn("internet_list", "btn_optimize")
        click("btn_run_optimize")
        waitTag("opt_step", 5_000); shot("15_optimize_running")
        waitTag("btn_measure_after", 90_000)
        shot("16_optimize_result")
        tag("optimize_list").performScrollToNode(hasTestTag("btn_measure_after"))
        click("btn_measure_after")
        waitText("Antes × depois", 90_000)
        tag("optimize_list").performScrollToNode(hasText("Antes × depois", substring = true))
        shot("17_optimize_before_after"); back()

        clickIn("internet_list", "nav_speed")
        click("btn_start_speed")
        compose.waitForIdle()
        if (has("confirm_speed")) click("confirm_speed")
        Thread.sleep(5_000); shot("18_speed_running")
        waitTag("res_down", 120_000)
        shot("19_speed_result"); back()

        clickIn("internet_list", "nav_stability")
        click("btn_stab_start")
        Thread.sleep(12_000)
        shot("20_stability_running")
        click("btn_stab_stop")
        compose.waitForIdle(); back()

        clickIn("internet_list", "nav_mobile"); waitText("Como interpretar o sinal"); shot("21_mobile"); back()
        clickIn("internet_list", "nav_wifi_net"); waitText("Recomendação para a conexão atual"); shot("22_wifi_smart"); back()
        clickIn("internet_list", "nav_net_history"); waitText("Registros"); shot("23_net_history"); back()
    }

    @Test fun d_ai_and_settings() {
        passOnboarding()
        click("tab_ai")
        waitTag("ai_input")
        tag("ai_input").performTextInput("Por que minha internet está lenta?")
        click("ai_send")
        compose.waitUntil(20_000) { hasTxt("Por que a internet está lenta") }
        shot("24_ai")
        tag("ai_input").performTextInput("O que posso fazer para melhorar meu ping?")
        click("ai_send")
        compose.waitUntil(20_000) { hasTxt("Como melhorar o ping") }
        shot("25_ai_ping")

        click("tab_settings")
        waitTag("settings_list"); shot("26_settings")
        clickIn("settings_list", "nav_permissions"); waitText("Menor privilégio"); shot("27_permissions"); back()
        clickIn("settings_list", "nav_policy"); waitText("POLÍTICA DE PRIVACIDADE"); shot("28_policy"); back()
    }

    @Test fun e_share_link_intent() {
        passOnboarding()
        val i = Intent(inst.targetContext, MainActivity::class.java).setAction(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, "Sua encomenda foi taxada! Pague em https://correios-taxa.top/rastreio")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        inst.targetContext.startActivity(i)
        waitTag("phish_level", 15_000)
        shot("29_shared_link")
    }

    @Test fun f_screen_sizes() {
        passOnboarding()
        val sizes = listOf("720x1280" to 320, "1080x2400" to 420, "1440x3200" to 560)
        try {
            sizes.forEachIndexed { idx, (sz, dpi) ->
                inst.uiAutomation.executeShellCommand("wm size $sz").close()
                inst.uiAutomation.executeShellCommand("wm density $dpi").close()
                Thread.sleep(3_000)
                compose.waitUntil(15_000) { has("btn_scan") || has("tab_home") }
                shot("3${idx}_size_${sz}_${dpi}dpi")
                if (has("tab_internet")) { click("tab_internet"); Thread.sleep(800); shot("3${idx}_size_${sz}_internet"); click("tab_home") }
            }
        } finally {
            inst.uiAutomation.executeShellCommand("wm size reset").close()
            inst.uiAutomation.executeShellCommand("wm density reset").close()
            Thread.sleep(2_000)
        }
    }
}
