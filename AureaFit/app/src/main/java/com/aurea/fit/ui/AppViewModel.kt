package com.aurea.fit.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.aurea.fit.AureaApp
import com.aurea.fit.data.*
import com.aurea.fit.domain.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel compartilhado. Expõe o estado (fluxos do banco) e as ações das telas.
 * Toda a lógica pesada fica no domínio (domain/) e no repositório (data/).
 */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    val repo: Repository = (app as AureaApp).container.repository

    private fun <T> Flow<T>.state(initial: T) = stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), initial)

    val settings: StateFlow<Settings> = repo.settings.state
    val account = repo.account.state(null)
    val profile = repo.profile.state(null)
    val workoutPlan = repo.workoutPlan.state(null)
    val dietPlan = repo.dietPlan.state(null)
    val planHistory = repo.planHistory.state(emptyList())
    val sessions = repo.sessions.state(emptyList())
    val setLogs = repo.setLogs.state(emptyList())
    val measurements = repo.measurements.state(emptyList())
    val photos = repo.photos.state(emptyList())
    val schedule = repo.schedule.state(emptyList())
    val notifications = repo.notifications.state(emptyList())
    val unread = repo.unreadNotifications.state(0)
    val checkIns = repo.checkIns.state(emptyList())

    private val day = MutableStateFlow(today())
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val waterToday = day.flatMapLatest { repo.waterToday(it) }.state(emptyList())
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val waterWeek = day.flatMapLatest { repo.waterSince(it - 6) }.state(emptyList())
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val mealChecks = day.flatMapLatest { repo.mealChecks(it) }.state(emptyList())

    /** Chamado ao voltar ao app (o dia pode ter mudado). */
    fun refreshDay() { day.value = today() }

    val waterGoal: StateFlow<Int> = combine(settings, dietPlan) { s, d ->
        if (s.waterGoalOverride > 0) s.waterGoalOverride else d?.targets?.waterMl ?: 2000
    }.state(2000)

    // ----------------------------------------------------------- conta
    suspend fun hasAccount() = repo.hasAccount()
    suspend fun register(name: String, email: String, pw: String) = repo.register(name, email, pw)
    suspend fun login(email: String, pw: String) = repo.login(email, pw)
    suspend fun changePassword(old: String, new: String) = repo.changePassword(old, new)
    fun logout() = repo.logout()
    fun deleteEverything(done: () -> Unit) = viewModelScope.launch { repo.deleteEverything(); done() }

    // ----------------------------------------------------------- perfil e planos
    fun saveProfile(p: UserProfile, reason: String, regenerate: Boolean = true, done: () -> Unit = {}) =
        viewModelScope.launch { repo.saveProfile(p, reason, regenerate); done() }

    fun restorePlan(e: PlanEntity) = viewModelScope.launch { repo.restorePlan(e) }
    fun swapExercise(day: Int, old: String, new: String) = viewModelScope.launch { repo.swapExercise(day, old, new) }
    fun swapFood(day: Int, meal: Int, item: Int, newItem: MealItem, allDays: Boolean) =
        viewModelScope.launch { repo.swapFood(day, meal, item, newItem, allDays) }

    // ----------------------------------------------------------- treinos
    suspend fun lastSets(id: String) = repo.lastSets(id)
    suspend fun lastFeedback(id: String) = repo.lastFeedback(id)
    suspend fun lastRecovery(): Boolean {
        val last = repo.db.checkins().last() ?: return true
        val a = runCatching { AppJson.decodeFromString<CheckInAnswers>(last.answersJson) }.getOrNull() ?: return true
        return a.recovery >= 3 && a.sleep >= 3
    }
    fun saveSession(dayIndex: Int, title: String, logged: List<Repository.LoggedExercise>, minutes: Int, done: () -> Unit) =
        viewModelScope.launch { repo.saveSession(dayIndex, title, logged, minutes); done() }
    fun deleteSession(id: Long) = viewModelScope.launch { repo.deleteSession(id) }

    // ----------------------------------------------------------- evolução
    fun addMeasurement(m: MeasurementEntity) = viewModelScope.launch { repo.addMeasurement(m) }
    fun deleteMeasurement(id: Long) = viewModelScope.launch { repo.deleteMeasurement(id) }
    fun addPhoto(uri: Uri, note: String, done: (Boolean) -> Unit) = viewModelScope.launch { done(repo.addPhoto(uri, note)) }
    fun deletePhoto(p: PhotoEntity) = viewModelScope.launch { repo.deletePhoto(p) }

    // ----------------------------------------------------------- água / refeições
    fun addWater(ml: Int) = viewModelScope.launch { repo.addWater(ml) }
    fun deleteWater(id: Long) = viewModelScope.launch { repo.deleteWater(id) }
    fun toggleMeal(i: Int, done: Boolean) = viewModelScope.launch { repo.toggleMeal(i, done) }

    // ----------------------------------------------------------- agenda / notificações
    fun updateSchedule(item: ScheduleEntity) = viewModelScope.launch { repo.updateScheduleItem(item) }
    fun addSchedule(item: ScheduleEntity) = viewModelScope.launch { repo.addScheduleItem(item) }
    fun deleteSchedule(item: ScheduleEntity) = viewModelScope.launch { repo.deleteScheduleItem(item) }
    fun resetSchedule() = viewModelScope.launch { repo.currentProfile()?.let { repo.regenerateSchedule(it) } }
    fun markNotificationsRead() = viewModelScope.launch { repo.markNotificationsRead() }
    fun clearNotifications() = viewModelScope.launch { repo.clearNotifications() }
    fun testNotification() = viewModelScope.launch {
        val t = "Lembretes ativados ✨"; val b = "É assim que o Áurea vai lembrar você das refeições, treinos e hidratação."
        (getApplication<AureaApp>()).container.scheduler.show(999_999, t, b)
        repo.logNotification(t, b)
    }

    // ----------------------------------------------------------- check-in
    suspend fun submitCheckIn(a: CheckInAnswers) = repo.submitCheckIn(a)
    suspend fun applyRecommendations(id: Long, recs: List<Recommendation>) = repo.applyRecommendations(id, recs)
    suspend fun lastCheckInDay() = repo.lastCheckInDay()

    // ----------------------------------------------------------- configurações / backup
    fun updateSettings(block: (Settings) -> Settings) {
        val before = settings.value.notificationsEnabled
        repo.settings.update(block)
        if (before != settings.value.notificationsEnabled) viewModelScope.launch { repo.rescheduleAll() }
    }
    suspend fun exportTo(uri: Uri, photos: Boolean) = repo.backup.exportTo(uri, photos)
    suspend fun importFrom(uri: Uri) = repo.backup.importFrom(uri)
}
