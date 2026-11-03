package com.ascend.faceai.analysis

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Motor de análise. Cada número do relatório sai de uma medição feita aqui sobre os 478 pontos
 * do MediaPipe e/ou os pixels da foto. Nenhuma nota é sorteada ou fixa.
 *
 * Metodologia de pontuação (versão 1):
 *  - cada métrica pontuável recebe nota = 100·exp(-½·((valor − referência)/tolerância)²);
 *  - a nota da categoria é a média ponderada das métricas pontuáveis dela;
 *  - a nota geral é a média ponderada das categorias disponíveis;
 *  - referências vêm de cânones neoclássicos e estudos de proporção facial; NÃO são verdade universal.
 */
object FaceAnalyzer {

    private class M(
        val key: String, val label: String, val value: Double, val display: String, val reference: String,
        val score: Double?, val weight: Double = 1.0, val note: String = ""
    ) {
        fun toResult() = MetricResult(key, label, value, display, reference, score?.let { (it * 10).roundToInt() / 10.0 }, note)
    }

    private fun pct(v: Double) = "${(v * 100).roundToInt()}%"
    private fun f2(v: Double) = String.format(java.util.Locale.US, "%.2f", v)
    private fun f1(v: Double) = String.format(java.util.Locale.US, "%.1f", v)
    private fun deg(v: Double) = "${f1(v)}°"

    private fun catScore(ms: List<M>): Int? {
        val s = ms.filter { it.score != null }
        if (s.isEmpty()) return null
        return (s.sumOf { it.score!! * it.weight } / s.sumOf { it.weight }).roundToInt().coerceIn(0, 100)
    }

    data class Analysis(val report: FaceReport)

