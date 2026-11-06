package com.nexusguard.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CellTower
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.nexusguard.app.core.Intents
import com.nexusguard.app.network.ConnType
import com.nexusguard.app.network.ConnectionState
import com.nexusguard.app.network.Diagnosis
import com.nexusguard.app.network.DnsBenchmarker
import com.nexusguard.app.network.FixAction
import com.nexusguard.app.network.Issue
import com.nexusguard.app.network.IssueLevel
import com.nexusguard.app.network.NetworkSnapshot
import com.nexusguard.app.network.SpeedMode
import com.nexusguard.app.ui.InternetViewModel
import com.nexusguard.app.ui.components.BarChart
import com.nexusguard.app.ui.components.Centered
import com.nexusguard.app.ui.components.EmptyState
import com.nexusguard.app.ui.components.HBar
import com.nexusguard.app.ui.components.InfoBox
import com.nexusguard.app.ui.components.KeyValue
import com.nexusguard.app.ui.components.LineChart
import com.nexusguard.app.ui.components.MetricTile
import com.nexusguard.app.ui.components.NA
import com.nexusguard.app.ui.components.NavRow
import com.nexusguard.app.ui.components.NexusCard
import com.nexusguard.app.ui.components.Pill
import com.nexusguard.app.ui.components.PrimaryButton
import com.nexusguard.app.ui.components.ProgressBlock
import com.nexusguard.app.ui.components.PulseDot
import com.nexusguard.app.ui.components.ScoreRing
import com.nexusguard.app.ui.components.ScreenHeader
import com.nexusguard.app.ui.components.SecondaryButton
import com.nexusguard.app.ui.components.SectionTitle
import com.nexusguard.app.ui.components.TileRow
import com.nexusguard.app.ui.theme.Grotesk
import com.nexusguard.app.ui.theme.NX

@Composable
fun ConnectionPanel(s: ConnectionState) {
    val c = NX.c
    NexusCard(glow = true) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PulseDot(if (!s.connected) c.danger else if (s.validated) c.success else c.warn)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(s.type.label, style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.testTag("conn_type"))
                Text(when {
                    !s.connected -> "Sem conexão"
                    s.captivePortal -> "Rede exige login (portal cativo)"
                    s.validated -> "Acesso à internet confirmado"
                    else -> "Conectado, internet não confirmada"
                }, style = MaterialTheme.typography.bodySmall, color = c.muted)
            }
            if (s.vpnActive) Pill("VPN", c.purple)
            if (s.metered == true) { Spacer(Modifier.width(6.dp)); Pill("tarifada", c.warn) }
        }
        if (s.connected) {
            Spacer(Modifier.height(10.dp))
            when (s.type) {
                ConnType.WIFI -> s.wifi?.let { w ->
                    TileRow {
                        MetricTile("Sinal", w.rssiDbm?.toString() ?: NA, "dBm", Modifier.weight(1f), color = w.rssiDbm?.let { if (it > -67) c.success else if (it > -78) c.warn else c.danger })
                        MetricTile("Banda", w.bandLabel ?: NA, "", Modifier.weight(1f))
                        MetricTile("Enlace", w.linkSpeedMbps?.toString() ?: NA, "Mbps", Modifier.weight(1f))
                    }
                }
                ConnType.CELLULAR -> s.cellular?.let { cell ->
                    TileRow {
                        MetricTile("Tecnologia", cell.technology ?: NA, "", Modifier.weight(1.3f))
                        MetricTile("Sinal", cell.signalLevel?.let { "$it/4" } ?: NA, "", Modifier.weight(1f))
                        MetricTile("RSRP", cell.rsrp?.toString() ?: NA, "dBm", Modifier.weight(1f))
                    }
                }
                else -> {}
            }
            KeyValue("DNS privado", when (s.privateDnsActive) { true -> "Ativo" + (s.privateDnsServer?.let { " ($it)" } ?: " (automático)"); false -> "Inativo"; null -> null })
            KeyValue("Estimativa do sistema", s.estDownKbps?.let { "↓ ${it / 1000} / ↑ ${(s.estUpKbps ?: 0) / 1000} Mbps (não é medição)" })
        }
    }
}

