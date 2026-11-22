package com.aurea.fit.data

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.aurea.fit.domain.*
import com.aurea.fit.notifications.ReminderScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.SecureRandom
import java.time.LocalDate
import java.util.UUID
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

val AppJson = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = false }

fun today(): Long = LocalDate.now().toEpochDay()

data class Settings(
    val loggedIn: Boolean = false,
    val themeMode: Int = 0, // 0 = sistema, 1 = claro, 2 = escuro
    val hideCalories: Boolean = false,
    val secureScreen: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val waterGoalOverride: Int = 0,
    val glassMl: Int = 250
)

class SettingsStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("aurea_settings", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(read())
    val state: StateFlow<Settings> = _state

    private fun read() = Settings(
        loggedIn = prefs.getBoolean("loggedIn", false),
        themeMode = prefs.getInt("themeMode", 0),
        hideCalories = prefs.getBoolean("hideCalories", false),
        secureScreen = prefs.getBoolean("secureScreen", false),
        notificationsEnabled = prefs.getBoolean("notificationsEnabled", true),
        waterGoalOverride = prefs.getInt("waterGoalOverride", 0),
        glassMl = prefs.getInt("glassMl", 250)
    )

    fun update(block: (Settings) -> Settings) {
        val s = block(_state.value)
        prefs.edit()
            .putBoolean("loggedIn", s.loggedIn)
            .putInt("themeMode", s.themeMode)
            .putBoolean("hideCalories", s.hideCalories)
            .putBoolean("secureScreen", s.secureScreen)
            .putBoolean("notificationsEnabled", s.notificationsEnabled)
            .putInt("waterGoalOverride", s.waterGoalOverride)
            .putInt("glassMl", s.glassMl)
            .apply()
        _state.value = s
    }

    fun clear() { prefs.edit().clear().apply(); _state.value = Settings() }
}

object PasswordHasher {
    private const val ITER = 12000
    fun newSalt(): String = ByteArray(16).also { SecureRandom().nextBytes(it) }.toHex()
    fun hash(password: String, salt: String): String {
        val spec = PBEKeySpec(password.toCharArray(), salt.hexToBytes(), ITER, 256)
        val f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1")
        return f.generateSecret(spec).encoded.toHex()
    }
    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
    private fun String.hexToBytes() = chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}

sealed class AuthResult {
    data object Ok : AuthResult()
    data class Error(val message: String) : AuthResult()
}

