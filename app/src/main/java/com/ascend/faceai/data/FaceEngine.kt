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
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
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
    /**
     * Segmentação multiclasse (cabelo, pele, fundo...) com o modelo selfie_multiclass do MediaPipe executado
     * diretamente pelo TensorFlow Lite na CPU. Assim funciona em qualquer aparelho, inclusive sem GPU compatível.
     */
    private val segInterpreter: Interpreter? by lazy {
        runCatching {
            val fd = context.assets.openFd(MODEL_SEG)
            val buf = FileInputStream(fd.fileDescriptor).channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
            Interpreter(buf, Interpreter.Options().setNumThreads(4))
        }.onFailure { android.util.Log.e("Ascend", "segmenter init failed", it) }.getOrNull()
    }

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
        // Padroniza a escala: rosto com ~380 px de largura, para que textura e manchas sejam comparáveis entre fotos.
        val scale = (380.0 / fw).coerceIn(0.25, 3.0)
        val outW = max(1, (cw * scale).toInt()); val outH = max(1, (ch * scale).toInt())
        val crop = Bitmap.createScaledBitmap(Bitmap.createBitmap(bmp, l, t, cw, ch), outW, outH, true)
        val px = IntArray(outW * outH).also { crop.getPixels(it, 0, outW, 0, 0, outW, outH) }
        val lm = raw.map { P((it.x - l) * scale, (it.y - t) * scale, it.z * scale) }

        val seg = runCatching { segment(crop) }.onFailure { android.util.Log.e("Ascend", "segmentation failed", it) }.getOrNull()

        val frame = FaceFrame(outW, outH, px, lm, seg, 1, blend, matrix, widthFrac, cOff)
        return PreparedPhoto(type, frame, crop, QualityChecker.check(frame, type))
    }

    /** Segmenta o recorte do rosto: devolve a classe (0..5) de cada pixel do recorte. */
    private fun segment(crop: Bitmap): ByteArray? {
        val itp = segInterpreter ?: return null
        val n = SEG_SIZE
        val small = Bitmap.createScaledBitmap(crop, n, n, true)
        val px = IntArray(n * n).also { small.getPixels(it, 0, n, 0, 0, n, n) }
        val input = ByteBuffer.allocateDirect(n * n * 3 * 4).order(ByteOrder.nativeOrder())
        for (c in px) {
            input.putFloat(((c shr 16) and 0xFF) / 255f); input.putFloat(((c shr 8) and 0xFF) / 255f); input.putFloat((c and 0xFF) / 255f)
        }
        input.rewind()
        val output = ByteBuffer.allocateDirect(n * n * 6 * 4).order(ByteOrder.nativeOrder())
        synchronized(itp) { itp.run(input, output) }
        output.rewind()
        val fb = output.asFloatBuffer()
        val cls = ByteArray(n * n)
        for (i in 0 until n * n) {
            var best = 0; var bv = fb.get(i * 6)
            for (k in 1 until 6) { val v = fb.get(i * 6 + k); if (v > bv) { bv = v; best = k } }
            cls[i] = best.toByte()
        }
        val w = crop.width; val h = crop.height
        val out = ByteArray(w * h)
        for (y in 0 until h) {
            val sy = (y * n / h).coerceIn(0, n - 1)
            for (x in 0 until w) out[y * w + x] = cls[sy * n + (x * n / w).coerceIn(0, n - 1)]
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
        const val SEG_SIZE = 256

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
