package com.nexusguard.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.NetworkCheck
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Radar
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.nexusguard.app.network.ConnType
import com.nexusguard.app.network.ConnectionState
import com.nexusguard.app.security.SecurityScore
import com.nexusguard.app.ui.MainViewModel
import com.nexusguard.app.ui.components.Centered
import com.nexusguard.app.ui.components.EmptyState
import com.nexusguard.app.ui.components.MetricTile
import com.nexusguard.app.ui.components.NA
import com.nexusguard.app.ui.components.NexusCard
import com.nexusguard.app.ui.components.Pill
import com.nexusguard.app.ui.components.PrimaryButton
import com.nexusguard.app.ui.components.PulseDot
import com.nexusguard.app.ui.components.ScoreRing
import com.nexusguard.app.ui.components.SecondaryButton
import com.nexusguard.app.ui.components.SectionTitle
import com.nexusguard.app.ui.components.TileRow
import com.nexusguard.app.ui.components.scoreColor
import com.nexusguard.app.ui.theme.Grotesk
import com.nexusguard.app.ui.theme.NX
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun fmt1(v: Double?): String = v?.let { if (it >= 100) it.toInt().toString() else String.format(Locale("pt", "BR"), "%.1f", it) } ?: NA
fun ago(t: Long): String {
    val d = (System.currentTimeMillis() - t) / 1000
    return when {
        d < 60 -> "agora"
        d < 3600 -> "há ${d / 60} min"
        d < 86400 -> "há ${d / 3600} h"
        else -> SimpleDateFormat("dd/MM HH:mm", Locale("pt", "BR")).format(Date(t))
    }
}

@Composable
fun NexusLogo(modifier: Modifier = Modifier) {
    val c = NX.c
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(34.dp)) {
            val w = size.width; val h = size.height
            val p = Path().apply {
                moveTo(w * .5f, h * .04f); lineTo(w * .92f, h * .2f); lineTo(w * .92f, h * .5f)
                cubicTo(w * .92f, h * .76f, w * .72f, h * .92f, w * .5f, h * .98f)
                cubicTo(w * .28f, h * .92f, w * .08f, h * .76f, w * .08f, h * .5f)
                lineTo(w * .08f, h * .2f); close()
            }
            drawPath(p, Brush.linearGradient(listOf(c.blue, c.purple)), style = Stroke(2.5.dp.toPx()))
            val n = Path().apply { moveTo(w * .34f, h * .68f); lineTo(w * .34f, h * .34f); lineTo(w * .66f, h * .68f); lineTo(w * .66f, h * .34f) }
            drawPath(n, c.text, style = Stroke(2.6.dp.toPx()))
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Text("NEXUS GUARD", fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = 2.sp, color = c.text)
            Text("Segurança • Conectividade", style = MaterialTheme.typography.labelSmall, color = c.muted)
        }
    }
}

fun connSummary(s: ConnectionState): String = when {
    !s.connected -> "Sem conexão"
    s.type == ConnType.WIFI -> listOfNotNull("Wi-Fi", s.wifi?.ssid, s.wifi?.bandLabel).joinToString(" • ")
    s.type == ConnType.CELLULAR -> listOfNotNull("Dados móveis", s.cellular?.technology, s.cellular?.operatorName).joinToString(" • ")
    else -> s.type.label
}

