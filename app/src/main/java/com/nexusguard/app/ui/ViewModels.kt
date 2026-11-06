package com.nexusguard.app.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nexusguard.app.NexusApp
import com.nexusguard.app.ai.AiAnswer
import com.nexusguard.app.ai.AiContext
import com.nexusguard.app.ai.NexusAiEngine
import com.nexusguard.app.core.AppSettings
import com.nexusguard.app.core.SettingsRepository
import com.nexusguard.app.data.AlertEntry
import com.nexusguard.app.data.HistoryEntry
import com.nexusguard.app.data.HistoryRepository
import com.nexusguard.app.data.Kind
import com.nexusguard.app.data.StabilityEvent
import com.nexusguard.app.network.ConnectionState
import com.nexusguard.app.network.Diagnosis
import com.nexusguard.app.network.DiagnosticsEngine
import com.nexusguard.app.network.DnsBenchmark
import com.nexusguard.app.network.LatencyResult
import com.nexusguard.app.network.LatencyTester
import com.nexusguard.app.network.NetworkSnapshot
import com.nexusguard.app.network.OptimizationReport
import com.nexusguard.app.network.SpeedMode
import com.nexusguard.app.network.SpeedProgress
import com.nexusguard.app.network.SpeedResult
import com.nexusguard.app.network.StabilitySummary
import com.nexusguard.app.network.StabilityTracker
import com.nexusguard.app.security.AppInfo
import com.nexusguard.app.security.FileScanResult
import com.nexusguard.app.security.PhishingReport
import com.nexusguard.app.security.RedirectHop
import com.nexusguard.app.security.ReputationResult
import com.nexusguard.app.security.SecurityScanResult
import com.nexusguard.app.security.SecurityScore
import com.nexusguard.app.security.SecurityWorker
import com.nexusguard.app.security.WifiAssessment
import com.nexusguard.app.security.WifiSecurityAssessor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Application.c get() = (this as NexusApp).container

