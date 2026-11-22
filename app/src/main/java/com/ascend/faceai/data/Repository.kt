package com.ascend.faceai.data

import android.content.Context
import android.graphics.Bitmap
import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.analysis.FaceAnalyzer
import com.ascend.faceai.analysis.FaceReport
import com.ascend.faceai.analysis.LocalAdvisor
import com.ascend.faceai.analysis.QualityResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.util.UUID

class AnalysisRepository(
    private val context: Context,
    private val db: AscendDatabase,
    val vault: PhotoVault,
    val settings: SettingsStore,
    val engine: FaceEngine,
    val ai: AiBackendClient,
    val cloud: CloudSync
) {
    private fun decode(e: AnalysisEntity): FaceReport? =
        runCatching { json.decodeFromString(FaceReport.serializer(), e.reportJson) }.getOrNull()

    val reports: Flow<List<FaceReport>> = db.analyses().observeAll().map { list -> list.mapNotNull { decode(it) } }
    val entities: Flow<List<AnalysisEntity>> = db.analyses().observeAll()

    suspend fun all(): List<FaceReport> = db.analyses().all().mapNotNull { decode(it) }
    suspend fun get(id: String): FaceReport? = db.analyses().get(id)?.let { decode(it) }

    /** Executa a análise completa sobre fotos já preparadas e salva (relatório + recortes criptografados). */
    suspend fun analyzeAndSave(photos: List<PreparedPhoto>, onStep: (String) -> Unit = {}): FaceReport = withContext(Dispatchers.Default) {
        val id = UUID.randomUUID().toString()
        val frames = photos.filter { it.frame != null && it.quality.ok }.associate { it.type to it.frame!! }
        val q: Map<CaptureType, QualityResult> = photos.associate { it.type to it.quality }
        onStep("Calculando proporções e simetria")
        val report = FaceAnalyzer.analyze(id, System.currentTimeMillis(), frames, q)
        onStep("Protegendo suas fotos")
        photos.filter { it.crop != null && it.quality.ok }.forEach { vault.save(id, it.type, FaceEngine.limit(it.crop!!, 1080)) }
        onStep("Salvando relatório")
        db.analyses().upsert(
            AnalysisEntity(id, report.createdAt, report.overall, report.potential,
                json.encodeToString(FaceReport.serializer(), report), frames.keys.joinToString(",") { it.name })
        )
        report
    }

    fun photo(id: String, type: CaptureType = CaptureType.FRONTAL): Bitmap? = vault.load(id, type)

    suspend fun delete(id: String) {
        db.analyses().delete(id); db.plans().deleteFor(id); vault.delete(id)
    }

    suspend fun deletePhotosOnly() { vault.deleteAll() }

    suspend fun deleteAllLocal() {
        db.analyses().deleteAll(); db.plans().deleteAll(); db.chat().deleteAll(); vault.deleteAll()
        context.cacheDir.resolve("exports").deleteRecursively()
    }

    // ---- Plano ----
    fun planState(analysisId: String) = db.plans().observe(analysisId)
    suspend fun setTask(analysisId: String, key: String, done: Boolean) =
        db.plans().upsert(PlanTaskEntity("$analysisId:$key", analysisId, key, done, if (done) System.currentTimeMillis() else null))

    // ---- Chat ----
    val chat = db.chat().observe()
    suspend fun clearChat() = db.chat().deleteAll()

    suspend fun ask(question: String): ChatMessageEntity {
        val now = System.currentTimeMillis()
        db.chat().insert(ChatMessageEntity(role = "user", text = question, source = "user", createdAt = now))
        val reports = all()
        val s = settings.current()
        val msg = if (s.aiConfigured && s.externalAiConsent) {
            try {
                val history = db.chat().last(10).reversed().map { it.role to it.text }
                ChatMessageEntity(role = "assistant", text = ai.chat(question, reports, history), source = "ai", createdAt = System.currentTimeMillis())
            } catch (e: Exception) {
                ChatMessageEntity(role = "assistant", text = "Não consegui falar com a IA externa (${e.message}).\n\nResposta do motor local:\n" + LocalAdvisor.answer(question, reports),
                    source = "error", createdAt = System.currentTimeMillis())
            }
        } else {
            ChatMessageEntity(role = "assistant", text = LocalAdvisor.answer(question, reports), source = "local", createdAt = System.currentTimeMillis())
        }
        db.chat().insert(msg)
        return msg
    }

    // ---- Projeção de 90 dias ----
    class ProjectionOut(
        val before: Bitmap, val after: Bitmap, val changes: List<String>,
        /** Notas medidas pelo próprio app na foto atual e na foto projetada (mesmo processo para as duas). */
        val scoresBefore: Map<String, Int?> = emptyMap(), val scoresAfter: Map<String, Int?> = emptyMap()
    )

    suspend fun project90(id: String, includeFatLoss: Boolean): ProjectionOut = withContext(Dispatchers.Default) {
        val r = get(id) ?: error("Análise não encontrada.")
        val before = photo(id) ?: error("A foto desta análise foi apagada.")
        if (r.frontalLandmarks.size < 468 * 2) error("Esta análise não tem os pontos do rosto salvos.")
        val w = before.width; val h = before.height
        val px = IntArray(w * h).also { before.getPixels(it, 0, w, 0, 0, w, h) }
        val res = com.ascend.faceai.analysis.Projection.project(px, w, h, r.frontalLandmarks, com.ascend.faceai.analysis.Projection.optionsFor(r, includeFatLoss))
        val after = Bitmap.createBitmap(res.argb, w, h, Bitmap.Config.ARGB_8888)
        ProjectionOut(before, after, res.changes)
    }

    /** Passa as duas fotos pelo MESMO processo de análise (mais lento: roda o MediaPipe duas vezes). */
    suspend fun measureProjection(o: ProjectionOut): ProjectionOut = withContext(Dispatchers.Default) {
        fun measure(b: Bitmap): Map<String, Int?> = runCatching {
            val p = engine.prepare(b, CaptureType.FRONTAL)
            val f = p.frame ?: return@runCatching emptyMap<String, Int?>()
            val rep = FaceAnalyzer.analyze("proj", System.currentTimeMillis(), mapOf(CaptureType.FRONTAL to f), mapOf(CaptureType.FRONTAL to p.quality))
            mapOf("geral" to rep.overall) + rep.categories.associate { it.id to it.score }
        }.getOrElse { emptyMap() }
        ProjectionOut(o.before, o.after, o.changes, measure(o.before), measure(o.after))
    }

    /** Salva a imagem (antes | depois) em cache/exports para compartilhar. Não vai para a galeria. */
    fun exportProjection(before: Bitmap, after: Bitmap): java.io.File {
        val out = Bitmap.createBitmap(before.width * 2 + 24, before.height, Bitmap.Config.ARGB_8888)
        val cv = android.graphics.Canvas(out)
        cv.drawColor(android.graphics.Color.BLACK)
        cv.drawBitmap(before, 0f, 0f, null); cv.drawBitmap(after, before.width + 24f, 0f, null)
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE; textSize = before.width / 16f; setShadowLayer(6f, 0f, 2f, android.graphics.Color.BLACK) }
        cv.drawText("Hoje", 24f, paint.textSize + 20f, paint)
        cv.drawText("90 dias (simulação)", before.width + 48f, paint.textSize + 20f, paint)
        val dir = java.io.File(context.cacheDir, "exports").apply { mkdirs() }
        val f = java.io.File(dir, "ascend-projecao-90-dias.jpg")
        f.outputStream().use { out.compress(Bitmap.CompressFormat.JPEG, 92, it) }
        return f
    }

    // ---- Nuvem ----
    suspend fun syncNow(): String {
        val local = all()
        val pushed = cloud.push(local)
        local.forEach { db.analyses().markSynced(it.id) }
        val remote = cloud.pull()
        val localIds = local.map { it.id }.toSet()
        var added = 0
        remote.filter { it.id !in localIds }.forEach { r ->
            db.analyses().upsert(AnalysisEntity(r.id, r.createdAt, r.overall, r.potential, json.encodeToString(FaceReport.serializer(), r), "", true)); added++
        }
        return "Enviados $pushed relatórios, recebidos $added novos. Fotos ficam só neste aparelho."
    }
}

class AppContainer(context: Context) {
    val settings = SettingsStore(context)
    val db = AscendDatabase.create(context)
    val vault = PhotoVault(context)
    val engine = FaceEngine(context)
    val ai = AiBackendClient(settings)
    val cloud = CloudSync(settings)
    val repo = AnalysisRepository(context, db, vault, settings, engine, ai, cloud)
}
