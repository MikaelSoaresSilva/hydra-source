package com.ascend.faceai.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.Cameraswitch
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.LocalScan
import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.data.FaceEngine
import com.ascend.faceai.data.PreparedPhoto
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.onMain
import com.ascend.faceai.ui.components.BulletList
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.GlowOrb
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.SecondaryButton
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.components.TopBar
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

@Composable
fun ScanScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val scan = LocalScan.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var camera by remember { mutableStateOf<CaptureType?>(null) }
    var busy by remember { mutableStateOf<CaptureType?>(null) }
    var pickFor by remember { mutableStateOf(CaptureType.FRONTAL) }
    val modelsOk = remember { c.engine.modelsAvailable() }

    fun process(type: CaptureType, bmp: Bitmap) {
        busy = type
        scope.launch {
            val prepared = withContext(Dispatchers.Default) { runCatching { c.engine.prepare(bmp, type) } }
            prepared.onSuccess { scan.photos[type] = it }.onFailure { Log.e("Ascend", "prepare", it) }
            busy = null
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            val bmp = withContext(Dispatchers.IO) { FaceEngine.decodeUri(ctx, uri) }
            if (bmp != null) process(pickFor, bmp)
        }
    }

    camera?.let { type ->
        CameraCapture(type, onClose = { camera = null }) { bmp -> camera = null; process(type, bmp) }
        return
    }

    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar("Scanner facial", { scan.clear(); nav.popBackStack() })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
            if (!modelsOk) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("Modelos de visão computacional ausentes neste APK.", color = Ac.Bad, style = MaterialTheme.typography.titleMedium)
                    Text("Gere o APK pelo script do projeto, que baixa os modelos do MediaPipe.", color = Ac.TextMid, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(12.dp))
            }
            Text("A foto frontal é obrigatória. As demais deixam a análise de perfil, mandíbula e nariz mais completa.", style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid)
            Spacer(Modifier.height(10.dp))
            GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
                Eyebrow("Para medições precisas")
                BulletList(listOf(
                    "Luz natural de frente (janela), sem sombras fortes.",
                    "Celular na altura dos olhos, a cerca de 1 m — use o zoom 2x se puder.",
                    "Expressão neutra, sem óculos, cabelo fora dos olhos, sem filtros."
                ))
            }
            Spacer(Modifier.height(12.dp))
            CaptureType.entries.forEach { type ->
                SlotCard(type, scan.photos[type], busy == type,
                    onCamera = { camera = type },
                    onGallery = { pickFor = type; picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    onRemove = { scan.photos.remove(type) })
                Spacer(Modifier.height(10.dp))
            }
        }
        val frontOk = scan.photos[CaptureType.FRONTAL]?.quality?.ok == true
        Column(Modifier.padding(18.dp)) {
            if (!frontOk) Text("Envie uma foto frontal aprovada para continuar.", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow, modifier = Modifier.padding(bottom = 8.dp))
            PrimaryButton("Analisar", Modifier.fillMaxWidth().testTag("analyze"), enabled = frontOk && busy == null) { nav.navigate(Routes.PROCESSING) }
        }
    }
}

@Composable
private fun SlotCard(type: CaptureType, p: PreparedPhoto?, busy: Boolean, onCamera: () -> Unit, onGallery: () -> Unit, onRemove: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth().testTag("slot_${type.name}"), padding = 14.dp, highlight = p?.quality?.ok == true) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(64.dp).clip(RoundedCornerShape(14.dp)).background(Ac.SurfaceHi), contentAlignment = Alignment.Center) {
                when {
                    busy -> CircularProgressIndicator(Modifier.size(24.dp), color = Ac.Cyan, strokeWidth = 2.dp)
                    p?.crop != null -> Image(p.crop.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    else -> HeadGuide(type, Modifier.size(44.dp))
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(type.label, style = MaterialTheme.typography.titleMedium, color = Ac.TextHi)
                    Spacer(Modifier.width(8.dp))
                    if (type == CaptureType.FRONTAL) Tag("obrigatória", Ac.Blue) else Tag("opcional")
                }
                Text(type.instruction, style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            }
        }
        if (p != null) {
            Spacer(Modifier.height(10.dp))
            val q = p.quality
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (q.ok) Icons.Outlined.CheckCircle else Icons.Outlined.ErrorOutline, null, tint = if (q.ok) Ac.Good else Ac.Bad, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(if (q.ok) "Foto aprovada · qualidade ${(q.qualityScore * 100).toInt()}%" else "Repita a foto", style = MaterialTheme.typography.titleSmall, color = if (q.ok) Ac.Good else Ac.Bad)
            }
            if (q.issues.isNotEmpty()) BulletList(q.issues, Ac.TextHi, Ac.Bad)
            if (q.warnings.isNotEmpty()) BulletList(q.warnings, Ac.TextMid, Ac.Warn)
            if (q.facesDetected == 1) Text("Brilho ${q.brightness.toInt()} · nitidez ${q.sharpness.toInt()} · rotação ${q.yawDeg.toInt()}° · inclinação ${q.rollDeg.toInt()}°",
                style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SecondaryButton(if (p == null) "Câmera" else "Repetir", Modifier.weight(1f).testTag("cam_${type.name}"), onClick = onCamera)
            SecondaryButton("Galeria", Modifier.weight(1f).testTag("gal_${type.name}"), onClick = onGallery)
            if (p != null) SecondaryButton("Remover", Modifier.weight(1f), onClick = onRemove)
        }
    }
}