@Composable
fun InternetScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val conn by vm.connection.collectAsState()
    val lat by vm.latestLatency.collectAsState()
    val sp by vm.latestSpeed.collectAsState()
    val dns by vm.latestDns.collectAsState()
    val stab by vm.stability.collectAsState()
    val latUi by vm.latency.collectAsState()
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("internet_list")) {
            item {
                ScreenHeader("Internet", "Medições reais da sua conexão")
                Spacer(Modifier.height(8.dp))
                ConnectionPanel(conn)
                Spacer(Modifier.height(12.dp))
                PrimaryButton("OTIMIZAR MINHA INTERNET", Modifier.fillMaxWidth(), icon = Icons.Filled.Bolt, tag = "btn_optimize") { nav.navigate("internet/optimize") }
                SectionTitle("Últimas medições", action = {
                    Text(if (latUi.running) "medindo…" else "medir ping", style = MaterialTheme.typography.labelSmall, color = NX.c.cyan,
                        modifier = Modifier.testTag("btn_quick_ping").clickable(enabled = !latUi.running) { vm.runLatency() }.padding(4.dp))
                })
                val l = latUi.result ?: lat
                TileRow {
                    MetricTile("Ping", fmt1(l?.medianMs), "ms", Modifier.weight(1f), Icons.Filled.Timer, tag = "tile_ping")
                    MetricTile("Jitter", fmt1(l?.jitterMs), "ms", Modifier.weight(1f))
                    MetricTile("Perda", fmt1(l?.lossPercent), "%", Modifier.weight(1f))
                }
                TileRow {
                    MetricTile("Download", fmt1(sp?.downloadMbps), "Mbps", Modifier.weight(1f), Icons.Filled.Speed)
                    MetricTile("Upload", fmt1(sp?.uploadMbps), "Mbps", Modifier.weight(1f))
                    MetricTile("DNS", fmt1(dns?.system?.combinedMs ?: dns?.best?.combinedMs), "ms", Modifier.weight(1f))
                }
                if (latUi.running || latUi.live.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    NexusCard(padding = 12.dp) { LineChart(latUi.live, height = 80.dp, unit = "ms") }
                }
                SectionTitle("Ferramentas")
            }
            item { NavRow("Teste de velocidade", "Download, upload, ping e jitter (consumo informado antes)", Icons.Filled.Speed, tag = "nav_speed") { nav.navigate("internet/speed") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Diagnóstico DNS", "Compara resolvedores e recomenda o DNS privado mais rápido", Icons.Filled.Dns, tag = "nav_dns") { nav.navigate("internet/dns") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Modo Estabilidade", if (stab.running) "Ativo • ${stab.total} verificações • ${stab.outages} quedas" else "Monitora quedas e oscilações enquanto estiver ligado", Icons.Filled.MonitorHeart,
                badge = if (stab.running) "ATIVO" else null, badgeColor = NX.c.success, tag = "nav_stability") { nav.navigate("internet/stability") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Wi-Fi inteligente", "Sinal, banda 2,4/5 GHz, canal, padrão e recomendações", Icons.Filled.Wifi, tag = "nav_wifi_net") { nav.navigate("internet/wifi") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Internet móvel (4G/5G)", "Tecnologia, sinal, operadora e diagnóstico", Icons.Filled.CellTower, tag = "nav_mobile") { nav.navigate("internet/mobile") }; Spacer(Modifier.height(8.dp)) }
            item { NavRow("Histórico de desempenho", "Testes anteriores e gráficos", Icons.Filled.History, tag = "nav_net_history") { nav.navigate("internet/history") }; Spacer(Modifier.height(24.dp)) }
        }
    }
}


