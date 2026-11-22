package com.aurea.fit.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable

/* ============================== ENTIDADES ============================== */

@Serializable
@Entity(tableName = "account")
data class AccountEntity(
    @PrimaryKey val id: Int = 1,
    val name: String,
    val email: String,
    val passwordHash: String,
    val salt: String,
    val createdAt: Long
)

@Serializable
@Entity(tableName = "profile")
data class ProfileEntity(@PrimaryKey val id: Int = 1, val json: String, val updatedAt: Long)

@Serializable
@Entity(tableName = "plans")
data class PlanEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String, // WORKOUT | DIET
    val json: String,
    val reason: String,
    val createdAt: Long,
    val active: Boolean
)

@Serializable
@Entity(tableName = "workout_sessions")
data class WorkoutSessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val epochDay: Long,
    val planId: Long,
    val dayIndex: Int,
    val title: String,
    val completed: Boolean,
    val durationMin: Int,
    val startedAt: Long
)

@Serializable
@Entity(tableName = "set_logs")
data class SetLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sessionId: Long,
    val exerciseId: String,
    val setNumber: Int,
    val weightKg: Double,
    val reps: Int,
    val epochDay: Long
)

@Serializable
@Entity(tableName = "exercise_feedback")
data class ExerciseFeedbackEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sessionId: Long,
    val exerciseId: String,
    val rpe: Int,
    val goodForm: Boolean,
    val pain: Boolean,
    val epochDay: Long
)

@Serializable
@Entity(tableName = "measurements")
data class MeasurementEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val epochDay: Long,
    val weightKg: Double? = null,
    val waistCm: Double? = null,
    val hipCm: Double? = null,
    val thighCm: Double? = null,
    val armCm: Double? = null
)

@Serializable
@Entity(tableName = "photos")
data class PhotoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val epochDay: Long,
    val fileName: String,
    val note: String = ""
)

@Serializable
@Entity(tableName = "water")
data class WaterEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val epochDay: Long,
    val ml: Int,
    val timeMillis: Long
)

@Serializable
@Entity(tableName = "schedule")
data class ScheduleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String, // WAKE, MEAL, TRAINING, WATER, REST, SLEEP, CHECKIN
    val label: String,
    val time: String,
    val daysMask: Int = 0b1111111, // bit 0 = segunda ... bit 6 = domingo
    val enabled: Boolean = true
)

@Serializable
@Entity(tableName = "notifications")
data class NotificationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timeMillis: Long,
    val title: String,
    val body: String,
    val read: Boolean = false
)

@Serializable
@Entity(tableName = "checkins")
data class CheckInEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val epochDay: Long,
    val answersJson: String,
    val recommendationsJson: String,
    val appliedSummary: String = ""
)

@Serializable
@Entity(tableName = "meal_checks", primaryKeys = ["epochDay", "mealIndex"])
data class MealCheckEntity(val epochDay: Long, val mealIndex: Int)

/* ================================ DAOs ================================ */

@Dao
interface AccountDao {
    @Query("SELECT * FROM account WHERE id = 1") suspend fun get(): AccountEntity?
    @Query("SELECT * FROM account WHERE id = 1") fun observe(): Flow<AccountEntity?>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsert(a: AccountEntity)
}

@Dao
interface ProfileDao {
    @Query("SELECT * FROM profile WHERE id = 1") suspend fun get(): ProfileEntity?
    @Query("SELECT * FROM profile WHERE id = 1") fun observe(): Flow<ProfileEntity?>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsert(p: ProfileEntity)
}

@Dao
interface PlanDao {
    @Query("SELECT * FROM plans WHERE kind = :kind AND active = 1 ORDER BY id DESC LIMIT 1")
    fun observeActive(kind: String): Flow<PlanEntity?>
    @Query("SELECT * FROM plans WHERE kind = :kind AND active = 1 ORDER BY id DESC LIMIT 1")
    suspend fun active(kind: String): PlanEntity?
    @Query("SELECT * FROM plans ORDER BY id DESC") fun observeAll(): Flow<List<PlanEntity>>
    @Query("SELECT * FROM plans ORDER BY id ASC") suspend fun all(): List<PlanEntity>
    @Query("SELECT * FROM plans WHERE id = :id") suspend fun byId(id: Long): PlanEntity?
    @Query("UPDATE plans SET active = 0 WHERE kind = :kind") suspend fun deactivate(kind: String)
    @Query("UPDATE plans SET active = 1 WHERE id = :id") suspend fun activate(id: Long)
    @Insert suspend fun insert(p: PlanEntity): Long
    @Transaction
    suspend fun replaceActive(p: PlanEntity): Long { deactivate(p.kind); return insert(p.copy(active = true)) }
    @Transaction
    suspend fun restore(kind: String, id: Long) { deactivate(kind); activate(id) }
}

