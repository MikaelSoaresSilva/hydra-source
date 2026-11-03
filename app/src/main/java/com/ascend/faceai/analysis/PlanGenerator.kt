package com.ascend.faceai.analysis

import kotlinx.serialization.Serializable

@Serializable
data class PlanTask(
    val key: String,
    val phase: Int,
    val title: String,
    val description: String,
    val objective: String,
    val frequency: String,
    val difficulty: String,
    val cost: String,
    val priority: String,
    val cautions: String,
    val categoryId: String
)

@Serializable
data class GlowPlan(val basedOn: String, val tasks: List<PlanTask>) {
    fun phase(p: Int) = tasks.filter { it.phase == p }
}

/**
 * Gera o plano 7/30/60/90 dias a partir das notas e métricas do relatório.
 * Regras determinísticas e explícitas: cada tarefa existe por causa de uma medição específica.
 */
object PlanGenerator {

    fun generate(r: FaceReport): GlowPlan {
        val t = ArrayList<PlanTask>()
        fun m(cat: String, key: String) = r.category(cat)?.metrics?.firstOrNull { it.key == key }
        fun score(cat: String) = r.category(cat)?.score ?: 100
        fun prio(s: Int) = when { s < 55 -> "Alta"; s < 75 -> "Média"; else -> "Baixa" }

        // ---- 7 dias ----
        t += PlanTask("photo_std", 7, "Padronize sua foto de acompanhamento",
            "Escolha um local fixo com luz de janela à sua frente, celular na altura dos olhos a ~1 m (zoom 2x), expressão neutra.",
            "Comparações justas entre análises: luz e distância diferentes mudam as medições.", "1 vez (repetir sempre igual)", "Fácil", "Grátis", "Alta",
            "Não use filtros de beleza nem modo retrato.", "geral")
        t += PlanTask("skin_base", 7, "Rotina básica de pele",
            "Manhã: limpar + hidratante + protetor solar FPS 30+. Noite: limpar + hidratante.",
            "Base para melhorar uniformidade, oleosidade e textura aparente.", "2x ao dia", "Fácil", "R$ 60–150 (3 produtos)", prio(score("pele")),
            "Teste produtos novos numa área pequena por 48 h. Se arder ou coçar, suspenda.", "pele")
        t += PlanTask("organize", 7, "Organize seus cuidados pessoais",
            "Separe um kit: sabonete facial, hidratante, protetor, pente/escova, aparador ou lâmina, pinça.",
            "Reduzir atrito para manter a rotina.", "1 vez", "Fácil", "Depende do que já tem", "Média", "—", "geral")
        val hairScore = score("cabelo")
        t += PlanTask("haircut", 7, "Ajuste de cabelo",
            r.category("cabelo")?.recommendations?.firstOrNull() ?: "Leve ao barbeiro a recomendação do seu formato de rosto (${r.faceShape}).",
            "Enquadramento: o cabelo é o fator visual mais rápido de mudar.", "1 corte; manutenção a cada 3–4 semanas", "Fácil", "R$ 30–80 por corte", prio(hairScore),
            "Mostre ao barbeiro fotos de referência; mudanças grandes vale fazer aos poucos.", "cabelo")
        if (r.beardDetected) {
            t += PlanTask("beard_lines", 7, "Contorno da barba",
                "Defina a linha do pescoço (~2 dedos acima do pomo de adão) e limpe pelos soltos na bochecha. ${r.category("barba")?.recommendations?.firstOrNull() ?: ""}",
                "Barba com linhas limpas parece intencional e realça a mandíbula.", "A cada 3–5 dias", "Média", "R$ 0–150 (aparador)", prio(score("barba")),
                "Lâminas novas e pele hidratada evitam foliculite. Não raspe contra o pelo se tiver pelos encravados.", "barba")
        } else {
            t += PlanTask("beard_test", 7, "Experimente um estilo de barba (opcional)",
                "Se tiver crescimento, deixe 2–3 semanas sem raspar para avaliar a cobertura. Para o formato ${r.faceShape}: ${FaceAnalyzer.shapeBeardAdvice(r.faceShape)}",
                "Descobrir se a barba favorece seu formato.", "Avaliar em 3 semanas", "Fácil", "Grátis", "Baixa", "Coceira nas primeiras semanas é comum; hidrate a pele.", "barba")
        }
        if (score("sobrancelhas") < 80) t += PlanTask("brows", 7, "Limpeza das sobrancelhas",
            r.category("sobrancelhas")?.recommendations?.firstOrNull() ?: "Retire apenas pelos soltos fora do desenho natural.",
            "Emoldurar os olhos sem perder naturalidade.", "A cada 2–3 semanas", "Média", "Grátis (pinça) ou R$ 20–50 (profissional)", prio(score("sobrancelhas")),
            "Não afine demais — o crescimento de volta pode levar meses.", "sobrancelhas")
        t += PlanTask("sleep", 7, "Sono e hidratação",
            "7–9 h de sono em horário regular e água ao longo do dia.",
            "Sono afeta olheiras aparentes e aspecto da pele.", "Diário", "Média", "Grátis", if ((m("olhos", "under_eye")?.value ?: 0.0) < -10) "Alta" else "Média", "—", "olhos")

        // ---- 30 dias ----
        val redDens = m("pele", "spots")?.value ?: 0.0
        if (redDens > 10) t += PlanTask("acne", 30, "Cuidado específico: pontos avermelhados",
            "Inclua à noite um sabonete ou gel com ácido salicílico (0,5–2%), 3x por semana no começo.",
            "Reduzir os pontos avermelhados medidos (${m("pele", "spots")?.display}).", "3–7x por semana", "Média", "R$ 40–90", "Alta",
            "Pode ressecar; use hidratante. Acne dolorosa, com nódulos ou que deixa marcas: procure dermatologista. Gestantes devem consultar médico antes.", "pele")
        if ((m("pele", "shine")?.value ?: 0.0) > 0.04) t += PlanTask("oil", 30, "Controle de brilho",
            "Troque para gel de limpeza para pele oleosa e hidratante oil-free; protetor com toque seco.",
            "Reduzir o brilho aparente medido.", "Diário", "Fácil", "R$ 50–120", "Média", "Não lave o rosto em excesso — a pele pode produzir mais óleo.", "pele")
        if ((m("pele", "tone")?.value ?: 0.0) > 3.5) t += PlanTask("tone", 30, "Uniformidade do tom",
            "Protetor solar todos os dias (reaplicar se ficar ao sol). Opcional: sérum de niacinamida ou vitamina C pela manhã.",
            "Melhorar a uniformidade de luminosidade medida.", "Diário", "Fácil", "R$ 40–120", "Média", "Vitamina C pode irritar peles sensíveis; comece em dias alternados.", "pele")
        t += PlanTask("grooming_review", 30, "Revisão do grooming",
            "Repita a análise com a foto padronizada e compare cabelo, barba e sobrancelhas com a primeira.",
            "Ver se os ajustes melhoraram o enquadramento.", "1 vez", "Fácil", "Grátis", "Média", "—", "geral")
        t += PlanTask("routine_up", 30, "Evolução da rotina",
            "Se a pele tolerou bem o primeiro mês, adicione esfoliação química suave 1x/semana (ex.: ácido salicílico ou lático).",
            "Melhorar textura aparente.", "1x por semana", "Média", "R$ 40–100", prio(score("pele")),
            "Nunca combine vários ácidos de uma vez. Pare se houver ardência.", "pele")
        if ((r.category("mandibula")?.metrics?.firstOrNull { it.key == "jaw_def" }?.value ?: 1.0) < 0.2) t += PlanTask("composition", 30, "Composição corporal",
            "Mantenha treino de força e alimentação adequada; a definição do contorno do rosto acompanha o percentual de gordura.",
            "Melhorar a definição visual da mandíbula medida.", "Contínuo", "Difícil", "Variável", "Média",
            "Evite dietas extremas. Exercícios faciais e aparelhos de mandíbula não têm evidência sólida e podem causar dor na ATM.", "mandibula")

        // ---- 60 dias ----
        t += PlanTask("reeval60", 60, "Reavaliação completa",
            "Nova análise com as mesmas condições de foto (frontal + perfis, se possível).",
            "Medir a evolução real.", "1 vez", "Fácil", "Grátis", "Alta", "Compare só fotos com qualidade semelhante.", "geral")
        t += PlanTask("compare60", 60, "Comparação fotográfica",
            "Use Histórico → Comparar para ver as duas datas lado a lado.",
            "Identificar o que funcionou.", "1 vez", "Fácil", "Grátis", "Média", "—", "geral")
        t += PlanTask("adjust60", 60, "Ajuste das recomendações",
            "Mantenha o que melhorou a nota da categoria; troque o que não mudou após 8 semanas.",
            "Definir novas prioridades com base em dados.", "1 vez", "Fácil", "Grátis", "Média", "—", "geral")

        // ---- 90 dias ----
        t += PlanTask("report90", 90, "Relatório de evolução",
            "Exporte o PDF da análise mais recente e compare com a primeira.",
            "Fechar o ciclo e registrar resultados.", "1 vez", "Fácil", "Grátis", "Média", "—", "geral")
        t += PlanTask("plan_update", 90, "Atualização do plano",
            "Gere o plano novamente a partir da nova análise.",
            "Novas prioridades.", "1 vez", "Fácil", "Grátis", "Média",
            "Se alguma preocupação continuar (pele, mordida, assimetria que incomoda), procure um profissional de saúde.", "geral")
        return GlowPlan(r.id, t)
    }
}