// ------------------------------------------------------------------ Velocidade
@Composable
fun SpeedScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val ui by vm.speed.collectAsState()
    val conn by vm.connection.collectAsState()
    val hist by vm.speedHistory.collectAsState()
    val settings by vm.settings.collectAsState()
    var mode by rememberSaveable { mutableStateOf(if (settings?.speedMode == "full") SpeedMode.FULL else SpeedMode.LIGHT) }
    var confirm by rememberSaveable { mutableStateOf(false) }
    val c = NX.c
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Teste de velocidade", "Servidor: Cloudflare (speed.cloudflare.com)", onBack = { nav.popBackStack() })
                NexusCard(glow = true) {
                    val p = ui.progress
                    val live = p?.liveMbps
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(p?.phase ?: if (ui.result != null) "Resultado" else "Pronto para testar", style = MaterialTheme.typography.labelMedium, color = c.muted)
                        Text(when {
                            ui.running && live != null -> fmt1(live)
                            ui.result?.downloadMbps != null && !ui.running -> fmt1(ui.result?.downloadMbps)
                            else -> "--"
                        }, fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 64.sp, color = c.text, modifier = Modifier.testTag("speed_value"))
                        Text("Mbps", style = MaterialTheme.typography.labelMedium, color = c.cyan)
                    }
                    if (ui.running) {
                        ProgressBlock(p?.phase ?: "Iniciando", p?.fraction, p?.latencyMs?.let { "ping ${fmt1(it)} ms" })
                        if (ui.samples.isNotEmpty()) LineChart(ui.samples.map { it }, height = 90.dp, unit = "Mbps")
                    }
                    ui.result?.let { r ->
                        Spacer(Modifier.height(10.dp))
                        if (r.error != null) InfoBox(r.error, color = c.danger)
                        TileRow {
                            MetricTile("Download", fmt1(r.downloadMbps), "Mbps", Modifier.weight(1f), tag = "res_down")
                            MetricTile("Upload", fmt1(r.uploadMbps), "Mbps", Modifier.weight(1f), tag = "res_up")
                        }
                        TileRow {
                            MetricTile("Ping", fmt1(r.idleLatencyMs), "ms", Modifier.weight(1f))
                            MetricTile("Sob carga", fmt1(r.loadedLatencyMs), "ms", Modifier.weight(1f))
                            MetricTile("Jitter", fmt1(r.jitterMs), "ms", Modifier.weight(1f))
                        }
                        Text("Dados usados: ${bytes(r.bytesDown + r.bytesUp)} • ${r.connType}", style = MaterialTheme.typography.labelSmall, color = c.muted)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SpeedMode.values().forEach { m ->
                        FilterChip(mode == m, { if (!ui.running) mode = m }, { Text("${m.label} (até ~${m.maxDataMb} MB)") })
                    }
                }
                Spacer(Modifier.height(8.dp))
                if (ui.running) SecondaryButton("CANCELAR", Modifier.fillMaxWidth(), icon = Icons.Filled.Stop) { vm.cancelSpeed() }
                else PrimaryButton("INICIAR TESTE", Modifier.fillMaxWidth(), icon = Icons.Filled.PlayArrow, tag = "btn_start_speed") {
                    if (conn.metered == true || conn.type == ConnType.CELLULAR) confirm = true else vm.runSpeed(mode)
                }
                Spacer(Modifier.height(8.dp))
                InfoBox("Consumo máximo: ~${mode.maxDataMb} MB (limite rígido; em conexões lentas o consumo é menor). O teste mede a conexão até o servidor da Cloudflare; serviços específicos podem ter desempenho diferente. A Cloudflare recebe seu endereço IP, como em qualquer site.")
                if (hist.isNotEmpty()) {
                    SectionTitle("Histórico de download (${hist.size} testes)")
                    NexusCard { BarChart(hist.mapNotNull { it.downloadMbps }) }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("Usar dados móveis?") },
        text = { Text("Você está em uma conexão tarifada. O modo ${mode.label} pode consumir até ~${mode.maxDataMb} MB do seu pacote.") },
        confirmButton = { TextButton({ confirm = false; vm.runSpeed(mode) }, modifier = Modifier.testTag("confirm_speed")) { Text("Testar") } },
        dismissButton = { TextButton({ confirm = false }) { Text("Cancelar") } }
    )
}

