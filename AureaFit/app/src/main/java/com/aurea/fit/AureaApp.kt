package com.aurea.fit

import android.app.Application
import android.content.Context
import com.aurea.fit.data.AureaDatabase
import com.aurea.fit.data.Repository
import com.aurea.fit.data.SettingsStore
import com.aurea.fit.notifications.ReminderScheduler

/** Contêiner simples de dependências (injeção manual, leve para celulares modestos). */
class AppContainer(context: Context, inMemoryDb: Boolean = false) {
    val database: AureaDatabase = AureaDatabase.build(context, inMemoryDb)
    val settings = SettingsStore(context)
    val scheduler = ReminderScheduler(context)
    val repository = Repository(context, database, settings, scheduler)
}

open class AureaApp : Application() {
    lateinit var container: AppContainer
        internal set

    override fun onCreate() {
        super.onCreate()
        container = createContainer()
        ReminderScheduler.createChannels(this)
    }

    protected open fun createContainer() = AppContainer(this)
}