/** Ícone-guia de posição da cabeça (vista de cima: direção do nariz). */
@Composable
fun HeadGuide(type: CaptureType, modifier: Modifier) {
    Canvas(modifier) {
        val c = Offset(size.width / 2, size.height / 2); val r = size.minDimension * 0.36f
        drawOval(Ac.Metal, Offset(c.x - r * 0.8f, c.y - r), Size(r * 1.6f, r * 2f), style = Stroke(2.dp.toPx()))
        val dx = when (type) { CaptureType.FRONTAL -> 0f; CaptureType.ANGLE45 -> 0.45f; CaptureType.PROFILE_LEFT -> -0.8f; CaptureType.PROFILE_RIGHT -> 0.8f }
        drawCircle(Ac.Cyan, 3.dp.toPx(), Offset(c.x + dx * r, c.y + r * 0.1f))
        drawLine(Ac.Cyan, Offset(c.x + dx * r * 0.4f - r * 0.3f, c.y - r * 0.25f), Offset(c.x + dx * r * 0.4f - r * 0.05f, c.y - r * 0.25f), 2.dp.toPx())
        drawLine(Ac.Cyan, Offset(c.x + dx * r * 0.4f + r * 0.05f, c.y - r * 0.25f), Offset(c.x + dx * r * 0.4f + r * 0.3f, c.y - r * 0.25f), 2.dp.toPx())
    }
}

