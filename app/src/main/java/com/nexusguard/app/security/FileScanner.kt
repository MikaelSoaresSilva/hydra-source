package com.nexusguard.app.security

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.io.File
import java.security.MessageDigest
import java.util.Locale
import java.util.zip.ZipFile

@Serializable
data class ApkReport(
    val packageName: String?,
    val label: String?,
    val versionName: String?,
    val versionCode: Long?,
    val minSdk: Int?,
    val targetSdk: Int?,
    val permissions: List<String>,
    val sensitivePermissions: List<String>,
    val certs: List<CertInfo>,
    val dexCount: Int,
    val nativeAbis: List<String>,
    val embeddedPayloads: List<String>,
    val installedSameSigner: Boolean?,     // null = não instalado
    val installedVersion: String?,
    val iocMatch: String?
)

@Serializable
data class FileScanResult(
    val name: String,
    val sizeBytes: Long,
    val mime: String?,
    val sha256: String,
    val detectedType: String,
    val findings: List<SerializableFinding>,
    val score: Int,
    val level: String,
    val apk: ApkReport? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class SerializableFinding(val severity: String, val title: String, val explanation: String) {
    companion object { fun of(f: Finding) = SerializableFinding(f.severity.name, f.title, f.explanation) }
    val sev: Severity get() = runCatching { Severity.valueOf(severity) }.getOrDefault(Severity.INFO)
}

/**
 * Analisa somente arquivos que o próprio usuário escolheu pelo seletor do Android (Storage Access Framework).
 * Nada é executado; o arquivo é lido apenas para calcular o hash e inspecionar a estrutura.
 */
class FileScanner(private val context: Context, private val ioc: IocDatabase) {

    companion object {
        const val MAX_COPY_BYTES = 400L * 1024 * 1024
        fun levelFor(score: Int) = when {
            score >= 70 -> "Perigoso"
            score >= 35 -> "Suspeito"
            score >= 15 -> "Atenção"
            else -> "Nenhum indicador forte"
        }
    }

    suspend fun scan(uri: Uri, onProgress: (Float) -> Unit = {}): FileScanResult = withContext(Dispatchers.IO) {
        val cr = context.contentResolver
        var name = "arquivo"
        var size = -1L
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                c.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { name = c.getString(it) ?: name }
                c.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !c.isNull(it) }?.let { size = c.getLong(it) }
            }
        }
        if (name == "arquivo") uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.isNotBlank() }?.let { name = it }
        val mime = cr.getType(uri)
        val head = ByteArray(64)
        var headLen = 0
        val md = MessageDigest.getInstance("SHA-256")
        val dir = File(context.cacheDir, "scan").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val tmp = File(dir, "candidate.bin")
        var total = 0L
        var copy = true
        cr.openInputStream(uri)?.use { input ->
            tmp.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    if (headLen < head.size) { val k = minOf(n, head.size - headLen); System.arraycopy(buf, 0, head, headLen, k); headLen += k }
                    md.update(buf, 0, n)
                    if (copy) {
                        // Só mantemos cópia temporária de arquivos ZIP/APK (para inspecionar a estrutura)
                        if (headLen >= 4 && !(head[0] == 0x50.toByte() && head[1] == 0x4B.toByte())) copy = false
                        else if (total + n > MAX_COPY_BYTES) copy = false
                        else out.write(buf, 0, n)
                    }
                    total += n
                    if (size > 0) onProgress((total.toFloat() / size).coerceIn(0f, 1f))
                }
            }
        } ?: throw IllegalStateException("Não foi possível abrir o arquivo selecionado.")
        if (size < 0) size = total
        val sha = CertInfo.hex(md.digest()).lowercase(Locale.ROOT)
        val headBytes = head.copyOf(headLen)

        var isApk = false
        var apk: ApkReport? = null
        val extra = mutableListOf<Finding>()
        if (copy && tmp.exists() && headLen >= 4 && headBytes[0] == 0x50.toByte()) {
            val entries = runCatching { ZipFile(tmp).use { z -> z.entries().toList().map { it.name } } }.getOrNull()
            if (entries != null && "AndroidManifest.xml" in entries) {
                isApk = true
                apk = inspectApk(tmp, entries, extra)
            } else if (entries != null) {
                val inner = entries.filter { e -> listOf(".apk", ".exe", ".dex", ".js", ".vbs", ".bat", ".scr", ".jar").any { e.lowercase(Locale.ROOT).endsWith(it) } }
                if (inner.isNotEmpty()) extra += Finding(Severity.MEDIUM, "ZIP contém executáveis",
                    "Dentro do arquivo compactado há: ${inner.take(5).joinToString()}. Não extraia/instale se não souber a origem.")
            }
        }
        tmp.delete()

        val verdict = FileTypeDetector.evaluate(name, headBytes, isApk)
        val all = (verdict.findings + extra).sortedByDescending { it.severity.weight }
        val score = all.sumOf { it.severity.weight }.coerceIn(0, 100)
        FileScanResult(name, size, mime, sha, verdict.type.label, all.map { SerializableFinding.of(it) }, score, levelFor(score), apk)
    }

    @Suppress("DEPRECATION")
    private fun inspectApk(file: File, entries: List<String>, findings: MutableList<Finding>): ApkReport {
        val pm = context.packageManager
        val sigFlag = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val pi: PackageInfo? = pm.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_PERMISSIONS or sigFlag)
            ?: pm.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_PERMISSIONS)
        val ai = pi?.applicationInfo?.apply { sourceDir = file.absolutePath; publicSourceDir = file.absolutePath }
        val label = ai?.let { runCatching { pm.getApplicationLabel(it).toString() }.getOrNull() }
        val perms = pi?.requestedPermissions?.toList().orEmpty()
        var certs = pi?.let { CertInfo.ofPackage(it) }.orEmpty()
        if (certs.isEmpty()) certs = v1Certs(file, entries)

        if (pi == null) findings += Finding(Severity.MEDIUM, "APK não pôde ser lido pelo Android",
            "O arquivo parece um APK, mas o sistema não conseguiu interpretá-lo. Pode estar corrompido ou propositalmente malformado.")

        val pkg = pi?.packageName
        val iocMatch = pkg?.let { ioc.byPackage(it) } ?: certs.firstNotNullOfOrNull { ioc.byCertSha1(it.sha1) }
        if (iocMatch != null) findings += Finding(Severity.CRITICAL, "Corresponde a um app de espionagem conhecido",
            "Pacote ou assinatura consta na base pública stalkerware-indicators como \"$iocMatch\".")

        if (certs.isEmpty()) findings += Finding(Severity.HIGH, "Sem assinatura digital legível", "Não foi possível ler o certificado. APKs legítimos sempre são assinados.")
        if (certs.any { it.isDebug }) findings += Finding(Severity.MEDIUM, "Assinado com certificado de depuração",
            "Esse certificado é usado durante o desenvolvimento, não em versões oficiais publicadas.")
        if (certs.any { it.expired }) findings += Finding(Severity.LOW, "Certificado vencido", "O certificado de assinatura já expirou.")

        // Compara com a versão instalada (mesmo pacote com outra assinatura = possível versão adulterada)
        var sameSigner: Boolean? = null
        var installedVersion: String? = null
        if (pkg != null) {
            runCatching { pm.getPackageInfo(pkg, sigFlag) }.getOrNull()?.let { inst ->
                installedVersion = inst.versionName
                val instCerts = CertInfo.ofPackage(inst).map { it.sha256 }.toSet()
                sameSigner = certs.isNotEmpty() && certs.any { it.sha256 in instCerts }
                if (sameSigner == false) findings += Finding(Severity.CRITICAL, "Assinatura diferente do app instalado",
                    "Você já tem \"$pkg\" instalado, mas este APK foi assinado por outra pessoa/empresa. É o sinal típico de versão modificada (\"mod\", \"plus\", \"gold\") que pode conter malware.")
            }
        }

        val dexCount = entries.count { it.matches(Regex("classes\\d*\\.dex")) }
        val abis = entries.filter { it.startsWith("lib/") }.mapNotNull { it.split('/').getOrNull(1) }.distinct()
        val payloads = entries.filter { e ->
            val l = e.lowercase(Locale.ROOT)
            (l.startsWith("assets/") || l.startsWith("res/raw/")) && listOf(".apk", ".dex", ".jar", ".so.bin", ".odex").any { l.endsWith(it) }
        }
        if (payloads.isNotEmpty()) findings += Finding(Severity.MEDIUM, "Código escondido em recursos",
            "O APK carrega outros executáveis dentro dele (${payloads.take(3).joinToString()}). Isso é usado por instaladores legítimos, mas também por malware que baixa/instala partes depois.")

        val sensitive = perms.mapNotNull { AppRiskRules.sensitiveLabels[it] }
        val facts = AppFacts(pkg ?: "?", label ?: "?", false, ai?.targetSdkVersion ?: 0, null, perms.toSet(),
            perms.toSet(), false, false, false, false, certs.any { it.isDebug }, certs.map { it.sha1 }, iocMatch)
        val risk = AppRiskRules.evaluate(facts)
        if (risk.score >= 20) findings += Finding(if (risk.score >= 45) Severity.HIGH else Severity.MEDIUM, "Permissões sensíveis solicitadas (${sensitive.size})",
            "Se instalado e autorizado, poderia: ${sensitive.take(8).joinToString()}.")
        val target = ai?.targetSdkVersion
        if (target != null && target in 1..22) findings += Finding(Severity.MEDIUM, "Feito para Android muito antigo (API $target)",
            "Apps assim recebem permissões sem perguntar na hora do uso.")

        return ApkReport(pkg, label, pi?.versionName,
            pi?.let { if (Build.VERSION.SDK_INT >= 28) it.longVersionCode else it.versionCode.toLong() },
            if (Build.VERSION.SDK_INT >= 24) ai?.minSdkVersion else null, target, perms, sensitive, certs, dexCount, abis, payloads,
            sameSigner, installedVersion, iocMatch)
    }

    /** Fallback para assinatura v1 (arquivos .RSA, .DSA ou .EC em META-INF): extrai o certificado do bloco PKCS#7. */
    private fun v1Certs(file: File, entries: List<String>): List<CertInfo> = runCatching {
        val sigEntry = entries.firstOrNull { it.startsWith("META-INF/") && (it.endsWith(".RSA") || it.endsWith(".DSA") || it.endsWith(".EC")) } ?: return emptyList()
        ZipFile(file).use { z ->
            z.getInputStream(z.getEntry(sigEntry)).use { ins ->
                java.security.cert.CertificateFactory.getInstance("X.509").generateCertificates(ins)
                    .mapNotNull { CertInfo.from(it.encoded) }
            }
        }
    }.getOrDefault(emptyList())
}
