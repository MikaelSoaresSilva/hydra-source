package com.nexusguard.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.nexusguard.app.BuildConfig
import com.nexusguard.app.core.Intents
import com.nexusguard.app.core.SettingsRepository
import com.nexusguard.app.ui.SettingsViewModel
import com.nexusguard.app.ui.components.Centered
import com.nexusguard.app.ui.components.InfoBox
import com.nexusguard.app.ui.components.KeyValue
import com.nexusguard.app.ui.components.NavRow
import com.nexusguard.app.ui.components.NexusCard
import com.nexusguard.app.ui.components.PrimaryButton
import com.nexusguard.app.ui.components.ScreenHeader
import com.nexusguard.app.ui.components.SecondaryButton
import com.nexusguard.app.ui.components.SectionTitle
import com.nexusguard.app.ui.components.ToggleRow
import com.nexusguard.app.ui.theme.NX
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SettingsScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    val vm: SettingsViewModel = viewModel()
    val s by vm.settings.collectAsState()
    val scope = rememberCoroutineScope()
    var confirmClear by rememberSaveable { mutableStateOf(false) }
    var confirmErase by rememberSaveable { mutableStateOf(false) }
    val notifPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    val st = s ?: return
    val notifGranted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("settings_list")) {
            item {
                ScreenHeader("Ajustes", "NEXUS GUARD ${BuildConfig.VERSION_NAME}")
                SectionTitle("Notificações")
                NexusCard {
                    if (!notifGranted) {
                        InfoBox("As notificações estão bloqueadas para o app. Os alertas continuam sendo registrados no histórico.")
                        SecondaryButton("Permitir notificações", Modifier.fillMaxWidth().padding(top = 8.dp)) { notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS) }
                    }
                    ToggleRow("Alertas de segurança", "Wi-Fi inseguro, apps/arquivos/links suspeitos, configurações perigosas", st.notifySecurity, tag = "sw_notif_sec") { vm.setNotifySecurity(it) }
                    ToggleRow("Alertas de conexão", "Quedas detectadas e problemas de rede", st.notifyNetwork) { vm.setNotifyNetwork(it) }
                    ToggleRow("Verificação automática", "A cada 12 h, com bateria não baixa (WorkManager)", st.periodicChecks, tag = "sw_periodic") { vm.setPeriodic(it) }
                    SecondaryButton("Configurações de notificação do Android", Modifier.fillMaxWidth()) { Intents.appNotifications(ctx) }
                }
                SectionTitle("Privacidade")
                NexusCard {
                    ToggleRow("Consultas de reputação online", "Opcional. Envia só o link (Google Safe Browsing) ou o hash (VirusTotal) quando você pedir. Exige sua chave.", st.onlineReputation) { vm.setOnlineReputation(it) }
                    ToggleRow("NEXUS AI online", "Opcional. Envia um resumo técnico das medições (sem nome da rede ou lista de apps) ao Google Gemini com sua chave.", st.aiOnline) { vm.setAiOnline(it) }
                    ToggleRow("Bloqueio do app", if (Build.VERSION.SDK_INT >= 28) "Pedir biometria/PIN do aparelho ao abrir" else "Requer Android 9 ou superior", st.appLock, enabled = Build.VERSION.SDK_INT >= 28) { vm.setAppLock(it) }
                }
                Spacer(Modifier.height(8.dp))
                NavRow("Chaves de API (opcional)", "Gemini, Safe Browsing e VirusTotal — guardadas criptografadas", Icons.Filled.Key) { nav.navigate("settings/keys") }
                Spacer(Modifier.height(8.dp))
                NavRow("Permissões", "O que o app usa e por quê", Icons.Filled.VerifiedUser, tag = "nav_permissions") { nav.navigate("settings/permissions") }
                Spacer(Modifier.height(8.dp))
                NavRow("Política de privacidade", "Como seus dados são tratados", Icons.Filled.Policy, tag = "nav_policy") { nav.navigate("settings/policy") }
                SectionTitle("Tema")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(st.theme == "dark", { vm.setTheme("dark") }, { Text("Escuro") })
                    FilterChip(st.theme == "amoled", { vm.setTheme("amoled") }, { Text("Preto AMOLED (economiza bateria)") })
                }
                SectionTitle("Modo Estabilidade")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(5, 10, 30).forEach { v -> FilterChip(st.stabilityIntervalSec == v, { vm.setInterval(v) }, { Text("a cada $v s") }) }
                }
                SectionTitle("Histórico e relatórios")
                NexusCard {
                    val stamp = SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date())
                    SecondaryButton("Exportar relatório completo (.txt)", Modifier.fillMaxWidth(), icon = Icons.Filled.Description) {
                        scope.launch { Intents.shareFile(ctx, "nexus-guard-relatorio-$stamp.txt", "text/plain", vm.exportText()) }
                    }
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton("Exportar testes de velocidade (.csv)", Modifier.fillMaxWidth(), icon = Icons.Filled.TableChart) {
                        scope.launch { Intents.shareFile(ctx, "nexus-guard-velocidade-$stamp.csv", "text/csv", vm.exportCsv()) }
                    }
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton("Apagar histórico", Modifier.fillMaxWidth(), icon = Icons.Filled.DeleteForever, tag = "btn_clear_history") { confirmClear = true }
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton("Apagar tudo (histórico, ajustes e chaves)", Modifier.fillMaxWidth()) { confirmErase = true }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
    if (confirmClear) AlertDialog(
        onDismissRequest = { confirmClear = false }, title = { Text("Apagar histórico?") },
        text = { Text("Remove verificações, testes, alertas e eventos salvos neste aparelho. Não pode ser desfeito.") },
        confirmButton = { TextButton({ confirmClear = false; vm.clearHistory { android.widget.Toast.makeText(ctx, "Histórico apagado", android.widget.Toast.LENGTH_SHORT).show() } }) { Text("Apagar") } },
        dismissButton = { TextButton({ confirmClear = false }) { Text("Cancelar") } }
    )
    if (confirmErase) AlertDialog(
        onDismissRequest = { confirmErase = false }, title = { Text("Apagar tudo?") },
        text = { Text("Remove histórico, preferências e chaves de API. O app volta à tela de boas-vindas.") },
        confirmButton = { TextButton({ confirmErase = false; vm.eraseEverything { } }) { Text("Apagar tudo") } },
        dismissButton = { TextButton({ confirmErase = false }) { Text("Cancelar") } }
    )
}

