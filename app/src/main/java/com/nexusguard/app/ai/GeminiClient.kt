package com.nexusguard.app.ai

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
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
import java.util.concurrent.TimeUnit

/**
 * NEXUS AI — modo online OPCIONAL, com a chave do próprio usuário (Google Gemini API).
 * Envia apenas o resumo técnico das medições (sem nome da rede, sem lista de apps, sem identificadores) e a pergunta.
 */
class GeminiClient(base: OkHttpClient) {
    private val client = base.newBuilder().callTimeout(45, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var model = "gemini-flash-latest"

    private val system = """
        Você é a NEXUS AI, assistente de diagnóstico de conexão e segurança de um app Android.
        Responda em português do Brasil, linguagem simples, frases curtas, no máximo 8 tópicos.
        Use SOMENTE os dados medidos fornecidos. Se um dado necessário não existir, diga claramente que não foi medido e qual teste fazer.
        Nunca invente números. Nunca prometa proteção absoluta. Ao recomendar uma configuração, explique o efeito e como desfazer.
        Lembre que trocar DNS não aumenta a velocidade de download nem reduz o ping de jogos.
    """.trimIndent()

    suspend fun ask(apiKey: String, contextSummary: String, question: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            var r = call(apiKey, contextSummary, question)
            if (r.first == 404) {
                discoverModel(apiKey)?.let { model = it; r = call(apiKey, contextSummary, question) }
            }
            when (r.first) {
                200 -> parse(r.second) ?: error("Resposta vazia do serviço.")
                400 -> error("Pedido recusado pelo serviço (400). ${extractError(r.second)}")
                401, 403 -> error("Chave de API inválida ou sem permissão.")
                429 -> error("Limite gratuito atingido. Tente mais tarde ou use o modo local.")
                else -> error("Erro ${r.first}: ${extractError(r.second)}")
            }
        }
    }

    private fun call(key: String, ctx: String, q: String): Pair<Int, String> {
        val body = buildJsonObject {
            put("systemInstruction", buildJsonObject { put("parts", buildJsonArray { add(buildJsonObject { put("text", system) }) }) })
            put("contents", buildJsonArray {
                add(buildJsonObject {
                    put("role", "user")
                    put("parts", buildJsonArray { add(buildJsonObject { put("text", "DADOS MEDIDOS NO APARELHO:\n$ctx\n\nPERGUNTA: $q") }) })
                })
            })
        }
        val req = Request.Builder()
            .url("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent")
            .header("x-goog-api-key", key)
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        return client.newCall(req).execute().use { it.code to (it.body?.string().orEmpty()) }
    }

    private fun parse(txt: String): String? = runCatching {
        val o = json.parseToJsonElement(txt).jsonObject
        o["candidates"]!!.jsonArray[0].jsonObject["content"]!!.jsonObject["parts"]!!.jsonArray
            .mapNotNull { it.jsonObject["text"]?.jsonPrimitive?.content }.joinToString("").trim().ifEmpty { null }
    }.getOrNull()

    private fun extractError(txt: String): String = runCatching {
        json.parseToJsonElement(txt).jsonObject["error"]!!.jsonObject["message"]!!.jsonPrimitive.content
    }.getOrDefault("")

    /** Se o alias sair do ar, escolhe o modelo "flash" mais recente que aceite generateContent. */
    private fun discoverModel(key: String): String? = runCatching {
        val req = Request.Builder().url("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200").header("x-goog-api-key", key).build()
        client.newCall(req).execute().use { r ->
            val arr = json.parseToJsonElement(r.body?.string().orEmpty()).jsonObject["models"]!!.jsonArray
            arr.map { it.jsonObject }
                .filter { m -> m["supportedGenerationMethods"]?.jsonArray?.any { (it as? JsonPrimitive)?.content == "generateContent" } == true }
                .map { it["name"]!!.jsonPrimitive.content.removePrefix("models/") }
                .filter { it.contains("flash") && !it.contains("tts") && !it.contains("image") && !it.contains("live") && !it.contains("preview") }
                .maxOrNull()
        }
    }.getOrNull()
}
