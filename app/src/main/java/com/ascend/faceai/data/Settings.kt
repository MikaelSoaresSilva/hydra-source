package com.ascend.faceai.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "ascend_settings")

data class AppSettings(
    val onboardingDone: Boolean = false,
    val consentAt: Long = 0L,
    val adultConfirmed: Boolean = false,
    val externalAiConsent: Boolean = false,
    val backendUrl: String = "",
    val backendToken: String = "",
    val supabaseUrl: String = "",
    val supabaseAnonKey: String = "",
    val accessToken: String = "",
    val refreshToken: String = "",
    val userId: String = "",
    val userEmail: String = "",
    val loginSkipped: Boolean = false,
    val uploadPhotosToCloud: Boolean = false
) {
    val consentGiven get() = consentAt > 0L && adultConfirmed
    val aiConfigured get() = backendUrl.startsWith("https://")
    val cloudConfigured get() = supabaseUrl.startsWith("https://") && supabaseAnonKey.isNotBlank()
    val loggedIn get() = accessToken.isNotBlank() && userId.isNotBlank()
}

class SettingsStore(private val context: Context) {
    private object K {
        val onboarding = booleanPreferencesKey("onboarding_done")
        val consentAt = longPreferencesKey("consent_at")
        val adult = booleanPreferencesKey("adult")
        val extAi = booleanPreferencesKey("external_ai_consent")
        val backendUrl = stringPreferencesKey("backend_url")
        val backendToken = stringPreferencesKey("backend_token")
        val sbUrl = stringPreferencesKey("supabase_url")
        val sbKey = stringPreferencesKey("supabase_key")
        val access = stringPreferencesKey("access_token")
        val refresh = stringPreferencesKey("refresh_token")
        val userId = stringPreferencesKey("user_id")
        val email = stringPreferencesKey("user_email")
        val skipped = booleanPreferencesKey("login_skipped")
        val upPhotos = booleanPreferencesKey("upload_photos")
    }

    val flow: Flow<AppSettings> = context.dataStore.data.map { p -> p.toSettings() }

    suspend fun current(): AppSettings = flow.first()

    private fun Preferences.toSettings() = AppSettings(
        onboardingDone = this[K.onboarding] ?: false,
        consentAt = this[K.consentAt] ?: 0L,
        adultConfirmed = this[K.adult] ?: false,
        externalAiConsent = this[K.extAi] ?: false,
        backendUrl = this[K.backendUrl] ?: "",
        backendToken = this[K.backendToken] ?: "",
        supabaseUrl = this[K.sbUrl] ?: "",
        supabaseAnonKey = this[K.sbKey] ?: "",
        accessToken = this[K.access] ?: "",
        refreshToken = this[K.refresh] ?: "",
        userId = this[K.userId] ?: "",
        userEmail = this[K.email] ?: "",
        loginSkipped = this[K.skipped] ?: false,
        uploadPhotosToCloud = this[K.upPhotos] ?: false
    )

    suspend fun setOnboardingDone() = context.dataStore.edit { it[K.onboarding] = true }
    suspend fun giveConsent(externalAi: Boolean) = context.dataStore.edit {
        it[K.consentAt] = System.currentTimeMillis(); it[K.adult] = true; it[K.extAi] = externalAi
    }
    suspend fun revokeConsent() = context.dataStore.edit { it[K.consentAt] = 0L; it[K.extAi] = false }
    suspend fun setExternalAiConsent(v: Boolean) = context.dataStore.edit { it[K.extAi] = v }
    suspend fun setBackend(url: String, token: String) = context.dataStore.edit {
        it[K.backendUrl] = url.trim().trimEnd('/'); it[K.backendToken] = token.trim()
    }
    suspend fun setSupabase(url: String, key: String) = context.dataStore.edit {
        it[K.sbUrl] = url.trim().trimEnd('/'); it[K.sbKey] = key.trim()
    }
    suspend fun setSession(access: String, refresh: String, userId: String, email: String) = context.dataStore.edit {
        it[K.access] = access; it[K.refresh] = refresh; it[K.userId] = userId; it[K.email] = email
    }
    suspend fun clearSession() = context.dataStore.edit {
        it[K.access] = ""; it[K.refresh] = ""; it[K.userId] = ""; it[K.email] = ""
    }
    suspend fun setLoginSkipped(v: Boolean) = context.dataStore.edit { it[K.skipped] = v }
    suspend fun setUploadPhotos(v: Boolean) = context.dataStore.edit { it[K.upPhotos] = v }
    suspend fun clearAll() = context.dataStore.edit { it.clear() }
}