@Composable
fun KeysScreen(nav: NavHostController) {
    val vm: SettingsViewModel = viewModel()
    val s by vm.settings.collectAsState()
    val ctx = LocalContext.current
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Chaves de API", "Todas opcionais. O app funciona 100% sem elas.", onBack = { nav.popBackStack() })
                InfoBox("As chaves ficam criptografadas com o Android Keystore e só são usadas quando você toca no botão de consulta correspondente.")
                KeyField("Google Gemini (NEXUS AI online)", s?.hasGeminiKey == true,
                    "Gratuita com limites em aistudio.google.com. Custos só se você ativar cobrança na sua conta Google. Envia: resumo técnico das medições + sua pergunta.",
                    "https://aistudio.google.com/apikey") { vm.saveKey(SettingsRepository.ApiKey.GEMINI, it) }
                KeyField("Google Safe Browsing", s?.hasSafeBrowsingKey == true,
                    "Gratuita (uso não comercial) no Google Cloud Console, API \"Safe Browsing\". Envia: o link analisado.",
                    "https://developers.google.com/safe-browsing/v4/get-started") { vm.saveKey(SettingsRepository.ApiKey.SAFE_BROWSING, it) }
                KeyField("VirusTotal", s?.hasVirusTotalKey == true,
                    "Conta gratuita em virustotal.com (limite de 4 consultas/minuto). Envia: somente o hash SHA-256, nunca o arquivo.",
                    "https://www.virustotal.com/gui/my-apikey") { vm.saveKey(SettingsRepository.ApiKey.VIRUS_TOTAL, it) }
                Spacer(Modifier.height(10.dp))
                InfoBox("Depois de salvar, ative \"Consultas de reputação online\" ou \"NEXUS AI online\" em Ajustes > Privacidade.")
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun KeyField(title: String, saved: Boolean, help: String, url: String, onSave: (String?) -> Unit) {
    val ctx = LocalContext.current
    var v by rememberSaveable(title) { mutableStateOf("") }
    SectionTitle(title)
    NexusCard {
        Text(if (saved) "Chave salva ✓" else "Nenhuma chave", style = MaterialTheme.typography.titleSmall, color = if (saved) NX.c.success else NX.c.muted)
        Text(help, style = MaterialTheme.typography.bodySmall, color = NX.c.muted, modifier = Modifier.padding(vertical = 6.dp))
        OutlinedTextField(v, { v = it }, Modifier.fillMaxWidth(), placeholder = { Text("Cole a chave aqui") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            shape = RoundedCornerShape(12.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NX.c.blue, unfocusedBorderColor = NX.c.stroke))
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SecondaryButton("Salvar", Modifier.weight(1f), enabled = v.isNotBlank()) { onSave(v); v = "" }
            SecondaryButton("Remover", Modifier.weight(1f), enabled = saved) { onSave(null) }
            SecondaryButton("Obter", Modifier.weight(1f)) { Intents.openUrl(ctx, url) }
        }
    }
}

data class PermInfo(val name: String, val perm: String?, val why: String, val required: Boolean)

val permissionList = listOf(
    PermInfo("Internet", Manifest.permission.INTERNET, "Testes de velocidade, latência e DNS; consultas de reputação e NEXUS AI online (só quando você pedir).", true),
    PermInfo("Estado da rede", Manifest.permission.ACCESS_NETWORK_STATE, "Saber se você está em Wi-Fi, dados móveis ou VPN, se há internet confirmada e se existe portal cativo.", true),
    PermInfo("Estado do Wi-Fi", Manifest.permission.ACCESS_WIFI_STATE, "Ler sinal, banda, velocidade de enlace e tipo de segurança da rede conectada.", true),
    PermInfo("Localização (opcional)", Manifest.permission.ACCESS_FINE_LOCATION, "Exigência do Android para revelar o NOME da rede Wi-Fi e (até o Android 11) o tipo de segurança. Sua localização não é usada nem salva.", false),
    PermInfo("Telefone (opcional)", Manifest.permission.READ_PHONE_STATE, "Identificar a tecnologia exata da rede móvel (5G SA/NSA, 4G+). Não lê chamadas, contatos nem número.", false),
    PermInfo("Notificações", if (Build.VERSION.SDK_INT >= 33) Manifest.permission.POST_NOTIFICATIONS else null, "Avisar sobre Wi-Fi inseguro, quedas de conexão, apps e links suspeitos.", false),
    PermInfo("Serviço em primeiro plano", Manifest.permission.FOREGROUND_SERVICE, "Manter o Modo Estabilidade ativo com uma notificação visível, só enquanto você quiser.", true),
    PermInfo("Ver apps instalados", "android.permission.QUERY_ALL_PACKAGES", "Função principal de segurança: analisar permissões, origem e assinatura dos apps e procurar apps de espionagem conhecidos.", true)
)

@Composable
fun PermissionsScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    var tick by rememberSaveable { mutableStateOf(0) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Permissões", "Menor privilégio: só o necessário", onBack = { nav.popBackStack() })
                InfoBox("O NEXUS GUARD não usa root, não usa serviço de acessibilidade, não lê mensagens, chamadas, senhas ou histórico de navegação e não mantém serviços ocultos.")
            }
            permissionList.forEach { p ->
                item {
                    val granted = tick >= 0 && (p.perm == null || ContextCompat.checkSelfPermission(ctx, p.perm) == PackageManager.PERMISSION_GRANTED)
                    Spacer(Modifier.height(8.dp))
                    NexusCard {
                        Row {
                            Text(p.name, style = MaterialTheme.typography.titleSmall, color = NX.c.text, modifier = Modifier.weight(1f))
                            Text(if (granted) "concedida" else "não concedida", style = MaterialTheme.typography.labelSmall, color = if (granted) NX.c.success else NX.c.muted)
                        }
                        Text(p.why, style = MaterialTheme.typography.bodySmall, color = NX.c.muted, modifier = Modifier.padding(top = 4.dp))
                        if (!granted && !p.required && p.perm != null) SecondaryButton("Conceder", Modifier.fillMaxWidth().padding(top = 8.dp)) { launcher.launch(p.perm) }
                    }
                }
            }
            item {
                Spacer(Modifier.height(10.dp))
                SecondaryButton("Abrir permissões no Android", Modifier.fillMaxWidth()) { Intents.appDetails(ctx, ctx.packageName) }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

const val PRIVACY_POLICY = """POLÍTICA DE PRIVACIDADE — NEXUS GUARD
Versão 1.0 • novembro de 2026

1. Resumo
O NEXUS GUARD funciona no seu aparelho. Não há contas, anúncios, rastreadores, SDKs de análise ou servidores próprios. Nós não vendemos, não compartilhamos e não recebemos seus dados.

2. Dados tratados no aparelho
• Configurações de segurança do sistema (versão do Android, patch, bloqueio de tela, depuração etc.).
• Lista de apps instalados, suas permissões, origem e certificados (para a análise de risco).
• Informações da conexão (tipo, sinal, banda, DNS, portal cativo) e resultados de medições.
• Links e arquivos que VOCÊ escolher analisar. Arquivos são lidos apenas para calcular hash e inspecionar a estrutura; uma cópia temporária de APK/ZIP é apagada ao fim da análise.
Tudo é salvo em banco de dados local criptografado (SQLCipher/AES-256, chave protegida pelo Android Keystore), excluído do backup na nuvem. Você pode apagar tudo em Ajustes.

3. Conexões de rede realizadas
• Teste de velocidade: servidores da Cloudflare (speed.cloudflare.com), que recebem seu IP como qualquer site.
• Latência e estabilidade: pequenas conexões a 1.1.1.1, 8.8.8.8 e 9.9.9.9.
• Diagnóstico DNS: consultas de nomes populares e aleatórios a resolvedores públicos (Cloudflare, Google, Quad9, AdGuard, OpenDNS) e ao DNS da sua rede.
• Portal cativo: connectivitycheck.gstatic.com (mesmo endpoint usado pelo Android).
• "Expandir link" (quando você toca): pedido HEAD ao link para ler o redirecionamento.
Nenhuma dessas conexões envia dados pessoais.

4. Serviços opcionais (desligados por padrão, exigem sua chave)
• Google Safe Browsing: recebe o link que você pediu para consultar.
• VirusTotal: recebe somente o hash SHA-256 do arquivo.
• Google Gemini (NEXUS AI online): recebe um resumo técnico das medições (sem nome da rede, sem lista de apps, sem identificadores) e sua pergunta.
Cada serviço tem sua própria política de privacidade. Chaves ficam criptografadas no aparelho.

5. O que o app NÃO faz
Não lê mensagens, chamadas, contatos, senhas, fotos ou histórico de navegação; não coleta localização (a permissão opcional só existe porque o Android a exige para revelar o nome do Wi-Fi); não usa root nem acessibilidade; não executa arquivos; não possui funções ocultas.

6. Seus direitos (LGPD)
Como os dados ficam apenas no seu aparelho, você tem controle total: pode exportá-los (Ajustes › Exportar) e apagá-los a qualquer momento (Ajustes › Apagar tudo) ou desinstalando o app.

7. Limitações
Nenhum aplicativo garante proteção absoluta. As análises indicam riscos com base em sinais verificáveis e podem não detectar ameaças desconhecidas.

8. Contato
Dúvidas: responsável pelo projeto (Mikael) — informe um e-mail de contato antes de publicar na Play Store."""

@Composable
fun PrivacyPolicyScreen(nav: NavHostController) {
    Centered {
        Column(Modifier.fillMaxSize().padding(horizontal = 18.dp).verticalScroll(rememberScrollState())) {
            ScreenHeader("Política de privacidade", onBack = { nav.popBackStack() })
            NexusCard { Text(PRIVACY_POLICY, style = MaterialTheme.typography.bodySmall, color = NX.c.text) }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
fun OnboardingScreen(onFinish: (Boolean) -> Unit) {
    val ctx = LocalContext.current
    var periodic by rememberSaveable { mutableStateOf(true) }
    var accepted by rememberSaveable { mutableStateOf(false) }
    var showPolicy by rememberSaveable { mutableStateOf(false) }
    val notif = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { onFinish(periodic) }
    Centered {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 22.dp).verticalScroll(rememberScrollState())) {
            Spacer(Modifier.height(24.dp))
            NexusLogo()
            Spacer(Modifier.height(24.dp))
            Text("Segurança real e internet inteligente.", style = MaterialTheme.typography.displaySmall, color = NX.c.text)
            Spacer(Modifier.height(12.dp))
            Text("Tudo o que você vê no NEXUS GUARD foi medido no seu aparelho. Quando algo não pode ser medido, o app mostra \"não disponível\" — nunca inventa números.",
                style = MaterialTheme.typography.bodyLarge, color = NX.c.muted)
            Spacer(Modifier.height(20.dp))
            NexusCard {
                listOf(
                    "Verificações de segurança do sistema, apps, arquivos, links e Wi-Fi",
                    "Latência, jitter, perda de pacotes, DNS e velocidade reais",
                    "Dados guardados só no aparelho, criptografados",
                    "Sem contas, anúncios ou rastreadores",
                    "Nada é alterado no sistema sem você"
                ).forEach { Row(Modifier.padding(vertical = 4.dp)) { androidx.compose.material3.Icon(Icons.Filled.Lock, null, tint = NX.c.cyan, modifier = Modifier.padding(end = 10.dp)); Text(it, style = MaterialTheme.typography.bodyMedium, color = NX.c.text) } }
            }
            Spacer(Modifier.height(12.dp))
            ToggleRow("Verificação automática a cada 12 h", "Leve, com bateria não baixa. Pode desligar depois.", periodic) { periodic = it }
            ToggleRow("Li e aceito a política de privacidade", "Resumo: nada sai do aparelho sem sua ação.", accepted, tag = "sw_accept") { accepted = it }
            SecondaryButton("Ler política de privacidade", Modifier.fillMaxWidth(), tag = "btn_read_policy") { showPolicy = true }
            Spacer(Modifier.height(16.dp))
            PrimaryButton("COMEÇAR", Modifier.fillMaxWidth(), enabled = accepted, tag = "btn_start") {
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    notif.launch(Manifest.permission.POST_NOTIFICATIONS) else onFinish(periodic)
            }
            Spacer(Modifier.height(30.dp))
        }
    }
    if (showPolicy) AlertDialog(
        onDismissRequest = { showPolicy = false },
        title = { Text("Política de privacidade") },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) { Text(PRIVACY_POLICY, style = MaterialTheme.typography.bodySmall) } },
        confirmButton = { TextButton({ showPolicy = false; accepted = true }) { Text("Li e aceito") } },
        dismissButton = { TextButton({ showPolicy = false }) { Text("Fechar") } }
    )
}

@Composable
fun LockScreen(onUnlock: () -> Unit) {
    Centered {
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(28.dp), verticalArrangement = Arrangement.Center) {
            NexusLogo()
            Spacer(Modifier.height(24.dp))
            Text("App bloqueado", style = MaterialTheme.typography.headlineSmall, color = NX.c.text)
            Text("Use sua biometria ou o bloqueio do aparelho.", style = MaterialTheme.typography.bodyMedium, color = NX.c.muted)
            Spacer(Modifier.height(20.dp))
            PrimaryButton("DESBLOQUEAR", Modifier.fillMaxWidth(), icon = Icons.Filled.Lock) { onUnlock() }
        }
    }
}

@Suppress("unused")
@Composable
private fun AboutBlock() { KeyValue("Versão", BuildConfig.VERSION_NAME) }