    fun analyze(
        id: String,
        createdAt: Long,
        frames: Map<CaptureType, FaceFrame>,
        quality: Map<CaptureType, QualityResult>
    ): FaceReport {
        val f = frames[CaptureType.FRONTAL] ?: error("Foto frontal obrigatória")
        val qFront = quality[CaptureType.FRONTAL] ?: QualityChecker.check(f, CaptureType.FRONTAL)
        val q = qFront.qualityScore.coerceIn(0.2, 1.0)
        val lm = f.lm
        val ml = Midline(LM.MIDLINE.map { lm[it] })

        // ---------- Medidas base ----------
        val faceW = dist(lm[LM.CHEEK_A], lm[LM.CHEEK_B])
        val trich = estimateTrichion(f)
        val trichion = trich.first
        val menton = lm[LM.CHIN]
        val glab = lm[LM.GLABELLA]
        val sn = lm[LM.SUBNASALE]
        val top = trichion ?: lm[LM.FOREHEAD_TOP]
        val upper = dist(top, glab)
        val middle = dist(glab, sn)
        val lower = dist(sn, menton)
        val faceH = dist(top, menton)
        val lw = faceH / faceW
        val stomion = mid(lm[LM.STOMION_UP], lm[LM.STOMION_LOW])

        val wA = dist(lm[LM.EYE_A_OUT], lm[LM.EYE_A_IN]); val wB = dist(lm[LM.EYE_B_OUT], lm[LM.EYE_B_IN])
        val eyeW = (wA + wB) / 2
        val icd = dist(lm[LM.EYE_A_IN], lm[LM.EYE_B_IN])
        val ipd = dist(lm[LM.IRIS_A], lm[LM.IRIS_B])
        val hA = dist(lm[LM.EYE_A_TOP], lm[LM.EYE_A_BOT]); val hB = dist(lm[LM.EYE_B_TOP], lm[LM.EYE_B_BOT])
        val ear = (hA / wA + hB / wB) / 2
        val rot = atan2(lm[LM.IRIS_B].y - lm[LM.IRIS_A].y, lm[LM.IRIS_B].x - lm[LM.IRIS_A].x)
        fun rotate(v: P): P = P(v.x * cos(-rot) - v.y * sin(-rot), v.x * sin(-rot) + v.y * cos(-rot))
        val tiltA = run { val v = rotate(lm[LM.EYE_A_OUT] - lm[LM.EYE_A_IN]); Math.toDegrees(atan2(-v.y, -v.x)) }
        val tiltB = run { val v = rotate(lm[LM.EYE_B_OUT] - lm[LM.EYE_B_IN]); Math.toDegrees(atan2(-v.y, v.x)) }
        val tilt = (tiltA + tiltB) / 2

        val alarW = dist(lm[LM.ALAR_A], lm[LM.ALAR_B])
        val mouthW = dist(lm[LM.MOUTH_A], lm[LM.MOUTH_B])
        val bigonial = dist(lm[LM.GONION_A], lm[LM.GONION_B])
        val bitemporal = dist(lm[LM.TEMPLE_A], lm[LM.TEMPLE_B])
        val chinW = dist(lm[LM.CHIN_A], lm[LM.CHIN_B])
        val jawRatio = bigonial / faceW
        val foreheadRatio = bitemporal / faceW
        val cheekProm = faceW / ((bitemporal + bigonial) / 2)
        val browMid = mid(lm[LM.BROW_A_MID], lm[LM.BROW_B_MID])
        val fwhr = faceW / dist(browMid, lm[LM.UPPER_LIP])

        fun asym(pairs: Array<Pair<Int, Int>>): Double =
            pairs.map { (a, b) -> dist(lm[a], ml.reflect(lm[b])) / faceW }.average() * 100

        val asymAll = asym(LM.PAIRS)
        val asymEyes = asym(LM.EYE_PAIRS)
        val asymBrows = asym(LM.BROW_PAIRS)
        val asymMid = asym(LM.MOUTH_NOSE_PAIRS)
        val asymJaw = asym(LM.JAW_PAIRS)

        // ---------- Pixels ----------
        val lab = PixelOps.labPlanes(f.argb)
        val L = lab[0]; val A = lab[1]; val B = lab[2]
        val oval = PixelOps.polygonMask(f.w, f.h, LM.FACE_OVAL.map { lm[it] })
        val eyesMask = PixelOps.polygonMask(f.w, f.h, LM.EYE_A_POLY.map { lm[it] }).also {
            PixelOps.fillPolygon(it, f.w, f.h, LM.EYE_B_POLY.map { i -> lm[i] })
        }
        val browsMask = PixelOps.polygonMask(f.w, f.h, LM.BROW_A_POLY.map { lm[it] }).also {
            PixelOps.fillPolygon(it, f.w, f.h, LM.BROW_B_POLY.map { i -> lm[i] })
        }
        val lipsMask = PixelOps.polygonMask(f.w, f.h, LM.LIPS_POLY.map { lm[it] })
        val nostril = PixelOps.polygonMask(f.w, f.h, LM.NOSTRIL_POLY.map { lm[it] })
        val r = max(2, (eyeW * 0.18).toInt())

        val beard = analyzeBeard(f, L, oval, lipsMask, ml, faceH, eyeW)
        val skinMask = BooleanArray(f.w * f.h)
        val exEyes = PixelOps.dilate(eyesMask, f.w, f.h, r)
        val exBrows = PixelOps.dilate(browsMask, f.w, f.h, r)
        val exLips = PixelOps.dilate(lipsMask, f.w, f.h, r / 2 + 1)
        for (i in skinMask.indices) {
            if (!oval[i] || exEyes[i] || exBrows[i] || exLips[i] || nostril[i]) continue
            if (f.seg != null && (f.seg[i].toInt() and 0xFF) != SegClass.FACE_SKIN) continue
            if (beard.zone != null && beard.present && beard.zone[i]) continue
            skinMask[i] = true
        }
        val skin = analyzeSkin(f, L, A, B, skinMask, eyesMask, eyeW, qFront)
        val hair = analyzeHair(f, trich, faceW, faceH, lw)
        val jawDef = jawDefinition(f, L, oval) to frames[CaptureType.ANGLE45]?.takeIf { quality[CaptureType.ANGLE45]?.ok == true }?.let {
            jawDefinition(it, PixelOps.labPlanes(it.argb)[0], PixelOps.polygonMask(it.w, it.h, LM.FACE_OVAL.map { p -> it.lm[p] }))
        }
        val cheekShade = run {
            val zy = (patchMean(L, f, lm[LM.ZYGO_A], eyeW * 0.2) + patchMean(L, f, lm[LM.ZYGO_B], eyeW * 0.2)) / 2
            val lowA = mid(lm[LM.CHEEK_CENTER_A], lm[LM.GONION_A]); val lowB = mid(lm[LM.CHEEK_CENTER_B], lm[LM.GONION_B])
            val lo = (patchMean(L, f, lowA, eyeW * 0.2) + patchMean(L, f, lowB, eyeW * 0.2)) / 2
            (zy - lo) / max(1.0, zy)
        }
        val browDensity = run {
            val bl = PixelOps.mean(L, browsMask)
            val fore = PixelOps.polygonMask(f.w, f.h, LM.FOREHEAD_POLY.map { lm[it] })
            for (i in fore.indices) if (!skinMask[i]) fore[i] = false
            val fl = if (PixelOps.count(fore) > 50) PixelOps.mean(L, fore) else PixelOps.mean(L, skinMask)
            fl - bl
        }

        // ---------- Perfil ----------
        val profileFrame = listOf(CaptureType.PROFILE_LEFT, CaptureType.PROFILE_RIGHT)
            .firstOrNull { frames[it] != null && quality[it]?.ok == true }?.let { frames[it] }
        val profile = profileFrame?.let { analyzeProfile(it) }

        // ---------- Categorias ----------
        val cats = ArrayList<CategoryResult>()
        val norm = { p: P -> p.x / f.w to p.y / f.h }

        // Harmonia
        val harm = ArrayList<M>()
        if (trichion != null) {
            val tot = upper + middle + lower
            val dev = listOf(upper, middle, lower).maxOf { abs(it / tot - 1.0 / 3) }
            harm += M("thirds", "Equilíbrio dos terços faciais", dev, "Superior ${pct(upper / tot)} · Médio ${pct(middle / tot)} · Inferior ${pct(lower / tot)}",
                "Cada terço ≈ 33%", closeness(dev, 0.0, 0.045), 1.5, "Maior desvio entre os terços: ${pct(dev)}")
        } else {
            val ratio = middle / lower
            harm += M("thirds_ml", "Terço médio ÷ terço inferior", ratio, f2(ratio), "≈ 0,95 (rosto médio)", closeness(ratio, 0.95, 0.12), 1.5,
                "Linha do cabelo não localizada (${trich.second}); terço superior não avaliado.")
        }
        harm += M("icd_eye", "Distância entre olhos ÷ largura do olho", icd / eyeW, f2(icd / eyeW), "≈ 1,43 (rosto médio; equivale à regra dos quintos)", closeness(icd / eyeW, 1.43, 0.16))
        harm += M("mouth_nose", "Largura da boca ÷ largura do nariz", mouthW / alarW, f2(mouthW / alarW), "≈ 1,54", closeness(mouthW / alarW, 1.54, 0.30))
        harm += M("eye_face", "Largura do olho ÷ largura do rosto", eyeW / faceW, f2(eyeW / faceW), "≈ 0,17 (rosto médio)", closeness(eyeW / faceW, 0.169, 0.02))
        cats += category("harmonia", "Harmonia facial", harm, q * 0.8, norm(lm[LM.NOSE_TIP]), listOf(Modifiability.LOW),
            limits = listOf(
                "Referências de proporção (terços, quintos) são convenções artísticas e estatísticas, não um padrão obrigatório de beleza.",
                "Lentes grande-angulares de celular a curta distância aumentam o nariz e afinam o rosto; fotografe a ~1 m com zoom 2x se possível."
            ),
            recs = { s -> if ((s ?: 100) < 70) listOf("Harmonia é pouco alterável por cuidados pessoais; cabelo e barba podem equilibrar visualmente terços desproporcionais (veja Cabelo e Barba).") else listOf("Suas proporções principais estão próximas das referências; mantenha cabelo e barba que preservem esse equilíbrio.") })

        // Simetria
        val sym = listOf(
            M("asym_all", "Assimetria média (38 pares de pontos)", asymAll, "${f1(asymAll)}% da largura do rosto", "Rostos reais: 1–3%", lowerIsBetter(asymAll, 1.0, 2.2), 2.0),
            M("asym_eyes", "Assimetria dos olhos", asymEyes, "${f1(asymEyes)}%", "< 2%", lowerIsBetter(asymEyes, 0.8, 2.0)),
            M("asym_brows", "Assimetria das sobrancelhas", asymBrows, "${f1(asymBrows)}%", "< 2,5%", lowerIsBetter(asymBrows, 1.0, 2.5)),
            M("asym_mid", "Assimetria de nariz e boca", asymMid, "${f1(asymMid)}%", "< 2%", lowerIsBetter(asymMid, 0.8, 2.0)),
            M("asym_jaw", "Assimetria da mandíbula", asymJaw, "${f1(asymJaw)}%", "< 2,5%", lowerIsBetter(asymJaw, 1.0, 2.5))
        )
        cats += category("simetria", "Simetria", sym, q * lowerIsBetter(abs(qFront.yawDeg), 3.0, 6.0) / 100 * 0.9, norm(glab), listOf(Modifiability.LOW),
            limits = listOf(
                "Pequenas rotações da cabeça (${f1(abs(qFront.yawDeg))}° medido) e luz lateral aumentam a assimetria aparente.",
                "Toda face humana tem alguma assimetria natural; valores de 1–3% são comuns."
            ),
            recs = { s -> listOf("Expressão neutra e cabeça reta nas fotos de acompanhamento deixam a comparação justa.") +
                if (asymBrows > 2.5) listOf("A assimetria das sobrancelhas é a parte mais ajustável: um design com profissional pode equilibrar a altura.") else emptyList() })

        // Estrutura
        val shape = classifyShape(lw, jawRatio, foreheadRatio, trichion != null)
        val estr = ArrayList<M>()
        if (trichion != null) estr += M("lw", "Altura ÷ largura do rosto", lw, f2(lw), "≈ 1,35", closeness(lw, 1.35, 0.14), 1.5)
        else estr += M("lw", "Altura ÷ largura (sem linha do cabelo)", lw, f2(lw), "Descritivo", null, 1.0, "Subestimado: a altura vai só até o topo detectado da testa.")
        estr += M("jaw_cheek", "Mandíbula ÷ maçãs (largura)", jawRatio, f2(jawRatio), "≈ 0,80", closeness(jawRatio, 0.80, 0.07))
        estr += M("fore_cheek", "Testa ÷ maçãs (largura)", foreheadRatio, f2(foreheadRatio), "≈ 0,92", closeness(foreheadRatio, 0.925, 0.06))
        estr += M("fwhr", "Índice largura/altura facial (fWHR)", fwhr, f2(fwhr), "Descritivo (rosto médio ≈ 1,8)", null)
        profile?.let { estr += it.convexity }
        cats += category("estrutura", "Estrutura facial observável", estr, q * 0.75, norm(lm[LM.FOREHEAD_TOP]), listOf(Modifiability.LOW, Modifiability.PROFESSIONAL),
            limits = listOf(
                "Medidas 2D da foto frontal. Volume ósseo e projeção exigem perfil ou exame 3D.",
                if (profile == null) "Projeção do perfil não avaliada: envie uma foto de perfil." else "Perfil estimado pela malha do MediaPipe — aproximação, não cefalometria."
            ),
            recs = { _ -> listOf("Formato $shape: ${shapeHairAdvice(shape)}") })

        // Mandíbula
        val jaw = ArrayList<M>()
        jaw += M("jaw_ratio", "Largura da mandíbula ÷ largura do rosto", jawRatio, f2(jawRatio), "≈ 0,80 (levemente acima da média)", closeness(jawRatio, 0.80, 0.07), 1.5)
        val chinRatio = dist(stomion, menton) / dist(sn, menton)
        jaw += M("chin_ratio", "Lábios→queixo ÷ nariz→queixo", chinRatio, f2(chinRatio), "≈ 0,70 (≈ proporção 1:2)", closeness(chinRatio, 0.70, 0.06))
        val jd = listOfNotNull(jawDef.first, jawDef.second).average()
        jaw += M("jaw_def", "Definição visual do contorno (contraste)", jd, f2(jd), "≥ 0,22", higherIsBetter(jd, 0.22, 0.10), 0.8,
            "Mede o contraste de luz/sombra ao longo do contorno — depende da iluminação e da gordura/pele da região." + if (jawDef.second != null) " Inclui a foto de 45°." else "")
        jaw += M("chin_mouth", "Largura do queixo ÷ largura da boca", chinW / mouthW, f2(chinW / mouthW), "Descritivo", null)
        jaw += M("gonial_2d", "Ângulo do contorno mandibular (frontal 2D)", angleDeg(lm[LM.CHEEK_A], lm[LM.GONION_A], menton), deg(angleDeg(lm[LM.CHEEK_A], lm[LM.GONION_A], menton)), "Descritivo", null)
        profile?.let { jaw += it.chin; jaw += it.mandibular; jaw += it.lips }
        cats += category("mandibula", "Mandíbula e queixo", jaw, q * 0.7, norm(lm[LM.GONION_B]), listOf(Modifiability.LOW, Modifiability.SELF_CARE, Modifiability.PROFESSIONAL),
            limits = listOf(
                "Uma foto frontal não determina desenvolvimento ósseo nem a posição anatômica da maxila ou da mandíbula; isso exige avaliação odontológica/ortodôntica com exames de imagem.",
                "A definição visual muda com luz, ângulo, percentual de gordura e barba."
            ),
            recs = { s -> buildList {
                if (jd < 0.2) add("Definição visual baixa nesta foto: luz lateral suave de cima e barba bem desenhada no contorno costumam realçar a linha da mandíbula.")
                add("Composição corporal (treino + alimentação) é o fator modificável que mais afeta a definição do contorno.")
                add("Dúvidas sobre mordida, maxila ou queixo devem ir a um dentista/ortodontista — não use exercícios ou aparelhos sem orientação.")
            } })

        // Maçãs do rosto
        val mac = listOf(
            M("cheek_prom", "Proeminência das maçãs (largura relativa)", cheekProm, f2(cheekProm), "≈ 1,18", closeness(cheekProm, 1.18, 0.07), 1.5),
            M("cheek_shade", "Contraste luz/sombra abaixo das maçãs", cheekShade, f2(cheekShade), "≥ 0,06", higherIsBetter(cheekShade, 0.06, 0.05), 0.6,
                "Depende fortemente da direção da luz.")
        )
        cats += category("macas", "Maçãs do rosto", mac, q * 0.6, norm(lm[LM.ZYGO_B]), listOf(Modifiability.LOW, Modifiability.SELF_CARE),
            limits = listOf("Volume das maçãs é tridimensional; a foto frontal capta só largura e sombreamento.", "Luz frontal achata o rosto e reduz o contraste medido."),
            recs = { _ -> listOf("Em fotos, luz vinda de cima e levemente de lado realça as maçãs.", "Percentual de gordura mais baixo aumenta a definição visual dessa região.") })

        // Olhos
        val underEye = skin.underEye
        val eyes = listOf(
            M("tilt", "Inclinação dos cantos dos olhos", tilt, deg(tilt), "≈ +2° a +6° (levemente para cima)", closeness(tilt, 4.0, 4.5), 1.2),
            M("ear", "Abertura ocular (altura ÷ largura)", ear, f2(ear), "≈ 0,26", closeness(ear, 0.26, 0.07)),
            M("icd", "Espaçamento entre os olhos", icd / eyeW, f2(icd / eyeW), "≈ 1,43", closeness(icd / eyeW, 1.43, 0.16)),
            M("eye_size_asym", "Diferença de tamanho entre os olhos", abs(wA - wB) / eyeW, pct(abs(wA - wB) / eyeW), "< 5%", lowerIsBetter(abs(wA - wB) / eyeW, 0.03, 0.06)),
            M("ipd_face", "Distância entre pupilas ÷ largura do rosto", ipd / faceW, f2(ipd / faceW), "Descritivo (≈ 0,41–0,46)", null),
            M("under_eye", "Região abaixo dos olhos (ΔL vs bochecha)", underEye, f1(underEye), "≥ −6 (sombra natural)", higherIsBetter(underEye, -6.0, 6.0), 0.8,
                "Valores mais negativos = olheiras aparentes. Sombra da própria anatomia também escurece a região.")
        )
        cats += category("olhos", "Olhos e região orbital", eyes, q * 0.8, norm(mid(lm[LM.EYE_A_IN], lm[LM.EYE_A_OUT])), listOf(Modifiability.LOW, Modifiability.SELF_CARE),
            limits = listOf("Formato e inclinação dos olhos são estruturais.", "Olheiras medidas por luminosidade: sombra anatômica e luz de cima podem exagerar o valor."),
            recs = { _ -> buildList {
                if (underEye < -10) add("Olheiras aparentes: priorize 7–9 h de sono, hidratação e protetor solar; persistindo, procure um dermatologista.")
                add("Sobrancelhas bem definidas emolduram os olhos (veja Sobrancelhas).")
            } })

        // Nariz
        val noseDev = abs(ml.offset(lm[LM.NOSE_TIP])) / faceW
        val nostrilSym = abs(ml.offset(lm[LM.ALAR_A]) + ml.offset(lm[LM.ALAR_B])) / alarW
        val nose = ArrayList<M>()
        nose += M("alar_icd", "Largura do nariz ÷ distância entre olhos", alarW / icd, f2(alarW / icd), "Descritivo (rosto médio do modelo ≈ 0,86)", null, 1.0,
            "Não entra na nota: a largura do nariz varia naturalmente entre etnias e não é um defeito.")
        nose += M("alar_face", "Largura do nariz ÷ largura do rosto", alarW / faceW, f2(alarW / faceW), "Descritivo (≈ 0,21 no rosto médio)", null)
        nose += M("nose_len_ratio", "Comprimento do nariz ÷ terço inferior", dist(lm[LM.NASION], sn) / lower, f2(dist(lm[LM.NASION], sn) / lower), "≈ 0,73 (rosto médio)", closeness(dist(lm[LM.NASION], sn) / lower, 0.73, 0.15), 0.8)
        nose += M("nose_dev", "Desvio da ponta em relação à linha média", noseDev, pct(noseDev), "< 1,5%", lowerIsBetter(noseDev, 0.005, 0.015))
        nose += M("nostril_sym", "Simetria das asas do nariz", nostrilSym, pct(nostrilSym), "< 8%", lowerIsBetter(nostrilSym, 0.03, 0.08))
        nose += M("nose_len", "Comprimento do nariz ÷ altura do rosto", dist(lm[LM.NASION], sn) / faceH, f2(dist(lm[LM.NASION], sn) / faceH), "Descritivo", null)
        profile?.let { nose += it.nasal }
        cats += category("nariz", "Nariz", nose, q * 0.8, norm(P(lm[LM.NOSE_TIP].x, (lm[LM.NOSE_TIP].y + lm[LM.NASION].y) / 2)), listOf(Modifiability.LOW, Modifiability.PROFESSIONAL),
            limits = listOf("Câmeras próximas aumentam o nariz em até 30%; fotografe a ~1 m.", "Largura do nariz é apenas descritiva: varia entre etnias e não é penalizada.", if (profile == null) "Projeção e dorso do nariz exigem foto de perfil." else "Perfil estimado — aproximado."),
            recs = { _ -> listOf("O nariz é estrutural. Barba e cabelo com volume equilibrado reduzem o destaque visual do centro do rosto.", "Qualquer intervenção no nariz é decisão médica, a ser discutida com um profissional — o app não recomenda procedimentos.") })

        // Pele
        cats += category("pele", "Qualidade visual da pele", skin.metrics, q * skin.confidenceFactor, norm(lm[LM.CHEEK_CENTER_B]), listOf(Modifiability.SELF_CARE, Modifiability.PROFESSIONAL),
            limits = listOf(
                "Indicadores visuais aproximados (cor e contraste dos pixels). NÃO é diagnóstico dermatológico.",
                "Filtros de beleza, compressão de imagem, maquiagem e luz amarelada alteram os resultados.",
                "Poros e textura dependem da resolução: em fotos com pouca nitidez (${f1(qFront.sharpness)}) esses valores perdem confiabilidade."
            ),
            recs = { _ -> skin.recs }, unavailable = if (skin.pixels < 2000) "Pouca pele visível para medir." else null)

        // Cabelo
        cats += category("cabelo", "Cabelo e enquadramento", hair.metrics, q * 0.55, hair.region?.let { norm(it) } ?: norm(lm[LM.FOREHEAD_TOP]), listOf(Modifiability.GROOMING),
            limits = listOf("Cabelo segmentado por IA (MediaPipe multiclasse): cabelos muito claros ou parecidos com o fundo podem ser mal detectados.", "Corte exato (degradê, undercut) é estimado pela distribuição de volume, não reconhecido diretamente."),
            recs = { _ -> hair.recs }, unavailable = hair.unavailable)

        // Sobrancelhas
        val bhA = dist(lm[LM.BROW_A_MID], lm[LM.EYE_A_TOP]) / eyeW
        val bhB = dist(lm[LM.BROW_B_MID], lm[LM.EYE_B_TOP]) / eyeW
        val browAsym = abs(bhA - bhB) / ((bhA + bhB) / 2)
        val browTiltA = run { val v = rotate(lm[LM.BROW_A_TAIL] - lm[LM.BROW_A_IN]); Math.toDegrees(atan2(-v.y, -v.x)) }
        val browTiltB = run { val v = rotate(lm[LM.BROW_B_TAIL] - lm[LM.BROW_B_IN]); Math.toDegrees(atan2(-v.y, v.x)) }
        val browTilt = (browTiltA + browTiltB) / 2
        val tailA = (rotate(lm[LM.EYE_A_OUT]).x - rotate(lm[LM.BROW_A_TAIL]).x) / eyeW
        val tailB = (rotate(lm[LM.BROW_B_TAIL]).x - rotate(lm[LM.EYE_B_OUT]).x) / eyeW
        val browGap = dist(lm[LM.BROW_A_IN], lm[LM.BROW_B_IN]) / icd
        val brows = listOf(
            M("brow_asym", "Diferença de altura entre sobrancelhas", browAsym, pct(browAsym), "< 8%", lowerIsBetter(browAsym, 0.04, 0.10), 1.3),
            M("brow_tilt", "Inclinação (início → ponta)", browTilt, deg(browTilt), "≈ −10° (arco natural médio)", closeness(browTilt, -10.0, 7.0)),
            M("brow_tail", "Extensão da cauda além do canto do olho", (tailA + tailB) / 2, f2((tailA + tailB) / 2), "≈ 0,49 (rosto médio)", closeness((tailA + tailB) / 2, 0.49, 0.15)),
            M("brow_density", "Contraste/densidade (ΔL vs testa)", browDensity, f1(browDensity), "≥ 15", higherIsBetter(browDensity, 15.0, 8.0), 0.7, "Pelos claros em pele clara reduzem o valor sem significar falhas."),
            M("brow_height", "Altura média acima dos olhos", (bhA + bhB) / 2, f2((bhA + bhB) / 2), "Descritivo", null),
            M("brow_gap", "Espaço entre as sobrancelhas ÷ distância entre olhos", browGap, f2(browGap), "Descritivo (rosto médio ≈ 0,75)", null)
        )
        cats += category("sobrancelhas", "Sobrancelhas", brows, q * 0.7, norm(lm[LM.BROW_B_MID]), listOf(Modifiability.GROOMING),
            limits = listOf("Altura e inclinação mudam com a expressão (sobrancelhas levantadas).", "Densidade é medida por contraste e varia com cor de pelos e pele."),
            recs = { _ -> buildList {
                if (browAsym > 0.08) add("Diferença de altura visível: um design profissional (só limpeza, sem afinar demais) pode equilibrar os dois lados.")
                if (browGap < 0.62) add("Sobrancelhas próximas: remover pelos do centro (glabela) abre o olhar.")
                if (browDensity < 12) add("Pouca densidade aparente: evite afinar; pentear para cima e um gel fixador transparente dão volume natural.")
                add("Mantenha o formato natural masculino: retire só pelos soltos fora do desenho.")
            } })

        // Barba
        cats += category("barba", "Barba", beard.metrics, q * 0.45, norm(menton), listOf(Modifiability.GROOMING),
            limits = listOf("Barba detectada por escurecimento relativo e segmentação; barbas claras ou pele escura podem não ser detectadas corretamente.", "Linha do pescoço não é visível na foto frontal."),
            recs = { _ -> beard.recs + listOf("Para o formato $shape: ${shapeBeardAdvice(shape)}") },
            unavailable = if (!beard.present) "Barba não detectada (ou clara demais para a câmera). Dicas de estilo abaixo." else null)

        // ---------- Nota geral e potencial ----------
        val weights = mapOf("harmonia" to 0.14, "simetria" to 0.10, "estrutura" to 0.08, "mandibula" to 0.10, "macas" to 0.06,
            "olhos" to 0.10, "nariz" to 0.07, "pele" to 0.14, "cabelo" to 0.09, "sobrancelhas" to 0.06, "barba" to 0.06)
        val improvable = mapOf("pele" to 0.6, "cabelo" to 0.7, "sobrancelhas" to 0.6, "barba" to 0.7, "olhos" to 0.1, "mandibula" to 0.15, "macas" to 0.1)
        val scored = cats.filter { it.available && it.score != null }
        val wsum = scored.sumOf { weights[it.id] ?: 0.05 }
        val overall = (scored.sumOf { it.score!! * (weights[it.id] ?: 0.05) } / wsum).roundToInt()
        val potential = (scored.sumOf { (100 - it.score!!) * (weights[it.id] ?: 0.05) * (improvable[it.id] ?: 0.0) } / wsum).roundToInt()
        val overallConf = scored.sumOf { it.confidence * (weights[it.id] ?: 0.05) } / wsum

        val ranked = scored.sortedByDescending { it.score }
        val strengths = ranked.take(3).filter { it.score!! >= 60 }.map { "${it.name} (${it.score})" }
        val improvements = scored.filter { (improvable[it.id] ?: 0.0) >= 0.5 }.sortedBy { it.score }.take(3).map { "${it.name} (${it.score})" }

        val confWord = when { overallConf >= 0.7 -> "alta"; overallConf >= 0.45 -> "média"; else -> "baixa" }
        val summary = buildString {
            append("Rosto classificado como ${shape.lowercase()}. ")
            if (strengths.isNotEmpty()) append("Destaques: ${strengths.joinToString(", ")}. ")
            if (improvements.isNotEmpty()) append("Onde você mais pode evoluir com cuidados e grooming: ${improvements.joinToString(", ")}. ")
            append("Margem estimada de +$potential pontos trabalhando fatores modificáveis. Confiança geral $confWord (qualidade da foto ${(qFront.qualityScore * 100).roundToInt()}%).")
        }

        val descriptive = ArrayList<MetricResult>()
        descriptive += MetricResult("face_w", "Largura do rosto", faceW, "${faceW.roundToInt()} px", "Referência interna de escala")
        descriptive += MetricResult("ipd", "Distância entre pupilas", ipd, "${ipd.roundToInt()} px", "Escala")
        descriptive += MetricResult("hairline", "Linha do cabelo", if (trichion != null) 1.0 else 0.0, if (trichion != null) "Localizada" else "Não localizada", trich.second)
        profile?.let { descriptive += it.all.map { m -> m.toResult() } }

        val catMod = { m: Modifiability -> cats.filter { m in it.modifiability }.map { it.name } }

        return FaceReport(
            id = id, createdAt = createdAt, overall = overall, potential = potential, overallConfidence = overallConf,
            faceShape = shape, faceShapeExplanation = shapeExplanation(shape, lw, jawRatio, foreheadRatio, trichion != null),
            summary = summary, categories = cats, strengths = strengths, improvements = improvements,
            photos = quality.map { (t, qr) -> PhotoResult(t, qr, frames[t] != null && qr.ok && (t == CaptureType.FRONTAL || t == CaptureType.ANGLE45 || profileFrame === frames[t])) },
            descriptive = descriptive, profileAvailable = profile != null, beardDetected = beard.present,
            frontalLandmarks = lm.flatMap { listOf((it.x / f.w).toFloat(), (it.y / f.h).toFloat()) },
            lowModifiable = catMod(Modifiability.LOW), selfCareModifiable = catMod(Modifiability.SELF_CARE),
            groomingModifiable = catMod(Modifiability.GROOMING), professionalDependent = catMod(Modifiability.PROFESSIONAL)
        )
    }

