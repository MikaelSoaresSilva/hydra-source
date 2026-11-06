package com.nexusguard.app.security

import kotlinx.serialization.Serializable

enum class CheckStatus(val label: String) { PASS("OK"), WARN("Atenção"), FAIL("Risco"), UNKNOWN("Não verificável"), INFO("Informativo") }

enum class SettingsTarget { SECURITY, DEVELOPER, ACCESSIBILITY, DEVICE_ADMIN, NOTIFICATION_LISTENER, SYSTEM_UPDATE, BIOMETRIC, UNKNOWN_SOURCES, NONE }

@Serializable
data class SecurityCheck(
    val id: String,
    val title: String,
    val status: CheckStatus,
    val weight: Int,
    val detail: String,
    val recommendation: String? = null,
    val target: SettingsTarget = SettingsTarget.NONE
)

@Serializable
data class SecurityScanResult(
    val score: Int?,
    val checks: List<SecurityCheck>,
    val androidVersion: String,
    val sdkInt: Int,
    val securityPatch: String?,
    val device: String,
    val timestamp: Long = System.currentTimeMillis()
) {
    val failCount get() = checks.count { it.status == CheckStatus.FAIL }
    val warnCount get() = checks.count { it.status == CheckStatus.WARN }
}

object SecurityScore {
    /**
     * Pontuação = soma dos pesos aprovados / soma dos pesos verificáveis.
     * Itens "Atenção" valem metade. Itens não verificáveis ficam fora da conta (não inventamos resultado).
     */
    fun compute(checks: List<SecurityCheck>): Int? {
        val scored = checks.filter { it.weight > 0 && it.status in setOf(CheckStatus.PASS, CheckStatus.WARN, CheckStatus.FAIL) }
        val total = scored.sumOf { it.weight }
        if (total == 0) return null
        val got = scored.sumOf {
            when (it.status) { CheckStatus.PASS -> it.weight * 2; CheckStatus.WARN -> it.weight; else -> 0 }
        }
        return ((got.toDouble() / (total * 2)) * 100).toInt().coerceIn(0, 100)
    }

    fun label(score: Int?): String = when {
        score == null -> "Sem dados"
        score >= 85 -> "Protegido"
        score >= 65 -> "Bom, com ajustes"
        score >= 45 -> "Atenção"
        else -> "Em risco"
    }

    /** Dias desde o patch de segurança "AAAA-MM-DD"; null se não informado. */
    fun patchAgeDays(patch: String?, nowMillis: Long = System.currentTimeMillis()): Long? {
        if (patch.isNullOrBlank()) return null
        val p = patch.split('-')
        if (p.size < 2) return null
        val y = p[0].toIntOrNull() ?: return null
        val m = p[1].toIntOrNull() ?: return null
        val d = p.getOrNull(2)?.toIntOrNull() ?: 1
        val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply { clear(); set(y, m - 1, d) }
        return ((nowMillis - cal.timeInMillis) / 86_400_000L).coerceAtLeast(0)
    }
}

// ---------------------------------------------------------------- Aplicativos

data class AppFacts(
    val packageName: String,
    val label: String,
    val isSystem: Boolean,
    val targetSdk: Int,
    val installer: String?,
    val requested: Set<String>,
    val granted: Set<String>,
    val accessibilityService: Boolean,
    val accessibilityEnabled: Boolean,
    val deviceAdmin: Boolean,
    val notificationListener: Boolean,
    val debugCertificate: Boolean,
    val certSha1: List<String>,
    val iocMatch: String?,
    val iocByCertificate: Boolean = false,
    val launcherVisible: Boolean = true
)

@Serializable
data class AppRisk(val score: Int, val level: String, val reasons: List<String>, val sensitiveGranted: List<String>)

object AppRiskRules {
    private const val P = "android.permission."

    val sensitiveLabels: Map<String, String> = linkedMapOf(
        "${P}READ_SMS" to "Ler SMS", "${P}RECEIVE_SMS" to "Receber SMS", "${P}SEND_SMS" to "Enviar SMS",
        "${P}READ_CALL_LOG" to "Ler registro de chamadas", "${P}PROCESS_OUTGOING_CALLS" to "Interceptar chamadas", "${P}CALL_PHONE" to "Fazer chamadas",
        "${P}ANSWER_PHONE_CALLS" to "Atender chamadas",
        "${P}READ_CONTACTS" to "Ler contatos", "${P}ACCESS_FINE_LOCATION" to "Localização precisa", "${P}ACCESS_BACKGROUND_LOCATION" to "Localização em segundo plano",
        "${P}CAMERA" to "Câmera", "${P}RECORD_AUDIO" to "Microfone",
        "${P}MANAGE_EXTERNAL_STORAGE" to "Acesso a todos os arquivos", "${P}READ_EXTERNAL_STORAGE" to "Ler armazenamento",
        "${P}READ_MEDIA_IMAGES" to "Ler fotos", "${P}READ_MEDIA_VIDEO" to "Ler vídeos",
        "${P}SYSTEM_ALERT_WINDOW" to "Sobrepor outros apps", "${P}REQUEST_INSTALL_PACKAGES" to "Instalar outros apps",
        "${P}READ_PHONE_STATE" to "Estado do telefone", "${P}READ_PHONE_NUMBERS" to "Número de telefone",
        "${P}BODY_SENSORS" to "Sensores corporais", "${P}PACKAGE_USAGE_STATS" to "Histórico de uso de apps", "${P}QUERY_ALL_PACKAGES" to "Ver todos os apps instalados",
        "${P}BIND_ACCESSIBILITY_SERVICE" to "Serviço de acessibilidade", "${P}BIND_DEVICE_ADMIN" to "Administrador do dispositivo",
        "${P}BIND_NOTIFICATION_LISTENER_SERVICE" to "Ler notificações"
    )

