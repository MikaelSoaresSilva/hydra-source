package com.aurea.fit.ui.screens

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.aurea.fit.data.MeasurementEntity
import com.aurea.fit.data.PhotoEntity
import com.aurea.fit.data.today
import com.aurea.fit.domain.ExerciseLibrary
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.components.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** 14. Minha evolução. */
@Composable
fun EvolutionScreen(vm: AppViewModel, nav: (String) -> Unit) {
    val ms by vm.measurements.collectAsState()
    val photos by vm.photos.collectAsState()
    val sessions by vm.sessions.collectAsState()
    var adding by remember { mutableStateOf(false) }
    var photoNote by remember { mutableStateOf("") }
    var viewing by remember { mutableStateOf<PhotoEntity?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) vm.addPhoto(uri, photoNote) { ok -> message = if (ok) "Foto salva com privacidade no aparelho." else "Não foi possível salvar a foto." }
    }
    val first = ms.firstOrNull(); val last = ms.lastOrNull()
    fun delta(sel: (MeasurementEntity) -> Double?): String {
        val a = ms.firstNotNullOfOrNull(sel); val b = ms.lastOrNull { sel(it) != null }?.let(sel)
        if (a == null || b == null) return "—"
        val d = b - a
        return (if (d > 0) "+" else "") + fmt1(d)
    }
    Scaffold(
        topBar = { AureaTopBar("Minha evolução", actions = { IconButton(onClick = { nav("charts") }) { Icon(Icons.Default.ShowChart, "Gráficos de progresso") } }) },
        floatingActionButton = { ExtendedFloatingActionButton(onClick = { adding = true }, icon = { Icon(Icons.Default.Add, null) }, text = { Text("Registrar medidas") }, modifier = Modifier.testTag("addMeasure")) },
        snackbarHost = {
            val host = remember { SnackbarHostState() }
            LaunchedEffect(message) { message?.let { host.showSnackbar(it); message = null } }
            SnackbarHost(host)
        }
    ) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile("peso (kg) desde o início", delta { it.weightKg }, Modifier.weight(1f))
                    StatTile("cintura (cm)", delta { it.waistCm }, Modifier.weight(1f))
                    StatTile("quadril (cm)", delta { it.hipCm }, Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile("treinos registrados", "${sessions.size}", Modifier.weight(1f), Icons.Default.FitnessCenter)
                    StatTile("coxa (cm)", delta { it.thighCm }, Modifier.weight(1f))
                    StatTile("braço (cm)", delta { it.armCm }, Modifier.weight(1f))
                }
            }
            item {
                AureaCard(onClick = { nav("charts") }) {
                    Text("Peso ao longo do tempo", style = MaterialTheme.typography.titleMedium)
                    LineChart(ms.mapNotNull { m -> m.weightKg?.let { ChartPoint(m.epochDay, it) } }, "kg")
                    Text("Toque para ver todos os gráficos", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
            }
            item {
                InfoBanner("O peso oscila no dia a dia (água, sal, ciclo menstrual). Pese-se pela manhã, em jejum, e observe a tendência das semanas. Medidas e cargas também mostram evolução.")
            }
            item { SectionTitle("Fotos de progresso (privadas)") }
            item {
                AureaCard {
                    Text("As fotos são opcionais, ficam somente no armazenamento privado do app e nunca são enviadas automaticamente. Elas não são usadas para avaliar saúde ou composição corporal.", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(photoNote, { photoNote = it.take(60) }, label = { Text("Legenda (opcional), ex.: frente, lado") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                        Icon(Icons.Default.AddAPhoto, null); Spacer(Modifier.width(8.dp)); Text("Adicionar foto")
                    }
                    if (photos.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(photos, key = { it.id }) { ph ->
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    PhotoThumb(File(vm.repo.photoDir, ph.fileName), 300, Modifier.size(width = 96.dp, height = 128.dp).clip(MaterialTheme.shapes.small).clickable { viewing = ph })
                                    Text(epochLabel(ph.epochDay), style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
            item { SectionTitle("Histórico de medidas") }
            if (ms.isEmpty()) item { EmptyState("Nenhuma medida ainda", "Registre seu peso e suas medidas para acompanhar a evolução.", "Registrar agora") { adding = true } }
            items(ms.reversed(), key = { it.id }) { m ->
                AureaCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(epochLabel(m.epochDay), style = MaterialTheme.typography.titleSmall)
                            Text(listOfNotNull(
                                m.weightKg?.let { "Peso ${fmt1(it)} kg" }, m.waistCm?.let { "Cintura ${fmt1(it)}" }, m.hipCm?.let { "Quadril ${fmt1(it)}" },
                                m.thighCm?.let { "Coxa ${fmt1(it)}" }, m.armCm?.let { "Braço ${fmt1(it)}" }
                            ).joinToString(" • "), style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { vm.deleteMeasurement(m.id) }) { Icon(Icons.Default.Delete, "Apagar medida") }
                    }
                }
            }
            item { Spacer(Modifier.height(60.dp)) }
        }
    }
    if (adding) MeasurementDialog(last, { adding = false }) { vm.addMeasurement(it); adding = false; message = "Medidas registradas!" }
    viewing?.let { ph ->
        var confirm by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { viewing = null },
            title = { Text("${epochLabel(ph.epochDay)} ${ph.note}") },
            text = { PhotoThumb(File(vm.repo.photoDir, ph.fileName), 1200, Modifier.fillMaxWidth().heightIn(max = 460.dp)) },
            confirmButton = { TextButton(onClick = { viewing = null }) { Text("Fechar") } },
            dismissButton = { TextButton(onClick = { confirm = true }, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Excluir") } }
        )
        if (confirm) ConfirmDialog("Excluir foto?", "A foto será apagada definitivamente do aparelho.", "Excluir", true, { confirm = false }) { vm.deletePhoto(ph); confirm = false; viewing = null }
    }
}

@Composable
fun PhotoThumb(file: File, maxSide: Int, modifier: Modifier) {
    var bmp by remember(file) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(file) {
        bmp = withContext(Dispatchers.IO) {
            runCatching {
                val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(file.path, o)
                var s = 1; while (o.outWidth / s > maxSide * 2) s *= 2
                BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = s })?.asImageBitmap()
            }.getOrNull()
        }
    }
    bmp?.let { Image(it, contentDescription = "Foto de progresso", modifier = modifier, contentScale = ContentScale.Crop) }
        ?: Box(modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(20.dp)) }
}

@Composable
fun MeasurementDialog(last: MeasurementEntity?, onDismiss: () -> Unit, onSave: (MeasurementEntity) -> Unit) {
    var w by remember { mutableStateOf(last?.weightKg?.let { fmt1(it) } ?: "") }
    var waist by remember { mutableStateOf("") }
    var hip by remember { mutableStateOf("") }
    var thigh by remember { mutableStateOf("") }
    var arm by remember { mutableStateOf("") }
    fun d(s: String, r: ClosedFloatingPointRange<Double>) = s.toDoubleOrNull()?.takeIf { it in r }
    val any = listOf(d(w, 30.0..250.0), d(waist, 30.0..200.0), d(hip, 30.0..200.0), d(thigh, 20.0..120.0), d(arm, 10.0..80.0)).any { it != null }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Registrar medidas de hoje") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                NumberField("Peso", w, { w = it }, suffix = "kg", modifier = Modifier.testTag("mWeight"))
                NumberField("Cintura", waist, { waist = it }, suffix = "cm")
                NumberField("Quadril", hip, { hip = it }, suffix = "cm")
                NumberField("Coxa", thigh, { thigh = it }, suffix = "cm")
                NumberField("Braço", arm, { arm = it }, suffix = "cm")
            }
        },
        confirmButton = {
            TextButton(enabled = any, onClick = {
                onSave(MeasurementEntity(epochDay = today(), weightKg = d(w, 30.0..250.0), waistCm = d(waist, 30.0..200.0), hipCm = d(hip, 30.0..200.0), thighCm = d(thigh, 20.0..120.0), armCm = d(arm, 10.0..80.0)))
            }, modifier = Modifier.testTag("saveMeasure")) { Text("Salvar") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } }
    )
}

