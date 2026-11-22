package com.ascend.faceai.analysis

import java.net.URLEncoder
import java.text.Normalizer
import kotlin.math.roundToInt

/**
 * "Defeitos e soluções": transforma as medições do relatório em pontos fracos concretos e, para cada um,
 * soluções práticas (massagem, skin care, grooming, hábitos, treino, profissional) com passo a passo e links.
 *
 * Regras:
 *  - um defeito só aparece se uma medição real ficou abaixo do limite (nada é inventado);
 *  - cada solução informa a força da evidência — massagem e mewing NÃO mudam osso, e o app diz isso;
 *  - links são buscas no YouTube / Mercado Livre / Amazon para nomes exatos de técnicas e produtos,
 *    para nunca apontarem para uma página que saiu do ar;
 *  - nada de cirurgia, hormônio ou remédio como solução automática: casos assim vão para "Profissional".
 */
enum class SolKind(val label: String) {
    MASSAGEM("Massagem facial"),
    SKINCARE("Skin care"),
    GROOMING("Cabelo, barba e sobrancelha"),
    HABITO("Hábitos"),
    TREINO("Treino e postura"),
    PROFISSIONAL("Avaliação profissional")
}

enum class Evidence(val label: String) {
    FORTE("Evidência forte"),
    MODERADA("Evidência moderada"),
    FRACA("Evidência fraca ou efeito temporário")
}

enum class Changeable(val label: String) {
    SIM("Dá para melhorar"),
    PARCIAL("Melhora parcial"),
    NAO("Estrutural: não muda com cuidados")
}

enum class LinkType(val label: String) { VIDEO("Vídeo"), PRODUTO("Produto"), GUIA("Guia") }

data class SolLink(val label: String, val url: String, val type: LinkType)

data class Solution(
    val kind: SolKind,
    val title: String,
    val steps: List<String>,
    val frequency: String,
    val timeToResult: String,
    val evidence: Evidence,
    val cost: String,
    val cautions: String,
    val links: List<SolLink>
)

data class Defect(
    val id: String,
    val categoryId: String,
    val title: String,
    /** 3 = alta, 2 = média, 1 = leve. */
    val severity: Int,
    val measured: String,
    val why: String,
    val changeable: Changeable,
    val honestNote: String?,
    val solutions: List<Solution>
) {
    val severityLabel get() = when (severity) { 3 -> "Prioridade alta"; 2 -> "Prioridade média"; else -> "Leve" }
}

object Links {
    private fun enc(q: String) = URLEncoder.encode(q, "UTF-8")
    private fun slug(q: String) = Normalizer.normalize(q.lowercase(), Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "").replace("[^a-z0-9]+".toRegex(), "-").trim('-')

    fun video(label: String, query: String) = SolLink(label, "https://www.youtube.com/results?search_query=${enc(query)}", LinkType.VIDEO)
    fun ml(label: String, query: String = label) = SolLink("$label · Mercado Livre", "https://lista.mercadolivre.com.br/${slug(query)}", LinkType.PRODUTO)
    fun amazon(label: String, query: String = label) = SolLink("$label · Amazon", "https://www.amazon.com.br/s?k=${enc(query)}", LinkType.PRODUTO)
}

object Solutions {

    // ---------------- Blocos reutilizáveis ----------------
    private val sunscreen = listOf(Links.ml("Protetor solar Episol Sec FPS 70"), Links.ml("Protetor solar Isdin Fusion Water FPS 60"))

    private val baseRoutine = Solution(
        SolKind.SKINCARE, "Rotina base (sem ela nada funciona)",
        listOf(
            "Manhã: lave o rosto com um gel de limpeza facial (água morna, 30 s), seque sem esfregar.",
            "Aplique um hidratante leve (2 gotas de ervilha de produto).",
            "Termine com protetor solar FPS 30+ (2 dedos de produto para rosto e pescoço), mesmo em dia nublado.",
            "Noite: lave de novo e passe o hidratante. Não durma com protetor nem suor no rosto."
        ),
        "2x ao dia, todos os dias", "4–8 semanas para notar diferença", Evidence.FORTE, "R$ 100–200 (3 produtos que duram ~2 meses)",
        "Teste cada produto novo atrás da orelha por 48 h. Se arder, coçar ou empipocar, suspenda.",
        listOf(Links.video("Rotina de skin care masculina passo a passo", "rotina skincare masculina simples passo a passo"),
            Links.ml("Gel de limpeza CeraVe controle de oleosidade"), Links.ml("Hidratante facial Neutrogena Hydro Boost gel"), sunscreen[0])
    )