// ======================================================================= Main / Home
data class ScanUi(val running: Boolean = false, val error: String? = null)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.c
    val settings: StateFlow<AppSettings?> = c.settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val connection: StateFlow<ConnectionState> = c.monitor.state
    val latestScan = c.history.latestScan.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val latestLatency = c.history.latestLatency.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val latestSpeed = c.history.latestSpeed.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val latestDns = c.history.latestDns.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val alerts: StateFlow<List<AlertEntry>> = c.history.alerts.recent(30).stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val unread = c.history.alerts.unreadCount().stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    val netDiagnosis: StateFlow<Diagnosis?> = combine(connection, latestLatency, latestDns, latestSpeed) { conn, lat, dns, sp ->
        // só considera medições feitas no mesmo tipo de conexão e na última hora
        val fresh = { t: Long -> System.currentTimeMillis() - t < 3_600_000L }
        DiagnosticsEngine.diagnose(NetworkSnapshot(conn, lat?.takeIf { true }, dns?.takeIf { fresh(it.timestamp) }, sp?.takeIf { fresh(it.timestamp) && it.connType == conn.type.label }))
    }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _scan = MutableStateFlow(ScanUi())
    val scan = _scan.asStateFlow()

    fun runScan() {
        if (_scan.value.running) return
        viewModelScope.launch {
            _scan.value = ScanUi(true)
            try {
                val conn = c.monitor.refresh()
                val loc = ContextCompat.checkSelfPermission(getApplication(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                val wifi = WifiSecurityAssessor.assess(conn, null, loc)
                val r = c.deviceScanner.scan(wifi.check)
                withContext(Dispatchers.IO) {
                    c.history.add(Kind.SECURITY_SCAN, "Verificação completa", "Nota ${r.score ?: "-"} • ${r.failCount} riscos • ${r.warnCount} atenções",
                        r.score, SecurityScore.label(r.score), HistoryRepository.encode(r))
                    r.checks.filter { it.status == com.nexusguard.app.security.CheckStatus.FAIL }.forEach {
                        c.notifier.alert("security", "high", "Risco: ${it.title}", it.detail, "security/scan", dedupeHours = 72)
                    }
                }
                _scan.value = ScanUi(false)
            } catch (e: Exception) {
                _scan.value = ScanUi(false, e.message ?: "Falha na verificação")
            }
        }
    }

    fun markAlertsRead() = viewModelScope.launch(Dispatchers.IO) { c.history.alerts.markAllRead() }

    fun finishOnboarding(periodic: Boolean) = viewModelScope.launch {
        c.settings.setPeriodic(periodic)
        c.settings.setOnboardingDone(true)
        SecurityWorker.schedule(getApplication(), periodic)
    }
}

// ======================================================================= Segurança
data class AppsUi(val loading: Boolean = false, val apps: List<AppInfo> = emptyList(), val includeSystem: Boolean = false, val loadedAt: Long = 0, val error: String? = null)
data class FileUi(val running: Boolean = false, val progress: Float = 0f, val result: FileScanResult? = null, val error: String? = null, val reputation: ReputationResult? = null, val repLoading: Boolean = false)
data class PhishUi(val report: PhishingReport? = null, val hops: List<RedirectHop>? = null, val expanding: Boolean = false, val reputation: ReputationResult? = null, val repLoading: Boolean = false, val expandedReport: PhishingReport? = null)

class SecurityViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.c
    val settings = c.settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _apps = MutableStateFlow(AppsUi())
    val apps = _apps.asStateFlow()
    private val _file = MutableStateFlow(FileUi())
    val file = _file.asStateFlow()
    private val _phish = MutableStateFlow(PhishUi())
    val phish = _phish.asStateFlow()
    private val _captive = MutableStateFlow<String?>(null)

    val history: StateFlow<List<HistoryEntry>> = c.history.byKinds(Kind.SECURITY_SCAN, Kind.APP_SCAN, Kind.APK, Kind.FILE, Kind.PHISHING, Kind.WIFI)
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val alerts = c.history.alerts.recent(100).stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    fun locationGranted() = ContextCompat.checkSelfPermission(getApplication(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    val wifi: StateFlow<WifiAssessment> = combine(c.monitor.state, _captive) { s, cap -> WifiSecurityAssessor.assess(s, cap, locationGranted()) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, WifiSecurityAssessor.assess(c.monitor.state.value))

    fun refreshWifi() = viewModelScope.launch {
        c.monitor.refresh()
        _captive.value = c.netChecks.captiveProbe()
        val a = WifiSecurityAssessor.assess(c.monitor.state.value, _captive.value, locationGranted())
        if (a.onWifi) {
            withContext(Dispatchers.IO) {
                c.history.add(Kind.WIFI, "Diagnóstico de Wi-Fi", a.findings.take(3).joinToString(" • ") { it.title }, a.score, a.label)
                if (a.label == "Insegura") c.notifier.alert("security", "warn", "Wi-Fi potencialmente inseguro", a.findings.first().explanation, "security/wifi", dedupeHours = 12)
            }
        }
    }

    fun loadApps(includeSystem: Boolean = _apps.value.includeSystem) {
        if (_apps.value.loading) return
        viewModelScope.launch {
            _apps.update { it.copy(loading = true, includeSystem = includeSystem, error = null) }
            try {
                val list = c.appAnalyzer.analyzeAll(includeSystem)
                _apps.value = AppsUi(false, list, includeSystem, System.currentTimeMillis())
                val risky = list.filter { it.risk.level == "Alto" || it.risk.level == "Crítico" }
                withContext(Dispatchers.IO) {
                    c.history.add(Kind.APP_SCAN, "Análise de aplicativos", "${list.size} apps analisados • ${risky.size} com risco alto/crítico" +
                        if (risky.isNotEmpty()) "\n" + risky.take(8).joinToString { "${it.label} (${it.risk.level})" } else "",
                        level = if (risky.any { it.risk.level == "Crítico" }) "Crítico" else if (risky.isNotEmpty()) "Alto" else "Baixo",
                        payload = HistoryRepository.encode(risky.map { listOf(it.label, it.risk.level) }))
                    risky.filter { it.risk.level == "Crítico" }.forEach {
                        c.notifier.alert("security", "high", "App de risco crítico: ${it.label}", it.risk.reasons.first(), "security/app/${it.packageName}", dedupeHours = 72)
                    }
                }
            } catch (e: Exception) {
                _apps.update { it.copy(loading = false, error = e.message ?: "Falha ao listar apps") }
            }
        }
    }

    suspend fun appDetail(pkg: String): AppInfo? = _apps.value.apps.firstOrNull { it.packageName == pkg } ?: c.appAnalyzer.analyzePackage(pkg)

    private var fileJob: Job? = null
    fun scanFile(uri: Uri) {
        fileJob?.cancel()
        fileJob = viewModelScope.launch {
            _file.value = FileUi(running = true)
            try {
                val r = c.fileScanner.scan(uri) { p -> _file.update { it.copy(progress = p) } }
                _file.value = FileUi(result = r)
                withContext(Dispatchers.IO) {
                    c.history.add(if (r.apk != null) Kind.APK else Kind.FILE, if (r.apk != null) "APK analisado: ${r.name}" else "Arquivo analisado: ${r.name}",
                        "${r.detectedType} • SHA-256 ${r.sha256.take(16)}… • ${r.findings.firstOrNull()?.title ?: "sem indicadores"}", r.score, r.level, HistoryRepository.encode(r))
                    if (r.score >= 35) c.notifier.alert("security", "warn", "Arquivo suspeito: ${r.name}", r.findings.first().explanation, "security/files", dedupeHours = 1)
                }
            } catch (e: Exception) {
                _file.value = FileUi(error = e.message ?: "Falha ao ler o arquivo")
            }
        }
    }

    fun virusTotal() {
        val r = _file.value.result ?: return
        viewModelScope.launch {
            val key = c.settings.apiKey(SettingsRepository.ApiKey.VIRUS_TOTAL) ?: return@launch
            _file.update { it.copy(repLoading = true) }
            val rep = c.reputation.virusTotalHash(r.sha256, key)
            _file.update { it.copy(repLoading = false, reputation = rep) }
        }
    }

    fun analyzeUrl(text: String) {
        val r = c.phishing.analyze(text)
        _phish.value = PhishUi(report = r)
        if (r.url != null) viewModelScope.launch(Dispatchers.IO) {
            c.history.add(Kind.PHISHING, "Link analisado", "${r.registrableDomain ?: r.url} • ${r.findings.first().title}", r.score, r.level.label)
            if (r.score >= 35) c.notifier.alert("security", "warn", "Link suspeito: ${r.registrableDomain ?: "endereço"}", r.findings.first().explanation, "security/phishing", dedupeHours = 1)
        }
    }

    fun expand() {
        val url = _phish.value.report?.url ?: return
        viewModelScope.launch {
            _phish.update { it.copy(expanding = true) }
            val hops = c.reputation.expand(url)
            val final = hops.lastOrNull()?.url
            _phish.update { it.copy(expanding = false, hops = hops, expandedReport = final?.takeIf { f -> f != url }?.let { f -> c.phishing.analyze(f) }) }
        }
    }

    fun safeBrowsing() {
        val url = _phish.value.expandedReport?.url ?: _phish.value.report?.url ?: return
        viewModelScope.launch {
            val key = c.settings.apiKey(SettingsRepository.ApiKey.SAFE_BROWSING) ?: return@launch
            _phish.update { it.copy(repLoading = true) }
            val r = c.reputation.safeBrowsing(if (url.contains("://")) url else "http://$url", key)
            _phish.update { it.copy(repLoading = false, reputation = r) }
        }
    }
}

// ======================================================================= Internet
data class SpeedUi(val running: Boolean = false, val progress: SpeedProgress? = null, val result: SpeedResult? = null, val samples: List<Double> = emptyList())
data class DnsUi(val running: Boolean = false, val current: String? = null, val result: DnsBenchmark? = null)
data class LatencyUi(val running: Boolean = false, val live: List<Double?> = emptyList(), val result: LatencyResult? = null)
data class OptUi(val phase: String = "idle", val step: Int = -1, val stepLabel: String = "", val live: String? = null, val report: OptimizationReport? = null, val measuringAfter: Boolean = false)

class InternetViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.c
    val connection = c.monitor.state
    val settings = c.settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val stability = StabilityTracker.state
    val stabilityEvents: StateFlow<List<StabilityEvent>> = c.history.stability.recent(100).stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val speedHistory: StateFlow<List<SpeedResult>> = c.history.speedHistory.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val latestSpeed = c.history.latestSpeed.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val latestDns = c.history.latestDns.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val latestLatency = c.history.latestLatency.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val latestStability: StateFlow<StabilitySummary?> = c.history.latestStability.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val history = c.history.byKinds(Kind.SPEED, Kind.DNS, Kind.LATENCY, Kind.OPTIMIZATION, Kind.STABILITY).stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _speed = MutableStateFlow(SpeedUi())
    val speed = _speed.asStateFlow()
    private val _dns = MutableStateFlow(DnsUi())
    val dns = _dns.asStateFlow()
    private val _lat = MutableStateFlow(LatencyUi())
    val latency = _lat.asStateFlow()
    private val _opt = MutableStateFlow(OptUi())
    val opt = _opt.asStateFlow()

    private var speedJob: Job? = null

    fun runSpeed(mode: SpeedMode) {
        if (_speed.value.running) return
        speedJob = viewModelScope.launch {
            c.settings.setSpeedMode(if (mode == SpeedMode.FULL) "full" else "light")
            _speed.value = SpeedUi(running = true)
            val conn = c.monitor.refresh()
            val r = c.speed.run(mode, conn.type.label) { p ->
                _speed.update { s -> s.copy(progress = p, samples = if (p.liveMbps != null) (s.samples + p.liveMbps).takeLast(80) else s.samples) }
            }
            _speed.update { it.copy(running = false, result = r) }
            withContext(Dispatchers.IO) {
                c.history.add(Kind.SPEED, "Teste de velocidade (${mode.label})",
                    if (r.error != null) r.error else "↓ ${fmt(r.downloadMbps)} Mbps • ↑ ${fmt(r.uploadMbps)} Mbps • ping ${fmt(r.idleLatencyMs)} ms • ${r.connType} • ${(r.bytesDown + r.bytesUp) / 1_000_000} MB usados",
                    level = r.connType, payload = HistoryRepository.encode(r))
            }
        }
    }

    fun cancelSpeed() { speedJob?.cancel(); _speed.update { it.copy(running = false) } }

    fun runDns() {
        if (_dns.value.running) return
        viewModelScope.launch {
            _dns.value = DnsUi(running = true)
            val conn = c.monitor.refresh()
            val r = c.dns.run(c.monitor.activeNetwork, conn.dnsServers) { name -> _dns.update { it.copy(current = name) } }
            _dns.value = DnsUi(result = r)
            withContext(Dispatchers.IO) {
                val best = r.best
                c.history.add(Kind.DNS, "Comparação de DNS", "Mais rápido: ${best?.name ?: "-"} (${fmt(best?.combinedMs)} ms) • Sistema: ${fmt(r.system?.combinedMs)} ms",
                    payload = HistoryRepository.encode(r))
            }
        }
    }

    fun runLatency() {
        if (_lat.value.running) return
        viewModelScope.launch {
            _lat.value = LatencyUi(running = true)
            val r = LatencyTester.measure("1.1.1.1", 20) { v -> _lat.update { it.copy(live = it.live + v) } }
            _lat.update { it.copy(running = false, result = r) }
            saveLatency(r)
        }
    }

    private suspend fun saveLatency(r: LatencyResult) = withContext(Dispatchers.IO) {
        c.history.add(Kind.LATENCY, "Latência (${r.method})", "mediana ${fmt(r.medianMs)} ms • jitter ${fmt(r.jitterMs)} ms • perda ${fmt(r.lossPercent)}%",
            payload = HistoryRepository.encode(r))
    }

    /** OTIMIZAR MINHA INTERNET — etapas 1 a 7 (medir, diagnosticar, recomendar). */
    fun optimize() {
        if (_opt.value.phase == "running") return
        viewModelScope.launch {
            _opt.value = OptUi(phase = "running")
            val snap = c.optimizer.measure({ i, label -> _opt.update { it.copy(step = i, stepLabel = label) } }, { live -> _opt.update { it.copy(live = live) } })
            val d = DiagnosticsEngine.diagnose(snap)
            val report = OptimizationReport(snap, d)
            _opt.value = OptUi(phase = "ready", report = report)
            withContext(Dispatchers.IO) {
                snap.latency?.let { saveLatency(it) }
                snap.dns?.let { c.history.add(Kind.DNS, "Comparação de DNS", "Mais rápido: ${it.best?.name ?: "-"} (${fmt(it.best?.combinedMs)} ms)", payload = HistoryRepository.encode(it)) }
                c.history.add(Kind.OPTIMIZATION, "Otimização: diagnóstico", "${d.label} (${d.score ?: "-"}/100) • ${d.issues.count { it.level >= com.nexusguard.app.network.IssueLevel.WARN }} pontos de atenção",
                    d.score, d.label, HistoryRepository.encode(report))
                d.issues.filter { it.level == com.nexusguard.app.network.IssueLevel.BAD }.take(2).forEach {
                    c.notifier.alert("network", "warn", it.title, it.recommendation, "internet/optimize", dedupeHours = 6)
                }
            }
        }
    }

    /** Etapas 9 e 10: medir de novo e comparar antes × depois. */
    fun measureAfter() {
        val before = _opt.value.report ?: return
        viewModelScope.launch {
            _opt.update { it.copy(phase = "running", measuringAfter = true) }
            val snap = c.optimizer.measure({ i, label -> _opt.update { it.copy(step = i, stepLabel = label) } }, { live -> _opt.update { it.copy(live = live) } })
            val d = DiagnosticsEngine.diagnose(snap)
            val report = before.copy(after = snap, afterDiagnosis = d)
            _opt.value = OptUi(phase = "done", report = report)
            withContext(Dispatchers.IO) {
                c.history.add(Kind.OPTIMIZATION, "Otimização: antes × depois", "Antes ${before.beforeDiagnosis.score ?: "-"} → depois ${d.score ?: "-"}",
                    d.score, d.label, HistoryRepository.encode(report))
            }
        }
    }

    fun resetOptimize() { _opt.value = OptUi() }

    fun startStability() = viewModelScope.launch {
        StabilityTracker.start(getApplication(), settings.value?.stabilityIntervalSec ?: 5)
    }
    fun stopStability() = StabilityTracker.stop(getApplication())

    companion object { fun fmt(v: Double?) = v?.let { DiagnosticsEngine.fmt(it) } ?: "-" }
}

// ======================================================================= NEXUS AI
data class ChatMsg(val fromUser: Boolean, val text: String? = null, val answer: AiAnswer? = null, val online: Boolean = false, val error: Boolean = false)

class AiViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.c
    val settings = c.settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    private val _msgs = MutableStateFlow(listOf(ChatMsg(false, answer = NexusAiEngine.answer("ajuda", AiContext()))))
    val messages = _msgs.asStateFlow()
    private val _busy = MutableStateFlow(false)
    val busy = _busy.asStateFlow()

    suspend fun context(): AiContext {
        val h = c.history
        val appScan = h.latestAppScan.first()
        val risky = appScan?.payload?.let { p -> HistoryRepository.decode<List<List<String>>>(p) }?.mapNotNull { if (it.size >= 2) it[0] to it[1] else null }.orEmpty()
        return AiContext(
            connection = c.monitor.refresh(),
            latency = h.latestLatency.first(),
            dns = h.latestDns.first(),
            speed = h.latestSpeed.first(),
            stability = StabilityTracker.state.value.takeIf { it.total > 0 }?.summary() ?: h.latestStability.first(),
            security = h.latestScan.first(),
            riskyApps = risky,
            appsAnalyzed = appScan != null,
            lastPhishingLevel = h.latestPhishing.first()?.let { "${it.summary} (${it.level})" }
        )
    }

    fun ask(q: String) {
        val question = q.trim()
        if (question.isEmpty() || _busy.value) return
        _msgs.update { it + ChatMsg(true, question) }
        viewModelScope.launch {
            _busy.value = true
            val ctx = context()
            _msgs.update { it + ChatMsg(false, answer = NexusAiEngine.answer(question, ctx)) }
            val s = c.settings.current()
            if (s.aiOnline) {
                val key = c.settings.apiKey(SettingsRepository.ApiKey.GEMINI)
                if (key != null) {
                    val r = c.gemini.ask(key, NexusAiEngine.contextSummary(ctx), question)
                    _msgs.update { it + ChatMsg(false, text = r.getOrElse { e -> "Modo online indisponível: ${e.message}. A resposta acima (modo local) continua válida." }, online = true, error = r.isFailure) }
                }
            }
            _busy.value = false
        }
    }

    fun clear() { _msgs.value = listOf(ChatMsg(false, answer = NexusAiEngine.answer("ajuda", AiContext()))) }
}

