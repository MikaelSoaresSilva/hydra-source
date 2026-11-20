package com.aurea.fit.data

import android.content.Context
import android.net.Uri
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

@Serializable
data class BackupData(
    val version: Int = 1,
    val exportedAt: Long,
    val account: AccountEntity?,
    val profile: ProfileEntity?,
    val plans: List<PlanEntity>,
    val sessions: List<WorkoutSessionEntity>,
    val sets: List<SetLogEntity>,
    val feedback: List<ExerciseFeedbackEntity>,
    val measurements: List<MeasurementEntity>,
    val photos: List<PhotoEntity>,
    val water: List<WaterEntity>,
    val schedule: List<ScheduleEntity>,
    val notifications: List<NotificationEntity>,
    val checkins: List<CheckInEntity>,
    val mealChecks: List<MealCheckEntity>
)

/**
 * Exportação e backup.
 * O arquivo .zip contém "dados.json" (todos os registros) e, se a usuária escolher,
 * a pasta "fotos/". O app NÃO envia nada para servidores: a usuária escolhe onde salvar
 * (memória do celular, cartão, Google Drive etc.) pelo seletor de arquivos do Android.
 */
class BackupManager(private val context: Context, private val repo: Repository) {

    suspend fun snapshot(): BackupData = withContext(Dispatchers.IO) {
        val db = repo.db
        BackupData(
            exportedAt = System.currentTimeMillis(),
            account = db.account().get(),
            profile = db.profile().get(),
            plans = db.plans().all(),
            sessions = db.workouts().allSessions(),
            sets = db.workouts().allSets(),
            feedback = db.workouts().allFeedback(),
            measurements = db.progress().allMeasurements(),
            photos = db.progress().allPhotos(),
            water = db.water().all(),
            schedule = db.schedule().all(),
            notifications = db.notifications().all(),
            checkins = db.checkins().all(),
            mealChecks = db.mealChecks().all()
        )
    }

    suspend fun exportTo(uri: Uri, includePhotos: Boolean): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val data = snapshot()
            var count = 0
            context.contentResolver.openOutputStream(uri)?.use { out ->
                ZipOutputStream(out).use { zip ->
                    zip.putNextEntry(ZipEntry("dados.json"))
                    zip.write(AppJson.encodeToString(data.copy(photos = if (includePhotos) data.photos else emptyList())).toByteArray())
                    zip.closeEntry()
                    if (includePhotos) data.photos.forEach { ph ->
                        val f = File(repo.photoDir, ph.fileName)
                        if (f.exists()) {
                            zip.putNextEntry(ZipEntry("fotos/${ph.fileName}"))
                            f.inputStream().use { it.copyTo(zip) }
                            zip.closeEntry()
                            count++
                        }
                    }
                }
            } ?: error("Não foi possível abrir o arquivo de destino.")
            count
        }
    }

    /** Restaura um backup, substituindo os dados atuais. */
    suspend fun importFrom(uri: Uri): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            var data: BackupData? = null
            val tmpPhotos = File(context.cacheDir, "restore_photos").apply { deleteRecursively(); mkdirs() }
            context.contentResolver.openInputStream(uri)?.use { input ->
                ZipInputStream(input).use { zip ->
                    var e = zip.nextEntry
                    while (e != null) {
                        val name = e.name
                        when {
                            name == "dados.json" -> data = AppJson.decodeFromString<BackupData>(zip.readBytes().decodeToString())
                            name.startsWith("fotos/") && !e.isDirectory -> {
                                val fileName = File(name).name
                                // proteção contra caminhos maliciosos ("zip slip")
                                if (fileName.matches(Regex("[A-Za-z0-9._-]+"))) File(tmpPhotos, fileName).outputStream().use { zip.copyTo(it) }
                            }
                        }
                        e = zip.nextEntry
                    }
                }
            } ?: error("Não foi possível abrir o arquivo.")
            val d = data ?: error("Arquivo de backup inválido (dados.json não encontrado).")
            val db = repo.db
            db.withTransaction {
                db.maintenance().clearAll()
                d.account?.let { db.account().upsert(it) }
                d.profile?.let { db.profile().upsert(it) }
                d.plans.forEach { db.plans().insert(it) }
                d.sessions.forEach { db.workouts().insertSession(it) }
                db.workouts().insertSets(d.sets)
                db.workouts().insertFeedback(d.feedback)
                d.measurements.forEach { db.progress().insertMeasurement(it) }
                d.photos.forEach { db.progress().insertPhoto(it) }
                d.water.forEach { db.water().insert(it) }
                db.schedule().insertAll(d.schedule)
                d.notifications.forEach { db.notifications().insert(it) }
                d.checkins.forEach { db.checkins().insert(it) }
                d.mealChecks.forEach { db.mealChecks().insert(it) }
            }
            repo.photoDir.listFiles()?.forEach { it.delete() }
            tmpPhotos.listFiles()?.forEach { it.copyTo(File(repo.photoDir, it.name), overwrite = true) }
            tmpPhotos.deleteRecursively()
            repo.rescheduleAll()
        }
    }
}