// ------------------------------------------------------------------ DNS
@Composable
fun DnsScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    val vm: InternetViewModel = viewModel()
    val ui by vm.dns.collectAsState()
    val latest by vm.latestDns.collectAsState()
    val conn by vm.connection.collectAsState()
    val res = ui.result ?: latest
    val c = NX.c
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Diagnóstico DNS", "Tempo de resposta real de cada resolvedor nesta rede", onBack = { nav.popBackStack() })
                InfoBox("O DNS traduz nomes (google.com) em endereços. Um DNS mais rápido faz os sites COMEÇAREM a carregar antes. Ele NÃO aumenta a velocidade de download nem reduz o ping de jogos.")
                Spacer(Modifier.height(10.dp))
                PrimaryButton(if (ui.running) "MEDINDO ${ui.current ?: ""}…" else "COMPARAR DNS (~10 KB)", Modifier.fillMaxWidth(), enabled = !ui.running, icon = Icons.Filled.Dns, tag = "btn_dns") { vm.runDns() }
                if (ui.running) ProgressBlock("Enviando consultas reais (UDP/53)…", null)
                KeyValue("DNS privado agora", when (conn.privateDnsActive) { true -> conn.privateDnsServer ?: "Automático (ativo)"; false -> "Desligado"; null -> null })
            }
            if (res == null && !ui.running) item { NexusCard { EmptyState("Sem comparação ainda", "Toque em COMPARAR DNS. São enviadas cerca de 20 consultas pequenas a cada servidor.") } }
            if (res != null) {
                val best = res.best
                val sysMs = res.system?.combinedMs
                val systemFaster = best != null && sysMs != null && res.system!!.successRate >= 0.8 && sysMs <= best.combinedMs!!
                item {
                    best?.let { b ->
                        SectionTitle("Recomendação para esta rede")
                        NexusCard(glow = true) {
                            if (systemFaster) {
                                Text("Seu DNS atual já é o mais rápido (${fmt1(sysMs)} ms)", style = MaterialTheme.typography.titleLarge, color = c.success, modifier = Modifier.testTag("dns_best"))
                                Text("Trocar não traria ganho de velocidade nesta rede. Opcional, por privacidade (consultas criptografadas): o DNS público mais rápido aqui foi ${b.name}, com ${fmt1(b.combinedMs)} ms.",
                                    style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(vertical = 6.dp))
                            } else
                            Text("${b.name} — ${fmt1(b.combinedMs)} ms", style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.testTag("dns_best"))
                            Text("Nome do host para o DNS privado:", style = MaterialTheme.typography.bodySmall, color = c.muted)
                            Text(b.dotHost ?: "-", style = MaterialTheme.typography.titleMedium, color = c.cyan)
                            DnsBenchmarker.resolvers.firstOrNull { it.name == b.name }?.let { Text(it.note, style = MaterialTheme.typography.bodySmall, color = c.muted) }
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                SecondaryButton("Copiar", Modifier.weight(1f), icon = Icons.Filled.ContentCopy) { Intents.copy(ctx, "DNS privado", b.dotHost ?: "") }
                                PrimaryButton("CONFIGURAR", Modifier.weight(1f), icon = Icons.Filled.Settings) { b.dotHost?.let { Intents.copy(ctx, "DNS privado", it) }; Intents.privateDns(ctx) }
                            }
                            Spacer(Modifier.height(10.dp))
                            Text("Como configurar (o Android não permite que apps mudem o DNS sozinhos):", style = MaterialTheme.typography.titleSmall, color = c.text)
                            listOf(
                                "Toque em CONFIGURAR (o nome já fica copiado).",
                                "Xiaomi/POCO (HyperOS): Configurações › Conexão e compartilhamento › DNS privado.",
                                "Outros: Configurações › Rede e internet › DNS privado.",
                                "Escolha \"Nome do host do provedor de DNS privado\", cole e salve.",
                                "Para desfazer: volte para \"Automático\"."
                            ).forEachIndexed { i, t -> Text("${i + 1}. $t", style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(vertical = 2.dp)) }
                        }
                    }
                    SectionTitle("Resultados (menor é melhor)")
                }
                val maxMs = res.results.mapNotNull { it.combinedMs }.maxOrNull() ?: 1.0
                items(res.results.sortedBy { it.combinedMs ?: Double.MAX_VALUE }, key = { it.name }) { r ->
                    NexusCard(Modifier.padding(bottom = 8.dp), padding = 12.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(r.name, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
                            if (r.isSystem) Pill("atual", c.purple)
                            if (r == res.best) { Spacer(Modifier.width(6.dp)); Pill("mais rápido", c.success) }
                        }
                        Text("${r.address} • sucesso ${(r.successRate * 100).toInt()}%", style = MaterialTheme.typography.labelSmall, color = c.muted)
                        Spacer(Modifier.height(6.dp))
                        HBar(((r.combinedMs ?: maxMs) / maxMs).toFloat(), if (r == res.best) c.success else c.blue)
                        Spacer(Modifier.height(4.dp))
                        Text("Populares: ${fmt1(r.cachedMedianMs)} ms • Não armazenados: ${fmt1(r.uncachedMedianMs)} ms", style = MaterialTheme.typography.labelSmall, color = c.muted)
                    }
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

// ------------------------------------------------------------------ Otimizador
@Composable
fun IssueCard(i: Issue) {
    val ctx = LocalContext.current
    val c = NX.c
    val col = when (i.level) { IssueLevel.BAD -> c.danger; IssueLevel.WARN -> c.warn; IssueLevel.INFO -> c.cyan; IssueLevel.OK -> c.success }
    NexusCard(Modifier.padding(bottom = 8.dp), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(i.title, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
            Pill(i.level.label, col)
        }
        Text(i.detail, style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(top = 4.dp))
        Text("Recomendação: ${i.recommendation}", style = MaterialTheme.typography.bodySmall, color = c.text, modifier = Modifier.padding(top = 6.dp))
        i.consequence?.let { Text("Efeitos: $it", style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(top = 4.dp)) }
        val label = when (i.action) {
            FixAction.PRIVATE_DNS -> "Configurar DNS privado"
            FixAction.WIFI_PANEL -> "Abrir redes Wi-Fi"
            FixAction.INTERNET_PANEL -> "Abrir conexões"
            FixAction.CAPTIVE_LOGIN -> "Abrir login da rede"
            FixAction.MOBILE_DATA_SETTINGS -> "Abrir rede móvel"
            FixAction.NONE -> null
        }
        if (label != null) {
            Spacer(Modifier.height(8.dp))
            SecondaryButton(label, Modifier.fillMaxWidth()) {
                when (i.action) {
                    FixAction.PRIVATE_DNS -> Intents.privateDns(ctx)
                    FixAction.WIFI_PANEL -> Intents.wifiPanel(ctx)
                    FixAction.INTERNET_PANEL -> Intents.internetPanel(ctx)
                    FixAction.CAPTIVE_LOGIN -> Intents.captiveLogin(ctx)
                    FixAction.MOBILE_DATA_SETTINGS -> Intents.mobileData(ctx)
                    FixAction.NONE -> {}
                }
            }
        }
    }
}

@Composable
private fun SnapshotTiles(s: NetworkSnapshot, d: Diagnosis) {
    TileRow {
        MetricTile("Nota", d.score?.toString() ?: NA, "/100", Modifier.weight(1f))
        MetricTile("Ping", fmt1(s.latency?.medianMs), "ms", Modifier.weight(1f))
        MetricTile("Jitter", fmt1(s.latency?.jitterMs), "ms", Modifier.weight(1f))
    }
    TileRow {
        MetricTile("Perda", fmt1(s.latency?.lossPercent), "%", Modifier.weight(1f))
        MetricTile("DNS atual", fmt1(s.dns?.system?.combinedMs), "ms", Modifier.weight(1f))
        MetricTile("Falhas", s.stability?.let { "${it.failures}/${it.samples}" } ?: NA, "", Modifier.weight(1f))
    }
}

@Composable
fun OptimizeScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val ui by vm.opt.collectAsState()
    val c = NX.c
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("optimize_list")) {
            item {
                ScreenHeader("Otimizar minha internet", "Medir → diagnosticar → recomendar → medir de novo", onBack = { nav.popBackStack() })
                when (ui.phase) {
                    "idle" -> {
                        NexusCard(glow = true) {
                            Text("O que vai acontecer", style = MaterialTheme.typography.titleMedium, color = c.text)
                            listOf("Analisar a conexão atual", "Medir latência e perda de pacotes (20 pings)", "Comparar servidores DNS", "Verificar estabilidade (10 testes)",
                                "Verificar portal cativo", "Gerar recomendações com base nos números", "Você aplica os ajustes permitidos pelo Android", "Medir de novo e comparar antes × depois")
                                .forEachIndexed { i, t -> Text("${i + 1}. $t", style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(vertical = 2.dp)) }
                            Spacer(Modifier.height(6.dp))
                            Text("Consumo: menos de 100 KB. Duração: cerca de 15 segundos.", style = MaterialTheme.typography.labelSmall, color = c.cyan)
                        }
                        Spacer(Modifier.height(12.dp))
                        PrimaryButton("OTIMIZAR MINHA INTERNET", Modifier.fillMaxWidth(), icon = Icons.Filled.Bolt, tag = "btn_run_optimize") { vm.optimize() }
                        Spacer(Modifier.height(8.dp))
                        InfoBox("Transparência: o Android não permite que aplicativos troquem DNS, banda Wi-Fi ou modo de rede sozinhos. O NEXUS GUARD mede, explica e abre a tela oficial certa para você aplicar cada ajuste. Nenhuma configuração é alterada sem você.")
                    }
                    "running" -> NexusCard(glow = true) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ScoreRing(null, if (ui.measuringAfter) "Depois" else "Analisando", size = 110.dp, scanning = true)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Etapa ${ui.step + 1} de 6", style = MaterialTheme.typography.labelSmall, color = c.muted)
                                Text(ui.stepLabel, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.testTag("opt_step"))
                                ui.live?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.cyan) }
                            }
                        }
                        ProgressBlock("Medindo", (ui.step + 1) / 6f)
                    }
                    else -> {}
                }
            }
            val rep = ui.report
            if (rep != null && (ui.phase == "ready" || ui.phase == "done")) {
                item {
                    if (ui.phase == "done" && rep.after != null && rep.afterDiagnosis != null) {
                        SectionTitle("Antes × depois")
                        NexusCard(glow = true) {
                            CompareRow("Nota", rep.beforeDiagnosis.score?.toDouble(), rep.afterDiagnosis.score?.toDouble(), "", higherBetter = true)
                            CompareRow("Ping (mediana)", rep.before.latency?.medianMs, rep.after.latency?.medianMs, "ms")
                            CompareRow("Jitter", rep.before.latency?.jitterMs, rep.after.latency?.jitterMs, "ms")
                            CompareRow("Perda", rep.before.latency?.lossPercent, rep.after.latency?.lossPercent, "%")
                            CompareRow("DNS do sistema", rep.before.dns?.system?.combinedMs, rep.after.dns?.system?.combinedMs, "ms")
                            Spacer(Modifier.height(6.dp))
                            Text("Diferenças pequenas (poucos ms) são variação normal da rede. Compare tendências repetindo o teste.", style = MaterialTheme.typography.labelSmall, color = c.muted)
                        }
                    }
                    SectionTitle(if (ui.phase == "done") "Situação atual" else "Diagnóstico")
                    val d = if (ui.phase == "done") rep.afterDiagnosis ?: rep.beforeDiagnosis else rep.beforeDiagnosis
                    val s = if (ui.phase == "done") rep.after ?: rep.before else rep.before
                    NexusCard(glow = true) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ScoreRing(d.score, d.label, size = 100.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(connSummary(s.connection), style = MaterialTheme.typography.titleSmall, color = c.text)
                                Text("${d.issues.count { it.level >= IssueLevel.WARN }} ponto(s) de atenção", style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.testTag("opt_issues"))
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        SnapshotTiles(s, d)
                    }
                    SectionTitle("Recomendações personalizadas")
                }
                val d = if (ui.phase == "done") rep.afterDiagnosis ?: rep.beforeDiagnosis else rep.beforeDiagnosis
                items(d.issues, key = { it.id }) { IssueCard(it) }
                item {
                    Spacer(Modifier.height(8.dp))
                    if (ui.phase == "ready") {
                        InfoBox("Aplique as recomendações que fizerem sentido (botões acima) e depois meça de novo para comparar.")
                        Spacer(Modifier.height(8.dp))
                        PrimaryButton("MEDIR NOVAMENTE (DEPOIS)", Modifier.fillMaxWidth(), tag = "btn_measure_after") { vm.measureAfter() }
                    }
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton("Recomeçar", Modifier.fillMaxWidth()) { vm.resetOptimize() }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun CompareRow(label: String, before: Double?, after: Double?, unit: String, higherBetter: Boolean = false) {
    val c = NX.c
    val better = if (before != null && after != null) (if (higherBetter) after > before else after < before) else null
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.weight(1f))
        Text("${fmt1(before)} → ${fmt1(after)} $unit", style = MaterialTheme.typography.titleSmall,
            color = when (better) { true -> c.success; false -> c.warn; null -> c.text })
    }
}