@Dao
interface WorkoutDao {
    @Insert suspend fun insertSession(s: WorkoutSessionEntity): Long
    @Update suspend fun updateSession(s: WorkoutSessionEntity)
    @Query("SELECT * FROM workout_sessions ORDER BY epochDay DESC, id DESC") fun observeSessions(): Flow<List<WorkoutSessionEntity>>
    @Query("SELECT * FROM workout_sessions WHERE id = :id") suspend fun session(id: Long): WorkoutSessionEntity?
    @Query("DELETE FROM workout_sessions WHERE id = :id") suspend fun deleteSession(id: Long)
    @Insert suspend fun insertSets(sets: List<SetLogEntity>)
    @Query("DELETE FROM set_logs WHERE sessionId = :sessionId") suspend fun deleteSets(sessionId: Long)
    @Query("SELECT * FROM set_logs ORDER BY epochDay ASC, id ASC") fun observeSets(): Flow<List<SetLogEntity>>
    @Query("SELECT * FROM set_logs WHERE exerciseId = :exerciseId AND sessionId = (SELECT sessionId FROM set_logs WHERE exerciseId = :exerciseId ORDER BY epochDay DESC, id DESC LIMIT 1) ORDER BY setNumber")
    suspend fun lastSetsFor(exerciseId: String): List<SetLogEntity>
    @Insert suspend fun insertFeedback(f: List<ExerciseFeedbackEntity>)
    @Query("DELETE FROM exercise_feedback WHERE sessionId = :sessionId") suspend fun deleteFeedback(sessionId: Long)
    @Query("SELECT * FROM exercise_feedback WHERE exerciseId = :exerciseId ORDER BY epochDay DESC, id DESC LIMIT 1")
    suspend fun lastFeedback(exerciseId: String): ExerciseFeedbackEntity?
    @Query("SELECT * FROM workout_sessions") suspend fun allSessions(): List<WorkoutSessionEntity>
    @Query("SELECT * FROM set_logs") suspend fun allSets(): List<SetLogEntity>
    @Query("SELECT * FROM exercise_feedback") suspend fun allFeedback(): List<ExerciseFeedbackEntity>
}

@Dao
interface ProgressDao {
    @Insert suspend fun insertMeasurement(m: MeasurementEntity): Long
    @Query("DELETE FROM measurements WHERE id = :id") suspend fun deleteMeasurement(id: Long)
    @Query("SELECT * FROM measurements ORDER BY epochDay ASC, id ASC") fun observeMeasurements(): Flow<List<MeasurementEntity>>
    @Query("SELECT * FROM measurements ORDER BY epochDay ASC") suspend fun allMeasurements(): List<MeasurementEntity>
    @Insert suspend fun insertPhoto(p: PhotoEntity): Long
    @Query("DELETE FROM photos WHERE id = :id") suspend fun deletePhoto(id: Long)
    @Query("SELECT * FROM photos ORDER BY epochDay DESC, id DESC") fun observePhotos(): Flow<List<PhotoEntity>>
    @Query("SELECT * FROM photos") suspend fun allPhotos(): List<PhotoEntity>
}

@Dao
interface WaterDao {
    @Insert suspend fun insert(w: WaterEntity): Long
    @Query("DELETE FROM water WHERE id = :id") suspend fun delete(id: Long)
    @Query("SELECT * FROM water WHERE epochDay = :day ORDER BY timeMillis DESC") fun observeDay(day: Long): Flow<List<WaterEntity>>
    @Query("SELECT * FROM water WHERE epochDay >= :from ORDER BY epochDay") fun observeSince(from: Long): Flow<List<WaterEntity>>
    @Query("SELECT * FROM water") suspend fun all(): List<WaterEntity>
}

