package com.nexusguard.app.core

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "nexus_settings")

data class AppSettings(
    val onboardingDone: Boolean = false,
    val notifySecurity: Boolean = true,
    val notifyNetwork: Boolean = true,
    val periodicChecks: Boolean = true,
    val onlineReputation: Boolean = false,      // consultas a Safe Browsing / VirusTotal (opcionais, exigem chave)
    val aiOnline: Boolean = false,              // NEXUS AI online (Gemini) — opcional
    val theme: String = "dark",                 // "dark" | "amoled"
    val stabilityIntervalSec: Int = 5,
    val appLock: Boolean = false,
    val hasGeminiKey: Boolean = false,
    val hasSafeBrowsingKey: Boolean = false,
    val hasVirusTotalKey: Boolean = false,
    val speedMode: String = "light"             // "light" | "full"
)

class SettingsRepository(private val context: Context) {
    private object K {
        val onboarding = booleanPreferencesKey("onboarding_done")
        val notifySec = booleanPreferencesKey("notify_security")
        val notifyNet = booleanPreferencesKey("notify_network")
        val periodic = booleanPreferencesKey("periodic_checks")
        val onlineRep = booleanPreferencesKey("online_reputation")
        val aiOnline = booleanPreferencesKey("ai_online")
        val theme = stringPreferencesKey("theme")
        val stabInterval = intPreferencesKey("stability_interval")
        val appLock = booleanPreferencesKey("app_lock")
        val gemini = stringPreferencesKey("gemini_key_enc")
        val safeBrowsing = stringPreferencesKey("sb_key_enc")
        val virusTotal = stringPreferencesKey("vt_key_enc")
        val speedMode = stringPreferencesKey("speed_mode")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            onboardingDone = p[K.onboarding] ?: false,
            notifySecurity = p[K.notifySec] ?: true,
            notifyNetwork = p[K.notifyNet] ?: true,
            periodicChecks = p[K.periodic] ?: true,
            onlineReputation = p[K.onlineRep] ?: false,
            aiOnline = p[K.aiOnline] ?: false,
            theme = p[K.theme] ?: "dark",
            stabilityIntervalSec = p[K.stabInterval] ?: 5,
            appLock = p[K.appLock] ?: false,
            hasGeminiKey = !p[K.gemini].isNullOrEmpty(),
            hasSafeBrowsingKey = !p[K.safeBrowsing].isNullOrEmpty(),
            hasVirusTotalKey = !p[K.virusTotal].isNullOrEmpty(),
            speedMode = p[K.speedMode] ?: "light"
        )
    }

    suspend fun current(): AppSettings = settings.first()

    suspend fun setOnboardingDone(v: Boolean) = context.dataStore.edit { it[K.onboarding] = v }
    suspend fun setNotifySecurity(v: Boolean) = context.dataStore.edit { it[K.notifySec] = v }
    suspend fun setNotifyNetwork(v: Boolean) = context.dataStore.edit { it[K.notifyNet] = v }
    suspend fun setPeriodic(v: Boolean) = context.dataStore.edit { it[K.periodic] = v }
    suspend fun setOnlineReputation(v: Boolean) = context.dataStore.edit { it[K.onlineRep] = v }
    suspend fun setAiOnline(v: Boolean) = context.dataStore.edit { it[K.aiOnline] = v }
    suspend fun setTheme(v: String) = context.dataStore.edit { it[K.theme] = v }
    suspend fun setStabilityInterval(v: Int) = context.dataStore.edit { it[K.stabInterval] = v.coerceIn(2, 60) }
    suspend fun setAppLock(v: Boolean) = context.dataStore.edit { it[K.appLock] = v }
    suspend fun setSpeedMode(v: String) = context.dataStore.edit { it[K.speedMode] = v }

    enum class ApiKey { GEMINI, SAFE_BROWSING, VIRUS_TOTAL }

    private fun keyOf(k: ApiKey) = when (k) { ApiKey.GEMINI -> K.gemini; ApiKey.SAFE_BROWSING -> K.safeBrowsing; ApiKey.VIRUS_TOTAL -> K.virusTotal }

    /** Chaves de API são guardadas criptografadas com o Android Keystore. */
    suspend fun setApiKey(k: ApiKey, value: String?) = context.dataStore.edit {
        if (value.isNullOrBlank()) it.remove(keyOf(k)) else it[keyOf(k)] = KeystoreCrypto.encryptString(value.trim())
    }

    suspend fun apiKey(k: ApiKey): String? = context.dataStore.data.first()[keyOf(k)]?.let { KeystoreCrypto.decryptString(it) }

    suspend fun clearAll() = context.dataStore.edit { it.clear() }
}
