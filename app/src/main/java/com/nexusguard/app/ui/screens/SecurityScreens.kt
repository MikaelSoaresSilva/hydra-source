package com.nexusguard.app.ui.screens

import android.graphics.drawable.Drawable
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Radar
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.nexusguard.app.core.Intents
import com.nexusguard.app.security.AppInfo
import com.nexusguard.app.security.AppRiskRules
import com.nexusguard.app.security.CheckStatus
import com.nexusguard.app.security.SecurityScore
import com.nexusguard.app.security.SettingsTarget
import com.nexusguard.app.ui.MainViewModel
import com.nexusguard.app.ui.SecurityViewModel
import com.nexusguard.app.ui.components.Centered
import com.nexusguard.app.ui.components.EmptyState
import com.nexusguard.app.ui.components.ExpandableRow
import com.nexusguard.app.ui.components.InfoBox
import com.nexusguard.app.ui.components.KeyValue
import com.nexusguard.app.ui.components.NavRow
import com.nexusguard.app.ui.components.NexusCard
import com.nexusguard.app.ui.components.Pill
import com.nexusguard.app.ui.components.PrimaryButton
import com.nexusguard.app.ui.components.ProgressBlock
import com.nexusguard.app.ui.components.ScoreRing
import com.nexusguard.app.ui.components.ScreenHeader
import com.nexusguard.app.ui.components.SecondaryButton
import com.nexusguard.app.ui.components.SectionTitle
import com.nexusguard.app.ui.theme.NX
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun riskColor(level: String?) = when (level) {
    "Crítico", "Perigoso", "Provavelmente perigoso", "Insegura", "Em risco" -> NX.c.danger
    "Alto", "Suspeito", "Atenção" -> NX.c.warn
    "Moderado" -> NX.c.cyan
    else -> NX.c.success
}

