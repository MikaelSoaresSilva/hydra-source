package com.ascend.faceai.analysis

import kotlinx.serialization.Serializable

@Serializable
enum class CaptureType(val label: String, val instruction: String) {
    FRONTAL("Frontal", "Olhe direto para a câmera, rosto neutro, sem sorrir, cabelo fora dos olhos."),
    ANGLE45("45 graus", "Gire a cabeça cerca de 45° para o lado, mantendo o queixo reto."),
    PROFILE_LEFT("Perfil esquerdo", "Vire a cabeça até a câmera ver apenas o lado esquerdo do rosto."),
    PROFILE_RIGHT("Perfil direito", "Vire a cabeça até a câmera ver apenas o lado direito do rosto.")
}

@Serializable
enum class Modifiability(val label: String) {
    LOW("Pouco modificável"),
    SELF_CARE("Modificável por cuidados pessoais"),
    GROOMING("Modificável por penteado e grooming"),
    PROFESSIONAL("Depende de avaliação profissional")
}

@Serializable
data class MetricResult(
    val key: String,
    val label: String,
    val value: Double,
    val display: String,
    val reference: String,
    /** null = métrica apenas descritiva (não entra na nota). */
    val score: Double? = null,
    val note: String = ""
)

@Serializable
data class CategoryResult(
    val id: String,
    val name: String,
    val score: Int? = null,
    val confidence: Double = 0.0,
    val justification: String = "",
    val contributors: List<String> = emptyList(),
    val strengths: List<String> = emptyList(),
    val opportunities: List<String> = emptyList(),
    val limitations: List<String> = emptyList(),
    val recommendations: List<String> = emptyList(),
    val modifiability: List<Modifiability> = emptyList(),
    val metrics: List<MetricResult> = emptyList(),
    /** Posição da região na foto (0..1) para o mapa interativo. */
    val regionX: Double? = null,
    val regionY: Double? = null,
    val available: Boolean = true,
    val unavailableReason: String? = null
)

@Serializable
data class QualityResult(
    val facesDetected: Int,
    val brightness: Double = 0.0,
    val lightingBalance: Double = 0.0,
    val sharpness: Double = 0.0,
    val yawDeg: Double = 0.0,
    val pitchDeg: Double = 0.0,
    val rollDeg: Double = 0.0,
    val faceWidthFraction: Double = 0.0,
    val centerOffset: Double = 0.0,
    val eyesOpen: Boolean = true,
    val obstruction: Double = 0.0,
    val issues: List<String> = emptyList(),
    val warnings: List<String> = emptyList(),
    val ok: Boolean = false,
    /** 0..1 — usado para ponderar a confiança das métricas. */
    val qualityScore: Double = 0.0
)

@Serializable
data class PhotoResult(
    val type: CaptureType,
    val quality: QualityResult,
    val used: Boolean
)

@Serializable
data class FaceReport(
    val id: String,
    val createdAt: Long,
    val methodologyVersion: Int = 1,
    val overall: Int,
    val potential: Int,
    val overallConfidence: Double,
    val faceShape: String,
    val faceShapeExplanation: String,
    val summary: String,
    val categories: List<CategoryResult>,
    val strengths: List<String>,
    val improvements: List<String>,
    val photos: List<PhotoResult>,
    val descriptive: List<MetricResult>,
    val profileAvailable: Boolean,
    val beardDetected: Boolean,
    /** Landmarks normalizados (x0,y0,x1,y1,...) da foto frontal recortada, para o mapa. */
    val frontalLandmarks: List<Float> = emptyList(),
    val lowModifiable: List<String> = emptyList(),
    val selfCareModifiable: List<String> = emptyList(),
    val groomingModifiable: List<String> = emptyList(),
    val professionalDependent: List<String> = emptyList()
) {
    fun category(id: String) = categories.firstOrNull { it.id == id }
}

/** Imagem já recortada em torno do rosto, com landmarks em pixels e máscara de segmentação opcional. */
class FaceFrame(
    val w: Int,
    val h: Int,
    val argb: IntArray,
    val lm: List<P>,
    /** Categoria por pixel: 0 fundo, 1 cabelo, 2 pele do corpo, 3 pele do rosto, 4 roupa, 5 acessórios/outros. */
    val seg: ByteArray?,
    val facesDetected: Int,
    val blendshapes: Map<String, Float> = emptyMap(),
    val matrix: FloatArray? = null,
    /** Fração da largura da foto original ocupada pelo rosto e deslocamento do centro (para qualidade). */
    val faceWidthFraction: Double = 0.5,
    val centerOffset: Double = 0.0
) {
    fun segAt(x: Int, y: Int): Int {
        val s = seg ?: return -1
        if (x < 0 || y < 0 || x >= w || y >= h) return -1
        return s[y * w + x].toInt() and 0xFF
    }
}

object SegClass {
    const val BACKGROUND = 0
    const val HAIR = 1
    const val BODY_SKIN = 2
    const val FACE_SKIN = 3
    const val CLOTHES = 4
    const val OTHERS = 5
}