/** 15. Gráficos de progresso. */
@Composable
fun ChartsScreen(vm: AppViewModel, onBack: () -> Unit) {
    val ms by vm.measurements.collectAsState()
    val logs by vm.setLogs.collectAsState()
    val sessions by vm.sessions.collectAsState()
    val metrics = listOf("Peso", "Cintura", "Quadril", "Coxa", "Braço", "Cintura/Quadril")
    var metric by rememberSaveable { mutableStateOf("Peso") }
    val exercisesLogged = logs.map { it.exerciseId }.distinct()
    var exId by remember(exercisesLogged) { mutableStateOf(exercisesLogged.firstOrNull()) }
    Scaffold(topBar = { AureaTopBar("Gráficos de progresso", onBack) }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                AureaCard {
                    Text("Medidas corporais", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(6.dp))
                    SingleChoice(metrics, metric, { it }, { metric = it })
                    val pts = ms.mapNotNull { m ->
                        val v = when (metric) {
                            "Peso" -> m.weightKg; "Cintura" -> m.waistCm; "Quadril" -> m.hipCm; "Coxa" -> m.thighCm; "Braço" -> m.armCm
                            else -> if (m.waistCm != null && m.hipCm != null && m.hipCm > 0) m.waistCm / m.hipCm else null
                        }
                        v?.let { ChartPoint(m.epochDay, it) }
                    }
                    Spacer(Modifier.height(8.dp))
                    LineChart(pts, if (metric == "Peso") "kg" else if (metric == "Cintura/Quadril") "" else "cm")
                }
            }
            item {
                AureaCard {
                    Text("Frequência de treino (últimas 8 semanas)", style = MaterialTheme.typography.titleLarge)
                    val t = today()
                    val weeks = (7 downTo 0).map { w -> sessions.count { it.epochDay in (t - (w + 1) * 7 + 1)..(t - w * 7) }.toDouble() }
                    BarChart((8 downTo 1).map { if (it == 1) "atual" else "-${it - 1}" }, weeks, "treinos")
                }
            }
            item {
                AureaCard {
                    Text("Evolução de desempenho (carga)", style = MaterialTheme.typography.titleLarge)
                    if (exercisesLogged.isEmpty()) Text("Registre treinos para ver a evolução das cargas.", style = MaterialTheme.typography.bodyMedium)
                    else {
                        SingleChoice(exercisesLogged, exId, { ExerciseLibrary.get(it)?.name ?: it }, { exId = it })
                        val pts = logs.filter { it.exerciseId == exId }.groupBy { it.epochDay }.map { (d, l) -> ChartPoint(d, l.maxOf { it.weightKg }) }
                        Spacer(Modifier.height(8.dp))
                        LineChart(pts, "kg")
                        val vol = logs.filter { it.exerciseId == exId }.groupBy { it.epochDay }.map { (d, l) -> ChartPoint(d, l.sumOf { it.weightKg * it.reps }) }
                        Text("Volume total (carga × repetições)", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 12.dp))
                        LineChart(vol, "kg", color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        }
    }
}
