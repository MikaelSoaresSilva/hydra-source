package com.ascend.faceai.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.analysis.FaceFrame
import com.ascend.faceai.analysis.LM
import com.ascend.faceai.analysis.P
import com.ascend.faceai.analysis.PoseEstimator
import com.ascend.faceai.analysis.QualityChecker
import com.ascend.faceai.analysis.QualityResult
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/** Resultado do preparo de uma foto: recorte pronto para análise + checagem de qualidade. */
class PreparedPhoto(val type: CaptureType, val frame: FaceFrame?, val crop: Bitmap?, val quality: QualityResult)

data class LiveHint(val message: String, val ready: Boolean, val faces: Int)

/**
 * Visão computacional 100% local (sem internet): MediaPipe Face Landmarker (478 pontos 3D,
 * blendshapes e matriz de pose) + MediaPipe Image Segmenter multiclasse (cabelo, pele, fundo...).
 */
class FaceEngine(private val context: Context) {

    private fun landmarkerOf(numFaces: Int): FaceLandmarker = FaceLandmarker.createFromOptions(
        context,
        FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL_FACE).build())
            .setRunningMode(RunningMode.IMAGE)
            .setNumFaces(numFaces)
            .setMinFaceDetectionConfidence(0.5f)
            .setMinFacePresenceConfidence(0.5f)
            .setOutputFaceBlendshapes(true)
            .setOutputFacialTransformationMatrixes(true)
            .build()
    )

    private val landmarker by lazy { landmarkerOf(3) }
    private val liveLandmarker by lazy { landmarkerOf(2) }
    private val segmenter: ImageSegmenter? by lazy {
        runCatching {
            ImageSegmenter.createFromOptions(
                context,
                ImageSegmenter.ImageSegmenterOptions.builder()
                    .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL_SEG).build())
                    .setRunningMode(RunningMode.IMAGE)
                    .setOutputCategoryMask(true)
                    .setOutputConfidenceMasks(false)
                    .build()
            )
        }.getOrNull()
    }

    /** Verifica modelos E biblioteca nativa (evita fechar o app em processadores sem suporte). */
    fun modelsAvailable(): Boolean = runCatching {
        context.assets.open(MODEL_FACE).close()
        synchronized(this) { landmarker }
        true
    }.getOrDefault(false)

    @Synchronized
    private fun detect(bmp: Bitmap): FaceLandmarkerResult = landmarker.detect(BitmapImageBuilder(bmp).build())

    @Synchronized
    fun prepare(source: Bitmap, type: CaptureType): PreparedPhoto {
        val bmp = ensureArgb(limit(source, 1600))
        val res = detect(bmp)
        val faces = res.faceLandmarks().size
        if (faces != 1) return PreparedPhoto(type, null, null, QualityChecker.noFace(faces))

        val raw = res.faceLandmarks()[0].map { P(it.x() * bmp.width.toDouble(), it.y() * bmp.height.toDouble(), it.z() * bmp.width.toDouble()) }
        val blend = res.faceBlendshapes().orElse(null)?.firstOrNull()?.associate { it.categoryName() to it.score() } ?: emptyMap()
        val matrix = res.facialTransformationMatrixes().orElse(null)?.firstOrNull()

        val ovalPts = LM.FACE_OVAL.map { raw[it] }
        val minX = ovalPts.minOf { it.x }; val maxX = ovalPts.maxOf { it.x }
        val minY = ovalPts.minOf { it.y }; val maxY = ovalPts.maxOf { it.y }
        val fw = maxX - minX; val fh = maxY - minY
        val widthFrac = fw / bmp.width
        val cOff = hypot((minX + maxX) / 2 - bmp.width / 2.0, (minY + maxY) / 2 - bmp.height / 2.0) / bmp.width

        val l = max(0, (minX - fw * 0.45).toInt()); val r = min(bmp.width, (maxX + fw * 0.45).toInt())
        val t = max(0, (minY - fh * 0.80).toInt()); val b = min(bmp.height, (maxY + fh * 0.25).toInt())
        val cw = r - l; val ch = b - t
        val scale = min(1.0, 720.0 / cw)
        val outW = max(1, (cw * scale).toInt()); val outH = max(1, (ch * scale).toInt())
        val crop = Bitmap.createScaledBitmap(Bitmap.createBitmap(bmp, l, t, cw, ch), outW, outH, true)
        val px = IntArray(outW * outH).also { crop.getPixels(it, 0, outW, 0, 0, outW, outH) }
        val lm = raw.map { P((it.x - l) * scale, (it.y - t) * scale, it.z * scale) }

        val seg = runCatching { segment(bmp, l, t, scale, outW, outH) }.getOrNull()

        val frame = FaceFrame(outW, outH, px, lm, seg, 1, blend, matrix, widthFrac, cOff)
        return PreparedPhoto(type, frame, crop, QualityChecker.check(frame, type))
    }

    private fun segment(bmp: Bitmap, l: Int, t: Int, scale: Double, outW: Int, outH: Int): ByteArray? {
        val s = segmenter ?: return null
        val result = s.segment(BitmapImageBuilder(bmp).build())
        val mask = result.categoryMask().orElse(null) ?: return null
        val mw = mask.width; val mh = mask.height
        val buf = ByteBufferExtractor.extract(mask)
        val all = ByteArray(buf.remaining()).also { buf.get(it) }
        val sx = mw.toDouble() / bmp.width; val sy = mh.toDouble() / bmp.height
        val out = ByteArray(outW * outH)
        for (y in 0 until outH) {
            val oy = ((t + y / scale) * sy).toInt().coerceIn(0, mh - 1)
            for (x in 0 until outW) {
                val ox = ((l + x / scale) * sx).toInt().coerceIn(0, mw - 1)
                out[y * outW + x] = all[oy * mw + ox]
            }
        }
        return out
    }

    /** Guia ao vivo durante a câmera: pose, tamanho e enquadramento em tempo real. */
    @Synchronized
    fun liveHint(frame: Bitmap, type: CaptureType): LiveHint {
        val bmp = ensureArgb(limit(frame, 480))
        val res = runCatching { liveLandmarker.detect(BitmapImageBuilder(bmp).build()) }.getOrNull() ?: return LiveHint("Preparando detector…", false, 0)
        val n = res.faceLandmarks().size
        if (n == 0) return LiveHint("Posicione o rosto dentro do guia", false, 0)
        if (n > 1) return LiveHint("Mais de um rosto na imagem", false, n)
        val lm = res.faceLandmarks()[0].map { P(it.x() * bmp.width.toDouble(), it.y() * bmp.height.toDouble()) }
        val matrix = res.facialTransformationMatrixes().orElse(null)?.firstOrNull()
        val pose = PoseEstimator.estimate(lm, matrix)
        val oval = LM.FACE_OVAL.map { lm[it] }
        val w = (oval.maxOf { it.x } - oval.minOf { it.x }) / bmp.width
        val cx = (oval.maxOf { it.x } + oval.minOf { it.x }) / 2 / bmp.width
        var luma = 0.0; var c = 0
        for (y in bmp.height / 3 until bmp.height * 2 / 3 step 6) for (x in bmp.width / 3 until bmp.width * 2 / 3 step 6) {
            val p = bmp.getPixel(x, y); luma += 0.299 * ((p shr 16) and 255) + 0.587 * ((p shr 8) and 255) + 0.114 * (p and 255); c++
        }
        luma /= max(1, c)
        val ay = abs(pose.yawDeg)
        val msg = when {
            luma < 55 -> "Ambiente escuro — procure mais luz"
            w < 0.28 -> "Aproxime o rosto"
            w > 0.85 -> "Afaste um pouco"
            abs(cx - 0.5) > 0.18 -> "Centralize o rosto"
            type == CaptureType.FRONTAL && ay > 8 -> "Olhe direto para a câmera"
            type == CaptureType.FRONTAL && abs(pose.rollDeg) > 6 -> "Deixe a cabeça reta"
            type == CaptureType.ANGLE45 && ay < 28 -> "Gire mais a cabeça (≈45°)"
            type == CaptureType.ANGLE45 && ay > 60 -> "Gire um pouco menos"
            (type == CaptureType.PROFILE_LEFT || type == CaptureType.PROFILE_RIGHT) && ay < 45 -> "Gire mais, até ficar de perfil"
            else -> null
        }
        return if (msg == null) LiveHint("Perfeito — pode capturar", true, 1) else LiveHint(msg, false, 1)
    }

    companion object {
        const val MODEL_FACE = "face_landmarker.task"
        const val MODEL_SEG = "selfie_multiclass.tflite"

        fun limit(b: Bitmap, maxSide: Int): Bitmap {
            val m = max(b.width, b.height)
            if (m <= maxSide) return b
            val s = maxSide.toDouble() / m
            return Bitmap.createScaledBitmap(b, (b.width * s).toInt(), (b.height * s).toInt(), true)
        }

        fun ensureArgb(b: Bitmap): Bitmap = if (b.config == Bitmap.Config.ARGB_8888) b else b.copy(Bitmap.Config.ARGB_8888, false)

        fun rotate(b: Bitmap, degrees: Int, mirror: Boolean = false): Bitmap {
            if (degrees == 0 && !mirror) return b
            val m = Matrix().apply { postRotate(degrees.toFloat()); if (mirror) postScale(-1f, 1f) }
            return Bitmap.createBitmap(b, 0, 0, b.width, b.height, m, true)
        }

        /** Lê uma imagem da galeria respeitando a rotação EXIF e reduzindo o tamanho. */
        fun decodeUri(context: Context, uri: Uri, maxSide: Int = 1600): Bitmap? {
            val cr = context.contentResolver
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
            if (opts.outWidth <= 0) return null
            var sample = 1
            while (max(opts.outWidth, opts.outHeight) / (sample * 2) >= maxSide) sample *= 2
            val bmp = cr.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 })
            } ?: return null
            val orientation = runCatching { cr.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) } }.getOrNull()
                ?: ExifInterface.ORIENTATION_NORMAL
            val deg = when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90; ExifInterface.ORIENTATION_ROTATE_180 -> 180; ExifInterface.ORIENTATION_ROTATE_270 -> 270; else -> 0
            }
            return limit(rotate(bmp, deg, orientation == ExifInterface.ORIENTATION_FLIP_HORIZONTAL), maxSide)
        }
    }
}
