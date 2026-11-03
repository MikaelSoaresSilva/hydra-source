package com.ascend.faceai

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.analysis.FaceAnalyzer
import com.ascend.faceai.analysis.PlanGenerator
import com.ascend.faceai.data.PdfExporter
import com.ascend.faceai.data.PreparedPhoto
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Testa a visão computacional REAL no Android com uma foto de retrato pública (mediapipe-assets/portrait.jpg).
 * Resultados detalhados vão para o logcat (tag AscendTest) e para files/test-results.txt.
 */
@RunWith(AndroidJUnit4::class)
class FacePipelineTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private val app get() = inst.targetContext.applicationContext as AscendApp
    private val out = StringBuilder()

    private fun log(s: String) { Log.i("AscendTest", s); out.appendLine(s) }
    private fun flush(name: String) {
        val dir = inst.targetContext.getExternalFilesDir("results")!!
        File(dir, "$name.txt").writeText(out.toString())
    }

    private fun portrait(): Bitmap = inst.context.assets.open("portrait.jpg").use { BitmapFactory.decodeStream(it) }

    @Test
    fun realFaceIsDetectedMeasuredAndScored() = runBlocking {
        val c = app.container
        assertTrue("modelos ausentes", c.engine.modelsAvailable())
        val t0 = System.currentTimeMillis()
        val p = c.engine.prepare(portrait(), CaptureType.FRONTAL)
        log("prepare ms=${System.currentTimeMillis() - t0}")
        val q = p.quality
        log("faces=${q.facesDetected} brightness=${q.brightness} balance=${q.lightingBalance} sharp=${q.sharpness} yaw=${q.yawDeg} pitch=${q.pitchDeg} roll=${q.rollDeg} width=${q.faceWidthFraction} obstruction=${q.obstruction} eyesOpen=${q.eyesOpen} ok=${q.ok} score=${q.qualityScore}")
        log("issues=${q.issues} warnings=${q.warnings}")
        assertEquals(1, q.facesDetected)
        assertNotNull(p.frame); assertNotNull(p.crop)
        assertEquals(478, p.frame!!.lm.size)
        assertNotNull("segmentação deveria funcionar", p.frame!!.seg)

        val report = FaceAnalyzer.analyze("test", System.currentTimeMillis(), mapOf(CaptureType.FRONTAL to p.frame!!), mapOf(CaptureType.FRONTAL to q))
        log("overall=${report.overall} potential=${report.potential} conf=${report.overallConfidence} shape=${report.faceShape}")
        log("summary=${report.summary}")
        report.categories.forEach { cat ->
            log("CAT ${cat.id} score=${cat.score} conf=${"%.2f".format(cat.confidence)} available=${cat.available} ${cat.unavailableReason ?: ""}")
            cat.metrics.forEach { m -> log("   ${m.key}: ${m.display} (ref ${m.reference}) -> ${m.score}") }
        }
        assertEquals(11, report.categories.size)
        assertTrue(report.overall in 1..100)
        listOf("harmonia", "simetria", "olhos", "nariz", "mandibula").forEach { id ->
            val s = report.category(id)?.score
            assertNotNull("categoria $id sem nota", s); assertTrue("$id=$s", s!! in 0..100)
        }
        assertTrue(report.categories.all { it.limitations.isNotEmpty() })
        assertTrue(PlanGenerator.generate(report).tasks.size >= 10)
        flush("pipeline")
    }

    @Test
    fun qualityChecks_rejectBadPhotos() {
        val c = app.container
        val base = portrait()
        // Dois rostos lado a lado
        val two = Bitmap.createBitmap(base.width * 2, base.height, Bitmap.Config.ARGB_8888).also {
            Canvas(it).apply { drawBitmap(base, 0f, 0f, null); drawBitmap(base, base.width.toFloat(), 0f, null) }
        }
        val pTwo = c.engine.prepare(two, CaptureType.FRONTAL)
        log("two faces -> faces=${pTwo.quality.facesDetected} issues=${pTwo.quality.issues}")
        assertEquals(2, pTwo.quality.facesDetected); assertTrue(!pTwo.quality.ok)

        // Muito escura
        val dark = Bitmap.createBitmap(base.width, base.height, Bitmap.Config.ARGB_8888).also {
            Canvas(it).drawBitmap(base, 0f, 0f, Paint().apply { colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setScale(0.22f, 0.22f, 0.22f, 1f) }) })
        }
        val pDark = c.engine.prepare(dark, CaptureType.FRONTAL)
        log("dark -> faces=${pDark.quality.facesDetected} brightness=${pDark.quality.brightness} issues=${pDark.quality.issues}")
        assertTrue(pDark.quality.facesDetected != 1 || pDark.quality.issues.any { it.contains("escura") })

        // Desfocada
        val small = Bitmap.createScaledBitmap(base, base.width / 14, base.height / 14, true)
        val blur = Bitmap.createScaledBitmap(small, base.width, base.height, true)
        val pBlur = c.engine.prepare(blur, CaptureType.FRONTAL)
        val pSharp = c.engine.prepare(base, CaptureType.FRONTAL)
        log("blur -> faces=${pBlur.quality.facesDetected} sharp=${pBlur.quality.sharpness} vs original=${pSharp.quality.sharpness} issues=${pBlur.quality.issues}")
        if (pBlur.quality.facesDetected == 1) assertTrue(pBlur.quality.sharpness < pSharp.quality.sharpness * 0.6)

        // Sem rosto
        val empty = Bitmap.createBitmap(800, 1000, Bitmap.Config.ARGB_8888).also { it.eraseColor(0xFF808080.toInt()) }
        val pNone = c.engine.prepare(empty, CaptureType.FRONTAL)
        assertEquals(0, pNone.quality.facesDetected)
        log("no face -> issues=${pNone.quality.issues}")
        flush("quality")
    }

    @Test
    fun saveEncryptHistoryPdfAndDelete() = runBlocking {
        val c = app.container
        c.repo.deleteAllLocal()
        val p = c.engine.prepare(portrait(), CaptureType.FRONTAL)
        val forced = PreparedPhoto(p.type, p.frame, p.crop, p.quality.copy(ok = true, issues = emptyList()))
        val r = c.repo.analyzeAndSave(listOf(forced))
        val all = c.repo.reports.first()
        assertEquals(1, all.size); assertEquals(r.id, all[0].id)
        assertEquals(r.overall, c.repo.get(r.id)!!.overall)

        // Foto guardada criptografada (bytes no disco não são JPEG) e legível pela chave do Keystore
        val raw = File(inst.targetContext.filesDir, "vault/${r.id}_FRONTAL.enc").readBytes()
        assertTrue(!(raw[0] == 0xFF.toByte() && raw[1] == 0xD8.toByte()))
        val photo = c.repo.photo(r.id); assertNotNull(photo)
        log("photo ${photo!!.width}x${photo.height}, enc bytes=${raw.size}")

        // Plano persistente
        c.repo.setTask(r.id, "skin_base", true)
        assertTrue(c.repo.planState(r.id).first().any { it.taskKey == "skin_base" && it.done })

        // Assistente sem backend -> motor local, identificado como tal
        val msg = c.repo.ask("Quais são meus maiores pontos fortes?")
        assertEquals("local", msg.source); assertTrue(msg.text.contains("/100"))
        log("advisor: ${msg.text.take(200)}")

        // PDF
        val pdf = PdfExporter.export(inst.targetContext, r, photo)
        log("pdf size=${pdf.length()}"); assertTrue(pdf.length() > 20_000)

        // Exclusão
        c.repo.delete(r.id)
        assertNull(c.repo.get(r.id)); assertNull(c.repo.photo(r.id))
        assertEquals(0, c.vault.count())
        c.repo.deleteAllLocal()
        assertTrue(c.repo.reports.first().isEmpty())
        flush("storage")
    }
}
