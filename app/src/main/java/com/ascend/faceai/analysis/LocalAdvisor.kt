package com.ascend.faceai.analysis

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Motor LOCAL de respostas baseado em regras — NÃO é inteligência artificial.
 * Responde às perguntas frequentes usando apenas os números dos relatórios salvos.
 * Quando uma IA externa estiver configurada, o app usa a IA; caso contrário, este motor.
 */
object LocalAdvisor {

    val suggestions = listOf(
        "O que mais prejudica minha apresentação facial?",
        "Quais são meus maiores pontos fortes?",
        "Qual corte de cabelo combina comigo?",
        "Qual estilo de barba favorece meu rosto?",
        "Como melhorar a aparência da minha pele?",
        "Quais mudanças devo priorizar?",
        "Como posso melhorar minha apresentação facial em 30 dias?",
        "O que mudou desde minha primeira análise?"
    )

    private val df = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))

    fun answer(question: String, reports: List<FaceReport>): String {
        if (reports.isEmpty()) return "Ainda não há análises salvas. Faça sua primeira análise para eu poder responder com base nos seus resultados."
        val latest = reports.maxBy { it.createdAt }
        val q = question.lowercase(Locale.ROOT)
        val scored = latest.categories.filter { it.available && it.score != null }
        return when {
            "mudou" in q || "evolu" in q || "primeira" in q -> evolution(reports)
            "forte" in q -> {
                val top = scored.sortedByDescending { it.score }.take(3)
                "Seus maiores pontos fortes na análise de ${df.format(Date(latest.createdAt))}:\n" +
                    top.joinToString("\n") { c -> "• ${c.name} — ${c.score}/100. ${c.strengths.firstOrNull() ?: c.justification}" }
            }
            "prejudica" in q || "pior" in q -> {
                val low = scored.sortedBy { it.score }.take(3)
                "As categorias com menor nota (todas medidas, não opinião):\n" + low.joinToString("\n") { c ->
                    "• ${c.name} — ${c.score}/100. ${c.opportunities.firstOrNull() ?: c.justification}\n  ${c.modifiability.joinToString(" / ") { it.label }}"
                } + "\n\nLembre: notas de estrutura (nariz, mandíbula, simetria) são pouco modificáveis; foque no que é modificável."
            }
            "cabelo" in q || "corte" in q || "franja" in q -> {
                val c = latest.category("cabelo")
                "Formato do rosto: ${latest.faceShape}. ${FaceAnalyzer.shapeHairAdvice(latest.faceShape)}\n" +
                    (c?.metrics?.filter { it.score == null }?.joinToString("\n") { "• ${it.label}: ${it.display}" } ?: "") +
                    "\n" + (c?.recommendations?.joinToString("\n") { "• $it" } ?: "")
            }
            "barba" in q -> {
                val c = latest.category("barba")
                (if (latest.beardDetected) "Barba detectada: ${c?.metrics?.firstOrNull()?.note}. " else "Barba não detectada na última foto. ") +
                    "Para o formato ${latest.faceShape}: ${FaceAnalyzer.shapeBeardAdvice(latest.faceShape)}\n" +
                    (c?.recommendations?.joinToString("\n") { "• $it" } ?: "")
            }
            "pele" in q -> {
                val c = latest.category("pele")
                if (c == null || !c.available) "A pele não pôde ser avaliada na última foto (${c?.unavailableReason ?: "sem dados"})."
                else "Qualidade visual da pele: ${c.score}/100 (indicador aproximado, não diagnóstico).\n" +
                    c.metrics.filter { it.score != null }.sortedBy { it.score }.take(3).joinToString("\n") { "• ${it.label}: ${it.display} (ref. ${it.reference})" } +
                    "\n\nO que fazer:\n" + c.recommendations.joinToString("\n") { "• $it" }
            }
            "30 dias" in q || "priorizar" in q || "prioridade" in q -> {
                val plan = PlanGenerator.generate(latest)
                val items = plan.tasks.filter { it.phase <= 30 }.sortedBy { when (it.priority) { "Alta" -> 0; "Média" -> 1; else -> 2 } }.take(6)
                "Prioridades pelo seu resultado (margem estimada +${latest.potential} pontos em fatores modificáveis):\n" +
                    items.joinToString("\n") { "• [${it.priority}] ${it.title} — ${it.frequency}" } +
                    "\n\nO plano completo está na aba Plano."
            }
            else -> "Sou o motor local de regras (sem IA externa configurada), então respondo melhor às perguntas sugeridas. Resumo da sua última análise:\n${latest.summary}"
        }
    }

    fun evolution(reports: List<FaceReport>): String {
        if (reports.size < 2) return "Há só uma análise salva. Faça outra (de preferência com a mesma luz e distância) para comparar."
        val sorted = reports.sortedBy { it.createdAt }
        val first = sorted.first(); val last = sorted.last()
        val lines = last.categories.mapNotNull { c ->
            val a = first.category(c.id)?.score; val b = c.score
            if (a == null || b == null) null else c.name to (b - a)
        }.sortedByDescending { kotlin.math.abs(it.second) }
        return "De ${df.format(Date(first.createdAt))} para ${df.format(Date(last.createdAt))}: nota geral ${first.overall} → ${last.overall} (${signed(last.overall - first.overall)}).\n" +
            lines.take(6).joinToString("\n") { "• ${it.first}: ${signed(it.second)}" } +
            "\n\nDiferenças de até ±3 pontos podem ser só variação de luz e ângulo."
    }

    private fun signed(v: Int) = if (v > 0) "+$v" else "$v"
}