    private fun category(
        id: String, name: String, ms: List<M>, confidence: Double, pos: Pair<Double, Double>, mod: List<Modifiability>,
        limits: List<String>, recs: (Int?) -> List<String>, unavailable: String? = null
    ): CategoryResult {
        val score = if (unavailable != null) null else catScore(ms)
        val scoredMs = ms.filter { it.score != null }
        val strengths = scoredMs.filter { it.score!! >= 80 }.sortedByDescending { it.score }.map { "${it.label}: ${it.display} (ref. ${it.reference})" }
        val opps = scoredMs.filter { it.score!! < 60 }.sortedBy { it.score }.map { "${it.label}: ${it.display} (ref. ${it.reference})" }
        val contributors = scoredMs.sortedByDescending { abs(it.score!! - (score ?: 50)) * it.weight }.take(3)
            .map { "${it.label} → ${it.score!!.roundToInt()}/100" }
        val just = when {
            unavailable != null -> unavailable
            score == null -> "Sem métricas pontuáveis nesta foto."
            else -> "Média ponderada de ${scoredMs.size} medições. " +
                (if (strengths.isNotEmpty()) "Mais próximo da referência: ${scoredMs.maxByOrNull { it.score!! }!!.label}. " else "") +
                (if (opps.isNotEmpty()) "Mais distante: ${scoredMs.minByOrNull { it.score!! }!!.label}." else "Nenhuma medição ficou muito distante da referência.")
        }
        return CategoryResult(
            id = id, name = name, score = score, confidence = confidence.coerceIn(0.05, 0.95), justification = just,
            contributors = contributors, strengths = strengths, opportunities = opps, limitations = limits,
            recommendations = recs(score), modifiability = mod, metrics = ms.map { it.toResult() },
            regionX = pos.first, regionY = pos.second, available = unavailable == null && score != null,
            unavailableReason = unavailable
        )
    }