class Repository(
    private val context: Context,
    val db: AureaDatabase,
    val settings: SettingsStore,
    private val scheduler: ReminderScheduler
) {
    val photoDir: File get() = File(context.filesDir, "photos").apply { mkdirs() }

    /* ------------------------------ Conta ------------------------------ */

    val account: Flow<AccountEntity?> = db.account().observe()

    suspend fun hasAccount(): Boolean = db.account().get() != null

    suspend fun register(name: String, email: String, password: String): AuthResult {
        val e = email.trim().lowercase()
        if (name.isBlank()) return AuthResult.Error("Informe seu nome.")
        if (!Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(e)) return AuthResult.Error("E-mail inválido.")
        if (password.length < 6) return AuthResult.Error("A senha precisa ter pelo menos 6 caracteres.")
        if (db.account().get() != null) return AuthResult.Error("Já existe uma conta neste aparelho. Faça login.")
        val salt = PasswordHasher.newSalt()
        withContext(Dispatchers.Default) {
            val hash = PasswordHasher.hash(password, salt)
            db.account().upsert(AccountEntity(1, name.trim(), e, hash, salt, System.currentTimeMillis()))
        }
        settings.update { it.copy(loggedIn = true) }
        return AuthResult.Ok
    }

    suspend fun login(email: String, password: String): AuthResult {
        val acc = db.account().get() ?: return AuthResult.Error("Nenhuma conta encontrada. Crie sua conta.")
        if (acc.email != email.trim().lowercase()) return AuthResult.Error("E-mail ou senha incorretos.")
        val hash = withContext(Dispatchers.Default) { PasswordHasher.hash(password, acc.salt) }
        if (hash != acc.passwordHash) return AuthResult.Error("E-mail ou senha incorretos.")
        settings.update { it.copy(loggedIn = true) }
        return AuthResult.Ok
    }

    suspend fun changePassword(old: String, new: String): AuthResult {
        val acc = db.account().get() ?: return AuthResult.Error("Conta não encontrada.")
        if (PasswordHasher.hash(old, acc.salt) != acc.passwordHash) return AuthResult.Error("Senha atual incorreta.")
        if (new.length < 6) return AuthResult.Error("A nova senha precisa ter pelo menos 6 caracteres.")
        val salt = PasswordHasher.newSalt()
        db.account().upsert(acc.copy(passwordHash = PasswordHasher.hash(new, salt), salt = salt))
        return AuthResult.Ok
    }

    fun logout() = settings.update { it.copy(loggedIn = false) }

    /** Exclui a conta e TODOS os dados (banco, fotos, preferências, lembretes). */
    suspend fun deleteEverything() = withContext(Dispatchers.IO) {
        scheduler.cancelAll(db.schedule().all())
        db.maintenance().clearAll()
        photoDir.deleteRecursively()
        File(context.cacheDir, "export").deleteRecursively()
        settings.clear()
    }

    /* ------------------------------ Perfil ------------------------------ */

    val profile: Flow<UserProfile?> = db.profile().observe().map { it?.let { e -> decodeProfile(e.json) } }

    suspend fun currentProfile(): UserProfile? = db.profile().get()?.let { decodeProfile(it.json) }

    private fun decodeProfile(json: String): UserProfile? = runCatching { AppJson.decodeFromString<UserProfile>(json) }.getOrNull()

    /**
     * Salva o perfil e gera novos planos. Planos antigos ficam no histórico.
     * @param regenerate quando false, só salva o perfil (ex.: mudança de nome).
     */
    suspend fun saveProfile(p: UserProfile, reason: String, regenerate: Boolean = true) {
        db.profile().upsert(ProfileEntity(1, AppJson.encodeToString(p), System.currentTimeMillis()))
        if (regenerate) {
            val oldWorkout = activeWorkoutPlan()
            val oldDiet = activeDietPlan()
            saveWorkoutPlan(WorkoutGenerator.generate(p, oldWorkout?.setsDelta ?: 0), reason)
            saveDietPlan(DietGenerator.generate(p, oldDiet?.calorieOffset ?: 0), reason)
            regenerateSchedule(p)
        }
    }

    /* ------------------------------ Planos ------------------------------ */

    val workoutPlanEntity: Flow<PlanEntity?> = db.plans().observeActive("WORKOUT")
    val dietPlanEntity: Flow<PlanEntity?> = db.plans().observeActive("DIET")
    val workoutPlan: Flow<WorkoutPlan?> = workoutPlanEntity.map { it?.let { e -> runCatching { AppJson.decodeFromString<WorkoutPlan>(e.json) }.getOrNull() } }
    val dietPlan: Flow<DietPlan?> = dietPlanEntity.map { it?.let { e -> runCatching { AppJson.decodeFromString<DietPlan>(e.json) }.getOrNull() } }
    val planHistory: Flow<List<PlanEntity>> = db.plans().observeAll()

    suspend fun activeWorkoutPlan(): WorkoutPlan? = db.plans().active("WORKOUT")?.let { runCatching { AppJson.decodeFromString<WorkoutPlan>(it.json) }.getOrNull() }
    suspend fun activeDietPlan(): DietPlan? = db.plans().active("DIET")?.let { runCatching { AppJson.decodeFromString<DietPlan>(it.json) }.getOrNull() }

    suspend fun saveWorkoutPlan(plan: WorkoutPlan, reason: String): Long =
        db.plans().replaceActive(PlanEntity(kind = "WORKOUT", json = AppJson.encodeToString(plan), reason = reason, createdAt = System.currentTimeMillis(), active = true))

    suspend fun saveDietPlan(plan: DietPlan, reason: String): Long =
        db.plans().replaceActive(PlanEntity(kind = "DIET", json = AppJson.encodeToString(plan), reason = reason, createdAt = System.currentTimeMillis(), active = true))

    suspend fun restorePlan(entity: PlanEntity) = db.plans().restore(entity.kind, entity.id)

    /** Troca um exercício do plano ativo e guarda a versão anterior no histórico. */
    suspend fun swapExercise(dayIndex: Int, oldId: String, newId: String) {
        val plan = activeWorkoutPlan() ?: return
        val p = currentProfile() ?: return
        val newEx = ExerciseLibrary.get(newId) ?: return
        val days = plan.days.map { d ->
            if (d.index != dayIndex) d else d.copy(exercises = d.exercises.map {
                if (it.exerciseId == oldId) WorkoutGenerator.prescribe(newEx, p, plan.setsDelta) else it
            })
        }
        saveWorkoutPlan(plan.copy(days = days), "Troca de exercício: ${ExerciseLibrary.get(oldId)?.name} → ${newEx.name}")
    }

    /** Troca um alimento do cardápio (mantendo equivalência calculada). */
    suspend fun swapFood(dayIndex: Int, mealIndex: Int, itemIndex: Int, newItem: MealItem, allDays: Boolean) {
        val plan = activeDietPlan() ?: return
        val oldItem = plan.days.getOrNull(dayIndex)?.meals?.getOrNull(mealIndex)?.items?.getOrNull(itemIndex) ?: return
        val days = plan.days.map { d ->
            if (!allDays && d.dayIndex != dayIndex) d else d.copy(meals = d.meals.mapIndexed { mi, m ->
                if (mi != mealIndex) m else m.copy(items = m.items.mapIndexed { ii, it ->
                    if ((allDays && it.foodId == oldItem.foodId) || (!allDays && ii == itemIndex)) newItem.copy(role = it.role) else it
                })
            })
        }
        val weekly = DietGenerator.shoppingList(days).sumOf { it.cost }
        saveDietPlan(plan.copy(days = days, weeklyCost = weekly, monthlyCost = weekly * 4.3),
            "Substituição: ${FoodDb.get(oldItem.foodId)?.name} → ${FoodDb.get(newItem.foodId)?.name}")
    }

    /* --------------------------- Treinos (log) --------------------------- */

    val sessions: Flow<List<WorkoutSessionEntity>> = db.workouts().observeSessions()
    val setLogs: Flow<List<SetLogEntity>> = db.workouts().observeSets()

    suspend fun lastSets(exerciseId: String): List<SetEntry> = db.workouts().lastSetsFor(exerciseId).map { SetEntry(it.weightKg, it.reps) }
    suspend fun lastFeedback(exerciseId: String): ExerciseFeedbackEntity? = db.workouts().lastFeedback(exerciseId)

    data class LoggedExercise(val exerciseId: String, val sets: List<SetEntry>, val rpe: Int, val goodForm: Boolean, val pain: Boolean)

    suspend fun saveSession(dayIndex: Int, title: String, logged: List<LoggedExercise>, durationMin: Int, day: Long = today()): Long {
        val planId = db.plans().active("WORKOUT")?.id ?: 0
        val id = db.workouts().insertSession(
            WorkoutSessionEntity(epochDay = day, planId = planId, dayIndex = dayIndex, title = title, completed = true, durationMin = durationMin, startedAt = System.currentTimeMillis())
        )
        val sets = logged.flatMap { le -> le.sets.mapIndexed { i, s -> SetLogEntity(sessionId = id, exerciseId = le.exerciseId, setNumber = i + 1, weightKg = s.weightKg, reps = s.reps, epochDay = day) } }
        db.workouts().insertSets(sets)
        db.workouts().insertFeedback(logged.map { ExerciseFeedbackEntity(sessionId = id, exerciseId = it.exerciseId, rpe = it.rpe, goodForm = it.goodForm, pain = it.pain, epochDay = day) })
        return id
    }

    suspend fun deleteSession(id: Long) {
        db.workouts().deleteSets(id); db.workouts().deleteFeedback(id); db.workouts().deleteSession(id)
    }

    /* ---------------------------- Evolução ---------------------------- */

    val measurements: Flow<List<MeasurementEntity>> = db.progress().observeMeasurements()
    val photos: Flow<List<PhotoEntity>> = db.progress().observePhotos()

    suspend fun addMeasurement(m: MeasurementEntity) {
        db.progress().insertMeasurement(m)
        // Atualiza o peso atual do perfil (sem regenerar o plano automaticamente).
        val p = currentProfile()
        if (p != null && m.weightKg != null && m.epochDay >= today() - 1) saveProfile(p.copy(weightKg = m.weightKg), "", regenerate = false)
    }

    suspend fun deleteMeasurement(id: Long) = db.progress().deleteMeasurement(id)

    /** Copia a foto para o armazenamento PRIVADO do app (nada é enviado a servidores). */
    suspend fun addPhoto(uri: Uri, note: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            val bmp = decodeScaled(uri, 1600) ?: return@runCatching false
            val name = "${UUID.randomUUID()}.jpg"
            File(photoDir, name).outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it) }
            bmp.recycle()
            db.progress().insertPhoto(PhotoEntity(epochDay = today(), fileName = name, note = note))
            true
        }.getOrDefault(false)
    }

    private fun decodeScaled(uri: Uri, maxSide: Int): Bitmap? {
        val cr = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (bounds.outWidth / sample > maxSide * 2 || bounds.outHeight / sample > maxSide * 2) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bmp = cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return null
        val scale = maxSide.toFloat() / maxOf(bmp.width, bmp.height)
        return if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true).also { if (it != bmp) bmp.recycle() } else bmp
    }

    suspend fun deletePhoto(photo: PhotoEntity) = withContext(Dispatchers.IO) {
        File(photoDir, photo.fileName).delete()
        db.progress().deletePhoto(photo.id)
    }

    /* ------------------------------ Água ------------------------------ */

    fun waterToday(day: Long = today()): Flow<List<WaterEntity>> = db.water().observeDay(day)
    fun waterSince(from: Long): Flow<List<WaterEntity>> = db.water().observeSince(from)
    suspend fun addWater(ml: Int) { if (ml > 0) db.water().insert(WaterEntity(epochDay = today(), ml = ml, timeMillis = System.currentTimeMillis())) }
    suspend fun deleteWater(id: Long) = db.water().delete(id)

    /* --------------------------- Refeições feitas --------------------------- */

    fun mealChecks(day: Long = today()): Flow<List<MealCheckEntity>> = db.mealChecks().observeDay(day)
    suspend fun toggleMeal(index: Int, done: Boolean, day: Long = today()) {
        if (done) db.mealChecks().insert(MealCheckEntity(day, index)) else db.mealChecks().delete(day, index)
    }

    /* ------------------------------ Agenda ------------------------------ */

    val schedule: Flow<List<ScheduleEntity>> = db.schedule().observe()

    /** Cria a agenda diária a partir da rotina informada no questionário. */
    suspend fun regenerateSchedule(p: UserProfile) {
        scheduler.cancelAll(db.schedule().all())
        db.schedule().clear()
        val items = ScheduleBuilder.build(p, activeWorkoutPlan())
        db.schedule().insertAll(items)
        rescheduleAll()
    }

    suspend fun updateScheduleItem(item: ScheduleEntity) { db.schedule().update(item); rescheduleAll() }
    suspend fun addScheduleItem(item: ScheduleEntity) { db.schedule().insert(item); rescheduleAll() }
    suspend fun deleteScheduleItem(item: ScheduleEntity) { scheduler.cancel(item); db.schedule().delete(item.id); rescheduleAll() }

    suspend fun rescheduleAll() {
        val items = db.schedule().all()
        if (settings.state.value.notificationsEnabled) scheduler.scheduleAll(items) else scheduler.cancelAll(items)
    }

    /* --------------------------- Notificações --------------------------- */

    val notifications: Flow<List<NotificationEntity>> = db.notifications().observe()
    val unreadNotifications: Flow<Int> = db.notifications().observeUnread()
    suspend fun markNotificationsRead() = db.notifications().markAllRead()
    suspend fun clearNotifications() = db.notifications().clear()
    suspend fun logNotification(title: String, body: String) = db.notifications().insert(NotificationEntity(timeMillis = System.currentTimeMillis(), title = title, body = body))

    /* ----------------------------- Check-ins ----------------------------- */

    val checkIns: Flow<List<CheckInEntity>> = db.checkins().observe()

    suspend fun lastCheckInDay(): Long? = db.checkins().last()?.epochDay

    suspend fun submitCheckIn(a: CheckInAnswers): Pair<Long, List<Recommendation>> {
        val p = currentProfile() ?: return 0L to emptyList()
        val plan = activeWorkoutPlan()
        val weights = db.progress().allMeasurements().mapNotNull { m -> m.weightKg?.let { WeightPoint(m.epochDay, it) } }
            .filter { it.epochDay >= today() - 35 }
        val recs = AdjustmentEngine.recommend(a, p, weights, plan?.setsDelta ?: 0)
        val id = db.checkins().insert(CheckInEntity(epochDay = today(), answersJson = AppJson.encodeToString(a), recommendationsJson = AppJson.encodeToString(recs)))
        return id to recs
    }

    /** Aplica as recomendações escolhidas. Cada alteração gera nova versão do plano com o motivo. */
    suspend fun applyRecommendations(checkInId: Long, recs: List<Recommendation>): String {
        var p = currentProfile() ?: return ""
        val workout = activeWorkoutPlan()
        val diet = activeDietPlan()
        var setsDelta = workout?.setsDelta ?: 0
        var calorieOffset = diet?.calorieOffset ?: 0
        var changedWorkout = false
        var changedDiet = false
        val reasons = mutableListOf<String>()
        for (r in recs) when (r.action) {
            ActionType.DELOAD, ActionType.REDUCE_SETS -> { setsDelta = (setsDelta + r.value).coerceIn(-2, 2); changedWorkout = true; reasons += r.title }
            ActionType.ADD_SETS -> { setsDelta = (setsDelta + r.value).coerceIn(-2, 1); changedWorkout = true; reasons += r.title }
            ActionType.ADD_LIMITATION -> r.limitation?.let { p = p.copy(limitations = p.limitations + it); changedWorkout = true; reasons += r.title }
            ActionType.REDUCE_DAYS -> { p = p.copy(daysPerWeek = (p.daysPerWeek - 1).coerceAtLeast(2)); changedWorkout = true; reasons += r.title }
            ActionType.SHORTER_SESSIONS -> { p = p.copy(minutesPerSession = (p.minutesPerSession + r.value).coerceAtLeast(30)); changedWorkout = true; reasons += r.title }
            ActionType.CALORIES_UP, ActionType.CALORIES_DOWN -> { calorieOffset = (calorieOffset + r.value).coerceIn(-300, 400); changedDiet = true; reasons += r.title }
            ActionType.SIMPLIFY_DIET -> { p = p.copy(mealsPerDay = (p.mealsPerDay - 1).coerceAtLeast(3), economic = true, prepMinutes = minOf(p.prepMinutes, 15)); changedDiet = true; reasons += r.title }
            ActionType.NONE, ActionType.SEE_PROFESSIONAL -> Unit
        }
        val summary = reasons.joinToString("; ")
        db.profile().upsert(ProfileEntity(1, AppJson.encodeToString(p), System.currentTimeMillis()))
        if (changedWorkout) saveWorkoutPlan(WorkoutGenerator.generate(p, setsDelta), "Check-in: $summary")
        if (changedDiet) saveDietPlan(DietGenerator.generate(p, calorieOffset), "Check-in: $summary")
        if (changedWorkout || changedDiet) regenerateScheduleKeepingEdits(p)
        db.checkins().all().firstOrNull { it.id == checkInId }?.let { db.checkins().update(it.copy(appliedSummary = summary.ifBlank { "Nenhuma alteração" })) }
        return summary
    }

    private suspend fun regenerateScheduleKeepingEdits(p: UserProfile) {
        // Só recria a agenda se os dias de treino mudaram; caso contrário mantém os horários editados.
        val trainingDays = activeWorkoutPlan()?.days?.map { it.weekday }?.toSet() ?: return
        val items = db.schedule().all()
        val training = items.firstOrNull { it.type == "TRAINING" } ?: return
        val mask = trainingDays.fold(0) { acc, d -> acc or (1 shl (d - 1)) }
        if (training.daysMask != mask) updateScheduleItem(training.copy(daysMask = mask))
    }

    /* ----------------------- Exportar / backup ----------------------- */

    val backup by lazy { BackupManager(context, this) }
}

