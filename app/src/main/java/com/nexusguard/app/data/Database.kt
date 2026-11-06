package com.nexusguard.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import com.nexusguard.app.core.KeystoreCrypto
import kotlinx.coroutines.flow.Flow
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory
import java.io.File
import java.security.SecureRandom

/** Tipos de registro do histórico. */
object Kind {
    const val SECURITY_SCAN = "security_scan"
    const val APP_SCAN = "app_scan"
    const val APK = "apk"
    const val FILE = "file"
    const val PHISHING = "phishing"
    const val WIFI = "wifi"
    const val SPEED = "speed"
    const val DNS = "dns"
    const val LATENCY = "latency"
    const val OPTIMIZATION = "optimization"
    const val STABILITY = "stability"
}

@Entity(tableName = "history")
data class HistoryEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String,
    val title: String,
    val summary: String,
    val score: Int? = null,
    val level: String? = null,
    val payload: String = "",
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "alerts")
data class AlertEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val category: String,      // "security" | "network"
    val severity: String,      // "info" | "warn" | "high"
    val title: String,
    val message: String,
    val timestamp: Long = System.currentTimeMillis(),
    val read: Boolean = false
)

@Entity(tableName = "stability_events")
data class StabilityEvent(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val session: Long,
    val type: String,          // start | stop | outage | network_change | spike
    val detail: String,
    val durationMs: Long = 0,
    val timestamp: Long = System.currentTimeMillis()
)

@Dao
interface HistoryDao {
    @Insert suspend fun insert(e: HistoryEntry): Long
    @Query("SELECT * FROM history ORDER BY timestamp DESC LIMIT :limit") fun recent(limit: Int = 200): Flow<List<HistoryEntry>>
    @Query("SELECT * FROM history WHERE kind IN (:kinds) ORDER BY timestamp DESC LIMIT :limit") fun byKinds(kinds: List<String>, limit: Int = 200): Flow<List<HistoryEntry>>
    @Query("SELECT * FROM history WHERE kind = :kind ORDER BY timestamp DESC LIMIT 1") fun latest(kind: String): Flow<HistoryEntry?>
    @Query("SELECT * FROM history WHERE kind = :kind ORDER BY timestamp DESC LIMIT 1") suspend fun latestOnce(kind: String): HistoryEntry?
    @Query("SELECT * FROM history ORDER BY timestamp DESC") suspend fun all(): List<HistoryEntry>
    @Query("DELETE FROM history") suspend fun clear()
    @Query("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY timestamp DESC LIMIT :keep)") suspend fun trim(keep: Int = 1000)
}

@Dao
interface AlertDao {
    @Insert suspend fun insert(a: AlertEntry): Long
    @Query("SELECT * FROM alerts ORDER BY timestamp DESC LIMIT :limit") fun recent(limit: Int = 100): Flow<List<AlertEntry>>
    @Query("SELECT * FROM alerts ORDER BY timestamp DESC") suspend fun all(): List<AlertEntry>
    @Query("SELECT COUNT(*) FROM alerts WHERE read = 0") fun unreadCount(): Flow<Int>
    @Query("UPDATE alerts SET read = 1") suspend fun markAllRead()
    @Query("SELECT * FROM alerts WHERE title = :title AND timestamp > :since LIMIT 1") suspend fun findRecent(title: String, since: Long): AlertEntry?
    @Query("DELETE FROM alerts") suspend fun clear()
}

@Dao
interface StabilityDao {
    @Insert suspend fun insert(e: StabilityEvent): Long
    @Query("SELECT * FROM stability_events ORDER BY timestamp DESC LIMIT :limit") fun recent(limit: Int = 200): Flow<List<StabilityEvent>>
    @Query("SELECT * FROM stability_events ORDER BY timestamp DESC") suspend fun all(): List<StabilityEvent>
    @Query("DELETE FROM stability_events") suspend fun clear()
}

@Database(entities = [HistoryEntry::class, AlertEntry::class, StabilityEvent::class], version = 1, exportSchema = true)
abstract class NexusDatabase : RoomDatabase() {
    abstract fun history(): HistoryDao
    abstract fun alerts(): AlertDao
    abstract fun stability(): StabilityDao

    companion object {
        const val NAME = "nexus_guard.db"

        /**
         * Banco cifrado com SQLCipher (AES-256). A senha é aleatória (32 bytes), gerada no primeiro uso
         * e guardada somente criptografada pelo Android Keystore, em área sem backup.
         */
        fun create(context: Context): NexusDatabase {
            System.loadLibrary("sqlcipher")
            val factory = SupportOpenHelperFactory(passphrase(context))
            return Room.databaseBuilder(context, NexusDatabase::class.java, NAME)
                .openHelperFactory(factory)
                .fallbackToDestructiveMigration()
                .build()
        }

        private fun passphrase(context: Context): ByteArray {
            val f = File(context.noBackupFilesDir, "db.key")
            if (f.exists()) {
                runCatching { return KeystoreCrypto.decrypt(f.readBytes()) }
                // Chave do Keystore perdida (ex.: restauração): o banco antigo fica ilegível e é recriado.
                context.deleteDatabase(NAME)
            }
            val raw = ByteArray(32).also { SecureRandom().nextBytes(it) }
            f.writeBytes(KeystoreCrypto.encrypt(raw))
            return raw
        }
    }
}
