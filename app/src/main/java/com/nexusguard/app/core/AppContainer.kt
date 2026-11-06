package com.nexusguard.app.core

import android.content.Context
import com.nexusguard.app.ai.GeminiClient
import com.nexusguard.app.data.HistoryRepository
import com.nexusguard.app.data.NexusDatabase
import com.nexusguard.app.network.ConnectionMonitor
import com.nexusguard.app.network.DnsBenchmarker
import com.nexusguard.app.network.NetChecks
import com.nexusguard.app.network.Optimizer
import com.nexusguard.app.network.SpeedTester
import com.nexusguard.app.security.AppAnalyzer
import com.nexusguard.app.security.DeviceScanner
import com.nexusguard.app.security.FileScanner
import com.nexusguard.app.security.IocDatabase
import com.nexusguard.app.security.PhishingAnalyzer
import com.nexusguard.app.security.ReputationClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** Injeção de dependências manual (simples e sem bibliotecas extras). */
class AppContainer(context: Context) {
    val appContext: Context = context.applicationContext
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    val settings = SettingsRepository(appContext)
    val db: NexusDatabase by lazy { NexusDatabase.create(appContext) }
    val history: HistoryRepository by lazy { HistoryRepository(db) }
    val notifier: Notifier by lazy { Notifier(appContext, history, settings) }

    val ioc: IocDatabase by lazy { IocDatabase(appContext) }
    val phishing: PhishingAnalyzer by lazy { PhishingAnalyzer(ioc.websites) }
    val deviceScanner by lazy { DeviceScanner(appContext, ioc) }
    val appAnalyzer by lazy { AppAnalyzer(appContext, ioc) }
    val fileScanner by lazy { FileScanner(appContext, ioc) }
    val reputation by lazy { ReputationClient(http) }

    val monitor = ConnectionMonitor(appContext)
    val dns by lazy { DnsBenchmarker() }
    val netChecks by lazy { NetChecks(http) }
    val speed by lazy { SpeedTester(http) }
    val optimizer by lazy { Optimizer(monitor, dns, netChecks) }
    val gemini by lazy { GeminiClient(http) }
}
