package com.nexusguard.app.security

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class RedirectHop(val url: String, val status: Int)
data class ReputationResult(val source: String, val verdict: String, val dangerous: Boolean?, val detail: String)

/**
 * Consultas de reputação OPCIONAIS. Só são feitas quando o usuário pede e informou a própria chave de API.
 * Enviam apenas o link (Safe Browsing) ou o hash SHA-256 (VirusTotal) — nunca o arquivo.
 */
class ReputationClient(base: OkHttpClient) {
    private val noRedirect = base.newBuilder().followRedirects(false).followSslRedirects(false)
        .callTimeout(12, TimeUnit.SECONDS).build()
    private val client = base.newBuilder().callTimeout(15, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true }

    /** Segue redirecionamentos manualmente (sem executar a página) para revelar o destino de links encurtados. */
    suspend fun expand(url: String, maxHops: Int = 6): List<RedirectHop> = withContext(Dispatchers.IO) {
        val hops = mutableListOf<RedirectHop>()
        var current = if (url.contains("://")) url else "https://$url"
        repeat(maxHops) {
            val req = Request.Builder().url(current).head().header("User-Agent", "Mozilla/5.0 (Linux; Android) NexusGuard-LinkCheck").build()
            val resp = runCatching { noRedirect.newCall(req).execute() }.getOrElse { e ->
                hops += RedirectHop(current, -1); return@withContext hops
            }
            resp.use { r ->
                hops += RedirectHop(current, r.code)
                val loc = r.header("Location")
                if (r.code in 300..399 && loc != null) {
                    current = r.request.url.resolve(loc)?.toString() ?: return@withContext hops
                } else return@withContext hops
            }
        }
        hops
    }

    suspend fun safeBrowsing(url: String, apiKey: String): ReputationResult = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("client", buildJsonObject { put("clientId", "nexus-guard"); put("clientVersion", "1.0") })
            put("threatInfo", buildJsonObject {
                put("threatTypes", buildJsonArray { listOf("MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION").forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
                put("platformTypes", buildJsonArray { add(kotlinx.serialization.json.JsonPrimitive("ANY_PLATFORM")) })
                put("threatEntryTypes", buildJsonArray { add(kotlinx.serialization.json.JsonPrimitive("URL")) })
                put("threatEntries", buildJsonArray { add(buildJsonObject { put("url", url) }) })
            })
        }
        val req = Request.Builder()
            .url("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=$apiKey")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        runCatching {
            client.newCall(req).execute().use { r ->
                val txt = r.body?.string().orEmpty()
                if (!r.isSuccessful) return@use ReputationResult("Google Safe Browsing", "Erro ${r.code}", null, "A consulta falhou (verifique a chave de API).")
                val obj = json.parseToJsonElement(txt.ifBlank { "{}" }).jsonObject
                val matches = obj["matches"]?.jsonArray
                if (matches.isNullOrEmpty()) ReputationResult("Google Safe Browsing", "Não listado", false, "O link não consta nas listas de ameaças do Google neste momento.")
                else ReputationResult("Google Safe Browsing", "LISTADO COMO PERIGOSO", true,
                    "Tipos: " + matches.mapNotNull { it.jsonObject["threatType"]?.jsonPrimitive?.content }.distinct().joinToString())
            }
        }.getOrElse { ReputationResult("Google Safe Browsing", "Sem resposta", null, it.message ?: "Falha de rede") }
    }

    suspend fun virusTotalHash(sha256: String, apiKey: String): ReputationResult = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("https://www.virustotal.com/api/v3/files/$sha256").header("x-apikey", apiKey).get().build()
        runCatching {
            client.newCall(req).execute().use { r ->
                when (r.code) {
                    404 -> ReputationResult("VirusTotal", "Hash desconhecido", null, "Esse arquivo nunca foi enviado ao VirusTotal. Isso não indica que seja seguro nem perigoso.")
                    200 -> {
                        val o = json.parseToJsonElement(r.body?.string().orEmpty()).jsonObject
                        val stats = o["data"]?.jsonObject?.get("attributes")?.jsonObject?.get("last_analysis_stats")?.jsonObject ?: JsonObject(emptyMap())
                        fun n(k: String) = runCatching { stats[k]?.jsonPrimitive?.int ?: 0 }.getOrDefault(0)
                        val mal = n("malicious"); val sus = n("suspicious"); val total = mal + sus + n("harmless") + n("undetected")
                        ReputationResult("VirusTotal", if (mal > 0) "$mal de $total antivírus detectaram" else "Nenhuma detecção", mal > 2,
                            "Maliciosos: $mal • Suspeitos: $sus • Total de motores: $total")
                    }
                    else -> ReputationResult("VirusTotal", "Erro ${r.code}", null, "A consulta falhou (verifique a chave ou o limite gratuito de 4 consultas/minuto).")
                }
            }
        }.getOrElse { ReputationResult("VirusTotal", "Sem resposta", null, it.message ?: "Falha de rede") }
    }
}