/** Monta os itens da agenda diária. */
object ScheduleBuilder {
    fun build(p: UserProfile, plan: WorkoutPlan?): List<ScheduleEntity> {
        val list = mutableListOf<ScheduleEntity>()
        list += ScheduleEntity(type = "WAKE", label = "Acordar — beba um copo de água", time = p.wakeTime)
        DietGenerator.mealStructure(p).forEach { (type, time, _) ->
            list += ScheduleEntity(type = "MEAL", label = type.label, time = time)
        }
        val trainDays = plan?.days?.map { it.weekday } ?: WorkoutGenerator.chooseWeekdays(p)
        val mask = trainDays.fold(0) { acc, d -> acc or (1 shl (d - 1)) }
        list += ScheduleEntity(type = "TRAINING", label = "Hora do treino!", time = p.trainTime, daysMask = mask)
        // Água: a cada ~2h entre acordar e dormir.
        val wake = minutesOf(p.wakeTime)
        var sleep = minutesOf(p.sleepTime); if (sleep <= wake) sleep += 1440
        var t = wake + 90
        while (t < sleep - 60) {
            list += ScheduleEntity(type = "WATER", label = "Hidratação — 1 copo de água", time = formatMinutes(t))
            t += 120
        }
        list += ScheduleEntity(type = "REST", label = "Pausa: levante, alongue e respire", time = formatMinutes(wake + ((sleep - wake) / 2) + 30))
        list += ScheduleEntity(type = "SLEEP", label = "Prepare-se para dormir (desligue as telas)", time = formatMinutes(sleep - 30))
        list += ScheduleEntity(type = "CHECKIN", label = "Check-in semanal: como você está?", time = "19:30", daysMask = 1 shl 6)
        return list
    }
}
