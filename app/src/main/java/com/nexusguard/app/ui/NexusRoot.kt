package com.nexusguard.app.ui

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nexusguard.app.ui.screens.AiScreen
import com.nexusguard.app.ui.screens.AppDetailScreen
import com.nexusguard.app.ui.screens.AppsScreen
import com.nexusguard.app.ui.screens.DeviceScanScreen
import com.nexusguard.app.ui.screens.DnsScreen
import com.nexusguard.app.ui.screens.FilesScreen
import com.nexusguard.app.ui.screens.HomeScreen
import com.nexusguard.app.ui.screens.InternetHistoryScreen
import com.nexusguard.app.ui.screens.InternetScreen
import com.nexusguard.app.ui.screens.KeysScreen
import com.nexusguard.app.ui.screens.MobileScreen
import com.nexusguard.app.ui.screens.OnboardingScreen
import com.nexusguard.app.ui.screens.OptimizeScreen
import com.nexusguard.app.ui.screens.PermissionsScreen
import com.nexusguard.app.ui.screens.PhishingScreen
import com.nexusguard.app.ui.screens.PrivacyPolicyScreen
import com.nexusguard.app.ui.screens.SecurityHistoryScreen
import com.nexusguard.app.ui.screens.SecurityScreen
import com.nexusguard.app.ui.screens.SettingsScreen
import com.nexusguard.app.ui.screens.SpeedScreen
import com.nexusguard.app.ui.screens.StabilityScreen
import com.nexusguard.app.ui.screens.WifiInternetScreen
import com.nexusguard.app.ui.screens.WifiSecurityScreen
import com.nexusguard.app.ui.theme.NX

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("home", "Início", Icons.Filled.Home),
    Tab("security", "Segurança", Icons.Filled.Shield),
    Tab("internet", "Internet", Icons.Filled.Wifi),
    Tab("ai", "NEXUS AI", Icons.Filled.AutoAwesome),
    Tab("settings", "Ajustes", Icons.Filled.Settings)
)

@Composable
fun NexusRoot(sharedText: String?, startRoute: String?, onSharedConsumed: () -> Unit) {
    val main: MainViewModel = viewModel()
    val settings by main.settings.collectAsState()
    val s = settings ?: return Box(Modifier.fillMaxSize().background(NX.c.bg))

    if (!s.onboardingDone) {
        OnboardingScreen(onFinish = { periodic -> main.finishOnboarding(periodic) })
        return
    }

    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val showBar = tabs.any { it.route == route }

    LaunchedEffect(sharedText) {
        if (sharedText != null) {
            nav.navigate("security/phishing?text=${android.net.Uri.encode(sharedText)}")
            onSharedConsumed()
        }
    }
    LaunchedEffect(startRoute) {
        if (startRoute != null && startRoute != "home") runCatching { nav.navigate(startRoute) }
    }

    Scaffold(
        containerColor = NX.c.bg,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = { if (showBar) BottomBar(nav, route) }
    ) { pad ->
        NavHost(
            nav, startDestination = "home",
            modifier = Modifier.padding(pad).statusBarsPadding(),
            enterTransition = { fadeIn() }, exitTransition = { fadeOut() }
        ) {
            composable("home") { HomeScreen(nav, main) }
            composable("security") { SecurityScreen(nav, main) }
            composable("internet") { InternetScreen(nav) }
            composable("ai") { AiScreen() }
            composable("settings") { SettingsScreen(nav) }

            composable("security/scan") { DeviceScanScreen(nav, main) }
            composable("security/apps") { AppsScreen(nav) }
            composable("security/app/{pkg}", arguments = listOf(navArgument("pkg") { type = NavType.StringType })) { e ->
                AppDetailScreen(nav, e.arguments?.getString("pkg").orEmpty())
            }
            composable("security/files") { FilesScreen(nav) }
            composable("security/phishing?text={text}", arguments = listOf(navArgument("text") { type = NavType.StringType; nullable = true; defaultValue = null })) { e ->
                PhishingScreen(nav, e.arguments?.getString("text"))
            }
            composable("security/wifi") { WifiSecurityScreen(nav) }
            composable("security/history") { SecurityHistoryScreen(nav) }

            composable("internet/speed") { SpeedScreen(nav) }
            composable("internet/dns") { DnsScreen(nav) }
            composable("internet/optimize") { OptimizeScreen(nav) }
            composable("internet/stability") { StabilityScreen(nav) }
            composable("internet/mobile") { MobileScreen(nav) }
            composable("internet/wifi") { WifiInternetScreen(nav) }
            composable("internet/history") { InternetHistoryScreen(nav) }

            composable("settings/policy") { PrivacyPolicyScreen(nav) }
            composable("settings/permissions") { PermissionsScreen(nav) }
            composable("settings/keys") { KeysScreen(nav) }
        }
    }
}

@Composable
private fun BottomBar(nav: NavHostController, route: String?) {
    val c = NX.c
    Box(Modifier.fillMaxWidth().background(c.bg).navigationBarsPadding().padding(horizontal = 10.dp, vertical = 6.dp)) {
        NavigationBar(
            modifier = Modifier.border(1.dp, c.stroke, RoundedCornerShape(22.dp)).background(c.surface, RoundedCornerShape(22.dp)),
            containerColor = Color.Transparent, tonalElevation = 0.dp,
            windowInsets = WindowInsets(0, 0, 0, 0)
        ) {
            tabs.forEach { t ->
                NavigationBarItem(
                    selected = route == t.route,
                    onClick = {
                        nav.navigate(t.route) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true; restoreState = true
                        }
                    },
                    icon = { Icon(t.icon, t.label) },
                    label = { Text(t.label, maxLines = 1) },
                    modifier = Modifier.testTag("tab_${t.route}"),
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White, selectedTextColor = c.text, indicatorColor = c.blue.copy(alpha = .35f),
                        unselectedIconColor = c.muted, unselectedTextColor = c.muted
                    )
                )
            }
        }
    }
}