// ======================================================================= Ajustes
class SettingsViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.c
    val settings = c.settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    fun setNotifySecurity(v: Boolean) = viewModelScope.launch { c.settings.setNotifySecurity(v) }
    fun setNotifyNetwork(v: Boolean) = viewModelScope.launch { c.settings.setNotifyNetwork(v) }
    fun setPeriodic(v: Boolean) = viewModelScope.launch { c.settings.setPeriodic(v); SecurityWorker.schedule(getApplication(), v) }
    fun setOnlineReputation(v: Boolean) = viewModelScope.launch { c.settings.setOnlineReputation(v) }
    fun setAiOnline(v: Boolean) = viewModelScope.launch { c.settings.setAiOnline(v) }
    fun setTheme(v: String) = viewModelScope.launch { c.settings.setTheme(v) }
    fun setInterval(v: Int) = viewModelScope.launch { c.settings.setStabilityInterval(v) }
    fun setAppLock(v: Boolean) = viewModelScope.launch { c.settings.setAppLock(v) }
    fun saveKey(k: SettingsRepository.ApiKey, v: String?) = viewModelScope.launch { c.settings.setApiKey(k, v) }

    suspend fun exportText(): String = withContext(Dispatchers.IO) { c.history.exportText() }
    suspend fun exportCsv(): String = withContext(Dispatchers.IO) { c.history.exportSpeedCsv() }

    fun clearHistory(done: () -> Unit) = viewModelScope.launch {
        withContext(Dispatchers.IO) { c.history.clearAll() }
        done()
    }

    fun eraseEverything(done: () -> Unit) = viewModelScope.launch {
        withContext(Dispatchers.IO) { c.history.clearAll() }
        c.settings.clearAll()
        SecurityWorker.schedule(getApplication(), false)
        done()
    }
}

/** Utilitário para telas: diagnóstico com os dados mais recentes. */
fun diagnosisOf(conn: ConnectionState, lat: LatencyResult?, dns: DnsBenchmark?, sp: SpeedResult?) =
    DiagnosticsEngine.diagnose(NetworkSnapshot(conn, lat, dns, sp))

@Suppress("unused")
private fun <T> StateFlow<T>.mapState(f: (T) -> T) = map(f)