@Composable
fun HomeScreen(nav: NavHostController, vm: MainViewModel) {
    val c = NX.c
    val scan by vm.latestScan.collectAsState()
    val scanUi by vm.scan.collectAsState()
    val conn by vm.connection.collectAsState()
    val lat by vm.latestLatency.collectAsState()
    val speed by vm.latestSpeed.collectAsState()
    val dns by vm.latestDns.collectAsState()
    val alerts by vm.alerts.collectAsState()
    val diag by vm.netDiagnosis.collectAsState()

    Centered {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 18.dp).testTag("home_list")) {
            item {
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    NexusLogo(Modifier.weight(1f))
                }
                Spacer(Modifier.height(16.dp))
                NexusCard(glow = true) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ScoreRing(scan?.score, if (scanUi.running) "Verificando" else SecurityScore.label(scan?.score), size = 150.dp,
                            caption = scan?.let { "verificado ${ago(it.timestamp)}" } ?: "ainda não verificado", scanning = scanUi.running)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Proteção", style = MaterialTheme.typography.labelSmall, color = c.muted)
                            Text(scan?.let { if (it.failCount == 0 && it.warnCount == 0) "Nenhum risco nas verificações" else "${it.failCount} risco(s) • ${it.warnCount} atenção" } ?: "Faça a primeira verificação",
                                style = MaterialTheme.typography.titleSmall, color = c.text)
                            Spacer(Modifier.height(10.dp))
                            Text("Internet", style = MaterialTheme.typography.labelSmall, color = c.muted)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                PulseDot(if (!conn.connected) c.danger else if (conn.validated) c.success else c.warn)
                                Spacer(Modifier.width(8.dp))
                                Text(connSummary(conn), style = MaterialTheme.typography.titleSmall, color = c.text, maxLines = 2)
                            }
                            diag?.score?.let { sc ->
                                Spacer(Modifier.height(4.dp))
                                Pill("Conexão ${diag?.label} • $sc", scoreColor(sc))
                            }
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PrimaryButton(if (scanUi.running) "VERIFICANDO…" else "VERIFICAR", Modifier.weight(1f), enabled = !scanUi.running, icon = Icons.Filled.Radar, tag = "btn_scan") {
                            vm.runScan()
                        }
                        SecondaryButton("OTIMIZAR", Modifier.weight(1f), icon = Icons.Filled.Bolt, tag = "btn_optimize_home") { nav.navigate("internet/optimize") }
                    }
                    if (scan != null && !scanUi.running) {
                        Spacer(Modifier.height(8.dp))
                        SecondaryButton("Ver detalhes da verificação", Modifier.fillMaxWidth()) { nav.navigate("security/scan") }
                    }
                    scanUi.error?.let { Text(it, color = c.danger, style = MaterialTheme.typography.bodySmall) }
                }
            }
            item {
                SectionTitle("Estado da internet")
                TileRow {
                    MetricTile("Ping", fmt1(lat?.medianMs), "ms", Modifier.weight(1f), Icons.Filled.Timer)
                    MetricTile("Jitter", fmt1(lat?.jitterMs), "ms", Modifier.weight(1f), Icons.Filled.NetworkCheck)
                    MetricTile("Perda", fmt1(lat?.lossPercent), "%", Modifier.weight(1f))
                }
                TileRow {
                    MetricTile("Download", fmt1(speed?.downloadMbps), "Mbps", Modifier.weight(1f), Icons.Filled.Speed)
                    MetricTile("Upload", fmt1(speed?.uploadMbps), "Mbps", Modifier.weight(1f))
                    MetricTile("DNS", fmt1(dns?.system?.combinedMs ?: dns?.best?.combinedMs), "ms", Modifier.weight(1f), Icons.Filled.Dns)
                }
                Text(
                    listOfNotNull(lat?.let { "latência ${ago(it.timestamp)}" }, speed?.let { "velocidade ${ago(it.timestamp)}" }).joinToString(" • ").ifEmpty { "Nenhuma medição ainda — toque em OTIMIZAR para medir." },
                    style = MaterialTheme.typography.labelSmall, color = c.muted, modifier = Modifier.padding(top = 4.dp)
                )
            }
            item {
                SectionTitle("Alertas recentes", action = {
                    if (alerts.any { !it.read }) Text("marcar como lidos", style = MaterialTheme.typography.labelSmall, color = c.cyan,
                        modifier = Modifier.clickable { vm.markAlertsRead() }.padding(4.dp))
                })
            }
            if (alerts.isEmpty()) item { NexusCard { EmptyState("Nenhum alerta", "Os alertas de segurança e de conexão aparecem aqui.") } }
            else items(alerts.take(6).size) { i ->
                val a = alerts[i]
                NexusCard(Modifier.padding(bottom = 8.dp), padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.Icon(Icons.Filled.NotificationsActive, null, tint = when (a.severity) { "high" -> c.danger; "warn" -> c.warn; else -> c.cyan }, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(a.title, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
                        if (!a.read) Pill("novo", c.cyan)
                    }
                    Text(a.message, style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(top = 4.dp))
                    Text(ago(a.timestamp), style = MaterialTheme.typography.labelSmall, color = c.muted, modifier = Modifier.padding(top = 4.dp))
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}