@Dao
interface ScheduleDao {
    @Query("SELECT * FROM schedule ORDER BY time ASC") fun observe(): Flow<List<ScheduleEntity>>
    @Query("SELECT * FROM schedule ORDER BY time ASC") suspend fun all(): List<ScheduleEntity>
    @Query("SELECT * FROM schedule WHERE id = :id") suspend fun byId(id: Long): ScheduleEntity?
    @Insert suspend fun insertAll(items: List<ScheduleEntity>): List<Long>
    @Insert suspend fun insert(item: ScheduleEntity): Long
    @Update suspend fun update(item: ScheduleEntity)
    @Query("DELETE FROM schedule WHERE id = :id") suspend fun delete(id: Long)
    @Query("DELETE FROM schedule") suspend fun clear()
}

@Dao
interface NotificationDao {
    @Insert suspend fun insert(n: NotificationEntity): Long
    @Query("SELECT * FROM notifications ORDER BY timeMillis DESC LIMIT 200") fun observe(): Flow<List<NotificationEntity>>
    @Query("SELECT COUNT(*) FROM notifications WHERE read = 0") fun observeUnread(): Flow<Int>
    @Query("UPDATE notifications SET read = 1") suspend fun markAllRead()
    @Query("DELETE FROM notifications") suspend fun clear()
    @Query("SELECT * FROM notifications") suspend fun all(): List<NotificationEntity>
}

@Dao
interface CheckInDao {
    @Insert suspend fun insert(c: CheckInEntity): Long
    @Update suspend fun update(c: CheckInEntity)
    @Query("SELECT * FROM checkins ORDER BY epochDay DESC, id DESC") fun observe(): Flow<List<CheckInEntity>>
    @Query("SELECT * FROM checkins ORDER BY epochDay DESC, id DESC LIMIT 1") suspend fun last(): CheckInEntity?
    @Query("SELECT * FROM checkins") suspend fun all(): List<CheckInEntity>
}

@Dao
interface MealCheckDao {
    @Query("SELECT * FROM meal_checks WHERE epochDay = :day") fun observeDay(day: Long): Flow<List<MealCheckEntity>>
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insert(m: MealCheckEntity)
    @Query("DELETE FROM meal_checks WHERE epochDay = :day AND mealIndex = :index") suspend fun delete(day: Long, index: Int)
    @Query("SELECT * FROM meal_checks") suspend fun all(): List<MealCheckEntity>
}

@Dao
interface MaintenanceDao {
    @Query("DELETE FROM account") suspend fun a()
    @Query("DELETE FROM profile") suspend fun b()
    @Query("DELETE FROM plans") suspend fun c()
    @Query("DELETE FROM workout_sessions") suspend fun d()
    @Query("DELETE FROM set_logs") suspend fun e()
    @Query("DELETE FROM exercise_feedback") suspend fun f()
    @Query("DELETE FROM measurements") suspend fun g()
    @Query("DELETE FROM photos") suspend fun h()
    @Query("DELETE FROM water") suspend fun i()
    @Query("DELETE FROM schedule") suspend fun j()
    @Query("DELETE FROM notifications") suspend fun k()
    @Query("DELETE FROM checkins") suspend fun l()
    @Query("DELETE FROM meal_checks") suspend fun m()
    suspend fun clearAll() { a(); b(); c(); d(); e(); f(); g(); h(); i(); j(); k(); l(); m() }
}

@Database(
    entities = [
        AccountEntity::class, ProfileEntity::class, PlanEntity::class, WorkoutSessionEntity::class,
        SetLogEntity::class, ExerciseFeedbackEntity::class, MeasurementEntity::class, PhotoEntity::class,
        WaterEntity::class, ScheduleEntity::class, NotificationEntity::class, CheckInEntity::class,
        MealCheckEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class AureaDatabase : RoomDatabase() {
    abstract fun account(): AccountDao
    abstract fun profile(): ProfileDao
    abstract fun plans(): PlanDao
    abstract fun workouts(): WorkoutDao
    abstract fun progress(): ProgressDao
    abstract fun water(): WaterDao
    abstract fun schedule(): ScheduleDao
    abstract fun notifications(): NotificationDao
    abstract fun checkins(): CheckInDao
    abstract fun mealChecks(): MealCheckDao
    abstract fun maintenance(): MaintenanceDao

    companion object {
        fun build(context: Context, inMemory: Boolean = false): AureaDatabase =
            if (inMemory) Room.inMemoryDatabaseBuilder(context, AureaDatabase::class.java).allowMainThreadQueries().build()
            else Room.databaseBuilder(context, AureaDatabase::class.java, "aurea.db").build()
    }
}
