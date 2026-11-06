package com.nexusguard.app.security

import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.biometrics.BiometricManager
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit

object SystemProps {
    /** Lê uma propriedade do sistema pelo utilitário getprop (sem APIs ocultas). */
    fun get(name: String): String? = runCatching {
        val p = ProcessBuilder("getprop", name).redirectErrorStream(true).start()
        val out = p.inputStream.bufferedReader().readText().trim()
        p.waitFor(2, TimeUnit.SECONDS)
        out.ifEmpty { null }
    }.getOrNull()
}

data class RootSignals(val signals: List<String>, val strong: Boolean)

/** Heurísticas de root. Sinais são indícios, nunca prova: ferramentas como Magisk podem se esconder. */
object RootHeuristics {
    private val suPaths = listOf(
        "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su", "/data/local/xbin/su", "/data/local/bin/su",
        "/system/sd/xbin/su", "/system/bin/failsafe/su", "/data/local/su", "/vendor/bin/su", "/system/app/Superuser.apk",
        "/system/etc/init.d/99SuperSUDaemon", "/cache/.disable_magisk", "/data/adb/magisk", "/data/adb/ksu"
    )
    val rootPackages = listOf(
        "com.topjohnwu.magisk", "io.github.huskydg.magisk", "io.github.vvb2060.magisk", "eu.chainfire.supersu",
        "com.koushikdutta.superuser", "com.noshufou.android.su", "me.weishu.kernelsu", "com.kingroot.kinguser",
        "com.kingo.root", "com.devadvance.rootcloak", "com.devadvance.rootcloak2", "de.robv.android.xposed.installer",
        "org.lsposed.manager", "com.saurik.substrate", "com.zachspong.temprootremovejb", "com.ramdroid.appquarantine"
    )

    fun check(context: Context): RootSignals {
        val s = mutableListOf<String>()
        var strong = false
        suPaths.filter { runCatching { File(it).exists() }.getOrDefault(false) }.forEach { s += "Arquivo de root encontrado: $it"; strong = true }
        if (Build.TAGS?.contains("test-keys") == true) s += "Sistema assinado com chaves de teste (test-keys)"
        val pm = context.packageManager
        rootPackages.forEach { pkg ->
            if (runCatching { pm.getPackageInfo(pkg, 0); true }.getOrDefault(false)) { s += "App de root/modificação instalado: $pkg"; strong = true }
        }
        runCatching {
            val p = ProcessBuilder("which", "su").redirectErrorStream(true).start()
            val out = p.inputStream.bufferedReader().readText().trim()
            p.waitFor(2, TimeUnit.SECONDS)
            if (out.startsWith("/")) { s += "Comando \"su\" disponível em $out"; strong = true }
        }
        if (SystemProps.get("ro.debuggable") == "1" && Build.TYPE != "eng") s += "Propriedade ro.debuggable=1"
        if (SystemProps.get("ro.secure") == "0") s += "Propriedade ro.secure=0"
        runCatching {
            File("/proc/mounts").readLines().firstOrNull { (it.contains(" /system ") || it.contains(" / ")) && it.contains(" rw,") && !it.contains("tmpfs") }
                ?.let { s += "Partição de sistema montada para escrita" }
        }
        return RootSignals(s, strong)
    }
}

class DeviceScanner(private val context: Context, private val ioc: IocDatabase) {

