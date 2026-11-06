package com.nexusguard.app.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.nexusguard.app.core.Intents
import com.nexusguard.app.security.PhishingReport
import com.nexusguard.app.security.RiskLevel
import com.nexusguard.app.security.Severity
import com.nexusguard.app.ui.SecurityViewModel
import com.nexusguard.app.ui.components.Centered
import com.nexusguard.app.ui.components.EmptyState
import com.nexusguard.app.ui.components.FindingRow
import com.nexusguard.app.ui.components.InfoBox
import com.nexusguard.app.ui.components.KeyValue
import com.nexusguard.app.ui.components.NexusCard
import com.nexusguard.app.ui.components.Pill
import com.nexusguard.app.ui.components.PrimaryButton
import com.nexusguard.app.ui.components.ProgressBlock
import com.nexusguard.app.ui.components.ScoreRing
import com.nexusguard.app.ui.components.ScreenHeader
import com.nexusguard.app.ui.components.SecondaryButton
import com.nexusguard.app.ui.components.SectionTitle
import com.nexusguard.app.ui.theme.NX

fun bytes(n: Long): String = when {
    n >= 1_000_000_000 -> String.format("%.2f GB", n / 1e9)
    n >= 1_000_000 -> String.format("%.1f MB", n / 1e6)
    n >= 1_000 -> String.format("%.0f KB", n / 1e3)
    else -> "$n B"
}