@Composable
fun CameraCapture(type: CaptureType, onClose: () -> Unit, onCaptured: (Bitmap) -> Unit) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val c = LocalContainer.current
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    LaunchedEffect(Unit) { if (!granted) perm.launch(Manifest.permission.CAMERA) }
    var front by remember { mutableStateOf(true) }
    var hint by remember { mutableStateOf("Posicione o rosto dentro do guia") }
    var ready by remember { mutableStateOf(false) }
    var capturing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val capture = remember { ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY).build() }
    val exec = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) { onDispose { exec.shutdown() } }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (granted) {
            val previewView = remember { PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
            AndroidView({ previewView }, Modifier.fillMaxSize())
            DisposableEffect(front) {
                val providerFuture = ProcessCameraProvider.getInstance(ctx)
                var provider: ProcessCameraProvider? = null
                providerFuture.addListener({
                    runCatching {
                        provider = providerFuture.get()
                        val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                        val last = AtomicLong(0)
                        val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888).build()
                        analysis.setAnalyzer(exec) { img: ImageProxy ->
                            val now = System.currentTimeMillis()
                            if (now - last.get() > 350) {
                                last.set(now)
                                runCatching {
                                    val bmp = FaceEngine.rotate(img.toBitmap(), img.imageInfo.rotationDegrees)
                                    val h = c.engine.liveHint(bmp, type)
                                    hint = h.message; ready = h.ready
                                }
                            }
                            img.close()
                        }
                        val selector = if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                        provider?.unbindAll()
                        provider?.bindToLifecycle(owner, selector, preview, capture, analysis)
                    }.onFailure { error = "Não foi possível abrir a câmera: ${it.message}" }
                }, ContextCompat.getMainExecutor(ctx))
                onDispose { runCatching { provider?.unbindAll() } }
            }
            GuideOverlay(type, ready)
        } else {
            Column(Modifier.align(Alignment.Center).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Permissão de câmera necessária", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
                Text("Você também pode escolher uma foto da galeria.", color = Ac.TextMid)
                Spacer(Modifier.height(12.dp))
                PrimaryButton("Permitir câmera", Modifier.fillMaxWidth()) { perm.launch(Manifest.permission.CAMERA) }
            }
        }
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) { Icon(Icons.Outlined.Close, "Fechar", tint = Color.White) }
            Column(Modifier.weight(1f)) {
                Eyebrow(type.label, Ac.Cyan)
                Text(type.instruction, style = MaterialTheme.typography.bodySmall, color = Color.White)
            }
            IconButton(onClick = { front = !front }) { Icon(Icons.Outlined.Cameraswitch, "Trocar câmera", tint = Color.White) }
        }
        Column(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.55f)).padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(error ?: hint, color = if (ready) Ac.Good else Color.White, style = MaterialTheme.typography.titleSmall)
            }
            Spacer(Modifier.height(18.dp))
            Box(
                Modifier.size(78.dp).clip(CircleShape).border(4.dp, if (ready) Ac.Good else Color.White, CircleShape).padding(7.dp).clip(CircleShape)
                    .background(if (capturing) Ac.Metal else Color.White).testTag("shutter")
                    .clickable(enabled = granted && !capturing) {
                        capturing = true
                        capture.takePicture(exec, object : ImageCapture.OnImageCapturedCallback() {
                            override fun onCaptureSuccess(image: ImageProxy) {
                                val bmp = FaceEngine.rotate(image.toBitmap(), image.imageInfo.rotationDegrees)
                                image.close()
                                ContextCompat.getMainExecutor(ctx).execute { capturing = false; onCaptured(bmp) }
                            }
                            override fun onError(exception: ImageCaptureException) {
                                ContextCompat.getMainExecutor(ctx).execute { capturing = false; error = "Falha ao capturar: ${exception.message}" }
                            }
                        })
                    }
            )
            Spacer(Modifier.height(6.dp))
            Text("Você pode capturar mesmo sem o aviso verde; a foto será verificada depois.", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun GuideOverlay(type: CaptureType, ready: Boolean) {
    val t = rememberInfiniteTransition(label = "scan")
    val y by t.animateFloat(0f, 1f, infiniteRepeatable(tween(2200), RepeatMode.Reverse), label = "y")
    Canvas(Modifier.fillMaxSize()) {
        val w = size.width * 0.68f; val h = w * 1.32f
        val left = (size.width - w) / 2; val top = size.height * 0.42f - h / 2
        val oval = Path().apply { addOval(androidx.compose.ui.geometry.Rect(left, top, left + w, top + h)) }
        val full = Path().apply { addRect(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height)) }
        drawPath(Path.combine(androidx.compose.ui.graphics.PathOperation.Difference, full, oval), Color.Black.copy(alpha = 0.55f))
        drawPath(oval, if (ready) Ac.Good else Ac.Cyan, style = Stroke(2.5.dp.toPx(), pathEffect = if (ready) null else PathEffect.dashPathEffect(floatArrayOf(18f, 12f))))
        // linha de varredura
        val sy = top + h * y
        drawLine(Ac.Blue.copy(alpha = 0.6f), Offset(left + w * 0.1f, sy), Offset(left + w * 0.9f, sy), 2.dp.toPx())
        // linhas-guia de olhos e queixo (frontal)
        if (type == CaptureType.FRONTAL) {
            drawLine(Color.White.copy(alpha = 0.25f), Offset(left + w * 0.15f, top + h * 0.42f), Offset(left + w * 0.85f, top + h * 0.42f), 1.dp.toPx())
            drawLine(Color.White.copy(alpha = 0.25f), Offset(size.width / 2, top + h * 0.1f), Offset(size.width / 2, top + h * 0.95f), 1.dp.toPx())
        }
    }
}

@Composable
fun ProcessingScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val scan = LocalScan.current
    val steps = remember { mutableStateListOf<String>() }
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(attempt) {
        error = null; steps.clear()
        steps += "Verificando qualidade das fotos"
        val photos = scan.photos.values.toList()
        steps += "Pontos faciais e segmentação: ${photos.count { it.quality.ok }} foto(s) aprovada(s)"
        val result = runCatching { c.repo.analyzeAndSave(photos) { s -> steps += s } }
        result.onSuccess { r ->
            onMain {
                steps += "Concluído"
                scan.clear()
                nav.navigate(Routes.report(r.id)) { popUpTo(Routes.HOME) }
            }
        }.onFailure { error = it.message ?: it.toString(); Log.e("Ascend", "analysis", it) }
    }
    Box(Modifier.fillMaxSize().background(Ac.Bg), contentAlignment = Alignment.Center) {
        GlowOrb(Modifier.size(300.dp))
        Column(Modifier.padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (error == null) "Analisando…" else "Falha na análise", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
            Spacer(Modifier.height(16.dp))
            steps.forEach { Text("✓  $it", style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid) }
            error?.let {
                Spacer(Modifier.height(12.dp)); Text(it, color = Ac.Bad, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(12.dp)); PrimaryButton("Tentar novamente", Modifier.fillMaxWidth()) { attempt++ }
                Spacer(Modifier.height(8.dp)); SecondaryButton("Voltar", Modifier.fillMaxWidth()) { nav.popBackStack() }
            }
        }
    }
}