    val knownStores = setOf(
        "com.android.vending", "com.google.android.feedback", "com.sec.android.app.samsungapps", "com.xiaomi.market", "com.xiaomi.mipicks",
        "com.huawei.appmarket", "com.amazon.venezia", "com.heytap.market", "com.oppo.market", "com.bbk.appstore", "org.fdroid.fdroid",
        "com.aurora.store", "com.miui.packageinstaller.store"
    )

    private fun has(f: AppFacts, perm: String) = (P + perm) in f.requested
    private fun granted(f: AppFacts, perm: String) = (P + perm) in f.granted

    fun evaluate(f: AppFacts): AppRisk {
        val reasons = mutableListOf<String>()
        var score = 0
        fun add(points: Int, reason: String) { score += points; reasons += reason }

        if (f.iocMatch != null) add(80, if (f.iocByCertificate)
            "A assinatura digital coincide com a de \"${f.iocMatch}\", listado na base pública stalkerware-indicators como aplicativo de espionagem."
        else "O nome do pacote consta na base pública stalkerware-indicators como \"${f.iocMatch}\" (aplicativo de espionagem). Confirme se você instalou isso de propósito.")

        val sms = has(f, "READ_SMS") || has(f, "RECEIVE_SMS")
        val accessibility = f.accessibilityService
        val overlay = has(f, "SYSTEM_ALERT_WINDOW")

        if (accessibility && f.accessibilityEnabled) add(25, "Possui um serviço de acessibilidade ATIVO: ele pode ler a tela e tocar em botões por você. É legítimo em apps de acessibilidade e automação, mas é o recurso mais usado por trojans bancários.")
        else if (accessibility) add(8, "Declara serviço de acessibilidade (atualmente desativado).")
        if (accessibility && overlay) add(15, "Combina acessibilidade com sobreposição de tela, padrão típico de apps que exibem telas falsas por cima de bancos.")
        if (f.deviceAdmin) add(15, "É administrador do dispositivo: pode bloquear a tela, apagar dados e dificultar a desinstalação.")
        if (f.notificationListener) add(10, "Pode ler todas as notificações, incluindo códigos de verificação recebidos por SMS e mensagens.")
        if (sms && (granted(f, "READ_SMS") || granted(f, "RECEIVE_SMS"))) add(12, "Tem acesso a SMS concedido: pode ler códigos de confirmação de bancos e contas.")
        else if (sms) add(5, "Solicita acesso a SMS (não concedido).")
        if (sms && f.deviceAdmin) add(10, "Combina SMS com administrador do dispositivo.")
        if (has(f, "REQUEST_INSTALL_PACKAGES") && !f.isSystem) add(8, "Pode instalar outros aplicativos.")
        if (granted(f, "READ_CALL_LOG") || granted(f, "PROCESS_OUTGOING_CALLS")) add(8, "Acessa o registro ou o controle de chamadas.")
        if (granted(f, "RECORD_AUDIO") && granted(f, "ACCESS_BACKGROUND_LOCATION")) add(10, "Tem microfone e localização em segundo plano concedidos ao mesmo tempo.")
        else {
            if (granted(f, "ACCESS_BACKGROUND_LOCATION")) add(6, "Pode acessar sua localização mesmo fechado.")
            if (granted(f, "RECORD_AUDIO")) add(3, "Tem acesso ao microfone.")
        }
        if (granted(f, "CAMERA")) add(2, "Tem acesso à câmera.")
        if (granted(f, "MANAGE_EXTERNAL_STORAGE")) add(6, "Tem acesso a todos os arquivos do armazenamento.")
        if (f.targetSdk in 1..22) add(15, "Feito para Android antigo (API ${f.targetSdk}): recebe permissões sem pedir na hora do uso.")
        else if (f.targetSdk in 23..28) add(4, "Feito para uma versão antiga do Android (API ${f.targetSdk}), com menos proteções de privacidade.")
        if (!f.isSystem && f.installer !in knownStores) add(6, if (f.installer == null) "Instalado manualmente (APK), fora de uma loja oficial." else "Instalado por \"${f.installer}\", que não é uma loja conhecida.")
        if (f.debugCertificate) add(10, "Assinado com certificado de depuração (\"Android Debug\"): não é uma versão publicada oficialmente.")
        if (!f.launcherVisible && !f.isSystem && (accessibility || f.deviceAdmin || sms || f.notificationListener)) add(12, "Não aparece na tela de apps, mas tem acessos sensíveis — comportamento comum em apps de espionagem.")

        val sensitiveGranted = f.granted.mapNotNull { sensitiveLabels[it] } +
            listOfNotNull(
                if (accessibility && f.accessibilityEnabled) "Acessibilidade ativa" else null,
                if (f.deviceAdmin) "Administrador do dispositivo" else null,
                if (f.notificationListener) "Leitura de notificações" else null
            )
        val s = score.coerceIn(0, 100)
        val level = when {
            f.iocMatch != null || s >= 75 -> "Crítico"
            s >= 45 -> "Alto"
            s >= 20 -> "Moderado"
            else -> "Baixo"
        }
        if (reasons.isEmpty()) reasons += "Nenhum acesso sensível relevante encontrado nas informações que o Android permite consultar."
        return AppRisk(s, level, reasons, sensitiveGranted.distinct())
    }
}
