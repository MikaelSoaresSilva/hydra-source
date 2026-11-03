package com.ascend.faceai.analysis

import kotlin.math.abs

/**
 * Verifica se a foto serve para análise. Tudo aqui é medido de verdade na imagem:
 * número de rostos, brilho, equilíbrio de luz, nitidez (variância do Laplaciano), pose,
 * tamanho/centralização do rosto, olhos abertos (blendshapes) e obstruções (segmentação).
 */
object QualityChecker {

    fun noFace(count: Int): QualityResult = QualityResult(
        facesDetected = count,
        issues = listOf(
            if (count == 0) "Nenhum rosto detectado. Aproxime-se, melhore a luz e mostre o rosto inteiro."
            else "Foram detectados $count rostos. Envie uma foto com apenas você."
        ),
        ok = false, qualityScore = 0.0
    )

    fun check(f: FaceFrame, type: CaptureType): QualityResult {
        if (f.facesDetected != 1) return noFace(f.facesDetected)
        val issues = ArrayList<String>()
        val warnings = ArrayList<String>()
        val oval = PixelOps.polygonMask(f.w, f.h, LM.FACE_OVAL.map { f.lm[it] })

        // Iluminação
        var sum = 0.0; var n = 0; var leftS = 0.0; var leftN = 0; var rightS = 0.0; var rightN = 0
        val cx = f.lm[LM.NOSE_TIP].x
        for (y in 0 until f.h) for (x in 0 until f.w) {
            val i = y * f.w + x
            if (!oval[i]) continue
            val l = PixelOps.luma(f.argb[i])
            sum += l; n++
            if (x < cx) { leftS += l; leftN++ } else { rightS += l; rightN++ }
        }
        val brightness = if (n > 0) sum / n else 0.0
        val lm = if (leftN > 0) leftS / leftN else 0.0
        val rm = if (rightN > 0) rightS / rightN else 0.0
        val balance = if (brightness > 0) abs(lm - rm) / brightness else 1.0
        if (brightness < 60) issues.add("Foto muito escura. Fique de frente para uma janela ou luz.")
        if (brightness > 215) issues.add("Foto muito clara/estourada. Evite luz forte direta no rosto.")
        if (type == CaptureType.FRONTAL && balance > 0.30) warnings.add("Luz desigual: um lado do rosto está bem mais escuro. Isso reduz a precisão de simetria e pele.")

        // Nitidez
        val (lum, dw, dh) = PixelOps.downsampleLuma(f.argb, f.w, f.h, 256)
        val sx = f.w.toDouble() / dw; val sy = f.h.toDouble() / dh
        val smallOval = BooleanArray(dw * dh) { i ->
            val x = ((i % dw) * sx).toInt().coerceIn(0, f.w - 1); val y = ((i / dw) * sy).toInt().coerceIn(0, f.h - 1)
            oval[y * f.w + x]
        }
        val sharp = PixelOps.laplacianVariance(lum, dw, dh, smallOval)
        if (sharp < 12) issues.add("Foto desfocada ou tremida. Segure firme e toque para focar.")
        else if (sharp < 25) warnings.add("Nitidez baixa: detalhes da pele podem não ser avaliados com precisão.")

        // Pose
        val pose = PoseEstimator.estimate(f.lm, f.matrix)
        val ay = abs(pose.yawDeg); val ap = abs(pose.pitchDeg); val ar = abs(pose.rollDeg)
        when (type) {
            CaptureType.FRONTAL -> {
                if (ay > 12) issues.add("Rosto virado para o lado (${ay.toInt()}°). Olhe direto para a câmera.")
                else if (ay > 7) warnings.add("Leve rotação lateral (${ay.toInt()}°) — pode afetar a simetria medida.")
                if (ar > 8) issues.add("Cabeça inclinada (${ar.toInt()}°). Deixe os olhos na horizontal.")
                if (ap > 20) issues.add("Queixo muito para cima ou para baixo. Mantenha a cabeça reta.")
            }
            CaptureType.ANGLE45 -> {
                if (ay < 25 || ay > 65) issues.add("Para a foto de 45°, gire a cabeça entre 30° e 60° (medido: ${ay.toInt()}°).")
            }
            CaptureType.PROFILE_LEFT, CaptureType.PROFILE_RIGHT -> {
                if (ay < 45) issues.add("Para o perfil, gire mais a cabeça (medido: ${ay.toInt()}°).")
            }
        }

        // Tamanho e posição
        if (f.faceWidthFraction < 0.22) issues.add("Rosto pequeno demais na foto. Aproxime a câmera.")
        if (f.faceWidthFraction > 0.92) issues.add("Rosto cortado ou perto demais. Afaste um pouco a câmera.")
        if (f.centerOffset > 0.25) warnings.add("Rosto fora do centro. Centralize no guia.")

        // Olhos
        val blinkA = f.blendshapes["eyeBlinkLeft"] ?: 0f
        val blinkB = f.blendshapes["eyeBlinkRight"] ?: 0f
        val eyesOpen = blinkA < 0.55f && blinkB < 0.55f
        if (!eyesOpen && type == CaptureType.FRONTAL) issues.add("Olhos fechados ou semicerrados. Mantenha os olhos abertos.")

        // Obstruções (segmentação): acessórios sobre os olhos, mão/objeto sobre o rosto
        var obstruction = 0.0
        if (f.seg != null) {
            val eyes = PixelOps.polygonMask(f.w, f.h, LM.EYE_A_POLY.map { f.lm[it] })
            PixelOps.fillPolygon(eyes, f.w, f.h, LM.EYE_B_POLY.map { f.lm[it] })
            val eyeZone = PixelOps.dilate(eyes, f.w, f.h, (f.w * 0.02).toInt().coerceAtLeast(2))
            var eyeN = 0; var eyeAcc = 0; var faceN = 0; var faceObj = 0
            for (i in oval.indices) {
                val c = f.seg[i].toInt() and 0xFF
                if (eyeZone[i]) { eyeN++; if (c == SegClass.OTHERS || c == SegClass.HAIR) eyeAcc++ }
                if (oval[i]) { faceN++; if (c == SegClass.OTHERS || c == SegClass.BODY_SKIN || c == SegClass.CLOTHES) faceObj++ }
            }
            val eyeFrac = if (eyeN > 0) eyeAcc.toDouble() / eyeN else 0.0
            val faceFrac = if (faceN > 0) faceObj.toDouble() / faceN else 0.0
            obstruction = maxOf(eyeFrac, faceFrac)
            if (type == CaptureType.FRONTAL && eyeFrac > 0.35) issues.add("Algo cobre os olhos (óculos, cabelo ou objeto). Remova para a análise.")
            else if (eyeFrac > 0.18) warnings.add("Possível obstrução parcial na região dos olhos (óculos ou cabelo).")
            if (faceFrac > 0.18) issues.add("Mão, roupa ou objeto cobrindo parte do rosto.")
        }

        val q = listOf(
            closeness(brightness, 135.0, 55.0) / 100,
            lowerIsBetter(balance, 0.12, 0.15) / 100,
            higherIsBetter(sharp, 40.0, 18.0) / 100,
            if (type == CaptureType.FRONTAL) lowerIsBetter(ay, 4.0, 6.0) / 100 else 1.0,
            1.0 - obstruction.coerceIn(0.0, 1.0)
        )
        val qualityScore = (q.sum() / q.size).coerceIn(0.0, 1.0)

        return QualityResult(
            facesDetected = 1, brightness = brightness, lightingBalance = balance, sharpness = sharp,
            yawDeg = pose.yawDeg, pitchDeg = pose.pitchDeg, rollDeg = pose.rollDeg,
            faceWidthFraction = f.faceWidthFraction, centerOffset = f.centerOffset, eyesOpen = eyesOpen,
            obstruction = obstruction, issues = issues, warnings = warnings, ok = issues.isEmpty(),
            qualityScore = qualityScore
        )
    }
}
