package com.ascend.faceai.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.screens.AssistantScreen
import com.ascend.faceai.ui.screens.CategoryScreen
import com.ascend.faceai.ui.screens.CompareScreen
import com.ascend.faceai.ui.screens.ConsentScreen
import com.ascend.faceai.ui.screens.HistoryScreen
import com.ascend.faceai.ui.screens.HomeScreen
import com.ascend.faceai.ui.screens.LoginScreen
import com.ascend.faceai.ui.screens.MethodologyScreen
import com.ascend.faceai.ui.screens.OnboardingScreen
import com.ascend.faceai.ui.screens.PlanScreen
import com.ascend.faceai.ui.screens.PrivacyScreen
import com.ascend.faceai.ui.screens.ProcessingScreen
import com.ascend.faceai.ui.screens.ReportScreen
import com.ascend.faceai.ui.screens.ScanScreen
import com.ascend.faceai.ui.screens.SettingsScreen
import com.ascend.faceai.ui.screens.SimulatorScreen
import com.ascend.faceai.ui.screens.SplashScreen
import com.ascend.faceai.ui.theme.Ac

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val CONSENT = "consent"
    const val LOGIN = "login"
    const val HOME = "home"
    const val HISTORY = "history"
    const val PLAN = "plan"
    const val ASSISTANT = "assistant"
    const val SETTINGS = "settings"
    const val SCAN = "scan"
    const val PROCESSING = "processing"
    const val REPORT = "report/{id}"
    const val CATEGORY = "category/{id}/{cat}"
    const val COMPARE = "compare/{a}/{b}"
    const val SIMULATOR = "simulator"
    const val PRIVACY = "privacy"
    const val METHODOLOGY = "methodology"
    fun report(id: String) = "report/$id"
    fun category(id: String, cat: String) = "category/$id/$cat"
    fun compare(a: String, b: String) = "compare/$a/$b"
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, "Início", Icons.Outlined.Dashboard),
    Tab(Routes.HISTORY, "Evolução", Icons.Outlined.History),
    Tab(Routes.PLAN, "Plano", Icons.Outlined.Checklist),
    Tab(Routes.ASSISTANT, "Ascend AI", Icons.Outlined.AutoAwesome),
    Tab(Routes.SETTINGS, "Ajustes", Icons.Outlined.Tune)
)

/** Garante que navegação/efeitos de UI após uma suspensão rodem na thread principal. */
suspend fun onMain(block: () -> Unit) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main.immediate) { block() }

fun NavHostController.goTab(route: String) = navigate(route) {
    popUpTo(Routes.HOME) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

fun startRoute(s: AppSettings) = when {
    !s.onboardingDone -> Routes.ONBOARDING
    !s.consentGiven -> Routes.CONSENT
    else -> Routes.HOME
}

@Composable
fun AppRoot() {
    val nav = rememberNavController()
    val container = LocalContainer.current
    val entry by nav.currentBackStackEntryAsState()
    val current = entry?.destination?.route
    val showBar = tabs.any { it.route == current }
    val settings by container.settings.flow.collectAsState(initial = null)

    Scaffold(
        containerColor = Ac.Bg,
        bottomBar = {
            if (showBar) NavigationBar(containerColor = Ac.Graphite, tonalElevation = androidx.compose.ui.unit.Dp(0f)) {
                tabs.forEach { t ->
                    NavigationBarItem(
                        selected = current == t.route,
                        onClick = { nav.goTab(t.route) },
                        icon = { Icon(t.icon, t.label) },
                        label = { Text(t.label) },
                        modifier = Modifier.testTag("tab_${t.route}"),
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Ac.TextHi, selectedTextColor = Ac.TextHi, indicatorColor = Ac.Blue.copy(alpha = 0.25f),
                            unselectedIconColor = Ac.TextLow, unselectedTextColor = Ac.TextLow
                        )
                    )
                }
            }
        }
    ) { pad ->
        Box(Modifier.fillMaxSize().background(Ac.Bg).padding(bottom = pad.calculateBottomPadding())) {
            NavHost(nav, startDestination = Routes.SPLASH) {
                composable(Routes.SPLASH) {
                    SplashScreen(settings) { s -> nav.navigate(startRoute(s)) { popUpTo(Routes.SPLASH) { inclusive = true } } }
                }
                composable(Routes.ONBOARDING) { OnboardingScreen { nav.navigate(Routes.CONSENT) { popUpTo(Routes.ONBOARDING) { inclusive = true } } } }
                composable(Routes.CONSENT) {
                    ConsentScreen(onPrivacy = { nav.navigate(Routes.PRIVACY) }) { nav.navigate(Routes.LOGIN) { popUpTo(Routes.CONSENT) { inclusive = true } } }
                }
                composable(Routes.LOGIN) { LoginScreen(onDone = { nav.navigate(Routes.HOME) { popUpTo(0) { inclusive = true } } }, onBack = null) }
                composable(Routes.HOME) { HomeScreen(nav) }
                composable(Routes.HISTORY) { HistoryScreen(nav) }
                composable(Routes.PLAN) { PlanScreen(nav) }
                composable(Routes.ASSISTANT) { AssistantScreen(nav) }
                composable(Routes.SETTINGS) { SettingsScreen(nav) }
                composable(Routes.SCAN) { ScanScreen(nav) }
                composable(Routes.PROCESSING) { ProcessingScreen(nav) }
                composable(Routes.REPORT, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                    ReportScreen(nav, it.arguments?.getString("id").orEmpty())
                }
                composable(Routes.CATEGORY, arguments = listOf(navArgument("id") { type = NavType.StringType }, navArgument("cat") { type = NavType.StringType })) {
                    CategoryScreen(nav, it.arguments?.getString("id").orEmpty(), it.arguments?.getString("cat").orEmpty())
                }
                composable(Routes.COMPARE, arguments = listOf(navArgument("a") { type = NavType.StringType }, navArgument("b") { type = NavType.StringType })) {
                    CompareScreen(nav, it.arguments?.getString("a").orEmpty(), it.arguments?.getString("b").orEmpty())
                }
                composable(Routes.SIMULATOR) { SimulatorScreen(nav) }
                composable(Routes.PRIVACY) { PrivacyScreen { nav.popBackStack() } }
                composable(Routes.METHODOLOGY) { MethodologyScreen { nav.popBackStack() } }
                composable("cloud") { LoginScreen(onDone = { nav.popBackStack() }, onBack = { nav.popBackStack() }) }
            }
        }
    }
}