// ------------------------------------------------------------------ Estabilidade
@Composable
fun StabilityScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val st by vm.stability.collectAsState()
    val events by vm.stabilityEvents.collectAsState()
    val ctx = LocalContext.current
    val c = NX.c
    val notifPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { vm.startStability() }
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Modo Estabilidade", "Acompanha a conexão enquanto estiver ligado", onBack = { nav.popBackStack() })
                NexusCard(glow = st.running) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PulseDot(if (st.running) c.success else c.muted)
                        Spacer(Modifier.width(10.dp))
                        Text(if (st.running) "Monitorando a cada ${st.intervalSec} s" else "Desligado", style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f).testTag("stab_status"))
                        st.outageStart?.let { Pill("SEM INTERNET", c.danger) }
                    }
                    Spacer(Modifier.height(10.dp))
                    TileRow {
                        MetricTile("Verificações", st.total.toString(), "", Modifier.weight(1f), tag = "stab_total")
                        MetricTile("Falhas", st.failures.toString(), "", Modifier.weight(1f))
                        MetricTile("Quedas", st.outages.toString(), "", Modifier.weight(1f))
                    }
                    val sum = st.summary()
                    TileRow {
                        MetricTile("Latência", fmt1(sum.medianRttMs), "ms", Modifier.weight(1f))
                        MetricTile("Jitter", fmt1(sum.jitterMs), "ms", Modifier.weight(1f))
                        MetricTile("Trocas", st.networkChanges.toString(), "", Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    LineChart(st.samples.map { it.rttMs }, height = 120.dp, unit = "ms")
                    Text("Marcas vermelhas = verificação sem resposta.", style = MaterialTheme.typography.labelSmall, color = c.muted)
                }
                Spacer(Modifier.height(12.dp))
                if (st.running) SecondaryButton("ENCERRAR MONITORAMENTO", Modifier.fillMaxWidth(), icon = Icons.Filled.Stop, tag = "btn_stab_stop") { vm.stopStability() }
                else PrimaryButton("INICIAR MONITORAMENTO", Modifier.fillMaxWidth(), icon = Icons.Filled.PlayArrow, tag = "btn_stab_start") {
                    if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                        notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS) else vm.startStability()
                }
                Spacer(Modifier.height(8.dp))
                InfoBox("Fica visível na barra de notificações e pode ser encerrado a qualquer momento. Cada verificação é uma conexão TCP minúscula (~200 bytes); com intervalo de 5 s, gasta cerca de 0,2 MB por hora. Para economizar bateria, use intervalos maiores em Ajustes. Com a tela desligada, o Android pode espaçar as verificações.")
                SectionTitle("Eventos registrados")
            }
            if (events.isEmpty()) item { EmptyState("Nenhum evento", "Quedas, trocas de rede e sessões aparecem aqui.") }
            items(events.take(60), key = { it.id }) { e ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text(ago(e.timestamp), style = MaterialTheme.typography.labelSmall, color = c.muted, modifier = Modifier.width(80.dp))
                    Text(e.detail + if (e.durationMs > 0) " (${e.durationMs / 1000} s)" else "", style = MaterialTheme.typography.bodySmall,
                        color = when (e.type) { "outage" -> c.danger; "network_change" -> c.warn; else -> c.text })
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

// ------------------------------------------------------------------ Móvel
@Composable
fun MobileScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val conn by vm.connection.collectAsState()
    val ctx = LocalContext.current
    val c = NX.c
    var granted by rememberSaveable { mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    val cell = conn.cellular
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Internet móvel", "4G / 5G", onBack = { nav.popBackStack() })
                if (conn.type != ConnType.CELLULAR) InfoBox("Você está em ${conn.type.label}. Desligue o Wi-Fi para ver os dados da rede móvel e testar 4G/5G.")
                Spacer(Modifier.height(8.dp))
                NexusCard(glow = true) {
                    TileRow {
                        MetricTile("Tecnologia", cell?.technology ?: NA, "", Modifier.weight(1.4f))
                        MetricTile("Sinal", cell?.signalLevel?.let { "$it/4" } ?: NA, "", Modifier.weight(1f))
                    }
                    TileRow {
                        MetricTile("RSRP", cell?.rsrp?.toString() ?: NA, "dBm", Modifier.weight(1f))
                        MetricTile("RSRQ", cell?.rsrq?.toString() ?: NA, "dB", Modifier.weight(1f))
                        MetricTile("SINR", cell?.sinr?.toString() ?: NA, "dB", Modifier.weight(1f))
                    }
                    KeyValue("Operadora", cell?.operatorName)
                    KeyValue("Roaming", cell?.roaming?.let { if (it) "Sim" else "Não" })
                    KeyValue("Origem da tecnologia", cell?.techSource)
                }
                if (!granted) {
                    Spacer(Modifier.height(10.dp))
                    InfoBox("Opcional: a permissão \"Telefone\" permite ler a tecnologia exata (ex.: 5G SA × 5G NSA). O NEXUS GUARD não lê chamadas, contatos nem número.")
                    SecondaryButton("Permitir (opcional)", Modifier.fillMaxWidth().padding(top = 6.dp)) { perm.launch(Manifest.permission.READ_PHONE_STATE) }
                }
                SectionTitle("Como interpretar o sinal")
                NexusCard {
                    listOf(
                        "RSRP (força): acima de -80 dBm excelente • -80 a -100 bom • abaixo de -110 fraco.",
                        "RSRQ (qualidade): acima de -10 dB bom • abaixo de -15 dB ruim (antena congestionada/interferência).",
                        "SINR (ruído): acima de 13 dB ótimo • abaixo de 0 dB ruim."
                    ).forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = c.text, modifier = Modifier.padding(vertical = 3.dp)) }
                }
                SectionTitle("Diagnóstico e recomendações")
                NexusCard {
                    val tips = mutableListOf<String>()
                    val lvl = cell?.signalLevel
                    if (lvl != null && lvl <= 1) tips += "Sinal fraco: perto de janelas, em locais altos ou ao ar livre a recepção melhora bastante."
                    if (cell?.technology?.contains("5G") == true && (lvl ?: 4) <= 2) tips += "5G com sinal fraco pode oscilar. Se notar quedas, fixar 4G em Configurações › Chip › Tipo de rede preferido costuma estabilizar (reversível)."
                    if (cell?.rsrq != null && cell.rsrq < -15) tips += "Qualidade baixa (RSRQ ${cell.rsrq} dB) sugere antena congestionada; em outro horário pode melhorar."
                    tips += "Para medir a velocidade real da rede móvel, faça o Teste de velocidade com o Wi-Fi desligado (o consumo é informado antes)."
                    tips += "O NEXUS GUARD não altera configurações do modem ou da operadora."
                    tips.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = c.text, modifier = Modifier.padding(vertical = 3.dp)) }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SecondaryButton("Rede móvel", Modifier.weight(1f)) { Intents.mobileData(ctx) }
                        SecondaryButton("Testar velocidade", Modifier.weight(1f)) { nav.navigate("internet/speed") }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