@Composable
fun FilesScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    val vm: SecurityViewModel = viewModel()
    val ui by vm.file.collectAsState()
    val settings by vm.settings.collectAsState()
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { vm.scanFile(it) } }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Arquivos e APKs", "Só arquivos que você escolher. Nada é executado.", onBack = { nav.popBackStack() })
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PrimaryButton("ESCOLHER ARQUIVO", Modifier.weight(1f), enabled = !ui.running, icon = Icons.Filled.FolderOpen, tag = "btn_pick_file") { picker.launch(arrayOf("*/*")) }
                    SecondaryButton("APK", Modifier.weight(.6f), enabled = !ui.running) { picker.launch(arrayOf("application/vnd.android.package-archive")) }
                }
                Spacer(Modifier.height(8.dp))
                if (ui.running) ProgressBlock("Calculando SHA-256 e inspecionando…", ui.progress, "${(ui.progress * 100).toInt()}%")
                ui.error?.let { InfoBox(it, color = NX.c.danger) }
            }
            val r = ui.result
            if (r == null && !ui.running && ui.error == null) item {
                NexusCard {
                    EmptyState("Nenhum arquivo analisado", "Verificamos: tipo real pelo conteúdo (não só pela extensão), extensões duplas, disfarces, hash SHA-256, e para APKs: pacote, assinatura, certificado, permissões e base de stalkerware.")
                }
            }
            if (r != null) item {
                NexusCard(glow = true) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ScoreRing(100 - r.score, r.level, size = 110.dp, caption = "segurança estimada")
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(r.name, style = MaterialTheme.typography.titleSmall, color = NX.c.text)
                            Text("${r.detectedType} • ${bytes(r.sizeBytes)}", style = MaterialTheme.typography.bodySmall, color = NX.c.muted)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("SHA-256", style = MaterialTheme.typography.labelSmall, color = NX.c.muted)
                    Text(r.sha256, style = MaterialTheme.typography.bodySmall, color = NX.c.text, modifier = Modifier.testTag("sha256"))
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SecondaryButton("Copiar hash", Modifier.weight(1f), icon = Icons.Filled.ContentCopy) { Intents.copy(ctx, "SHA-256", r.sha256) }
                        SecondaryButton("VirusTotal", Modifier.weight(1f), icon = Icons.Filled.OpenInBrowser) { Intents.openUrl(ctx, "https://www.virustotal.com/gui/file/${r.sha256}") }
                    }
                    if (settings?.onlineReputation == true && settings?.hasVirusTotalKey == true) {
                        Spacer(Modifier.height(8.dp))
                        SecondaryButton(if (ui.repLoading) "Consultando…" else "Consultar hash no VirusTotal (API)", Modifier.fillMaxWidth(), enabled = !ui.repLoading) { vm.virusTotal() }
                    }
                    ui.reputation?.let { rep ->
                        Spacer(Modifier.height(8.dp))
                        InfoBox("${rep.source}: ${rep.verdict}. ${rep.detail}", color = if (rep.dangerous == true) NX.c.danger else NX.c.cyan)
                    }
                    Text("Abrir o VirusTotal envia somente o hash (impressão digital do arquivo) pelo navegador, nunca o arquivo.", style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.padding(top = 6.dp))
                }
                SectionTitle("Indicadores (${r.findings.size})")
                NexusCard {
                    if (r.findings.isEmpty()) FindingRow(Severity.INFO, "Nenhum indicador conhecido", "Isso não garante que o arquivo seja seguro. Abra apenas arquivos de fontes confiáveis.")
                    r.findings.forEach { FindingRow(it.sev, it.title, it.explanation) }
                }
                r.apk?.let { apk ->
                    SectionTitle("Aplicativo (APK)")
                    NexusCard {
                        KeyValue("Nome", apk.label)
                        KeyValue("Pacote", apk.packageName)
                        KeyValue("Versão", apk.versionName?.let { "$it (${apk.versionCode})" })
                        KeyValue("Android mínimo", apk.minSdk?.let { "API $it" })
                        KeyValue("Feito para", apk.targetSdk?.let { "API $it" })
                        KeyValue("Já instalado", when (apk.installedSameSigner) { null -> "Não"; true -> "Sim (${apk.installedVersion}), mesma assinatura"; false -> "Sim, ASSINATURA DIFERENTE" })
                        KeyValue("Arquivos DEX", apk.dexCount.toString())
                        KeyValue("Bibliotecas nativas", apk.nativeAbis.joinToString().ifEmpty { "nenhuma" })
                        KeyValue("Base stalkerware", apk.iocMatch ?: "sem correspondência")
                    }
                    SectionTitle("Certificado")
                    NexusCard {
                        if (apk.certs.isEmpty()) Text("Não foi possível ler.", style = MaterialTheme.typography.bodySmall, color = NX.c.muted)
                        apk.certs.forEach { Text(it.pretty(), style = MaterialTheme.typography.bodySmall, color = NX.c.text); Spacer(Modifier.height(6.dp)) }
                    }
                    SectionTitle("Permissões (${apk.permissions.size}, ${apk.sensitivePermissions.size} sensíveis)")
                    NexusCard {
                        apk.sensitivePermissions.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = NX.c.warn) }
                        apk.permissions.filter { p -> com.nexusguard.app.security.AppRiskRules.sensitiveLabels[p] == null }.sorted().forEach {
                            Text("• ${it.removePrefix("android.permission.")}", style = MaterialTheme.typography.bodySmall, color = NX.c.muted)
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
fun PhishingScreen(nav: NavHostController, initial: String?) {
    val ctx = LocalContext.current
    val vm: SecurityViewModel = viewModel()
    val ui by vm.phish.collectAsState()
    val settings by vm.settings.collectAsState()
    var text by rememberSaveable { mutableStateOf(initial ?: "") }
    var confirmOpen by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(initial) { if (!initial.isNullOrBlank()) vm.analyzeUrl(initial) }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Proteção contra phishing", "Análise local — o link não é aberto", onBack = { nav.popBackStack() })
                OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth().testTag("url_input"), label = { Text("Cole o link ou a mensagem") }, minLines = 2,
                    shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NX.c.blue, unfocusedBorderColor = NX.c.stroke))
                Spacer(Modifier.height(10.dp))
                PrimaryButton("ANALISAR LINK", Modifier.fillMaxWidth(), enabled = text.isNotBlank(), icon = Icons.Filled.Search, tag = "btn_analyze_url") { vm.analyzeUrl(text) }
                Spacer(Modifier.height(8.dp))
                Text("Dica: no WhatsApp, navegador ou e-mail, toque em Compartilhar → NEXUS GUARD.", style = MaterialTheme.typography.labelSmall, color = NX.c.muted)
            }
            ui.report?.let { r ->
                item {
                    Spacer(Modifier.height(10.dp))
                    PhishReportCard(r)
                    if (r.url != null) {
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SecondaryButton(if (ui.expanding) "Seguindo…" else "Expandir link", Modifier.weight(1f), enabled = !ui.expanding, icon = Icons.Filled.UnfoldMore, tag = "btn_expand") { vm.expand() }
                            SecondaryButton("Abrir mesmo assim", Modifier.weight(1f), icon = Icons.Filled.OpenInBrowser) { confirmOpen = true }
                        }
                        Text("\"Expandir\" consulta o endereço só para ler o redirecionamento (sem carregar a página nem executar scripts).", style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.padding(top = 6.dp))
                        if (settings?.onlineReputation == true && settings?.hasSafeBrowsingKey == true) {
                            Spacer(Modifier.height(8.dp))
                            SecondaryButton(if (ui.repLoading) "Consultando…" else "Consultar Google Safe Browsing", Modifier.fillMaxWidth(), enabled = !ui.repLoading) { vm.safeBrowsing() }
                        }
                        ui.reputation?.let { InfoBox("${it.source}: ${it.verdict}. ${it.detail}", Modifier.padding(top = 8.dp), if (it.dangerous == true) NX.c.danger else NX.c.cyan) }
                    }
                }
                ui.hops?.let { hops ->
                    item {
                        SectionTitle("Caminho do link")
                        NexusCard {
                            hops.forEachIndexed { i, h ->
                                Text("${i + 1}. ${h.url}", style = MaterialTheme.typography.bodySmall, color = NX.c.text)
                                Text(if (h.status < 0) "sem resposta" else "HTTP ${h.status}", style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.padding(bottom = 6.dp))
                            }
                        }
                        ui.expandedReport?.let { er ->
                            SectionTitle("Análise do destino final")
                            PhishReportCard(er)
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
    if (confirmOpen) {
        val r = ui.expandedReport ?: ui.report
        AlertDialog(
            onDismissRequest = { confirmOpen = false },
            title = { Text(if ((r?.score ?: 0) >= 35) "Link possivelmente perigoso" else "Abrir link") },
            text = { Text(if ((r?.score ?: 0) >= 35) "O NEXUS GUARD encontrou sinais de golpe neste link (${r?.level?.label}). Se abrir, não digite senhas, códigos ou dados de cartão." else "Nenhum sinal forte foi encontrado, mas continue atento a pedidos de senha ou pagamento.") },
            confirmButton = { TextButton({ confirmOpen = false; r?.url?.let { Intents.openUrl(ctx, it) } }) { Text("Abrir") } },
            dismissButton = { TextButton({ confirmOpen = false }) { Text("Cancelar") } }
        )
    }
}

@Composable
fun PhishReportCard(r: PhishingReport) {
    val col = when (r.level) { RiskLevel.DANGEROUS -> NX.c.danger; RiskLevel.SUSPICIOUS -> NX.c.warn; RiskLevel.ATTENTION -> NX.c.cyan; RiskLevel.INVALID -> NX.c.muted; RiskLevel.NONE_FOUND -> NX.c.success }
    NexusCard(glow = true) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(r.level.label, style = MaterialTheme.typography.titleLarge, color = col, modifier = Modifier.testTag("phish_level"))
                r.registrableDomain?.let { Text("Domínio real: $it", style = MaterialTheme.typography.titleSmall, color = NX.c.text) }
                r.url?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = NX.c.muted, maxLines = 3) }
            }
            Pill("risco ${r.score}", col)
        }
        Spacer(Modifier.height(8.dp))
        r.findings.forEach { FindingRow(it.severity, it.title, it.explanation) }
    }
}

