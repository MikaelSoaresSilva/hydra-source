package com.aurea.fit.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.screens.*
import kotlinx.coroutines.flow.first

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab("home", "Início", Icons.Default.Home),
    Tab("workout", "Treino", Icons.Default.FitnessCenter),
    Tab("diet", "Dieta", Icons.Default.Restaurant),
    Tab("evolution", "Evolução", Icons.Default.TrendingUp),
    Tab("more", "Mais", Icons.Default.Menu)
)

/** Referência usada apenas pelos testes automatizados para navegar diretamente. */
object TestNav { var controller: NavHostController? = null }

@Composable
fun AppNav(vm: AppViewModel, startRoute: String? = null, navController: NavHostController = rememberNavController()) {
    TestNav.controller = navController
    val entry by navController.currentBackStackEntryAsState()
    val current = entry?.destination?.route
    val showBar = TABS.any { it.route == current }

    fun go(route: String) = navController.navigate(route) { launchSingleTop = true }
    fun goRoot(route: String) = navController.navigate(route) { popUpTo(0) { inclusive = true }; launchSingleTop = true }
    val back: () -> Unit = { if (!navController.popBackStack()) goRoot("home") }

    Scaffold(bottomBar = {
        if (showBar) NavigationBar {
            TABS.forEach { t ->
                NavigationBarItem(
                    selected = current == t.route,
                    onClick = { navController.navigate(t.route) { popUpTo("home") { saveState = true }; launchSingleTop = true; restoreState = true } },
                    icon = { Icon(t.icon, null) }, label = { Text(t.label) },
                    modifier = Modifier.testTag("tab_${t.route}")
                )
            }
        }
    }) { pad ->
        NavHost(navController, startDestination = "splash", modifier = Modifier.padding(bottom = if (showBar) pad.calculateBottomPadding() else androidx.compose.ui.unit.Dp(0f))) {
            composable("splash") {
                var target by remember { mutableStateOf<String?>(null) }
                LaunchedEffect(Unit) {
                    val has = vm.hasAccount()
                    target = when {
                        !has -> "auth/register"
                        !vm.settings.value.loggedIn -> "auth/login"
                        vm.repo.currentProfile() == null -> "onboarding"
                        else -> startRoute ?: "home"
                    }
                }
                SplashScreen { target?.let { t -> if (t == "home" || t.startsWith("auth") || t == "onboarding") goRoot(t) else { goRoot("home"); go(t) } } }
            }
            composable("auth/{mode}") { e ->
                AuthScreen(vm, e.arguments?.getString("mode") == "register") {
                    navController.navigate("postAuth") { popUpTo(0) { inclusive = true } }
                }
            }
            composable("postAuth") {
                LaunchedEffect(Unit) {
                    val hasProfile = vm.repo.currentProfile() != null
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) { goRoot(if (hasProfile) "home" else "onboarding") }
                }
            }
            composable("onboarding") { OnboardingScreen(vm, null, editing = false, onFinished = { goRoot("home") }) }
            composable("editProfile") {
                val p by vm.profile.collectAsState()
                p?.let { OnboardingScreen(vm, it, editing = true, onFinished = back, onBack = back) }
            }
            composable("home") { HomeScreen(vm, ::go) }
            composable("workout") { WorkoutPlanScreen(vm, ::go) }
            composable("session/{day}") { e -> WorkoutSessionScreen(vm, e.arguments?.getString("day")?.toIntOrNull() ?: 0, back) }
            composable("library") { LibraryScreen(vm, ::go, back) }
            composable("exercise/{id}") { e -> ExerciseDetailScreen(vm, e.arguments?.getString("id") ?: "", ::go, back) }
            composable("diet") { DietScreen(vm, ::go) }
            composable("recipes") { RecipesScreen(vm, back) }
            composable("shopping") { ShoppingScreen(vm, back) }
            composable("water") { WaterScreen(vm, back) }
            composable("calendar") { CalendarScreen(vm, back) }
            composable("evolution") { EvolutionScreen(vm, ::go) }
            composable("charts") { ChartsScreen(vm, back) }
            composable("more") { MoreScreen(vm, ::go) }
            composable("profile") { ProfileScreen(vm, ::go, back) }
            composable("settings") { SettingsScreen(vm, onLoggedOut = { goRoot("auth/login") }, onDeleted = { goRoot("auth/register") }, onBack = back) }
            composable("notifications") { NotificationsScreen(vm, ::go, back) }
            composable("checkin") { CheckInScreen(vm, back) }
            composable("history") { PlanHistoryScreen(vm, back) }
            composable("goal") { GoalScreen(vm, back) }
            composable("assessment") { AssessmentScreen(vm, back) }
        }
    }
}
