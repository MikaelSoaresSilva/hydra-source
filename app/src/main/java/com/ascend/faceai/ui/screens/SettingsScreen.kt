package com.ascend.faceai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.ascend.faceai.BuildConfig
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.Routes
import com.ascend.faceai.ui.components.DangerButton
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.SecondaryButton
import com.ascend.faceai.ui.components.Tag
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.launch

private enum class Danger { PHOTOS, ALL, ACCOUNT, CONSENT }

@Composable
fun SettingsScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val scope = rememberCoroutineScope()
    val s by c.settings.flow.collectAsState(initial = AppSettings())
    val reports by c.repo.reports.collectAsState(initial = emptyList())
    var url by remember(s.backendUrl) { mutableStateOf(s.backendUrl) }
    var token by remember(s.backendToken) { mutableStateOf(s.backendToken) }
    var aiMsg by remember { mutableStateOf<String?>(null) }
    var syncMsg by remember { mutableStateOf<String?>(null) }
    var dataMsg by remember { mutableStateOf<String?>(null) }
    var danger by remember { mutableStateOf<Danger?>(null) }

    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
        Spacer(Modifier.height(14.dp))
        Eyebrow("Configurações", Ac.Cyan)
        Text("Ajustes", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
        Spacer(Modifier.height(16.dp))

        // IA
        GlassCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Inteligência artificial", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi, modifier = Modifier.weight(1f))
                Tag(if (s.aiConfigured) "Configurada" else "Não configurada", if (s.aiConfigured) Ac.Good else Ac.Warn)
            }
            Spacer(Modifier.height(6.dp))
            Text("O assistente ASCEND AI e o simulador usam o SEU backend (pasta backend/ do projeto). As chaves da IA ficam no servidor, nunca no app.",
                style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            Spacer(Modifier.height(10.dp))
            AscendField(url, { url = it }, "URL do backend (https://…)", keyboard = KeyboardType.Uri, modifier = Modifier.testTag("backend_url"))
            Spacer(Modifier.height(8.dp))
            AscendField(token, { token = it }, "Token de acesso do app", password = true)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SecondaryButton("Salvar", Modifier.weight(1f)) { scope.launch { c.settings.setBackend(url, token); aiMsg = "Salvo." } }
                SecondaryButton("Testar conexão", Modifier.weight(1f)) {
                    scope.launch {
                        c.settings.setBackend(url, token)
                        aiMsg = runCatching { c.ai.health().let { "Conectado (${it.provider}). Chat: ${if (it.chat) "ok" else "indisponível"} · Imagens: ${if (it.image) "ok" else "indisponível"}" } }
                            .getOrElse { "Falhou: ${it.message}" }
                    }
                }
            }
            aiMsg?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Ac.Cyan, modifier = Modifier.padding(top = 8.dp)) }
        }
        Spacer(Modifier.height(14.dp))

        // Privacidade
        GlassCard(Modifier.fillMaxWidth()) {
            Text("Privacidade", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
            Spacer(Modifier.height(8.dp))
            ToggleRow("Permitir envio a serviços externos de IA", "Relatórios em texto no assistente; foto apenas quando você gerar uma simulação.", s.externalAiConsent) {
                scope.launch { c.settings.setExternalAiConsent(it) }
            }
            Spacer(Modifier.height(6.dp))
            Text("Consentimento de processamento dado em ${if (s.consentAt > 0) ptDate.format(java.util.Date(s.consentAt)) else "—"}.", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
            Row {
                TextButton(onClick = { nav.navigate(Routes.PRIVACY) }) { Text("Política de privacidade", color = Ac.Blue) }
                TextButton(onClick = { nav.navigate(Routes.METHODOLOGY) }) { Text("Metodologia", color = Ac.Blue) }
            }
        }
        Spacer(Modifier.height(14.dp))

        // Nuvem
        GlassCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Conta e nuvem", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi, modifier = Modifier.weight(1f))
                Tag(when { s.loggedIn -> "Conectado"; s.cloudConfigured -> "Sem login"; else -> "Não configurada" }, if (s.loggedIn) Ac.Good else Ac.Metal)
            }
            Spacer(Modifier.height(6.dp))
            Text(if (s.loggedIn) "Conta: ${s.userEmail}. Só relatórios (texto) são sincronizados; fotos ficam neste aparelho."
                else "Os dados estão apenas neste aparelho (não sincronizados).", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SecondaryButton(if (s.loggedIn) "Gerenciar conta" else "Configurar / entrar", Modifier.weight(1f)) { nav.navigate("cloud") }
                SecondaryButton("Sincronizar agora", Modifier.weight(1f), enabled = s.loggedIn) {
                    scope.launch { syncMsg = runCatching { c.repo.syncNow() }.getOrElse { "Falhou: ${it.message}" } }
                }
            }
            syncMsg?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Ac.Cyan, modifier = Modifier.padding(top = 8.dp)) }
        }
        Spacer(Modifier.height(14.dp))

        // Dados
        GlassCard(Modifier.fillMaxWidth()) {
            Text("Seus dados", style = MaterialTheme.typography.titleLarge, color = Ac.TextHi)
            Spacer(Modifier.height(6.dp))
            Text("${reports.size} análise(s) · ${c.vault.count()} foto(s) criptografada(s) neste aparelho.", style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
            Spacer(Modifier.height(10.dp))
            DangerButton("Excluir apenas as fotos", Modifier.fillMaxWidth().testTag("del_photos")) { danger = Danger.PHOTOS }
            Spacer(Modifier.height(8.dp))
            DangerButton("Excluir todas as análises e fotos", Modifier.fillMaxWidth().testTag("del_all")) { danger = Danger.ALL }
            Spacer(Modifier.height(8.dp))
            DangerButton("Excluir conta e todos os dados", Modifier.fillMaxWidth().testTag("del_account")) { danger = Danger.ACCOUNT }
            Spacer(Modifier.height(8.dp))
            SecondaryButton("Revogar consentimento", Modifier.fillMaxWidth()) { danger = Danger.CONSENT }
            dataMsg?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Ac.Cyan, modifier = Modifier.padding(top = 8.dp)) }
        }
        Spacer(Modifier.height(14.dp))
        Text("Ascend Face AI ${BuildConfig.VERSION_NAME} · processamento local com MediaPipe · sem anúncios, sem assinatura.", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
        Spacer(Modifier.height(28.dp))
    }

    danger?.let { d ->
        val (title, text) = when (d) {
            Danger.PHOTOS -> "Excluir fotos?" to "As fotos criptografadas serão apagadas. Os relatórios (números e textos) continuam."
            Danger.ALL -> "Excluir tudo?" to "Todas as análises, planos, conversas e fotos deste aparelho serão apagados permanentemente."
            Danger.ACCOUNT -> "Excluir conta e dados?" to "Apaga tudo deste aparelho e, se você estiver conectado, os relatórios na nuvem e a conta (exige o backend configurado). Depois o app volta ao início. Não dá para desfazer."
            Danger.CONSENT -> "Revogar consentimento?" to "O app deixará de processar fotos até você consentir de novo. Seus dados não são apagados automaticamente."
        }
        AlertDialog(
            onDismissRequest = { danger = null },
            title = { Text(title) }, text = { Text(text) }, containerColor = Ac.SurfaceHi,
            confirmButton = {
                TextButton(modifier = Modifier.testTag("confirm_danger"), onClick = {
                    scope.launch {
                        when (d) {
                            Danger.PHOTOS -> { c.repo.deletePhotosOnly(); dataMsg = "Fotos excluídas." }
                            Danger.ALL -> { c.repo.deleteAllLocal(); dataMsg = "Todos os dados locais foram excluídos." }
                            Danger.ACCOUNT -> {
                                val cur = c.settings.current()
                                val remote = if (cur.loggedIn) runCatching {
                                    c.cloud.deleteRemoteData()
                                    c.ai.deleteCloudAccount(cur.accessToken)
                                    "Conta e dados na nuvem excluídos."
                                }.getOrElse { "Atenção: não foi possível excluir na nuvem (${it.message}). Os dados locais foram apagados." } else ""
                                c.repo.deleteAllLocal(); c.settings.clearAll()
                                dataMsg = "Dados locais excluídos. $remote"
                                nav.navigate(Routes.ONBOARDING) { popUpTo(0) { inclusive = true } }
                            }
                            Danger.CONSENT -> { c.settings.revokeConsent(); nav.navigate(Routes.CONSENT) { popUpTo(0) { inclusive = true } } }
                        }
                        danger = null
                    }
                }) { Text("Confirmar", color = Ac.Bad) }
            },
            dismissButton = { TextButton(onClick = { danger = null }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun ToggleRow(title: String, sub: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = Ac.TextHi)
            Text(sub, style = MaterialTheme.typography.bodySmall, color = Ac.TextMid)
        }
        Switch(value, onChange, colors = SwitchDefaults.colors(checkedTrackColor = Ac.Blue))
    }
}

@Suppress("unused") private val ko = KeyboardOptions.Default
