package com.ascend.faceai.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.ascend.faceai.analysis.FaceReport
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

class RemoteException(message: String) : Exception(message)

private val JSON_TYPE = "application/json; charset=utf-8".toMediaType()
internal val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

private val http = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(120, TimeUnit.SECONDS)
    .writeTimeout(60, TimeUnit.SECONDS)
    .build()

private fun call(req: Request): String {
    http.newCall(req).execute().use { r ->
        val body = r.body?.string().orEmpty()
        if (!r.isSuccessful) {
            val msg = runCatching { json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull()
            throw RemoteException("Erro ${r.code}: ${msg ?: body.take(200).ifBlank { r.message }}")
        }
        return body
    }
}

/**
 * Cliente do backend próprio do usuário (pasta backend/ do projeto).
 * A chave da IA fica no servidor; o app só conhece a URL e um token de acesso digitados pelo usuário.
 */
class AiBackendClient(private val settings: SettingsStore) {

    data class Health(val chat: Boolean, val image: Boolean, val provider: String)

    private suspend fun base(): Pair<String, String> {
        val s = settings.current()
        if (!s.aiConfigured) throw RemoteException("IA externa não configurada. Vá em Ajustes → Inteligência artificial.")
        if (!s.externalAiConsent) throw RemoteException("Você ainda não autorizou o envio de dados a serviços externos (Ajustes → Privacidade).")
        return s.backendUrl to s.backendToken
    }

    private fun req(url: String, token: String, body: String?) = Request.Builder().url(url)
        .header("x-ascend-token", token)
        .apply { if (body == null) get() else post(body.toRequestBody(JSON_TYPE)) }
        .build()

    suspend fun health(): Health = withContext(Dispatchers.IO) {
        val s = settings.current()
        if (!s.aiConfigured) throw RemoteException("Informe uma URL https:// do backend.")
        val o = json.parseToJsonElement(call(req("${s.backendUrl}/health", s.backendToken, null))).jsonObject
        Health(
            o["chat"]?.jsonPrimitive?.content == "true", o["image"]?.jsonPrimitive?.content == "true",
            o["provider"]?.jsonPrimitive?.content ?: "?"
        )
    }

    /** Envia SOMENTE os relatórios em texto (sem fotos) e a pergunta. */
    suspend fun chat(question: String, reports: List<FaceReport>, history: List<Pair<String, String>>): String = withContext(Dispatchers.IO) {
        val (url, token) = base()
        val compact = reports.sortedByDescending { it.createdAt }.take(5).map { r ->
            buildJsonObject {
                put("date", java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date(r.createdAt)))
                put("overall", r.overall); put("potential", r.potential); put("faceShape", r.faceShape)
                put("confidence", r.overallConfidence); put("summary", r.summary); put("beardDetected", r.beardDetected)
                put("categories", buildJsonArray {
                    r.categories.forEach { c ->
                        add(buildJsonObject {
                            put("name", c.name); put("score", c.score?.toString() ?: "n/d"); put("confidence", c.confidence)
                            put("metrics", buildJsonArray { c.metrics.forEach { m -> add(buildJsonObject { put("label", m.label); put("value", m.display); put("ref", m.reference) }) } })
                            put("limitations", buildJsonArray { c.limitations.forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
                        })
                    }
                })
            }
        }
        val body = buildJsonObject {
            put("question", question)
            put("reports", buildJsonArray { compact.forEach { add(it) } })
            put("history", buildJsonArray { history.takeLast(8).forEach { (r, t) -> add(buildJsonObject { put("role", r); put("text", t) }) } })
        }
        val o = json.parseToJsonElement(call(req("$url/chat", token, body.toString()))).jsonObject
        o["answer"]?.jsonPrimitive?.content ?: throw RemoteException("Resposta vazia do backend.")
    }

    /** Envia a foto (com autorização explícita) para o modelo de edição de imagem configurado no backend. */
    suspend fun simulate(photo: Bitmap, instruction: String): Bitmap = withContext(Dispatchers.IO) {
        val (url, token) = base()
        val jpg = ByteArrayOutputStream().use { photo.compress(Bitmap.CompressFormat.JPEG, 90, it); it.toByteArray() }
        val body = buildJsonObject {
            put("imageBase64", Base64.encodeToString(jpg, Base64.NO_WRAP))
            put("instruction", instruction)
        }
        val o = json.parseToJsonElement(call(req("$url/simulate", token, body.toString()))).jsonObject
        val b64 = o["imageBase64"]?.jsonPrimitive?.content ?: throw RemoteException("O backend não retornou imagem.")
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw RemoteException("Imagem inválida recebida.")
    }

    suspend fun deleteCloudAccount(accessToken: String) = withContext(Dispatchers.IO) {
        val s = settings.current()
        if (!s.aiConfigured) throw RemoteException("Backend não configurado: a exclusão da conta na nuvem exige o backend (Ajustes).")
        call(Request.Builder().url("${s.backendUrl}/delete-account").header("x-ascend-token", s.backendToken)
            .header("Authorization", "Bearer $accessToken").post("{}".toRequestBody(JSON_TYPE)).build())
    }
}

/**
 * Sincronização real com Supabase (Auth + PostgREST). Só sincroniza os relatórios (texto/números).
 * Fotos NÃO são enviadas.
 */
class CloudSync(private val settings: SettingsStore) {

    private suspend fun cfg(): AppSettings {
        val s = settings.current()
        if (!s.cloudConfigured) throw RemoteException("Sincronização não configurada (Ajustes → Conta e nuvem).")
        return s
    }

    private fun parseSession(body: String): Triple<String, String, Pair<String, String>> {
        val o = json.parseToJsonElement(body).jsonObject
        val access = o["access_token"]?.jsonPrimitive?.content ?: throw RemoteException("Confirme seu e-mail e depois faça login.")
        val refresh = o["refresh_token"]?.jsonPrimitive?.content ?: ""
        val user = o["user"]?.jsonObject ?: JsonObject(emptyMap())
        return Triple(access, refresh, (user["id"]?.jsonPrimitive?.content ?: "") to (user["email"]?.jsonPrimitive?.content ?: ""))
    }

    suspend fun signIn(email: String, password: String, signUp: Boolean) = withContext(Dispatchers.IO) {
        val s = cfg()
        val path = if (signUp) "/auth/v1/signup" else "/auth/v1/token?grant_type=password"
        val body = buildJsonObject { put("email", email.trim()); put("password", password) }.toString()
        val res = call(Request.Builder().url(s.supabaseUrl + path).header("apikey", s.supabaseAnonKey).post(body.toRequestBody(JSON_TYPE)).build())
        val (a, r, u) = parseSession(res)
        settings.setSession(a, r, u.first, u.second.ifBlank { email.trim() })
    }

    private suspend fun refresh(): AppSettings {
        val s = cfg()
        if (s.refreshToken.isBlank()) throw RemoteException("Sessão expirada. Faça login novamente.")
        val body = buildJsonObject { put("refresh_token", s.refreshToken) }.toString()
        val res = call(Request.Builder().url("${s.supabaseUrl}/auth/v1/token?grant_type=refresh_token").header("apikey", s.supabaseAnonKey)
            .post(body.toRequestBody(JSON_TYPE)).build())
        val (a, r, u) = parseSession(res)
        settings.setSession(a, r, u.first.ifBlank { s.userId }, u.second.ifBlank { s.userEmail })
        return settings.current()
    }

    private suspend fun <T> authed(block: (AppSettings) -> T): T {
        val s = cfg()
        if (!s.loggedIn) throw RemoteException("Faça login para sincronizar.")
        return try { block(s) } catch (e: RemoteException) {
            if (e.message?.contains("401") == true || e.message?.contains("JWT") == true) block(refresh()) else throw e
        }
    }

    suspend fun push(reports: List<FaceReport>): Int = withContext(Dispatchers.IO) {
        if (reports.isEmpty()) return@withContext 0
        authed { s ->
            val arr = buildJsonArray {
                reports.forEach { r ->
                    add(buildJsonObject {
                        put("id", r.id); put("user_id", s.userId); put("created_at_ms", r.createdAt)
                        put("overall", r.overall); put("potential", r.potential)
                        put("report", json.parseToJsonElement(json.encodeToString(FaceReport.serializer(), r.copy(frontalLandmarks = emptyList()))))
                    })
                }
            }
            call(Request.Builder().url("${s.supabaseUrl}/rest/v1/analyses?on_conflict=id").header("apikey", s.supabaseAnonKey)
                .header("Authorization", "Bearer ${s.accessToken}").header("Prefer", "resolution=merge-duplicates,return=minimal")
                .post(arr.toString().toRequestBody(JSON_TYPE)).build())
            reports.size
        }
    }

    suspend fun pull(): List<FaceReport> = withContext(Dispatchers.IO) {
        authed { s ->
            val body = call(Request.Builder().url("${s.supabaseUrl}/rest/v1/analyses?select=report").header("apikey", s.supabaseAnonKey)
                .header("Authorization", "Bearer ${s.accessToken}").get().build())
            json.parseToJsonElement(body).jsonArray.mapNotNull { e ->
                runCatching { json.decodeFromJsonElement(FaceReport.serializer(), e.jsonObject["report"]!!) }.getOrNull()
            }
        }
    }

    suspend fun deleteRemoteData() = withContext(Dispatchers.IO) {
        authed { s ->
            call(Request.Builder().url("${s.supabaseUrl}/rest/v1/analyses?user_id=eq.${s.userId}").header("apikey", s.supabaseAnonKey)
                .header("Authorization", "Bearer ${s.accessToken}").delete().build())
        }
    }
}
