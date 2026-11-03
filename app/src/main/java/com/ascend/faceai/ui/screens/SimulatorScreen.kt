package com.ascend.faceai.ui.screens

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.EmptyState
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.components.TopBar
import com.ascend.faceai.ui.goTab
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.launch

private val styles = linkedMapOf(
    "Cortes" to listOf("Degradê baixo com topo texturizado", "Corte social curto clássico", "Buzz cut (máquina)", "Topete médio penteado para trás", "Crop francês", "Cabelo médio ondulado com risca lateral"),
    "Franjas" to listOf("Franja curta texturizada", "Franja lateral leve", "Franja cortina (dividida ao meio)"),
    "Barba" to listOf("Barba por fazer (3 dias)", "Barba curta bem desenhada", "Barba cheia média", "Cavanhaque", "Rosto sem barba"),
    "Sobrancelhas" to listOf("Sobrancelhas limpas e naturais, só pelos soltos removidos", "Sobrancelhas levemente mais cheias")
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SimulatorScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val scope = rememberCoroutineScope()
    val s by c.settings.flow.collectAsState(initial = AppSettings())
    val reports by c.repo.reports.collectAsState(initial = null)
    val latest = reports?.firstOrNull()
    val photo = rememberPhoto(latest?.id)
    var chosen by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<Bitmap?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val aiOn = s.aiConfigured && s.externalAiConsent

    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar("Simulador de visual", { nav.popBackStack() })
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
            if (!aiOn) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Tag("Indisponível", Ac.Warn)
                    Spacer(Modifier.height(8.dp))
                    Text("O simulador usa um modelo real de edição de imagem (configurado no seu backend). Ele não funciona offline e não usamos filtros falsos.",
                        style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi)
                    Spacer(Modifier.height(6.dp))
                    Text(when {
                        !s.aiConfigured -> "Falta: configurar a URL do backend em Ajustes → Inteligência artificial."
                        else -> "Falta: autorizar o envio de fotos a serviços externos em Ajustes → Privacidade."
                    }, style = MaterialTheme.typography.bodySmall, color = Ac.Warn)
                    Spacer(Modifier.height(10.dp))
                    PrimaryButton("Abrir Ajustes", Modifier.fillMaxWidth()) { nav.goTab(Routes.SETTINGS) }
                }
                Spacer(Modifier.height(14.dp))
            }
            if (reports != null && latest == null) {
                EmptyState("Faça uma análise primeiro", "O simulador usa a foto frontal da sua análise mais recente.", "Fazer análise") { nav.navigate(Routes.SCAN) }
                return@Column
            }
            photo?.let { before ->
                val after = result
                if (after == null) {
                    Image(before.asImageBitmap(), "Foto atual", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().aspectRatio(before.width.toFloat() / before.height).clip(RoundedCornerShape(22.dp)))
                } else BeforeAfter(before, after)
            }
            Spacer(Modifier.height(14.dp))
            styles.forEach { (group, opts) ->
                Eyebrow(group)
                Spacer(Modifier.height(6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    opts.forEach { o ->
                        Box(Modifier.clip(RoundedCornerShape(50)).background(if (chosen == o) Ac.Blue.copy(0.3f) else Ac.Surface).clickable { chosen = o }.padding(horizontal = 12.dp, vertical = 8.dp)) {
                            Text(o, style = MaterialTheme.typography.labelMedium, color = if (chosen == o) Ac.TextHi else Ac.TextMid)
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
            Text("A foto será enviada ao seu backend apenas ao tocar em Gerar. Pedimos ao modelo para preservar sua identidade e mudar só o estilo escolhido.",
                style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            Spacer(Modifier.height(10.dp))
            PrimaryButton(if (busy) "Gerando… (pode levar até 1 min)" else "Gerar simulação", Modifier.fillMaxWidth(), enabled = aiOn && chosen != null && photo != null && !busy) {
                val p = photo ?: return@PrimaryButton
                val instr = chosen ?: return@PrimaryButton
                busy = true; error = null
                scope.launch {
                    runCatching { c.ai.simulate(p, instr) }.onSuccess { result = it }.onFailure { error = it.message }
                    busy = false
                }
            }
            error?.let { Text(it, color = Ac.Bad, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
            Spacer(Modifier.height(28.dp))
        }
    }
}

@Composable
private fun BeforeAfter(before: Bitmap, after: Bitmap) {
    var split by remember { mutableFloatStateOf(0.5f) }
    Column {
        BoxWithConstraints(Modifier.fillMaxWidth().aspectRatio(before.width.toFloat() / before.height).clip(RoundedCornerShape(22.dp))) {
            Image(after.asImageBitmap(), "Simulação", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            Box(Modifier.fillMaxHeight().width(maxWidth * split).clipToBounds()) {
                Image(before.asImageBitmap(), "Atual", contentScale = ContentScale.Crop, alignment = androidx.compose.ui.Alignment.CenterStart,
                    modifier = Modifier.wrapContentWidth(androidx.compose.ui.Alignment.Start, unbounded = true).width(maxWidth).fillMaxHeight())
            }
            Box(Modifier.offset(x = maxWidth * split - 1.dp).fillMaxHeight().width(2.dp).background(Ac.TextHi))
        }
        Slider(split, { split = it }, colors = SliderDefaults.colors(thumbColor = Ac.Blue, activeTrackColor = Ac.Blue, inactiveTrackColor = Ac.SurfaceHi))
        Text("Arraste: esquerda = atual · direita = simulação", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
    }
}
