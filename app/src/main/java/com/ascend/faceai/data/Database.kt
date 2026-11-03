package com.ascend.faceai.data

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
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "analyses")
data class AnalysisEntity(
    @PrimaryKey val id: String,
    val createdAt: Long,
    val overall: Int,
    val potential: Int,
    val reportJson: String,
    val photoTypes: String,
    val synced: Boolean = false
)

@Entity(tableName = "plan_tasks")
data class PlanTaskEntity(
    @PrimaryKey val id: String, // "<analysisId>:<taskKey>"
    val analysisId: String,
    val taskKey: String,
    val done: Boolean,
    val doneAt: Long?
)

@Entity(tableName = "chat_messages")
data class ChatMessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val role: String, // "user" | "assistant"
    val text: String,
    val source: String, // "ai" | "local" | "user" | "error"
    val createdAt: Long
)

@Dao
interface AnalysisDao {
    @Query("SELECT * FROM analyses ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<AnalysisEntity>>

    @Query("SELECT * FROM analyses ORDER BY createdAt DESC")
    suspend fun all(): List<AnalysisEntity>

    @Query("SELECT * FROM analyses WHERE id = :id")
    suspend fun get(id: String): AnalysisEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(e: AnalysisEntity)

    @Query("DELETE FROM analyses WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM analyses")
    suspend fun deleteAll()

    @Query("UPDATE analyses SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)
}

@Dao
interface PlanDao {
    @Query("SELECT * FROM plan_tasks WHERE analysisId = :analysisId")
    fun observe(analysisId: String): Flow<List<PlanTaskEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(e: PlanTaskEntity)

    @Query("DELETE FROM plan_tasks WHERE analysisId = :analysisId")
    suspend fun deleteFor(analysisId: String)

    @Query("DELETE FROM plan_tasks")
    suspend fun deleteAll()
}

@Dao
interface ChatDao {
    @Query("SELECT * FROM chat_messages ORDER BY createdAt ASC, id ASC")
    fun observe(): Flow<List<ChatMessageEntity>>

    @Query("SELECT * FROM chat_messages ORDER BY createdAt DESC, id DESC LIMIT :n")
    suspend fun last(n: Int): List<ChatMessageEntity>

    @Insert
    suspend fun insert(e: ChatMessageEntity): Long

    @Query("DELETE FROM chat_messages")
    suspend fun deleteAll()
}

@Database(entities = [AnalysisEntity::class, PlanTaskEntity::class, ChatMessageEntity::class], version = 1, exportSchema = true)
abstract class AscendDatabase : RoomDatabase() {
    abstract fun analyses(): AnalysisDao
    abstract fun plans(): PlanDao
    abstract fun chat(): ChatDao

    companion object {
        fun create(context: Context): AscendDatabase =
            Room.databaseBuilder(context, AscendDatabase::class.java, "ascend.db").build()
    }
}