// ------------------------------------------------------------------ Wi-Fi (desempenho)
@Composable
fun WifiInternetScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val conn by vm.connection.collectAsState()
    val ctx = LocalContext.current
    val c = NX.c
    val w = conn.wifi
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    val locGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Wi-Fi inteligente", w?.ssid ?: if (conn.type == ConnType.WIFI) "Rede atual" else "Sem Wi-Fi", onBack = { nav.popBackStack() })
                if (conn.type != ConnType.WIFI) InfoBox("Conecte-se a uma rede Wi-Fi para ver os detalhes.")
                NexusCard(glow = true) {
                    TileRow {
                        MetricTile("Sinal", w?.rssiDbm?.toString() ?: NA, "dBm", Modifier.weight(1f))
                        MetricTile("Nível", w?.signalLevel?.let { "$it/4" } ?: NA, "", Modifier.weight(1f))
                        MetricTile("Banda", w?.bandLabel ?: NA, "", Modifier.weight(1f))
                    }
                    TileRow {
                        MetricTile("Canal", w?.channel?.toString() ?: NA, "", Modifier.weight(1f))
                        MetricTile("Enlace ↓", (w?.rxLinkSpeedMbps ?: w?.linkSpeedMbps)?.toString() ?: NA, "Mbps", Modifier.weight(1f))
                        MetricTile("Enlace ↑", w?.txLinkSpeedMbps?.toString() ?: NA, "Mbps", Modifier.weight(1f))
                    }
                    KeyValue("Padrão", w?.standard)
                    KeyValue("Segurança", w?.securityType)
                    KeyValue("Roteador (gateway)", w?.gatewayIp)
                    KeyValue("Nome da rede", w?.ssid ?: if (!locGranted) "oculto (requer localização)" else null)
                }
                if (!locGranted) SecondaryButton("Permitir localização (opcional)", Modifier.fillMaxWidth().padding(top = 8.dp)) { perm.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
                SectionTitle("Recomendação para a conexão atual")
                NexusCard {
                    val tips = mutableListOf<String>()
                    val r = w?.rssiDbm
                    when {
                        r == null -> tips += "Intensidade do sinal não disponível."
                        r > -60 -> tips += "Sinal excelente ($r dBm)."
                        r > -67 -> tips += "Sinal bom ($r dBm) para tudo, inclusive jogos e vídeo."
                        r > -75 -> tips += "Sinal razoável ($r dBm): aproxime-se do roteador para jogos e chamadas."
                        else -> tips += "Sinal fraco ($r dBm): esta é provavelmente a principal causa de lentidão. Aproxime-se do roteador ou considere um repetidor/mesh."
                    }
                    when (w?.bandLabel) {
                        "2,4 GHz" -> tips += "Você está em 2,4 GHz: alcance maior, porém mais lenta e congestionada. Perto do roteador, prefira a rede 5 GHz (geralmente com \"5G\" ou \"_5\" no nome)."
                        "5 GHz" -> tips += "Você está em 5 GHz: mais rápida e menos interferência. Longe do roteador (2+ paredes), a 2,4 GHz pode ficar mais estável."
                        "6 GHz" -> tips += "Você está em 6 GHz (Wi-Fi 6E): ótima velocidade, alcance menor."
                        else -> {}
                    }
                    if (w?.channel != null && w.bandLabel == "2,4 GHz" && w.channel !in listOf(1, 6, 11))
                        tips += "Canal ${w.channel} em 2,4 GHz sobrepõe canais vizinhos. No roteador, prefira 1, 6 ou 11 (ou automático)."
                    tips += "Posicionamento do roteador: alto, no centro da casa, longe de micro-ondas, espelhos, aquários e paredes grossas; antenas na vertical."
                    tips += "Para comparar redes: faça o Teste de velocidade em cada uma; o histórico mostra o tipo de conexão de cada teste."
                    tips += "Observação: o Android limita a varredura de redes vizinhas para apps; por isso a análise de congestionamento de canais é apenas orientativa."
                    tips.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = c.text, modifier = Modifier.padding(vertical = 3.dp)) }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SecondaryButton("Trocar de rede", Modifier.weight(1f)) { Intents.wifiPanel(ctx) }
                        SecondaryButton("Testar velocidade", Modifier.weight(1f)) { nav.navigate("internet/speed") }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

