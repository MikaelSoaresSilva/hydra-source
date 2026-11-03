package com.ascend.faceai

import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.analysis.CategoryResult
import com.ascend.faceai.analysis.FaceAnalyzer
import com.ascend.faceai.analysis.FaceReport
import com.ascend.faceai.analysis.LocalAdvisor
import com.ascend.faceai.analysis.MetricResult
import com.ascend.faceai.analysis.Midline
import com.ascend.faceai.analysis.P
import com.ascend.faceai.analysis.PixelOps
import com.ascend.faceai.analysis.PlanGenerator
import com.ascend.faceai.analysis.angleDeg
import com.ascend.faceai.analysis.closeness
import com.ascend.faceai.analysis.higherIsBetter
import com.ascend.faceai.analysis.lowerIsBetter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class AnalysisUnitTest {

    @Test fun closeness_isGaussian() {
        assertEquals(100.0, closeness(1.0, 1.0, 0.1), 1e-9)
        assertEquals(60.65, closeness(1.1, 1.0, 0.1), 0.01)
        assertEquals(13.53, closeness(1.2, 1.0, 0.1), 0.01)
        assertEquals(100.0, lowerIsBetter(0.5, 1.0, 1.0), 1e-9)
        assertEquals(100.0, higherIsBetter(2.0, 1.0, 1.0), 1e-9)
        assertTrue(lowerIsBetter(3.0, 1.0, 1.0) < 20)
    }

    @Test fun midline_reflectsAcrossVerticalLine() {
        val ml = Midline(listOf(P(50.0, 0.0), P(50.0, 50.0), P(50.0, 100.0)))
        val r = ml.reflect(P(40.0, 30.0))
        assertEquals(60.0, r.x, 1e-6); assertEquals(30.0, r.y, 1e-6)
        assertEquals(-10.0, ml.offset(P(40.0, 10.0)), 1e-6)
    }

    @Test fun midline_reflectsAcrossTiltedLine() {
        // linha x = y  -> reflexão troca coordenadas
        val ml = Midline(listOf(P(0.0, 0.0), P(10.0, 10.0), P(20.0, 20.0)))
        val r = ml.reflect(P(10.0, 0.0))
        assertEquals(0.0, r.x, 1e-6); assertEquals(10.0, r.y, 1e-6)
    }

    @Test fun angle_rightAngle() = assertEquals(90.0, angleDeg(P(1.0, 0.0), P(0.0, 0.0), P(0.0, 1.0)), 1e-9)

    @Test fun polygonFill_squareArea() {
        val m = PixelOps.polygonMask(100, 100, listOf(P(10.0, 10.0), P(60.0, 10.0), P(60.0, 60.0), P(10.0, 60.0)))
        assertEquals(2500.0, PixelOps.count(m).toDouble(), 120.0)
    }

    @Test fun components_countsBlobs() {
        val w = 20; val h = 20
        val m = BooleanArray(w * h)
        for (y in 2..4) for (x in 2..4) m[y * w + x] = true
        for (y in 10..11) for (x in 10..15) m[y * w + x] = true
        val sizes = PixelOps.componentSizes(m, w, h).sorted()
        assertEquals(listOf(9, 12), sizes)
    }

    @Test fun laplacian_detectsBlur() {
        val w = 64; val h = 64
        val sharp = DoubleArray(w * h) { if (((it % w) / 4 + (it / w) / 4) % 2 == 0) 200.0 else 40.0 }
        val blurred = PixelOps.boxBlur(sharp, w, h, 3)
        val vs = PixelOps.laplacianVariance(sharp, w, h, null)
        val vb = PixelOps.laplacianVariance(blurred, w, h, null)
        assertTrue("nitidez $vs deve ser > $vb", vs > vb * 5)
    }

    @Test fun boxBlur_preservesMean() {
        val w = 30; val h = 30
        val src = DoubleArray(w * h) { (it * 37 % 255).toDouble() }
        val b = PixelOps.boxBlur(src, w, h, 2)
        assertEquals(src.average(), b.average(), 3.0)
    }

    @Test fun lab_whiteAndRed() {
        val t = DoubleArray(3)
        PixelOps.toLab(0xFFFFFFFF.toInt(), t); assertEquals(100.0, t[0], 0.5); assertTrue(abs(t[1]) < 1)
        PixelOps.toLab(0xFFFF0000.toInt(), t); assertEquals(53.2, t[0], 1.0); assertEquals(80.1, t[1], 1.5)
    }

    @Test fun faceShape_rules() {
        assertEquals("Redondo", FaceAnalyzer.classifyShape(1.15, 0.80, 0.90, true))
        assertEquals("Quadrado", FaceAnalyzer.classifyShape(1.15, 0.92, 0.90, true))
        assertEquals("Oval", FaceAnalyzer.classifyShape(1.35, 0.85, 0.88, true))
        assertEquals("Oblongo", FaceAnalyzer.classifyShape(1.55, 0.82, 0.90, true))
        assertEquals("Triangular", FaceAnalyzer.classifyShape(1.35, 0.98, 0.84, true))
    }

    private fun fakeReport(id: String, t: Long, skin: Int, hair: Int): FaceReport {
        val cats = listOf(
            CategoryResult("pele", "Qualidade visual da pele", skin, 0.5, metrics = listOf(MetricResult("spots", "Pontos", 12.0, "4 pontos", "Poucos", 40.0))),
            CategoryResult("cabelo", "Cabelo e enquadramento", hair, 0.5, recommendations = listOf("Teste")),
            CategoryResult("harmonia", "Harmonia facial", 80, 0.7)
        )
        return FaceReport(id, t, overall = (skin + hair + 80) / 3, potential = 8, overallConfidence = 0.6, faceShape = "Oval",
            faceShapeExplanation = "", summary = "resumo", categories = cats, strengths = emptyList(), improvements = emptyList(),
            photos = emptyList(), descriptive = emptyList(), profileAvailable = false, beardDetected = false)
    }

    @Test fun advisor_usesRealNumbers() {
        val a = fakeReport("a", 1_000L, 50, 60)
        val b = fakeReport("b", 2_000_000_000L, 62, 70)
        val ans = LocalAdvisor.answer("O que mudou desde minha primeira análise?", listOf(a, b))
        assertTrue(ans, ans.contains("+12"))
        val strong = LocalAdvisor.answer("Quais são meus maiores pontos fortes?", listOf(b))
        assertTrue(strong.contains("Harmonia facial — 80"))
        assertTrue(LocalAdvisor.answer("x", emptyList()).contains("Ainda não há análises"))
    }

    @Test fun plan_hasAllPhasesAndFieldsAndReactsToMetrics() {
        val plan = PlanGenerator.generate(fakeReport("a", 1L, 40, 50))
        listOf(7, 30, 60, 90).forEach { assertTrue("fase $it vazia", plan.phase(it).isNotEmpty()) }
        assertTrue(plan.tasks.all { it.description.isNotBlank() && it.frequency.isNotBlank() && it.cautions.isNotBlank() && it.cost.isNotBlank() })
        assertTrue("spots=12 deve gerar tarefa de acne", plan.tasks.any { it.key == "acne" })
        assertEquals(plan.tasks.size, plan.tasks.map { it.key }.toSet().size)
    }

    @Test fun captureTypes_haveInstructions() = CaptureType.entries.forEach { assertTrue(it.instruction.length > 10) }
}