    suspend fun scan(currentWifiCheck: SecurityCheck? = null): SecurityScanResult = withContext(Dispatchers.IO) {
        val checks = mutableListOf<SecurityCheck>()
        val sdk = Build.VERSION.SDK_INT
        val release = Build.VERSION.RELEASE ?: "?"

        // 1. Versão do Android
        checks += when {
            sdk >= 33 -> SecurityCheck("android_version", "Versão do Android", CheckStatus.PASS, 10, "Android $release (API $sdk), versão com suporte atual a recursos de privacidade e segurança.")
            sdk >= 30 -> SecurityCheck("android_version", "Versão do Android", CheckStatus.WARN, 10, "Android $release (API $sdk). Versões mais novas trazem proteções adicionais.", "Verifique se há atualização do sistema disponível.", SettingsTarget.SYSTEM_UPDATE)
            else -> SecurityCheck("android_version", "Versão do Android", CheckStatus.FAIL, 10, "Android $release (API $sdk) provavelmente não recebe mais correções de segurança.", "Atualize o sistema se possível; se o aparelho não recebe mais atualizações, evite usá-lo para bancos.", SettingsTarget.SYSTEM_UPDATE)
        }

        // 2. Patch de segurança
        val patch = Build.VERSION.SECURITY_PATCH
        val age = SecurityScore.patchAgeDays(patch)
        checks += when {
            age == null -> SecurityCheck("patch", "Atualização de segurança", CheckStatus.UNKNOWN, 15, "O aparelho não informa a data do patch de segurança.")
            age <= 100 -> SecurityCheck("patch", "Atualização de segurança", CheckStatus.PASS, 15, "Patch de $patch (há $age dias).")
            age <= 200 -> SecurityCheck("patch", "Atualização de segurança", CheckStatus.WARN, 15, "Patch de $patch (há $age dias). Falhas corrigidas depois disso continuam abertas no seu aparelho.", "Abra Configurações > Sobre o telefone > Atualização do sistema e procure atualizações.", SettingsTarget.SYSTEM_UPDATE)
            else -> SecurityCheck("patch", "Atualização de segurança", CheckStatus.FAIL, 15, "Patch de $patch (há $age dias, mais de 6 meses).", "Instale as atualizações do sistema disponíveis. Se não houver, o fabricante pode ter encerrado o suporte.", SettingsTarget.SYSTEM_UPDATE)
        }

        // 3. Bloqueio de tela
        val km = context.getSystemService(KeyguardManager::class.java)
        checks += if (km?.isDeviceSecure == true)
            SecurityCheck("screen_lock", "Bloqueio de tela", CheckStatus.PASS, 15, "Há PIN, padrão, senha ou biometria configurados.")
        else SecurityCheck("screen_lock", "Bloqueio de tela", CheckStatus.FAIL, 15, "Sem bloqueio seguro: qualquer pessoa com o aparelho na mão acessa tudo, incluindo apps de banco abertos.", "Configure PIN de 6 dígitos ou senha + biometria.", SettingsTarget.SECURITY)

        // 4. Criptografia do armazenamento
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        val enc = runCatching { dpm.storageEncryptionStatus }.getOrNull()
        checks += when (enc) {
            DevicePolicyManager.ENCRYPTION_STATUS_ACTIVE, DevicePolicyManager.ENCRYPTION_STATUS_ACTIVE_PER_USER ->
                SecurityCheck("encryption", "Criptografia do armazenamento", CheckStatus.PASS, 8, "Os dados do aparelho estão criptografados.")
            DevicePolicyManager.ENCRYPTION_STATUS_ACTIVE_DEFAULT_KEY ->
                SecurityCheck("encryption", "Criptografia do armazenamento", CheckStatus.WARN, 8, "Criptografia ativa, mas com chave padrão (sem bloqueio de tela ligado a ela).", "Configure um bloqueio de tela para proteger a chave.", SettingsTarget.SECURITY)
            DevicePolicyManager.ENCRYPTION_STATUS_INACTIVE, DevicePolicyManager.ENCRYPTION_STATUS_UNSUPPORTED ->
                SecurityCheck("encryption", "Criptografia do armazenamento", CheckStatus.FAIL, 8, "O armazenamento não está criptografado.", "Ative a criptografia nas configurações de segurança.", SettingsTarget.SECURITY)
            else -> SecurityCheck("encryption", "Criptografia do armazenamento", CheckStatus.UNKNOWN, 8, "Não foi possível consultar o estado da criptografia.")
        }

        // 5. Opções do desenvolvedor e depuração USB / sem fio
        val dev = Settings.Global.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1
        val adb = Settings.Global.getInt(context.contentResolver, Settings.Global.ADB_ENABLED, 0) == 1
        val adbWifi = runCatching { Settings.Global.getInt(context.contentResolver, "adb_wifi_enabled", 0) == 1 }.getOrDefault(false)
        checks += when {
            adb || adbWifi -> SecurityCheck("adb", "Depuração ${if (adbWifi) "sem fio" else "USB"}", CheckStatus.FAIL, 8,
                "A depuração está ligada: um computador (ou alguém na mesma rede, no caso da depuração sem fio) autorizado pode instalar apps e ler dados.",
                "Desligue em Configurações > Opções do desenvolvedor > Depuração USB/sem fio quando não estiver usando.", SettingsTarget.DEVELOPER)
            dev -> SecurityCheck("adb", "Opções do desenvolvedor", CheckStatus.WARN, 5, "As opções do desenvolvedor estão ativadas (depuração desligada).", "Se não usa, desative as opções do desenvolvedor.", SettingsTarget.DEVELOPER)
            else -> SecurityCheck("adb", "Opções do desenvolvedor", CheckStatus.PASS, 5, "Desativadas.")
        }

        // 6. Root (heurística)
        val root = RootHeuristics.check(context)
        checks += when {
            root.strong -> SecurityCheck("root", "Sinais de root", CheckStatus.FAIL, 12,
                "Possíveis sinais de root encontrados (indícios, não certeza): ${root.signals.joinToString("; ")}.",
                "Se você não fez root de propósito, faça backup e restaure o sistema de fábrica. Root desativa proteções do Android e apps de banco podem parar de funcionar.")
            root.signals.isNotEmpty() -> SecurityCheck("root", "Sinais de root", CheckStatus.WARN, 12,
                "Indícios fracos: ${root.signals.joinToString("; ")}. Isso não confirma root.", "Nenhuma ação obrigatória; fique atento a apps que você não instalou.")
            else -> SecurityCheck("root", "Sinais de root", CheckStatus.PASS, 12,
                "Nenhum sinal encontrado nas verificações heurísticas. Observação: ferramentas modernas de root conseguem se esconder de apps comuns.")
        }

        // 7. Bootloader / inicialização verificada
        val vbs = SystemProps.get("ro.boot.verifiedbootstate")
        val flashLocked = SystemProps.get("ro.boot.flash.locked")
        checks += when {
            vbs == "orange" || flashLocked == "0" -> SecurityCheck("bootloader", "Bootloader", CheckStatus.FAIL, 8,
                "O bootloader parece desbloqueado (estado \"${vbs ?: "?"}\"). Isso permite carregar sistemas modificados.", "Se não foi você, procure a assistência técnica autorizada.")
            vbs == "yellow" -> SecurityCheck("bootloader", "Bootloader", CheckStatus.WARN, 8, "Inicialização verificada com chave personalizada (\"yellow\").")
            vbs == "green" -> SecurityCheck("bootloader", "Bootloader", CheckStatus.PASS, 8, "Inicialização verificada (\"green\"): o sistema carregado é o do fabricante.")
            else -> SecurityCheck("bootloader", "Bootloader", CheckStatus.UNKNOWN, 8, "O aparelho não expõe o estado da inicialização verificada.")
        }

        // 8. Apps com permissão para instalar outros apps
        val installers = appsAllowedToInstall()
        checks += when {
            installers == null -> SecurityCheck("unknown_sources", "Instalação de apps desconhecidos", CheckStatus.UNKNOWN, 6, "Não foi possível consultar.")
            installers.isEmpty() -> SecurityCheck("unknown_sources", "Instalação de apps desconhecidos", CheckStatus.PASS, 6, "Nenhum app (além das lojas) está autorizado a instalar APKs.")
            else -> SecurityCheck("unknown_sources", "Instalação de apps desconhecidos", CheckStatus.WARN, 6,
                "Podem instalar apps: ${installers.take(6).joinToString()}${if (installers.size > 6) " e mais ${installers.size - 6}" else ""}.",
                "Revogue em Configurações > Apps > Acesso especial > Instalar apps desconhecidos para os que não precisam.", SettingsTarget.UNKNOWN_SOURCES)
        }

        // 9. Serviços de acessibilidade ativos
        val acc = enabledComponents(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        checks += if (acc.isEmpty()) SecurityCheck("accessibility", "Serviços de acessibilidade", CheckStatus.PASS, 6, "Nenhum serviço de acessibilidade ativo.")
        else SecurityCheck("accessibility", "Serviços de acessibilidade", CheckStatus.WARN, 6,
            "Ativos: ${acc.joinToString { labelOf(it) }}. Eles podem ler a tela e agir por você.",
            "Mantenha apenas serviços que você reconhece e realmente usa.", SettingsTarget.ACCESSIBILITY)

        // 10. Administradores do dispositivo
        val admins = runCatching { dpm.activeAdmins?.map { it.packageName }.orEmpty() }.getOrDefault(emptyList())
            .filter { it != "com.google.android.gms" && !isSystemApp(it) }
        checks += if (admins.isEmpty()) SecurityCheck("device_admin", "Administradores do dispositivo", CheckStatus.PASS, 5, "Nenhum app de terceiros com poder de administrador.")
        else SecurityCheck("device_admin", "Administradores do dispositivo", CheckStatus.WARN, 5,
            "Com poder de administrador: ${admins.joinToString { labelOf(it) }}.", "Remova em Configurações > Segurança > Apps de administração, se não reconhecer.", SettingsTarget.DEVICE_ADMIN)

        // 11. Leitores de notificações
        val listeners = enabledComponents("enabled_notification_listeners").filter { !isSystemApp(it) }
        checks += if (listeners.isEmpty()) SecurityCheck("notif_listener", "Acesso às notificações", CheckStatus.PASS, 4, "Nenhum app de terceiros lê suas notificações.")
        else SecurityCheck("notif_listener", "Acesso às notificações", CheckStatus.WARN, 4,
            "Leem todas as notificações (inclusive códigos por SMS): ${listeners.joinToString { labelOf(it) }}.", "Confirme que reconhece cada um.", SettingsTarget.NOTIFICATION_LISTENER)

        // 12. Indicadores de stalkerware
        val stalker = ioc.matchInstalled(context)
        checks += if (stalker.isEmpty()) SecurityCheck("stalkerware", "Apps de espionagem conhecidos", CheckStatus.PASS, 20,
            "Nenhum pacote ou certificado da base pública stalkerware-indicators (${ioc.entryCount} famílias) foi encontrado.")
        else SecurityCheck("stalkerware", "Apps de espionagem conhecidos", CheckStatus.FAIL, 20,
            "Encontrado: ${stalker.joinToString()}.", "Se não foi você quem instalou, alguém pode estar monitorando o aparelho. Antes de remover, considere sua segurança pessoal e procure ajuda especializada se for o caso.")

        // 13. DNS privado
        val pdMode = runCatching { Settings.Global.getString(context.contentResolver, "private_dns_mode") }.getOrNull()
        checks += when (pdMode) {
            "hostname" -> SecurityCheck("private_dns", "DNS privado", CheckStatus.PASS, 3, "Ativo com servidor definido: consultas de nomes criptografadas.")
            "opportunistic" -> SecurityCheck("private_dns", "DNS privado", CheckStatus.PASS, 3, "Automático: criptografa quando a rede permite.")
            "off" -> SecurityCheck("private_dns", "DNS privado", CheckStatus.WARN, 3, "Desligado: consultas de nomes viajam sem criptografia.", "Ative em Internet > Diagnóstico DNS (o app indica o mais rápido).")
            else -> SecurityCheck("private_dns", "DNS privado", CheckStatus.UNKNOWN, 3, "O sistema não informou a configuração.")
        }

        // 14. Wi-Fi atual (opcional, vindo do módulo de rede)
        currentWifiCheck?.let { checks += it }

        // 15. Biometria (informativo)
        if (sdk >= 29) {
            val bm = context.getSystemService(BiometricManager::class.java)
            val can = runCatching { if (sdk >= 30) bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) else @Suppress("DEPRECATION") bm.canAuthenticate() }.getOrNull()
            checks += SecurityCheck("biometric", "Biometria", CheckStatus.INFO, 0, when (can) {
                BiometricManager.BIOMETRIC_SUCCESS -> "Biometria forte disponível e cadastrada."
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "O aparelho tem biometria, mas nenhuma digital/rosto foi cadastrado."
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "Sem sensor biométrico forte."
                else -> "Estado da biometria indisponível."
            })
        }

        // 16. Play Protect (não há API pública para ler o estado)
        checks += SecurityCheck("play_protect", "Google Play Protect", CheckStatus.UNKNOWN, 0,
            "O Android não permite que outros apps leiam se o Play Protect está ligado.", "Confira em Play Store > foto do perfil > Play Protect.")

        SecurityScanResult(SecurityScore.compute(checks), checks, release, sdk, patch, "${Build.MANUFACTURER} ${Build.MODEL}")
    }