@Composable
fun WifiSecurityScreen(nav: NavHostController) {
    val vm: SecurityViewModel = viewModel()
    val a by vm.wifi.collectAsState()
    var asked by rememberSaveable { mutableStateOf(false) }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { vm.refreshWifi() }
    LaunchedEffect(Unit) { vm.refreshWifi() }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Diagnóstico de Wi-Fi", "Verificação defensiva: nada é atacado ou varrido", onBack = { nav.popBackStack() })
                NexusCard(glow = true) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ScoreRing(if (a.onWifi) a.score else null, a.label, size = 110.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(if (a.onWifi) "Rede atual" else "Sem Wi-Fi", style = MaterialTheme.typography.titleSmall, color = NX.c.text)
                            Spacer(Modifier.height(8.dp))
                            SecondaryButton("Verificar de novo", Modifier.fillMaxWidth(), icon = Icons.Filled.Refresh) { vm.refreshWifi() }
                        }
                    }
                }
                if (!vm.locationGranted() && !asked) {
                    Spacer(Modifier.height(10.dp))
                    InfoBox("Opcional: o Android só mostra o nome da rede (e, em versões antigas, o tipo de segurança) para apps com permissão de localização. O NEXUS GUARD não registra sua localização.")
                    Spacer(Modifier.height(6.dp))
                    SecondaryButton("Permitir localização (opcional)", Modifier.fillMaxWidth()) { asked = true; perm.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
                }
                SectionTitle("O que encontramos")
                NexusCard { a.findings.forEach { FindingRow(it.severity, it.title, it.explanation) } }
                SectionTitle("Boas práticas")
                NexusCard {
                    listOf(
                        "Em redes públicas, use dados móveis para bancos e compras.",
                        "Ative o DNS privado (Internet > Diagnóstico DNS indica o mais rápido).",
                        "Desative \"Conectar automaticamente\" em redes abertas que você não usa mais.",
                        "No seu roteador: WPA2-AES ou WPA3, senha longa, firmware atualizado e WPS desligado.",
                        "Desconfie de redes com nomes genéricos (\"Free WiFi\") ou iguais à de um local conhecido."
                    ).forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = NX.c.text, modifier = Modifier.padding(vertical = 3.dp)) }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}