    // ---------------- Linha do cabelo ----------------
    /** Sobe pela linha média a partir do topo da testa até a pele acabar. Retorna (ponto, explicação). */
    fun estimateTrichion(f: FaceFrame): Pair<P?, String> {
        if (f.seg == null) return null to "segmentação indisponível"
        val start = f.lm[LM.FOREHEAD_TOP]
        val dir = run { val c = f.lm[LM.CHIN]; val d = start - c; val n = hypot(d.x, d.y); P(d.x / n, d.y / n) }
        val startClass = f.segAt(start.x.toInt(), start.y.toInt())
        if (startClass == SegClass.HAIR) return null to "franja ou cabelo cobrindo a testa"
        var p = start
        val maxSteps = (dist(start, f.lm[LM.CHIN]) * 0.7).toInt()
        for (s in 0 until maxSteps) {
            p = P(start.x + dir.x * s, start.y + dir.y * s)
            val x = p.x.toInt(); val y = p.y.toInt()
            if (y <= 0) return null to "topo da cabeça fora da foto"
            var skinVotes = 0
            for (dx in -2..2) { val c = f.segAt(x + dx, y); if (c == SegClass.FACE_SKIN || c == SegClass.BODY_SKIN) skinVotes++ }
            if (skinVotes <= 1) {
                val c = f.segAt(x, y)
                return if (c == SegClass.HAIR) p to "detectada pela segmentação de cabelo"
                else p to "fim da pele sem cabelo (testa alta ou calvície)"
            }
        }
        return null to "não encontrada"
    }

