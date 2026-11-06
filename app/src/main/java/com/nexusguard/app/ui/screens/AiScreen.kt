package com.nexusguard.app.ui.screens

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nexusguard.app.ai.NexusAiEngine
import com.nexusguard.app.ui.AiViewModel
import com.nexusguard.app.ui.ChatMsg
import com.nexusguard.app.ui.components.Pill
import com.nexusguard.app.ui.components.PulseDot
import com.nexusguard.app.ui.components.ScreenHeader
import com.nexusguard.app.ui.theme.NX

@Composable
fun AiScreen() {
    val vm: AiViewModel = viewModel()
    val msgs by vm.messages.collectAsState()
    val busy by vm.busy.collectAsState()
    val settings by vm.settings.collectAsState()
    var input by rememberSaveable { mutableStateOf("") }
    val list = rememberLazyListState()
    val c = NX.c
    LaunchedEffect(msgs.size) { if (msgs.isNotEmpty()) list.animateScrollToItem(msgs.size - 1) }
    Column(Modifier.fillMaxSize().imePadding().padding(horizontal = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) {
                ScreenHeader("NEXUS AI", if (settings?.aiOnline == true && settings?.hasGeminiKey == true) "Modo local + online (Gemini, sua chave)" else "Modo local • interpreta suas medições reais")
            }
            IconButton({ vm.clear() }) { Icon(Icons.Filled.DeleteSweep, "Limpar", tint = c.muted) }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("chat_list"), state = list, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(msgs.size) { i -> Bubble(msgs[i]) }
            if (busy) item { Row(verticalAlignment = Alignment.CenterVertically) { PulseDot(c.cyan); Spacer(Modifier.width(8.dp)); Text("Analisando suas medições…", style = MaterialTheme.typography.bodySmall, color = c.muted) } }
        }
        LazyRow(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(NexusAiEngine.suggestions) { s ->
                Box(Modifier.clip(RoundedCornerShape(50)).border(1.dp, c.stroke, RoundedCornerShape(50)).clickable(enabled = !busy) { vm.ask(s) }
                    .padding(horizontal = 12.dp, vertical = 8.dp)) { Text(s, style = MaterialTheme.typography.labelMedium, color = c.text) }
            }
        }
        Row(Modifier.padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(input, { input = it }, Modifier.weight(1f).testTag("ai_input"), placeholder = { Text("Pergunte sobre sua conexão ou segurança") },
                shape = RoundedCornerShape(16.dp), maxLines = 3,
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = c.blue, unfocusedBorderColor = c.stroke))
            Spacer(Modifier.width(8.dp))
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(c.accentH).clickable(enabled = input.isNotBlank() && !busy) { vm.ask(input); input = "" }
                .testTag("ai_send"), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Filled.Send, "Enviar", tint = androidx.compose.ui.graphics.Color.White)
            }
        }
    }
}

@Composable
private fun Bubble(m: ChatMsg) {
    val c = NX.c
    if (m.fromUser) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Box(Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp)).background(c.accentH).padding(12.dp)) {
                Text(m.text ?: "", style = MaterialTheme.typography.bodyMedium, color = androidx.compose.ui.graphics.Color.White)
            }
        }
        return
    }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp)).background(c.surface).border(1.dp, c.stroke, RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp)).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.AutoAwesome, null, tint = c.purple, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(m.answer?.title ?: "NEXUS AI", style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
            Pill(if (m.online) "online" else "local", if (m.online) c.purple else c.cyan)
        }
        Spacer(Modifier.height(6.dp))
        m.text?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = if (m.error) c.warn else c.text) }
        m.answer?.let { a ->
            a.paragraphs.forEach { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.text, modifier = Modifier.padding(vertical = 3.dp)) }
            if (a.actions.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text("O que fazer", style = MaterialTheme.typography.labelSmall, color = c.cyan)
                a.actions.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = c.text, modifier = Modifier.padding(vertical = 2.dp)) }
            }
            if (a.missing.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text("Ainda não medido: ${a.missing.joinToString()}", style = MaterialTheme.typography.labelSmall, color = c.warn)
            }
            if (a.dataUsed.isNotEmpty()) Text("Baseado em: ${a.dataUsed.joinToString()}", style = MaterialTheme.typography.labelSmall, color = c.muted, modifier = Modifier.padding(top = 4.dp))
        }
    }
}
