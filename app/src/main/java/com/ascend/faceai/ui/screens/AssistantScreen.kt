package com.ascend.faceai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.analysis.LocalAdvisor
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.goTab
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.launch

@Composable
fun AssistantScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val scope = rememberCoroutineScope()
    val msgs by c.repo.chat.collectAsState(initial = emptyList())
    val s by c.settings.flow.collectAsState(initial = AppSettings())
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    LaunchedEffect(msgs.size, busy) { if (msgs.isNotEmpty()) listState.animateScrollToItem(msgs.size - 1 + if (busy) 1 else 0) }
    val aiOn = s.aiConfigured && s.externalAiConsent

    fun send(q: String) {
        if (q.isBlank() || busy) return
        input = ""; busy = true
        scope.launch { runCatching { c.repo.ask(q.trim()) }; busy = false }
    }

    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding().imePadding()) {
        Row(Modifier.padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Eyebrow("Assistente", Ac.Cyan)
                Text("ASCEND AI", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
            }
            IconButton(onClick = { scope.launch { c.repo.clearChat() } }) { Icon(Icons.Outlined.DeleteSweep, "Limpar conversa", tint = Ac.TextMid) }
        }
        Box(Modifier.padding(horizontal = 18.dp).clip(RoundedCornerShape(14.dp)).background(Ac.Surface).clickable { if (!aiOn) nav.goTab(Routes.SETTINGS) }.padding(12.dp)) {
            Column {
                Tag(if (aiOn) "IA externa conectada" else "Modo local: motor de regras (sem IA)", if (aiOn) Ac.Good else Ac.Warn)
                Spacer(Modifier.height(6.dp))
                Text(
                    if (aiOn) "As respostas usam seus relatórios (somente texto, sem fotos) enviados ao backend configurado."
                    else "A IA externa está indisponível até ser configurada em Ajustes. Enquanto isso, respostas vêm de regras locais aplicadas aos seus números — não é inteligência artificial.",
                    style = MaterialTheme.typography.bodySmall, color = Ac.TextMid
                )
            }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = listState, contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (msgs.isEmpty()) item {
                Text("Pergunte algo sobre seus resultados ou toque numa sugestão abaixo.", style = MaterialTheme.typography.bodyMedium, color = Ac.TextLow)
            }
            items(msgs, key = { it.id }) { m ->
                val mine = m.role == "user"
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
                    Column(Modifier.widthIn(max = 310.dp).clip(RoundedCornerShape(18.dp))
                        .background(if (mine) Ac.Blue.copy(alpha = 0.28f) else Ac.SurfaceHi).padding(12.dp)) {
                        if (!mine) Text(when (m.source) { "ai" -> "ASCEND AI"; "local" -> "MOTOR LOCAL (REGRAS)"; else -> "AVISO" },
                            style = MaterialTheme.typography.labelSmall, color = when (m.source) { "ai" -> Ac.Cyan; "local" -> Ac.Warn; else -> Ac.Bad })
                        Text(m.text, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi)
                    }
                }
            }
            if (busy) item { CircularProgressIndicator(Modifier.padding(8.dp), color = Ac.Cyan, strokeWidth = 2.dp) }
        }
        LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(LocalAdvisor.suggestions) { q ->
                Box(Modifier.clip(RoundedCornerShape(50)).background(Ac.Surface).clickable { send(q) }.padding(horizontal = 12.dp, vertical = 8.dp).testTag("sugg")) {
                    Text(q, style = MaterialTheme.typography.labelMedium, color = Ac.TextMid)
                }
            }
        }
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            AscendField(input, { input = it }, "Sua pergunta", modifier = Modifier.weight(1f).testTag("chat_input"))
            IconButton(onClick = { send(input) }, enabled = !busy) { Icon(Icons.AutoMirrored.Outlined.Send, "Enviar", tint = Ac.Blue) }
        }
    }
}