    private fun patchMean(v: DoubleArray, f: FaceFrame, c: P, rad: Double): Double {
        var s = 0.0; var n = 0
        val r = max(1, rad.toInt())
        for (dy in -r..r) for (dx in -r..r) {
            if (dx * dx + dy * dy > r * r) continue
            val x = c.x.toInt() + dx; val y = c.y.toInt() + dy
            if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue
            s += v[y * f.w + x]; n++
        }
        return if (n == 0) 0.0 else s / n
    }

    // ---------------- Contorno da mandíbula ----------------
    private fun jawDefinition(f: FaceFrame, L: DoubleArray, oval: BooleanArray): Double {
        val c = P(LM.FACE_OVAL.map { f.lm[it].x }.average(), LM.FACE_OVAL.map { f.lm[it].y }.average())
        val faceW = dist(f.lm[LM.CHEEK_A], f.lm[LM.CHEEK_B]).coerceAtLeast(1.0)
        val d = faceW * 0.035
        val vals = ArrayList<Double>()
        val bright = PixelOps.mean(L, oval).coerceAtLeast(5.0)
        for (idx in LM.JAW_CONTOUR) {
            val p = f.lm[idx]
            val v = p - c; val n = hypot(v.x, v.y); if (n == 0.0) continue
            val u = P(v.x / n, v.y / n)
            val inside = p - u * d; val outside = p + u * d
            val xi = inside.x.toInt(); val yi = inside.y.toInt(); val xo = outside.x.toInt(); val yo = outside.y.toInt()
            if (xi !in 0 until f.w || yi !in 0 until f.h || xo !in 0 until f.w || yo !in 0 until f.h) continue
            vals += abs(L[yi * f.w + xi] - L[yo * f.w + xo]) / bright
        }
        return if (vals.isEmpty()) 0.0 else vals.average()
    }

    // ---------------- Pele ----------------
    private class SkinOut(val metrics: List<M>, val recs: List<String>, val underEye: Double, val confidenceFactor: Double, val pixels: Int)

