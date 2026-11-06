package com.nexusguard.app

import android.app.Application
import androidx.work.Configuration
import androidx.work.WorkManager
import com.nexusguard.app.core.AppContainer
import com.nexusguard.app.core.Notifier
import com.nexusguard.app.security.SecurityWorker
import kotlinx.coroutines.launch

class NexusApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        Notifier.createChannels(this)
        runCatching { WorkManager.initialize(this, Configuration.Builder().build()) }
        container.monitor.start()
        container.appScope.launch {
            val s = container.settings.current()
            if (s.onboardingDone) SecurityWorker.schedule(this@NexusApp, s.periodicChecks)
        }
    }
}