// ------------------------------------------------------------------ Histórico
@Composable
fun InternetHistoryScreen(nav: NavHostController) {
    val vm: InternetViewModel = viewModel()
    val hist by vm.history.collectAsState()
    val speeds by vm.speedHistory.collectAsState()
    val c = NX.c
    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp)) {
            item {
                ScreenHeader("Histórico de desempenho", onBack = { nav.popBackStack() })
                if (speeds.isNotEmpty()) {
                    SectionTitle("Download por teste (Mbps)")
                    NexusCard { BarChart(speeds.mapNotNull { it.downloadMbps }) }
                    SectionTitle("Ping por teste (ms)")
                    NexusCard { LineChart(speeds.map { it.idleLatencyMs }, height = 100.dp, color = c.purple, unit = "ms") }
                }
                SectionTitle("Registros")
            }
            if (hist.isEmpty()) item { EmptyState("Sem registros", "Os testes de velocidade, DNS, latência e otimização aparecem aqui.") }
            items(hist, key = { it.id }) { h ->
                NexusCard(Modifier.padding(bottom = 8.dp), padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(h.title, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
                        h.score?.let { Pill("$it/100", Color.White.copy(alpha = .7f)) }
                    }
                    Text(h.summary, style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(top = 4.dp))
                    Text(ago(h.timestamp), style = MaterialTheme.typography.labelSmall, color = c.muted, modifier = Modifier.padding(top = 4.dp))
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}