    private fun analyzeSkin(f: FaceFrame, L: DoubleArray, A: DoubleArray, B: DoubleArray, mask: BooleanArray, eyes: BooleanArray, eyeW: Double, q: QualityResult): SkinOut {
        val n = PixelOps.count(mask)
        val w = f.w; val h = f.h
        // Olheiras
        fun underEyeRegion(outer: P, inner: P, bottom: P): BooleanArray {
            val m = BooleanArray(w * h)
            val x0 = min(outer.x, inner.x) + eyeW * 0.15; val x1 = max(outer.x, inner.x) - eyeW * 0.15
            val y0 = bottom.y + eyeW * 0.22; val y1 = bottom.y + eyeW * 0.55
            for (y in y0.toInt()..y1.toInt()) for (x in x0.toInt()..x1.toInt()) {
                if (x !in 0 until w || y !in 0 until h || eyes[y * w + x]) continue
                if (f.seg != null && (f.seg[y * w + x].toInt() and 0xFF) != SegClass.FACE_SKIN) continue
                m[y * w + x] = true
            }
            return m
        }
        val ueA = underEyeRegion(f.lm[LM.EYE_A_OUT], f.lm[LM.EYE_A_IN], f.lm[LM.EYE_A_BOT])
        val ueB = underEyeRegion(f.lm[LM.EYE_B_OUT], f.lm[LM.EYE_B_IN], f.lm[LM.EYE_B_BOT])
        val ueL = (PixelOps.percentile(L, ueA, 0.5) + PixelOps.percentile(L, ueB, 0.5)) / 2
        val cheekMask = BooleanArray(w * h)
        for (c in listOf(f.lm[LM.CHEEK_CENTER_A], f.lm[LM.CHEEK_CENTER_B])) {
            val rr = (eyeW * 0.3).toInt()
            for (dy in -rr..rr) for (dx in -rr..rr) { val x = c.x.toInt() + dx; val y = c.y.toInt() + dy; if (x in 0 until w && y in 0 until h && dx * dx + dy * dy <= rr * rr) cheekMask[y * w + x] = true }
        }
        val cheekL = PixelOps.percentile(L, cheekMask, 0.5)
        val underEye = if (ueL.isNaN()) 0.0 else ueL - cheekL

        if (n < 2000) return SkinOut(emptyList(), listOf("Envie uma foto mais próxima e bem iluminada para avaliar a pele."), underEye, 0.3, n)

        // Vermelhidão
        val medA = PixelOps.percentile(A, mask, 0.5)
        var red = 0
        for (i in mask.indices) if (mask[i] && A[i] > medA + 7) red++
        val redFrac = red.toDouble() / n

        // Pontos (acne aparente) e manchas
        val rad = max(3, w / 80)
        val Ls = PixelOps.boxBlur(L, w, h, 1); val Lm = PixelOps.boxBlur(L, w, h, rad)
        val As = PixelOps.boxBlur(A, w, h, 1); val Am = PixelOps.boxBlur(A, w, h, rad)
        val redSpot = BooleanArray(w * h); val darkSpot = BooleanArray(w * h)
        for (i in mask.indices) {
            if (!mask[i]) continue
            val dl = Lm[i] - Ls[i]; val da = As[i] - Am[i]
            if (dl > 5.0 && da > 4.0) redSpot[i] = true
            else if (dl > 10.0 && da <= 2.0) darkSpot[i] = true
        }
        val minA = max(6, (w / 200.0).let { (it * it).toInt() })
        val maxA = (w / 22.0).let { (it * it).toInt() }
        val redCount = PixelOps.componentSizes(redSpot, w, h).count { it in minA..maxA }
        val darkCount = PixelOps.componentSizes(darkSpot, w, h).count { it in minA..maxA }
        val per100k = 100_000.0 / n
        val redDens = redCount * per100k
        val darkDens = darkCount * per100k

        // Textura
        val Lb2 = PixelOps.boxBlur(L, w, h, 2)
        val hf = DoubleArray(w * h) { L[it] - Lb2[it] }
        val texture = PixelOps.std(hf, mask)

        // Uniformidade (grade de células com remoção do gradiente de luz)
        var minX = w; var maxX = 0; var minY = h; var maxY = 0
        for (i in mask.indices) if (mask[i]) { val x = i % w; val y = i / w; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
        val gx = 6; val gy = 8
        val cells = ArrayList<DoubleArray>() // x, y, meanL, meanA
        for (cy in 0 until gy) for (cx in 0 until gx) {
            val x0 = minX + (maxX - minX) * cx / gx; val x1 = minX + (maxX - minX) * (cx + 1) / gx
            val y0 = minY + (maxY - minY) * cy / gy; val y1 = minY + (maxY - minY) * (cy + 1) / gy
            var sl = 0.0; var sa = 0.0; var cnt = 0; var tot = 0
            for (y in y0 until y1) for (x in x0 until x1) { tot++; val i = y * w + x; if (mask[i]) { sl += L[i]; sa += A[i]; cnt++ } }
            if (tot > 0 && cnt > tot * 0.6) cells += doubleArrayOf(cx.toDouble(), cy.toDouble(), sl / cnt, sa / cnt)
        }
        val (unevenL, unevenA) = if (cells.size >= 6) planeResidualStd(cells) else (Double.NaN to Double.NaN)

        // Brilho/oleosidade aparente (reflexos especulares)
        val medL = PixelOps.percentile(L, mask, 0.5)
        var shine = 0
        for (i in mask.indices) if (mask[i] && L[i] > medL + 20 && hypot(A[i], B[i]) < 18) shine++
        val shineFrac = shine.toDouble() / n

        val sharpFactor = higherIsBetter(q.sharpness, 35.0, 15.0) / 100
        val ms = ArrayList<M>()
        ms += M("redness", "Vermelhidão (área avermelhada)", redFrac, pct(redFrac), "< 6% da pele", lowerIsBetter(redFrac, 0.05, 0.07), 1.0)
        ms += M("spots", "Pontos avermelhados (acne visível aproximada)", redDens, "$redCount pontos", "Poucos ou nenhum", lowerIsBetter(redDens, 4.0, 8.0), 1.2,
            "Pelos, pintas e poros dilatados podem ser contados; confira visualmente.")
        ms += M("dark_spots", "Manchas escuras pequenas", darkDens, "$darkCount manchas", "Poucas", lowerIsBetter(darkDens, 10.0, 15.0), 0.6, "Inclui pintas e sardas, que não são problemas.")
        ms += M("texture", "Textura aparente/poros (microcontraste)", texture, f2(texture), "≤ 2,5", lowerIsBetter(texture, 2.5, 1.5), 0.8 * sharpFactor + 0.1,
            "Ruído da câmera e nitidez alteram esta medida.")
        if (!unevenL.isNaN()) {
            ms += M("tone", "Uniformidade do tom (luminosidade)", unevenL, f2(unevenL), "≤ 2,5", lowerIsBetter(unevenL, 2.5, 2.5), 1.0)
            ms += M("tone_color", "Uniformidade da cor (avermelhado)", unevenA, f2(unevenA), "≤ 1,5", lowerIsBetter(unevenA, 1.5, 1.5), 0.8)
        }
        ms += M("shine", "Brilho/oleosidade aparente", shineFrac, pct(shineFrac), "< 2%", lowerIsBetter(shineFrac, 0.02, 0.04), 0.7, "Flash e luz direta criam reflexos que não são oleosidade.")
        ms += M("under_eye_skin", "Olheiras aparentes (ΔL)", underEye, f1(underEye), "≥ −6", higherIsBetter(underEye, -6.0, 6.0), 0.7)
        ms += M("skin_area", "Pele analisada", n.toDouble(), "${(n / 1000)} mil pixels", "Descritivo", null)

        val recs = ArrayList<String>()
        recs += "Base diária: limpeza suave 2x/dia, hidratante leve e protetor solar FPS 30+ todas as manhãs (inclusive em dias nublados)."
        if (redDens > 10) recs += "Pontos avermelhados acima do esperado: sabonete com ácido salicílico 0,5–2% à noite pode ajudar; acne inflamada ou persistente deve ser avaliada por dermatologista."
        if (redFrac > 0.10) recs += "Vermelhidão difusa: evite água muito quente e esfoliação agressiva; prefira produtos sem fragrância."
        if (shineFrac > 0.04) recs += "Brilho aparente alto: gel de limpeza para pele oleosa e hidratante oil-free; papel absorvente durante o dia."
        if (!unevenL.isNaN() && unevenL > 3.5) recs += "Tom irregular: o protetor solar diário é a medida com melhor evidência; vitamina C ou niacinamida são opções comuns (teste em pequena área antes)."
        if (texture > 3.0) recs += "Textura aparente marcada: hidratação consistente e esfoliação química suave 1–2x/semana, se a pele tolerar."
        if (underEye < -10) recs += "Olheiras aparentes: sono regular e hidratação; se persistirem, avaliação dermatológica."
        return SkinOut(ms, recs, underEye, 0.55 * (0.5 + 0.5 * sharpFactor), n)
    }

    /** Ajusta um plano L = c0 + c1·x + c2·y (gradiente de iluminação) e devolve o desvio dos resíduos de L e o desvio de a*. */
    private fun planeResidualStd(cells: List<DoubleArray>): Pair<Double, Double> {
        // Mínimos quadrados 3x3
        var sxx = 0.0; var sxy = 0.0; var syy = 0.0; var sx = 0.0; var sy = 0.0; val n = cells.size.toDouble()
        var sz = 0.0; var sxz = 0.0; var syz = 0.0
        for (c in cells) { val x = c[0]; val y = c[1]; val z = c[2]; sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; sz += z; sxz += x * z; syz += y * z }
        val m = arrayOf(doubleArrayOf(n, sx, sy), doubleArrayOf(sx, sxx, sxy), doubleArrayOf(sy, sxy, syy))
        val v = doubleArrayOf(sz, sxz, syz)
        val coef = solve3(m, v) ?: doubleArrayOf(sz / n, 0.0, 0.0)
        val res = cells.map { it[2] - (coef[0] + coef[1] * it[0] + coef[2] * it[1]) }
        val rs = sqrt(res.sumOf { it * it } / n)
        val ma = cells.map { it[3] }.average()
        val sa = sqrt(cells.sumOf { (it[3] - ma) * (it[3] - ma) } / n)
        return rs to sa
    }

    private fun solve3(m: Array<DoubleArray>, v: DoubleArray): DoubleArray? {
        fun det(a: Array<DoubleArray>) = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
        val d = det(m); if (abs(d) < 1e-9) return null
        return DoubleArray(3) { k -> val mk = Array(3) { i -> DoubleArray(3) { j -> if (j == k) v[i] else m[i][j] } }; det(mk) / d }
    }

    // ---------------- Cabelo ----------------
    private class HairOut(val metrics: List<M>, val recs: List<String>, val unavailable: String?, val region: P?)

    private fun analyzeHair(f: FaceFrame, trich: Pair<P?, String>, faceW: Double, faceH: Double, lw: Double): HairOut {
        if (f.seg == null) return HairOut(emptyList(), listOf("Segmentação de cabelo indisponível neste aparelho."), "Segmentação de cabelo indisponível.", null)
        val lm = f.lm
        var hairPx = 0
        for (b in f.seg) if ((b.toInt() and 0xFF) == SegClass.HAIR) hairPx++
        val ovalN = PixelOps.count(PixelOps.polygonMask(f.w, f.h, LM.FACE_OVAL.map { lm[it] })).coerceAtLeast(1)
        val hairRel = hairPx.toDouble() / ovalN
        val topRef = trich.first ?: lm[LM.FOREHEAD_TOP]
        // Volume no topo: pixels de cabelo acima da linha do cabelo numa faixa central
        val bandHalf = (faceW * 0.12).toInt()
        var topH = 0
        run {
            var y = topRef.y.toInt() - 1
            var gap = 0
            var count = 0
            while (y > 0) {
                var votes = 0
                for (dx in -bandHalf..bandHalf step max(1, bandHalf / 4)) if (f.segAt(topRef.x.toInt() + dx, y) == SegClass.HAIR) votes++
                if (votes >= 3) { count++; gap = 0 } else { gap++; if (gap > 4 && count > 0) break; if (gap > faceH * 0.1) break }
                y--
            }
            topH = count
        }
        val topRatio = topH / faceH
        // Volume lateral na altura das têmporas
        fun sideRun(from: P, dirX: Int): Int {
            var x = from.x.toInt(); val y = from.y.toInt(); var c = 0; var gap = 0
            while (x in 0 until f.w) {
                if (f.segAt(x, y) == SegClass.HAIR) { c++; gap = 0 } else { gap++; if (gap > 6 && c > 0) break; if (gap > faceW * 0.15) break }
                x += dirX
            }
            return c
        }
        val sideA = sideRun(lm[LM.TEMPLE_A], -1).toDouble()
        val sideB = sideRun(lm[LM.TEMPLE_B], +1).toDouble()
        val sideRatio = (sideA + sideB) / faceW
        val sideSym = if (sideA + sideB > 0) abs(sideA - sideB) / (sideA + sideB) else 0.0
        // Franja
        val fore = PixelOps.polygonMask(f.w, f.h, LM.FOREHEAD_POLY.map { lm[it] })
        var fN = 0; var fH = 0
        for (i in fore.indices) if (fore[i]) { fN++; if ((f.seg[i].toInt() and 0xFF) == SegClass.HAIR) fH++ }
        val fringe = if (fN > 0) fH.toDouble() / fN else 0.0
        // Comprimento
        val chinY = lm[LM.CHIN].y.toInt(); val mouthY = lm[LM.MOUTH_A].y.toInt()
        var belowChin = 0; var belowMouth = 0
        for (y in mouthY until f.h) for (x in 0 until f.w) {
            if ((f.seg[y * f.w + x].toInt() and 0xFF) == SegClass.HAIR) {
                val outside = x < lm[LM.CHEEK_A].x - faceW * 0.05 || x > lm[LM.CHEEK_B].x + faceW * 0.05
                if (outside) { belowMouth++; if (y > chinY) belowChin++ }
            }
        }
        val lengthClass = when {
            hairRel < 0.05 -> "Raspado ou muito curto"
            belowChin > faceW * faceW * 0.05 -> "Longo"
            belowMouth > faceW * faceW * 0.04 -> "Médio"
            topRatio < 0.06 && sideRatio < 0.06 -> "Curto"
            else -> "Curto a médio"
        }
        val styleGuess = when {
            hairRel < 0.05 -> "Raspado/buzz"
            topRatio > 0.12 && sideRatio < 0.10 -> "Laterais curtas com volume no topo (tipo degradê/undercut)"
            fringe > 0.45 -> "Com franja sobre a testa"
            sideRatio > 0.25 -> "Volume lateral (cacheado/ondulado ou mais comprido)"
            else -> "Distribuição uniforme"
        }

        val refTop = when { lw > 1.45 -> 0.10; lw < 1.28 -> 0.24; else -> 0.17 }
        val refSide = when { lw > 1.45 -> 0.18; lw < 1.28 -> 0.06; else -> 0.11 }
        val refFringe = if (lw > 1.45) 0.35 else 0.12

        val ms = ArrayList<M>()
        if (hairRel < 0.05) {
            ms += M("hair_amount", "Cabelo visível", hairRel, pct(hairRel), "Descritivo", null)
            return HairOut(ms, listOf("Cabelo raspado/ausente: barba bem desenhada e sobrancelhas cuidadas ganham ainda mais importância no enquadramento.", "Mantenha o couro cabeludo hidratado e com protetor solar."),
                "Pouco ou nenhum cabelo detectado — enquadramento capilar não pontuado.", null)
        }
        ms += M("hair_top", "Volume no topo ÷ altura do rosto", topRatio, f2(topRatio), "≈ ${f2(refTop)} para seu formato", closeness(topRatio, refTop, 0.09), 1.3)
        ms += M("hair_side", "Volume lateral ÷ largura do rosto", sideRatio, f2(sideRatio), "≈ ${f2(refSide)} para seu formato", closeness(sideRatio, refSide, 0.08), 1.0)
        ms += M("hair_sym", "Equilíbrio do volume esquerda/direita", sideSym, pct(sideSym), "< 20%", lowerIsBetter(sideSym, 0.12, 0.2), 0.7)
        ms += M("fringe", "Cobertura da testa (franja)", fringe, pct(fringe), "≈ ${pct(refFringe)} para seu formato", closeness(fringe, refFringe, 0.3), 0.6)
        ms += M("hair_len", "Comprimento estimado", 0.0, lengthClass, "Descritivo", null)
        ms += M("hair_style", "Estilo estimado pela distribuição", 0.0, styleGuess, "Descritivo", null)

        val recs = ArrayList<String>()
        if (topRatio > refTop + 0.07) recs += "Volume no topo acima do ideal para seu formato: reduza a altura do topete para não alongar o rosto."
        if (topRatio < refTop - 0.07) recs += "Pouco volume no topo para seu formato: deixar o topo 1–2 cm mais longo e texturizado equilibra as proporções."
        if (sideRatio > refSide + 0.07) recs += "Laterais volumosas: um degradê ou laterais mais curtas afinam visualmente o rosto."
        if (sideRatio < refSide - 0.07) recs += "Laterais muito curtas para seu formato: manter um pouco mais de comprimento nas laterais suaviza o rosto."
        if (sideSym > 0.3) recs += "Volume desigual entre os lados: peça ao barbeiro para equilibrar ou ajuste a direção do penteado."
        recs += "Para o formato ${classifyShapeName(lw)}: ${shapeHairAdvice(classifyShapeName(lw))}"
        return HairOut(ms, recs, null, P(topRef.x, max(0.0, topRef.y - faceH * 0.12)))
    }

    private fun classifyShapeName(lw: Double) = when { lw > 1.45 -> "Oblongo"; lw < 1.28 -> "Redondo"; else -> "Oval" }

    // ---------------- Barba ----------------
    private class BeardOut(val present: Boolean, val metrics: List<M>, val recs: List<String>, val zone: BooleanArray?)

    private fun analyzeBeard(f: FaceFrame, L: DoubleArray, oval: BooleanArray, lips: BooleanArray, ml: Midline, faceH: Double, eyeW: Double): BeardOut {
        val lm = f.lm
        val y0 = lm[LM.SUBNASALE].y + faceH * 0.02
        val lipsD = PixelOps.dilate(lips, f.w, f.h, max(2, (eyeW * 0.08).toInt()))
        val zone = BooleanArray(f.w * f.h)
        for (i in zone.indices) if (oval[i] && i / f.w > y0 && !lipsD[i]) zone[i] = true
        val zn = PixelOps.count(zone)
        if (zn < 500) return BeardOut(false, emptyList(), emptyList(), null)
        val ref = (patchMean(L, f, lm[LM.ZYGO_A], eyeW * 0.25) + patchMean(L, f, lm[LM.ZYGO_B], eyeW * 0.25)) / 2
        var dark = 0; var hair = 0; var darkA = 0; var nA = 0; var darkB = 0; var nB = 0
        for (i in zone.indices) {
            if (!zone[i]) continue
            val isDark = L[i] < ref - 25
            if (isDark) dark++
            if (f.seg != null && (f.seg[i].toInt() and 0xFF) == SegClass.HAIR) hair++
            val side = ml.offset(P((i % f.w).toDouble(), (i / f.w).toDouble()))
            if (side < 0) { nA++; if (isDark) darkA++ } else { nB++; if (isDark) darkB++ }
        }
        val darkFrac = dark.toDouble() / zn
        val hairFrac = hair.toDouble() / zn
        // A segmentação de cabelo é o sinal principal; escurecimento só confirma (sombras não viram barba).
        val cov = if (f.seg != null) max(hairFrac, min(darkFrac, hairFrac * 2.5)) else darkFrac
        val present = if (f.seg != null) hairFrac > 0.10 else darkFrac > 0.30
        val level = when { cov > 0.40 -> "Barba cheia"; cov > 0.25 -> "Barba curta"; cov > 0.15 -> "Barba por fazer/rala"; else -> "Sem barba visível" }
        val fa = if (nA > 0) darkA.toDouble() / nA else 0.0; val fb = if (nB > 0) darkB.toDouble() / nB else 0.0
        val covAsym = if (fa + fb > 0) abs(fa - fb) / (fa + fb) else 0.0
        val ms = listOf(
            M("beard_cov", "Cobertura visual da barba", cov, pct(cov), "Descritivo", null, 1.0, level),
            M("beard_sym", "Equilíbrio da barba entre os lados", covAsym, pct(covAsym), "< 15%", lowerIsBetter(covAsym, 0.08, 0.15), 1.5),
            M("beard_density", "Densidade aparente", cov, pct(cov), "≥ 30% para barba cheia", if (cov > 0.25) higherIsBetter(cov, 0.35, 0.15) else null, 0.8,
                "Barba por fazer não é penalizada por densidade.")
        )
        val recs = ArrayList<String>()
        if (present && covAsym > 0.15) recs += "Barba mais densa de um lado: aparar o lado mais cheio um pouco mais curto equilibra visualmente."
        if (present) recs += "Desenhe a linha do pescoço ~2 dedos acima do pomo de adão e mantenha a linha da bochecha natural."
        return BeardOut(present, ms, recs, zone)
    }

    // ---------------- Perfil ----------------
    private class ProfileOut(val convexity: M, val lips: M, val chin: M, val nasal: M, val mandibular: M) {
        val all get() = listOf(convexity, lips, chin, nasal, mandibular)
    }

    private fun analyzeProfile(f: FaceFrame): ProfileOut {
        val lm = f.lm
        val g = lm[LM.GLABELLA]; val n = lm[LM.NASION]; val tip = lm[LM.NOSE_TIP]; val sn = lm[LM.SUBNASALE]
        val li = lm[LM.LOWER_LIP]; val pog = lm[LM.CHIN]
        val conv = angleDeg(g, sn, pog)
        val front = -kotlin.math.sign(signedDist(sn, tip, pog)).let { if (it == 0.0) 1.0 else it }
        val eLen = dist(tip, pog).coerceAtLeast(1.0)
        val lipProj = signedDist(li, tip, pog) * front / eLen
        val frontSide = kotlin.math.sign(signedDist(tip, g, sn)).let { if (it == 0.0) 1.0 else it }
        val chinProj = signedDist(pog, g, sn) * frontSide / dist(g, pog).coerceAtLeast(1.0)
        val nasal = abs(signedDist(tip, n, sn)) / dist(n, tip).coerceAtLeast(1.0)
        val pose = PoseEstimator.estimate(lm, f.matrix)
        val gon = if (pose.yawRatio > 0) lm[LM.GONION_B] else lm[LM.GONION_A]
        val mand = Math.toDegrees(atan2(abs(pog.y - gon.y), abs(pog.x - gon.x)))
        return ProfileOut(
            convexity = M("convexity", "Convexidade do perfil (glabela–subnasal–queixo)", conv, deg(conv), "≈ 165°–175°", closeness(conv, 170.0, 7.0), 0.8,
                "Estimado pela malha 3D do MediaPipe na foto de perfil (aproximado)."),
            lips = M("e_line", "Lábio inferior em relação à linha nariz–queixo", lipProj, f2(lipProj), "≈ −0,02 (levemente atrás)", closeness(lipProj, -0.02, 0.05), 0.5),
            chin = M("chin_proj", "Projeção do queixo (perfil)", chinProj, f2(chinProj), "Descritivo", null, 0.5, "Positivo = queixo mais à frente da linha glabela–subnasal."),
            nasal = M("nasal_proj", "Projeção do nariz (perfil)", nasal, f2(nasal), "Descritivo", null),
            mandibular = M("mand_plane", "Inclinação da linha da mandíbula (perfil)", mand, deg(mand), "Descritivo (linhas mais horizontais parecem mais definidas)", null)
        )
    }

    // ---------------- Formato ----------------
    fun classifyShape(lw: Double, jaw: Double, forehead: Double, hairlineKnown: Boolean): String {
        val l = if (hairlineKnown) lw else lw * 1.17 // compensa a altura subestimada sem linha do cabelo (rosto médio: 1,15 → 1,35)
        return when {
            jaw > forehead - 0.03 -> "Triangular"
            l < 1.25 -> if (jaw >= 0.84) "Quadrado" else "Redondo"
            l <= 1.45 -> when {
                jaw >= 0.87 -> "Quadrado"
                forehead > 0.97 && jaw < 0.74 -> "Coração"
                forehead < 0.87 && jaw < 0.76 -> "Diamante"
                else -> "Oval"
            }
            else -> if (jaw >= 0.84) "Retangular" else "Oblongo"
        }
    }

    private fun shapeExplanation(shape: String, lw: Double, jaw: Double, fore: Double, hairline: Boolean) =
        "Classificação por regras: altura/largura ${f2(lw)}${if (!hairline) " (corrigida, linha do cabelo não localizada)" else ""}, mandíbula/maçãs ${f2(jaw)}, testa/maçãs ${f2(fore)}. " +
            "Formatos de rosto são categorias aproximadas; muitas pessoas ficam entre dois tipos."

    fun shapeHairAdvice(shape: String) = when (shape) {
        "Redondo" -> "volume no topo e laterais curtas alongam o rosto; evite franja reta pesada."
        "Quadrado" -> "textura no topo com laterais médias suaviza os ângulos; risca lateral funciona bem."
        "Retangular", "Oblongo" -> "evite topete alto; franja leve ou risca lateral e um pouco mais de volume lateral equilibram o comprimento."
        "Coração" -> "comprimento médio e franja lateral equilibram a testa mais larga."
        "Diamante" -> "franja ou textura na frente alarga a testa; mantenha volume moderado nas laterais."
        "Triangular" -> "volume no topo e laterais superiores equilibra a mandíbula larga."
        else -> "a maioria dos cortes funciona; mantenha proporção entre topo e laterais."
    }

    fun shapeBeardAdvice(shape: String) = when (shape) {
        "Redondo" -> "barba mais longa no queixo e curta nas bochechas alonga o rosto."
        "Quadrado" -> "barba curta e uniforme ou por fazer; evite cantos muito retos."
        "Retangular", "Oblongo" -> "mais volume nas laterais e queixo curto para não alongar."
        "Coração", "Diamante" -> "barba cheia no queixo dá base a um queixo mais estreito."
        "Triangular" -> "barba curta nas laterais da mandíbula, um pouco mais no queixo."
        else -> "barba por fazer ou curta e bem contornada."
    }
}