@Composable
fun SecurityScreen(nav: NavHostController, main: MainViewModel) {
    val scan by main.latestScan.collectAsState()
    val scanUi by main.scan.collectAsState()
    val vm: SecurityViewModel = viewModel()
    val wifi by vm.wifi.collectAsState()
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("security_list")) {
            item {
                ScreenHeader("Segurança", "Verificações reais do aparelho, apps, arquivos, links e Wi-Fi")
                Spacer(Modifier.height(10.dp))
                NexusCard(glow = true) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ScoreRing(scan?.score, SecurityScore.label(scan?.score), size = 120.dp, scanning = scanUi.running)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(scan?.let { "${it.checks.count { c -> c.status == CheckStatus.PASS }} itens OK • ${it.failCount} riscos • ${it.warnCount} atenções" } ?: "Nenhuma verificação ainda",
                                style = MaterialTheme.typography.titleSmall, color = NX.c.text)
                            scan?.let { Text("Última: ${ago(it.timestamp)}", style = MaterialTheme.typography.labelSmall, color = NX.c.muted) }
                            Spacer(Modifier.height(10.dp))
                            PrimaryButton(if (scanUi.running) "VERIFICANDO…" else "VERIFICAÇÃO COMPLETA", Modifier.fillMaxWidth(), enabled = !scanUi.running, icon = Icons.Filled.Radar, tag = "btn_full_scan") {
                                main.runScan(); nav.navigate("security/scan")
                            }
                        }
                    }
                }
                SectionTitle("Ferramentas")
            }
            item { NavRow("Resultado da verificação", "Cada item verificado, com explicação e como corrigir", Icons.Filled.Radar, tag = "nav_scan") { nav.navigate("security/scan") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Análise de aplicativos", "Permissões sensíveis, origem, assinatura e risco de cada app", Icons.Filled.Apps, tag = "nav_apps") { nav.navigate("security/apps") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Arquivos e APKs", "Escolha um arquivo: tipo real, SHA-256, assinatura e indicadores", Icons.Filled.FolderOpen, tag = "nav_files") { nav.navigate("security/files") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Proteção contra phishing", "Cole ou compartilhe um link para analisar antes de abrir", Icons.Filled.Link, tag = "nav_phishing") { nav.navigate("security/phishing") }; Spacer(Modifier.height(8.dp)) }
            item {
                NavRow("Diagnóstico de Wi-Fi", if (wifi.onWifi) "Rede atual: ${wifi.label}" else "Você não está em Wi-Fi agora", Icons.Filled.Wifi,
                    badge = if (wifi.onWifi) wifi.label else null, badgeColor = riskColor(wifi.label), tag = "nav_wifi_sec") { nav.navigate("security/wifi") }
                Spacer(Modifier.height(8.dp))
            }
            item { NavRow("Histórico de ameaças", "Verificações, alertas e análises anteriores", Icons.Filled.History, tag = "nav_sec_history") { nav.navigate("security/history") }; Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
fun DeviceScanScreen(nav: NavHostController, main: MainViewModel) {
    val ctx = LocalContext.current
    val scan by main.latestScan.collectAsState()
    val scanUi by main.scan.collectAsState()
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("scan_list")) {
            item {
                ScreenHeader("Verificação do aparelho", scan?.let { "${it.device} • Android ${it.androidVersion}" }, onBack = { nav.popBackStack() })
                if (scanUi.running) ProgressBlock("Verificando configurações e sinais de risco…", null)
            }
            val s = scan
            if (s == null && !scanUi.running) item {
                NexusCard { EmptyState("Nenhuma verificação", "Toque abaixo para verificar o aparelho agora.") }
                Spacer(Modifier.height(10.dp))
                PrimaryButton("VERIFICAR AGORA", Modifier.fillMaxWidth()) { main.runScan() }
            }
            if (s != null) {
                item {
                    NexusCard(glow = true) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ScoreRing(s.score, SecurityScore.label(s.score), size = 110.dp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Como a nota é calculada", style = MaterialTheme.typography.titleSmall, color = NX.c.text)
                                Text("Cada item tem um peso. OK vale 100%, Atenção 50%, Risco 0%. Itens que o Android não permite verificar ficam fora da conta.",
                                    style = MaterialTheme.typography.bodySmall, color = NX.c.muted)
                            }
                        }
                    }
                    SectionTitle("Itens verificados (${s.checks.size})")
                }
                val order = listOf(CheckStatus.FAIL, CheckStatus.WARN, CheckStatus.UNKNOWN, CheckStatus.PASS, CheckStatus.INFO)
                items(s.checks.sortedBy { order.indexOf(it.status) }, key = { it.id }) { ch ->
                    NexusCard(Modifier.padding(bottom = 8.dp), padding = 10.dp) {
                        ExpandableRow(ch.title, ch.status, ch.detail, ch.recommendation,
                            actionLabel = if (ch.target != SettingsTarget.NONE) "Abrir configurações" else null,
                            onAction = { Intents.settings(ctx, ch.target) })
                    }
                }
                item {
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton(if (scanUi.running) "Verificando…" else "Verificar novamente", Modifier.fillMaxWidth(), enabled = !scanUi.running) { main.runScan() }
                    Spacer(Modifier.height(8.dp))
                    InfoBox("Nenhum aplicativo consegue garantir proteção absoluta. Esta nota resume configurações e sinais que o Android permite verificar.")
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
fun AppIcon(pkg: String, size: Int = 40) {
    val ctx = LocalContext.current
    val bmp by produceState<ImageBitmap?>(null, pkg) {
        value = runCatching {
            val d: Drawable = ctx.packageManager.getApplicationIcon(pkg)
            d.toBitmap(96, 96).asImageBitmap()
        }.getOrNull()
    }
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(10.dp)).background(NX.c.surfaceHigh), contentAlignment = Alignment.Center) {
        bmp?.let { Image(it, null, Modifier.size(size.dp)) }
    }
}

@Composable
fun AppsScreen(nav: NavHostController) {
    val vm: SecurityViewModel = viewModel()
    val ui by vm.apps.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("todos") }
    LaunchedEffect(Unit) { if (ui.apps.isEmpty() && !ui.loading) vm.loadApps() }
    val list = ui.apps.filter { a ->
        (query.isBlank() || a.label.contains(query, true) || a.packageName.contains(query, true)) &&
            when (filter) { "risco" -> a.risk.level != "Baixo"; "sideload" -> a.installer !in AppRiskRules.knownStores && !a.isSystem; else -> true }
    }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("apps_list")) {
            item {
                ScreenHeader("Aplicativos", if (ui.loading) "Analisando…" else "${ui.apps.size} apps • ${ui.apps.count { it.risk.level == "Alto" || it.risk.level == "Crítico" }} com risco alto", onBack = { nav.popBackStack() })
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), placeholder = { Text("Buscar app") }, singleLine = true,
                    leadingIcon = { androidx.compose.material3.Icon(Icons.Filled.Search, null) }, shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NX.c.blue, unfocusedBorderColor = NX.c.stroke))
                Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("todos" to "Todos", "risco" to "Com risco", "sideload" to "Fora da loja").forEach { (k, l) ->
                        FilterChip(filter == k, { filter = k }, { Text(l) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = NX.c.blue.copy(alpha = .3f)))
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (ui.includeSystem) "Incluindo apps do sistema" else "Apps instalados por você", style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.weight(1f))
                    Text(if (ui.includeSystem) "ocultar sistema" else "incluir sistema", style = MaterialTheme.typography.labelSmall, color = NX.c.cyan,
                        modifier = Modifier.clickable { vm.loadApps(!ui.includeSystem) }.padding(6.dp))
                }
                if (ui.loading) ProgressBlock("Lendo informações que o Android permite consultar…", null)
                ui.error?.let { InfoBox(it, color = NX.c.danger) }
                Spacer(Modifier.height(6.dp))
            }
            if (!ui.loading && list.isEmpty() && ui.apps.isNotEmpty()) item { EmptyState("Nada encontrado", "Ajuste a busca ou o filtro.") }
            items(list, key = { it.packageName }) { a -> AppRow(a) { nav.navigate("security/app/${a.packageName}") } }
            item {
                Spacer(Modifier.height(10.dp))
                InfoBox("Risco alto não significa infecção: indica acessos poderosos que merecem revisão. O Android não permite que apps leiam a memória ou os arquivos privados de outros apps — e o NEXUS GUARD não tenta contornar isso.")
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun AppRow(a: AppInfo, onClick: () -> Unit) {
    val c = NX.c
    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp).clip(RoundedCornerShape(16.dp)).background(c.surface).clickable { onClick() }.padding(12.dp),
        verticalAlignment = Alignment.CenterVertically) {
        AppIcon(a.packageName)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(a.label, style = MaterialTheme.typography.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(a.risk.sensitiveGranted.take(3).joinToString().ifEmpty { "Sem acessos sensíveis concedidos" }, style = MaterialTheme.typography.bodySmall, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Pill(a.risk.level, riskColor(a.risk.level))
    }
}

@Composable
fun AppDetailScreen(nav: NavHostController, pkg: String) {
    val ctx = LocalContext.current
    val vm: SecurityViewModel = viewModel()
    val info by produceState<AppInfo?>(null, pkg) { value = vm.appDetail(pkg) }
    val loaded by produceState(false, info) { value = info != null }
    val df = remember { SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")) }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item { ScreenHeader(info?.label ?: "Aplicativo", pkg, onBack = { nav.popBackStack() }) }
            val a = info
            if (a == null) item { if (!loaded) ProgressBlock("Carregando…", null) else EmptyState("App não encontrado", "Ele pode ter sido desinstalado.") }
            else {
                item {
                    NexusCard(glow = true) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            AppIcon(a.packageName, 52)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Risco ${a.risk.level}", style = MaterialTheme.typography.titleLarge, color = riskColor(a.risk.level))
                                Text("Pontuação ${a.risk.score}/100", style = MaterialTheme.typography.labelSmall, color = NX.c.muted)
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        a.risk.reasons.forEach { r -> Text("• $r", style = MaterialTheme.typography.bodySmall, color = NX.c.text, modifier = Modifier.padding(vertical = 3.dp)) }
                        Spacer(Modifier.height(10.dp))
                        PrimaryButton("ABRIR CONFIGURAÇÕES DO APP", Modifier.fillMaxWidth(), icon = Icons.Filled.Settings) { Intents.appDetails(ctx, a.packageName) }
                    }
                    SectionTitle("Informações")
                    NexusCard {
                        KeyValue("Versão", a.versionName)
                        KeyValue("Instalado por", a.installer?.let { storeName(it) } ?: "Instalação manual (APK)")
                        KeyValue("Instalado em", df.format(Date(a.firstInstall)))
                        KeyValue("Atualizado em", df.format(Date(a.lastUpdate)))
                        KeyValue("Feito para Android", "API ${a.targetSdk}")
                        KeyValue("App do sistema", if (a.isSystem) "Sim" else "Não")
                        KeyValue("Aparece na tela de apps", if (a.facts.launcherVisible) "Sim" else "Não")
                    }
                    SectionTitle("Acessos sensíveis concedidos (${a.risk.sensitiveGranted.size})")
                    NexusCard {
                        if (a.risk.sensitiveGranted.isEmpty()) Text("Nenhum.", style = MaterialTheme.typography.bodySmall, color = NX.c.muted)
                        a.risk.sensitiveGranted.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = NX.c.text, modifier = Modifier.padding(vertical = 2.dp)) }
                    }
                    SectionTitle("Assinatura digital")
                    NexusCard {
                        if (a.certs.isEmpty()) Text("Não foi possível ler o certificado.", style = MaterialTheme.typography.bodySmall, color = NX.c.muted)
                        a.certs.forEach { cert ->
                            Text(cert.pretty(), style = MaterialTheme.typography.bodySmall, color = NX.c.text)
                            if (cert.isDebug) Pill("certificado de depuração", NX.c.warn)
                            Spacer(Modifier.height(6.dp))
                        }
                    }
                    SectionTitle("Todas as permissões solicitadas (${a.requested.size})")
                    NexusCard {
                        a.requested.sorted().forEach { p ->
                            val granted = p in a.granted
                            Row(Modifier.padding(vertical = 2.dp)) {
                                Text(p.removePrefix("android.permission."), style = MaterialTheme.typography.bodySmall, color = if (AppRiskRules.sensitiveLabels.containsKey(p)) NX.c.warn else NX.c.text, modifier = Modifier.weight(1f))
                                Text(if (granted) "concedida" else "—", style = MaterialTheme.typography.labelSmall, color = if (granted) NX.c.cyan else NX.c.muted)
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

fun storeName(pkg: String) = when (pkg) {
    "com.android.vending" -> "Google Play Store"
    "com.xiaomi.market", "com.xiaomi.mipicks" -> "Xiaomi GetApps"
    "com.sec.android.app.samsungapps" -> "Galaxy Store"
    "org.fdroid.fdroid" -> "F-Droid"
    "com.google.android.packageinstaller", "com.android.packageinstaller", "com.miui.packageinstaller" -> "Instalador de pacotes (APK manual)"
    else -> pkg
}

@Composable
fun SecurityHistoryScreen(nav: NavHostController) {
    val vm: SecurityViewModel = viewModel()
    val hist by vm.history.collectAsState()
    val alerts by vm.alerts.collectAsState()
    var tab by rememberSaveable { mutableStateOf(0) }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Histórico de ameaças", "Tudo fica somente neste aparelho, criptografado", onBack = { nav.popBackStack() })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
                    FilterChip(tab == 0, { tab = 0 }, { Text("Análises (${hist.size})") })
                    FilterChip(tab == 1, { tab = 1 }, { Text("Alertas (${alerts.size})") })
                }
            }
            if (tab == 0) {
                if (hist.isEmpty()) item { EmptyState("Sem registros", "As verificações e análises aparecerão aqui.") }
                items(hist, key = { it.id }) { h ->
                    NexusCard(Modifier.padding(bottom = 8.dp), padding = 14.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(h.title, style = MaterialTheme.typography.titleSmall, color = NX.c.text, modifier = Modifier.weight(1f))
                            h.level?.let { Pill(it, riskColor(it)) }
                        }
                        Text(h.summary, style = MaterialTheme.typography.bodySmall, color = NX.c.muted, modifier = Modifier.padding(top = 4.dp))
                        Text(ago(h.timestamp), style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            } else {
                if (alerts.isEmpty()) item { EmptyState("Sem alertas", "Nenhum alerta registrado.") }
                items(alerts, key = { it.id }) { a ->
                    NexusCard(Modifier.padding(bottom = 8.dp), padding = 14.dp) {
                        Text(a.title, style = MaterialTheme.typography.titleSmall, color = NX.c.text)
                        Text(a.message, style = MaterialTheme.typography.bodySmall, color = NX.c.muted, modifier = Modifier.padding(top = 4.dp))
                        Text("${a.category} • ${ago(a.timestamp)}", style = MaterialTheme.typography.labelSmall, color = NX.c.muted, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}