    private val fatLoss = Solution(
        SolKind.HABITO, "Baixar o percentual de gordura corporal",
        listOf(
            "Coma ~300–500 kcal abaixo do seu gasto diário (perda de 0,5 kg por semana).",
            "Proteína alta: ~1,6–2,2 g por kg de peso por dia para preservar músculo.",
            "Mantenha o treino de força e some 8–10 mil passos por dia.",
            "Durma 7–9 h: sono curto aumenta inchaço e fome.",
            "Tire a foto de acompanhamento a cada 4 semanas, sempre com a mesma luz."
        ),
        "Diário", "8–16 semanas (rosto é das últimas áreas a secar)", Evidence.FORTE, "Grátis",
        "Não faça dietas muito restritivas; perda rápida derruba massa muscular. Em caso de doença ou remédio contínuo, fale com um médico ou nutricionista.",
        listOf(Links.video("Como perder gordura do rosto: o que funciona", "como perder gordura do rosto o que realmente funciona"),
            Links.video("Déficit calórico explicado", "déficit calórico como calcular explicado"))
    )

    private val lessPuffiness = Solution(
        SolKind.HABITO, "Reduzir o inchaço do rosto",
        listOf(
            "Evite refeições muito salgadas (embutidos, miojo, fast food) à noite.",
            "Beba água ao longo do dia (urina clara) e limite álcool.",
            "Durma com a cabeça um pouco mais alta (travesseiro firme).",
            "De manhã, 1 minuto de água fria ou rolo gelado no rosto."
        ),
        "Diário", "Dias (efeito vai e volta)", Evidence.MODERADA, "Grátis",
        "Inchaço persistente, com falta de ar ou nas pernas, deve ser avaliado por um médico.",
        listOf(Links.video("Como desinchar o rosto pela manhã", "como desinchar o rosto pela manhã rápido"))
    )

    private fun guaShaJaw() = Solution(
        SolKind.MASSAGEM, "Drenagem linfática com gua sha no contorno",
        listOf(
            "Passe um óleo facial ou hidratante para a pedra deslizar.",
            "Segure a gua sha quase deitada (ângulo de ~15°) e deslize do queixo até abaixo da orelha, 8 vezes de cada lado.",
            "Depois desça de trás da orelha até a clavícula (é por onde o líquido drena), 5 vezes de cada lado.",
            "Pressão leve: não deve doer nem deixar marca roxa. 3–5 minutos no total."
        ),
        "1x ao dia, de manhã", "Na hora (efeito dura algumas horas)", Evidence.FRACA, "R$ 20–60 (pedra gua sha)",
        "Massagem reduz inchaço temporariamente; NÃO afina osso nem queima gordura. Não use sobre acne inflamada, feridas ou após procedimentos.",
        listOf(Links.video("Gua sha no contorno da mandíbula", "gua sha mandíbula passo a passo masculino"),
            Links.video("Drenagem linfática facial masculina", "drenagem linfática facial masculina passo a passo"),
            Links.ml("Gua sha pedra quartzo"), Links.ml("Óleo facial para massagem"))
    )

    private fun professional(who: String, whenTo: String, search: String) = Solution(
        SolKind.PROFISSIONAL, "Consulta com $who",
        listOf("Procure um(a) $who se: $whenTo", "Leve este relatório e suas fotos de acompanhamento para mostrar a evolução."),
        "Quando necessário", "Depende do caso", Evidence.FORTE, "Consulta particular ou pelo SUS/convênio",
        "O app não indica remédios, procedimentos ou cirurgias: essa decisão é do profissional junto com você.",
        listOf(Links.video("O que esperar da consulta", search))
    )

    // ---------------- Geração ----------------