    private fun enabledComponents(key: String): List<String> =
        runCatching { Settings.Secure.getString(context.contentResolver, key) }.getOrNull()
            ?.split(':')?.mapNotNull { it.substringBefore('/').takeIf { p -> p.isNotBlank() } }?.distinct().orEmpty()

    private fun labelOf(pkg: String): String = runCatching {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)

    private fun isSystemApp(pkg: String): Boolean = runCatching {
        val ai = context.packageManager.getApplicationInfo(pkg, 0)
        (ai.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
    }.getOrDefault(false)

    @Suppress("DEPRECATION")
    private fun appsAllowedToInstall(): List<String>? = runCatching {
        val pm = context.packageManager
        val aom = context.getSystemService(android.app.AppOpsManager::class.java)
        val pkgs = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)
        pkgs.filter { pi ->
            pi.requestedPermissions?.contains(android.Manifest.permission.REQUEST_INSTALL_PACKAGES) == true &&
                pi.packageName != context.packageName &&
                pi.packageName !in AppRiskRules.knownStores &&
                ((pi.applicationInfo?.flags ?: 0) and android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0
        }.filter { pi ->
            val uid = pi.applicationInfo?.uid ?: return@filter false
            val mode = if (Build.VERSION.SDK_INT >= 29) aom.unsafeCheckOpNoThrow("android:request_install_packages", uid, pi.packageName)
            else aom.checkOpNoThrow("android:request_install_packages", uid, pi.packageName)
            mode == android.app.AppOpsManager.MODE_ALLOWED
        }.map { labelOf(it.packageName) }
    }.getOrNull()
}