    fun forReport(r: FaceReport): List<Defect> {
        val out = ArrayList<Defect>()
        fun metric(cat: String, key: String) = r.category(cat)?.metrics?.firstOrNull { it.key == key }
        fun ms(cat: String, key: String): Double? = metric(cat, key)?.score
        fun cs(cat: String): Int? = r.category(cat)?.takeIf { it.available }?.score
        fun sev(s: Double) = when { s < 40 -> 3; s < 60 -> 2; else -> 1 }
        fun meas(cat: String, key: String): String = metric(cat, key)?.let { "${it.label}: ${it.display} (referência ${it.reference}) → ${it.score?.roundToInt() ?: "—"}/100" } ?: ""
        fun catMeas(cat: String) = r.category(cat)?.let { "${it.name}: ${it.score ?: "—"}/100" } ?: ""
        val skinOk = cs("pele") != null

        // ---------- PELE ----------
        if (skinOk) {
            ms("pele", "spots")?.takeIf { it < 70 }?.let { s ->
                out += Defect("acne", "pele", "Acne e pontos avermelhados", sev(s), meas("pele", "spots"),
                    "Pontos vermelhos e inflamados são o que mais derruba a nota de pele, porque quebram a uniformidade.",
                    Changeable.SIM, null, listOf(
                        Solution(SolKind.SKINCARE, "Rotina anti-acne",
                            listOf(
                                "Manhã e noite: gel de limpeza para pele oleosa/acneica (massageie 30 s e enxágue).",
                                "Noite: sérum ou sabonete com ácido salicílico 2%. Comece 3 noites por semana e aumente se não irritar.",
                                "Manhã: niacinamida 10% (2–3 gotas) antes do hidratante: reduz oleosidade e vermelhidão.",
                                "Hidratante oil-free e protetor solar toque seco todas as manhãs.",
                                "Não esprema espinhas: isso deixa manchas e cicatrizes."
                            ),
                            "Diário", "6–12 semanas", Evidence.MODERADA, "R$ 120–250",
                            "Ácidos ressecam: se descascar ou arder, use em dias alternados. Não misture vários ácidos ao mesmo tempo.",
                            listOf(Links.video("Rotina de skin care masculina para acne", "rotina skincare masculina para acne"),
                                Links.video("Como usar ácido salicílico no rosto", "como usar ácido salicílico no rosto dermatologista"),
                                Links.ml("Effaclar Gel Concentrado La Roche-Posay"), Links.ml("Sérum ácido salicílico 2%"),
                                Links.ml("Principia NC-01 niacinamida 10%"), Links.amazon("The Ordinary Niacinamide 10% + Zinc 1%"), sunscreen[0])),
                        Solution(SolKind.HABITO, "Hábitos que pioram a acne",
                            listOf(
                                "Troque a fronha 2x por semana e a toalha de rosto a cada 2 dias.",
                                "Limpe a tela do celular e evite apoiar o rosto nas mãos.",
                                "Lave o rosto logo após o treino (suor + oleosidade entopem poros).",
                                "Se usa whey concentrado e a acne piorou depois disso, teste trocar por whey isolado ou outra fonte de proteína por 6 semanas."
                            ),
                            "Contínuo", "4–8 semanas", Evidence.MODERADA, "Grátis",
                            "A relação entre dieta e acne varia de pessoa para pessoa; observe o seu caso.",
                            listOf(Links.video("Whey protein causa acne?", "whey protein causa acne dermatologista explica"))),
                        professional("dermatologista", "a acne dura mais de 3 meses, deixa marcas, dói ou tem caroços. Existem tratamentos com receita muito mais fortes que os produtos de farmácia.",
                            "dermatologista explica tratamento de acne em homens")
                    ))
            }
            ms("pele", "redness")?.takeIf { it < 65 }?.let { s ->
                out += Defect("vermelhidao", "pele", "Vermelhidão na pele", sev(s), meas("pele", "redness"),
                    "Áreas avermelhadas deixam a pele com aspecto irritado e cansado.", Changeable.SIM, null, listOf(
                        Solution(SolKind.SKINCARE, "Rotina calmante",
                            listOf(
                                "Lave só com água morna (nunca quente) e um sabonete suave sem fragrância.",
                                "Use hidratante com ceramidas ou pantenol de manhã e à noite.",
                                "Niacinamida 5–10% ajuda a fortalecer a barreira da pele.",
                                "Protetor solar diário: sol e calor pioram a vermelhidão.",
                                "Evite esfoliantes com grânulos e loção pós-barba com álcool."
                            ),
                            "Diário", "3–6 semanas", Evidence.MODERADA, "R$ 80–180",
                            "Se a vermelhidão vier com ardor, bolinhas ou piorar com calor/álcool, pode ser rosácea: procure um dermatologista.",
                            listOf(Links.video("Como acalmar pele vermelha e irritada", "como acalmar pele vermelha irritada rosto"),
                                Links.ml("Cicaplast Baume B5 La Roche-Posay"), Links.ml("Hidratante facial CeraVe"), Links.ml("Principia NC-01 niacinamida 10%"))),
                        professional("dermatologista", "a vermelhidão é constante, arde ou aparece em crises.", "rosácea sintomas e tratamento dermatologista")
                    ))
            }
            ms("pele", "dark_spots")?.takeIf { it < 65 }?.let { s ->
                out += Defect("manchas", "pele", "Manchas escuras", sev(s), meas("pele", "dark_spots"),
                    "Manchas (de sol ou de espinhas antigas) tiram a uniformidade do tom.", Changeable.SIM,
                    "A contagem inclui pintas e sardas, que são normais e não precisam ser tratadas.", listOf(
                        Solution(SolKind.SKINCARE, "Clarear manchas com segurança",
                            listOf(
                                "Protetor solar todos os dias e reaplicação a cada 2–3 h se estiver no sol: sem isso nenhum clareador funciona.",
                                "Manhã: sérum de vitamina C (10–15%) antes do protetor.",
                                "Noite: niacinamida 10% sobre as manchas.",
                                "Seja paciente: manchas clareiam em semanas, não em dias."
                            ),
                            "Diário", "8–12 semanas", Evidence.MODERADA, "R$ 100–220",
                            "Pinta que muda de cor, tamanho ou formato precisa de dermatologista, não de clareador.",
                            listOf(Links.video("Como clarear manchas de espinha no rosto", "como clarear manchas de espinha no rosto masculino"),
                                Links.ml("Sérum vitamina C 10% facial"), Links.ml("Principia NC-01 niacinamida 10%"), sunscreen[0], sunscreen[1]))
                    ))
            }
            val tex = ms("pele", "texture"); val tone = listOfNotNull(ms("pele", "tone"), ms("pele", "tone_color")).minOrNull()
            if ((tex ?: 100.0) < 65 || (tone ?: 100.0) < 65) {
                val s = minOf(tex ?: 100.0, tone ?: 100.0)
                out += Defect("textura", "pele", "Textura, poros e tom irregular", sev(s),
                    listOf(meas("pele", "texture"), meas("pele", "tone")).filter { it.isNotBlank() }.joinToString("\n"),
                    "Poros marcados e tom desigual deixam a pele com aspecto áspero na foto.", Changeable.SIM, null, listOf(
                        Solution(SolKind.SKINCARE, "Esfoliação química suave + hidratação",
                            listOf(
                                "1–2 noites por semana: ácido salicílico 2% (poros) no lugar do hidratante noturno, depois hidrate.",
                                "Nas outras noites: hidratante normal.",
                                "Manhã: vitamina C ou niacinamida + protetor solar.",
                                "Beba água e mantenha o hidratante todo dia: pele desidratada marca mais os poros."
                            ),
                            "2x por semana (ácido) + diário (hidratação)", "6–10 semanas", Evidence.MODERADA, "R$ 80–200",
                            "Não use esfoliante de grânulos junto com ácidos. Se irritar, reduza para 1x por semana.",
                            listOf(Links.video("Como diminuir poros abertos no rosto", "como diminuir poros abertos rosto masculino"),
                                Links.ml("Sérum ácido salicílico 2%"), Links.ml("Sérum vitamina C 10% facial"))),
                        baseRoutine
                    ))
            }
            ms("pele", "shine")?.takeIf { it < 65 }?.let { s ->
                out += Defect("oleosidade", "pele", "Oleosidade e brilho", sev(s), meas("pele", "shine"),
                    "Brilho em excesso na testa e no nariz chama atenção nas fotos.", Changeable.SIM,
                    "Flash e luz direta também criam brilho; confirme com uma foto em luz de janela.", listOf(
                        Solution(SolKind.SKINCARE, "Controle de oleosidade",
                            listOf(
                                "Lave o rosto só 2x ao dia com gel para pele oleosa (lavar mais faz a pele produzir mais óleo).",
                                "Use hidratante em gel oil-free: pular o hidratante piora o brilho.",
                                "Protetor solar com toque seco.",
                                "Durante o dia, papel absorvente na zona T em vez de lavar de novo."
                            ),
                            "Diário", "2–4 semanas", Evidence.MODERADA, "R$ 80–170",
                            "Evite produtos com álcool que ardem: ressecam e aumentam a oleosidade de rebote.",
                            listOf(Links.video("Skin care para pele oleosa masculina", "skincare pele oleosa masculina rotina"),
                                Links.ml("Gel de limpeza CeraVe controle de oleosidade"), Links.ml("Hidratante facial Neutrogena Hydro Boost gel"),
                                sunscreen[0], Links.ml("Papel absorvente de oleosidade facial")))
                    ))
            }
        }
        val ue = ms("pele", "under_eye_skin") ?: ms("olhos", "under_eye")
        if (ue != null && ue < 65) {
            out += Defect("olheiras", "olhos", "Olheiras e inchaço abaixo dos olhos", sev(ue),
                meas("pele", "under_eye_skin").ifBlank { meas("olhos", "under_eye") },
                "A região abaixo dos olhos mais escura passa aparência de cansaço.", Changeable.PARCIAL,
                "Parte da olheira pode ser sombra da própria anatomia (olho fundo) — essa parte não some com cremes.", listOf(
                    Solution(SolKind.MASSAGEM, "Drenagem dos olhos (desinchar)",
                        listOf(
                            "Com o dedo anelar (o que faz menos força), dê toques leves do canto interno ao canto externo, abaixo do olho, 10 vezes.",
                            "Deslize do canto externo do olho até a têmpora e desça para a frente da orelha.",
                            "Termine com um rolo facial ou colher gelada por 1 minuto em cada olho.",
                            "Faça de manhã, que é quando o inchaço está maior."
                        ),
                        "1x ao dia, de manhã", "Na hora (temporário)", Evidence.FRACA, "R$ 0–40",
                        "Não puxe nem esfregue a pele dos olhos, que é fina. Não encoste nada gelado direto por muito tempo.",
                        listOf(Links.video("Massagem para olheiras e bolsas", "massagem drenagem para olheiras e bolsas passo a passo"),
                            Links.video("Como usar rolo facial gelado", "como usar rolo facial gelado nos olhos"),
                            Links.ml("Rolo facial de jade"), Links.ml("Máscara gel gelada para os olhos"))),
                    Solution(SolKind.SKINCARE, "Creme/sérum para olheiras",
                        listOf(
                            "À noite e de manhã, aplique uma pequena quantidade de sérum com cafeína na região abaixo do olho, com batidinhas.",
                            "Passe protetor solar também nessa área (sol escurece a olheira)."
                        ),
                        "2x ao dia", "4–8 semanas", Evidence.FRACA, "R$ 50–120",
                        "Mantenha o produto fora dos olhos. Se irritar, suspenda.",
                        listOf(Links.amazon("The Ordinary Caffeine Solution 5% + EGCG"), Links.ml("Sérum para olheiras com cafeína"))),
                    Solution(SolKind.HABITO, "Sono e hidratação",
                        listOf("Durma 7–9 h em horário regular.", "Diminua sal e álcool à noite.", "Trate a alergia/rinite se tiver: nariz entupido escurece as olheiras."),
                        "Diário", "1–3 semanas", Evidence.MODERADA, "Grátis", "—",
                        listOf(Links.video("Olheiras: causas e o que funciona", "olheiras causas e tratamento dermatologista explica")))
                ))
        }

        // ---------- MANDÍBULA / QUEIXO ----------
        val jawCat = cs("mandibula"); val jawDef = ms("mandibula", "jaw_def")
        if ((jawCat ?: 100) < 70 || (jawDef ?: 100.0) < 60) {
            val s = minOf(jawCat?.toDouble() ?: 100.0, jawDef ?: 100.0)
            out += Defect("mandibula", "mandibula", "Mandíbula pouco definida", sev(s),
                listOf(catMeas("mandibula"), meas("mandibula", "jaw_def")).filter { it.isNotBlank() }.joinToString("\n"),
                "Um contorno de mandíbula nítido é um dos traços que mais pesam na percepção de um rosto masculino.", Changeable.PARCIAL,
                "Sendo sincero: exercício facial, mewing ou chiclete não aumentam o osso da mandíbula em adultos. O que muda a definição VISÍVEL é gordura, inchaço, barba e postura.",
                listOf(
                    fatLoss,
                    Solution(SolKind.GROOMING, "Barba desenhando o contorno",
                        listOf(
                            "Se a barba cresce: deixe o queixo um pouco mais volumoso e as laterais (bochechas) mais curtas.",
                            "Faça a linha do pescoço reta, ~2 dedos acima do pomo de adão: tudo abaixo sai.",
                            "Se a barba não fecha: uma barba por fazer de 3–5 mm cria sombra no contorno e marca a mandíbula.",
                            "Mantenha as linhas a cada 3–5 dias."
                        ),
                        "A cada 3–5 dias", "Imediato", Evidence.MODERADA, "R$ 0–250 (aparador)",
                        "Lâmina nova e pele hidratada evitam pelos encravados.",
                        listOf(Links.video("Como desenhar a barba para marcar a mandíbula", "como desenhar barba para definir mandíbula"),
                            Links.ml("Aparador Philips OneBlade"))),
                    guaShaJaw(),
                    lessPuffiness,
                    Solution(SolKind.TREINO, "Postura da cabeça e da língua (mewing)",
                        listOf(
                            "Encoste a língua inteira no céu da boca (não só a ponta), lábios fechados e dentes levemente encostados.",
                            "Respire pelo nariz.",
                            "Queixo levemente para dentro e orelha alinhada com o ombro (sem cabeça projetada para frente).",
                            "Nas fotos, leve a cabeça um pouco para frente e o queixo um pouco para baixo: isso estica o contorno."
                        ),
                        "Ao longo do dia", "Postura: semanas · osso: sem evidência", Evidence.FRACA, "Grátis",
                        "Ajuda postura e ângulo nas fotos; não há prova de que remodele osso em adultos. Não force a mandíbula: se sentir dor na articulação (ATM), pare.",
                        listOf(Links.video("Mewing: o que a ciência diz", "mewing o que a ciência diz funciona"),
                            Links.video("Postura correta da língua (fonoaudiólogo)", "postura correta da língua fonoaudiólogo"))),
                    professional("dentista/ortodontista", "você tem mordida desalinhada, dor na mandíbula, ronco ou respira pela boca.", "ortodontista explica mordida e formato do rosto")
                ))
        }
        ms("mandibula", "chin_ratio")?.takeIf { it < 55 }?.let { s ->
            out += Defect("queixo", "mandibula", "Queixo pouco projetado ou curto", sev(s), meas("mandibula", "chin_ratio"),
                "O queixo equilibra o terço inferior do rosto.", Changeable.NAO,
                "O tamanho do queixo é ósseo. Cuidados não mudam isso; dá para disfarçar com barba.", listOf(
                    Solution(SolKind.GROOMING, "Barba que alonga o queixo",
                        listOf("Deixe mais volume e comprimento no queixo (cavanhaque fechado ou barba quadrada).", "Laterais mais curtas para o queixo parecer mais projetado.", "Evite barba muito cheia nas bochechas."),
                        "Manutenção semanal", "4–6 semanas para crescer", Evidence.MODERADA, "R$ 0–250",
                        "—", listOf(Links.video("Estilos de barba para queixo pequeno", "estilo de barba para queixo pequeno")))
                ))
        }

        // ---------- MAÇÃS ----------
        cs("macas")?.takeIf { it < 70 }?.let { s ->
            out += Defect("macas", "macas", "Maçãs do rosto pouco marcadas", sev(s.toDouble()), catMeas("macas") + "\n" + meas("macas", "cheek_shade"),
                "Maçãs marcadas criam o contraste de luz e sombra que deixa o rosto mais esculpido.", Changeable.PARCIAL,
                "O volume do osso não muda; a definição aparece com menos gordura e menos inchaço.",
                listOf(fatLoss,
                    Solution(SolKind.MASSAGEM, "Gua sha nas maçãs",
                        listOf("Com óleo, deslize a gua sha do lado do nariz até a têmpora, logo abaixo da maçã, 8 vezes por lado.", "Depois da têmpora, desça na frente da orelha até o pescoço.", "Pressão leve, 2–3 minutos."),
                        "1x ao dia, de manhã", "Na hora (temporário)", Evidence.FRACA, "R$ 20–60",
                        "Efeito de desinchar, não de esculpir osso. Evite sobre acne inflamada.",
                        listOf(Links.video("Gua sha nas maçãs do rosto", "gua sha maçãs do rosto passo a passo"), Links.ml("Gua sha pedra quartzo"))),
                    Solution(SolKind.GROOMING, "Corte que valoriza as maçãs",
                        listOf("Laterais curtas (degradê) deixam o rosto mais afinado na altura das maçãs.", "Volume em cima, não nos lados.", "Em fotos, use luz vinda de cima e um pouco de lado."),
                        "A cada 3–4 semanas", "Imediato", Evidence.MODERADA, "R$ 30–80 por corte", "—",
                        listOf(Links.video("Degradê masculino para afinar o rosto", "corte degradê para afinar o rosto masculino"))),
                    lessPuffiness
                ))
        }

        // ---------- SOBRANCELHAS ----------
        val browAsym = ms("sobrancelhas", "brow_asym"); val browDens = ms("sobrancelhas", "brow_density")
        val browShape = listOfNotNull(ms("sobrancelhas", "brow_tilt"), ms("sobrancelhas", "brow_tail")).minOrNull()
        if ((browAsym ?: 100.0) < 65 || (browShape ?: 100.0) < 55) {
            val s = minOf(browAsym ?: 100.0, browShape ?: 100.0)
            out += Defect("sobrancelha_formato", "sobrancelhas", "Sobrancelhas desniveladas ou com formato irregular", sev(s),
                listOf(meas("sobrancelhas", "brow_asym"), meas("sobrancelhas", "brow_tilt")).filter { it.isNotBlank() }.joinToString("\n"),
                "Sobrancelhas emolduram os olhos e mudam muito a expressão.", Changeable.SIM, null, listOf(
                    Solution(SolKind.GROOMING, "Design de sobrancelha masculina",
                        listOf(
                            "Penteie os pelos para cima com uma escovinha.",
                            "Tire com pinça só os pelos soltos embaixo da sobrancelha e no meio (entre os olhos).",
                            "Apare com tesourinha só as pontas muito compridas que passam da linha.",
                            "Não afine a parte de cima e não arredonde: sobrancelha masculina é reta e encorpada.",
                            "Se uma é mais alta que a outra, um designer pode equilibrar tirando pelos de baixo do lado mais baixo."
                        ),
                        "A cada 2–3 semanas", "Imediato", Evidence.MODERADA, "R$ 15–40 (kit) ou R$ 30–60 no designer",
                        "Na dúvida, tire menos. Pelo arrancado demora ~6 semanas para voltar.",
                        listOf(Links.video("Como fazer sobrancelha masculina em casa", "como fazer sobrancelha masculina em casa"),
                            Links.ml("Pinça de precisão para sobrancelha"), Links.ml("Tesoura e escova para sobrancelha")))
                ))
        }
        if ((browDens ?: 100.0) < 60) {
            out += Defect("sobrancelha_rala", "sobrancelhas", "Sobrancelhas ralas ou pouco marcadas", sev(browDens!!), meas("sobrancelhas", "brow_density"),
                "Sobrancelhas fracas deixam o olhar menos marcante.", Changeable.PARCIAL,
                "Pelos claros em pele clara também reduzem esta medida sem significar falhas.", listOf(
                    Solution(SolKind.GROOMING, "Dar corpo às sobrancelhas",
                        listOf("Pare de tirar pelos de cima e das pontas por 6–8 semanas.", "Penteie para cima e fixe com gel transparente.", "Para falhas, um lápis da cor do pelo com traços curtos (fica natural)."),
                        "Diário", "Imediato (gel) · 6–8 semanas (crescimento)", Evidence.MODERADA, "R$ 20–50",
                        "—", listOf(Links.video("Sobrancelha masculina mais grossa", "como deixar sobrancelha masculina mais grossa"),
                            Links.ml("Gel fixador transparente para sobrancelha"))),
                    professional("dermatologista", "há falhas grandes ou queda de pelos da sobrancelha.", "queda de pelos da sobrancelha causas dermatologista")
                ))
        }

        // ---------- CABELO ----------
        cs("cabelo")?.takeIf { it < 70 }?.let { s ->
            val advice = r.category("cabelo")?.recommendations.orEmpty().take(4)
            out += Defect("cabelo", "cabelo", "Corte não favorece o formato do rosto", sev(s.toDouble()), catMeas("cabelo"),
                "O cabelo é a mudança mais rápida e com maior impacto visual no rosto inteiro.", Changeable.SIM, null, listOf(
                    Solution(SolKind.GROOMING, "Corte para rosto ${r.faceShape.lowercase()}",
                        advice + listOf("Leve 2–3 fotos de referência ao barbeiro.", "Mantenha o corte a cada 3–4 semanas."),
                        "A cada 3–4 semanas", "Imediato", Evidence.MODERADA, "R$ 30–80 por corte",
                        "Mudanças grandes, faça aos poucos (um corte de cada vez).",
                        listOf(Links.video("Corte masculino para rosto ${r.faceShape.lowercase()}", "corte de cabelo masculino para rosto ${r.faceShape.lowercase()}"),
                            Links.video("Como modelar cabelo masculino com pomada", "como modelar cabelo masculino com pomada matte"),
                            Links.ml("Pomada efeito matte cabelo masculino"), Links.ml("Pó texturizador cabelo masculino"))),
                    Solution(SolKind.HABITO, "Cuidados com o cabelo",
                        listOf("Lave em dias alternados com shampoo suave e use condicionador nas pontas.", "Seque com toalha sem esfregar; finalize com secador na direção do penteado para dar volume.", "Pouco produto: uma ervilha de pomada basta."),
                        "Em dias alternados", "2–4 semanas", Evidence.MODERADA, "R$ 40–100", "—",
                        listOf(Links.video("Como secar cabelo masculino com volume", "como secar cabelo masculino com secador volume")))
                ))
        }

        // ---------- BARBA ----------
        if (r.beardDetected) {
            ms("barba", "beard_sym")?.takeIf { it < 65 }?.let { s ->
                out += Defect("barba", "barba", "Barba falhada ou desigual entre os lados", sev(s), meas("barba", "beard_sym"),
                    "Barba desigual parece descuidada e desequilibra a simetria.", Changeable.PARCIAL, null, listOf(
                        Solution(SolKind.GROOMING, "Equilibrar a barba",
                            listOf("Apare o lado mais cheio um pouco mais curto para igualar.", "Se há falhas, deixe crescer 4–6 semanas antes de julgar: pelos mais longos cobrem falhas.", "Óleo de barba após o banho e escova para direcionar os pelos sobre as falhas.", "Linhas limpas (bochecha e pescoço) deixam a barba intencional."),
                            "A cada 3–5 dias", "4–6 semanas", Evidence.MODERADA, "R$ 60–250",
                            "Coceira e vermelhidão na barba podem ser foliculite ou dermatite: dermatologista.",
                            listOf(Links.video("Como disfarçar falhas na barba", "como disfarçar falhas na barba"),
                                Links.ml("Óleo para barba"), Links.ml("Escova para barba"), Links.ml("Aparador Philips OneBlade"))),
                        professional("dermatologista", "as falhas são grandes e você quer avaliar tratamentos (existem opções, com acompanhamento médico).", "dermatologista falhas na barba tratamento")
                    ))
            }
        }

        // ---------- MASCULINIDADE ----------
        cs("masculinidade")?.takeIf { it < 60 }?.let { s ->
            out += Defect("masculinidade", "masculinidade", "Traços pouco marcados", sev(s.toDouble()), catMeas("masculinidade"),
                "Mandíbula, queixo, sobrancelhas e pelos faciais são o que mais pesa nesta nota.", Changeable.PARCIAL,
                "A estrutura óssea é genética. Dá para realçar o que existe — e é isso que as soluções fazem.", buildList {
                    add(fatLoss)
                    add(Solution(SolKind.TREINO, "Treino de pescoço e trapézio",
                        listOf("2x por semana: flexão e extensão de pescoço com anilha leve ou faixa (3 séries de 15–20).", "Encolhimento de ombros (trapézio): 3 séries de 10–15.", "Comece MUITO leve e aumente devagar."),
                        "2x por semana", "8–12 semanas", Evidence.MODERADA, "Grátis (academia)",
                        "Pescoço é sensível: sem trancos, sem carga alta. Com dor ou formigamento, pare e procure um profissional.",
                        listOf(Links.video("Treino de pescoço seguro na academia", "treino de pescoço seguro iniciante academia"))))
                    add(Solution(SolKind.GROOMING, "Grooming que realça traços masculinos",
                        listOf("Sobrancelhas naturais e encorpadas (só limpeza, sem afinar).", "Barba ou barba por fazer, se crescer.", "Laterais mais curtas e topo com textura."),
                        "Manutenção semanal", "Imediato", Evidence.MODERADA, "R$ 0–150", "—",
                        listOf(Links.video("Grooming masculino completo", "guia grooming masculino rosto barba sobrancelha"))))
                })
        }

        // ---------- ESTRUTURAIS (honestidade) ----------
        cs("simetria")?.takeIf { it < 60 }?.let { s ->
            out += Defect("simetria", "simetria", "Assimetria do rosto", sev(s.toDouble()), catMeas("simetria"),
                "Todo rosto é um pouco assimétrico; aqui a diferença ficou acima da média.", Changeable.NAO,
                "Assimetria óssea não muda com massagem nem exercícios. Parte da medida pode ser rotação da cabeça ou luz lateral na foto.", listOf(
                    Solution(SolKind.HABITO, "Reduzir a assimetria aparente",
                        listOf("Refaça a foto com a cabeça reta e luz de frente: muita assimetria medida vem do ângulo.", "Mastigue dos dois lados.", "Se dorme sempre do mesmo lado, alterne (evita inchaço de um lado só pela manhã).", "Repartido do cabelo e barba podem compensar o lado mais cheio."),
                        "Contínuo", "Imediato (foto) · semanas (hábitos)", Evidence.FRACA, "Grátis", "—",
                        listOf(Links.video("Como tirar foto de rosto do melhor ângulo", "como tirar foto de rosto masculino melhor ângulo luz")))
                ))
        }
        cs("nariz")?.takeIf { it < 55 }?.let { s ->
            out += Defect("nariz", "nariz", "Proporção do nariz", sev(s.toDouble()), catMeas("nariz"),
                "O nariz fica no centro do rosto e influencia a harmonia.", Changeable.NAO,
                "Não existe massagem, exercício ou produto que mude o formato do nariz. Lentes de celular de perto aumentam o nariz em até 30%: fotografe a ~1 m com zoom 2x.", listOf(
                    Solution(SolKind.GROOMING, "Equilíbrio visual",
                        listOf("Barba e cabelo com volume moderado dividem a atenção com o centro do rosto.", "Evite topete muito alto e rosto todo raspado se o nariz é grande."),
                        "Contínuo", "Imediato", Evidence.FRACA, "—", "Mudanças no nariz em si são decisão médica individual; o app não recomenda procedimentos.",
                        listOf(Links.video("Corte e barba para equilibrar nariz grande", "corte de cabelo e barba para nariz grande")))
                ))
        }

        return out.sortedWith(compareByDescending<Defect> { it.severity }.thenBy { it.changeable.ordinal })
    }
}
