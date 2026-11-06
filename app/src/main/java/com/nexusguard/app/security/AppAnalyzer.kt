package com.nexusguard.app.security

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Serializable
data class CertInfo(
    val subject: String,
    val issuer: String,
    val validFrom: Long,
    val validTo: Long,
    val sha256: String,
    val sha1: String,
    val algorithm: String,
    val serial: String
) {
    val isDebug get() = subject.contains("CN=Android Debug", true)
    val selfSigned get() = subject == issuer
    val expired get() = validTo < System.currentTimeMillis()

    companion object {
        fun hex(b: ByteArray) = b.joinToString("") { "%02X".format(it) }

        fun from(der: ByteArray): CertInfo? = runCatching {
            val c = CertificateFactory.getInstance("X.509").generateCertificate(ByteArrayInputStream(der)) as X509Certificate
            CertInfo(
                c.subjectX500Principal.name, c.issuerX500Principal.name, c.notBefore.time, c.notAfter.time,
                hex(MessageDigest.getInstance("SHA-256").digest(der)), hex(MessageDigest.getInstance("SHA-1").digest(der)),
                c.sigAlgName, c.serialNumber.toString(16)
            )
        }.getOrNull()

        @Suppress("DEPRECATION")
        fun ofPackage(pi: PackageInfo): List<CertInfo> {
            val sigs = if (Build.VERSION.SDK_INT >= 28) {
                val si = pi.signingInfo ?: return emptyList()
                if (si.hasMultipleSigners()) si.apkContentsSigners else si.signingCertificateHistory
            } else pi.signatures
            return sigs?.mapNotNull { from(it.toByteArray()) }.orEmpty()
        }
    }

    fun pretty(): String {
        val df = SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR"))
        return "Titular: $subject\nEmissor: $issuer\nValidade: ${df.format(Date(validFrom))} até ${df.format(Date(validTo))}\nAlgoritmo: $algorithm\nSHA-256: ${sha256.chunked(2).joinToString(":")}"
    }
}

/** Base pública stalkerware-indicators (Echap, CC-BY 4.0), embutida no app e consultada offline. */
class IocDatabase(context: Context) {
    @Serializable private data class Entry(val n: String, val p: List<String> = emptyList(), val c: List<String> = emptyList(), val w: List<String> = emptyList())
    @Serializable private data class Root(val source: String, val entries: List<Entry>)

    private val packages = HashMap<String, String>()
    private val certs = HashMap<String, String>()
    val websites = HashSet<String>()
    var entryCount = 0; private set

    init {
        runCatching {
            val txt = context.assets.open("stalkerware_ioc.json").bufferedReader().use { it.readText() }
            val root = Json { ignoreUnknownKeys = true }.decodeFromString(Root.serializer(), txt)
            entryCount = root.entries.size
            root.entries.forEach { e ->
                e.p.forEach { packages[it] = e.n }
                e.c.forEach { certs[it.uppercase(Locale.ROOT)] = e.n }
                e.w.forEach { websites += it.lowercase(Locale.ROOT) }
            }
        }
    }

    fun byPackage(pkg: String): String? = packages[pkg]
    fun byCertSha1(sha1: String): String? = certs[sha1.uppercase(Locale.ROOT)]

    @Suppress("DEPRECATION")
    fun matchInstalled(context: Context): List<String> {
        val pm = context.packageManager
        val found = mutableListOf<String>()
        pm.getInstalledApplications(0).forEach { ai ->
            byPackage(ai.packageName)?.let { found += "$it (${ai.packageName})" }
        }
        // Certificados: só de apps fora do sistema (rápido o suficiente para algumas centenas de apps)
        pm.getInstalledApplications(0).filter { (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 }.forEach { ai ->
            val pi = runCatching {
                if (Build.VERSION.SDK_INT >= 28) pm.getPackageInfo(ai.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                else pm.getPackageInfo(ai.packageName, PackageManager.GET_SIGNATURES)
            }.getOrNull() ?: return@forEach
            CertInfo.ofPackage(pi).firstNotNullOfOrNull { byCertSha1(it.sha1) }?.let { n ->
                val label = "$n (${ai.packageName}, assinatura)"
                if (found.none { f -> f.contains(ai.packageName) }) found += label
            }
        }
        return found
    }
}

data class AppInfo(
    val packageName: String,
    val label: String,
    val versionName: String?,
    val isSystem: Boolean,
    val installer: String?,
    val targetSdk: Int,
    val firstInstall: Long,
    val lastUpdate: Long,
    val requested: List<String>,
    val granted: List<String>,
    val certs: List<CertInfo>,
    val risk: AppRisk,
    val facts: AppFacts
)

class AppAnalyzer(private val context: Context, private val ioc: IocDatabase) {

    @Suppress("DEPRECATION")
    suspend fun analyzeAll(includeSystem: Boolean = false): List<AppInfo> = withContext(Dispatchers.IO) {
        val pm = context.packageManager
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        val admins = runCatching { dpm.activeAdmins?.map { it.packageName }?.toSet().orEmpty() }.getOrDefault(emptySet())
        val accEnabled = runCatching { Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) }.getOrNull().orEmpty()
        val listeners = runCatching { Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") }.getOrNull().orEmpty()

        pm.getInstalledApplications(0)
            .filter { it.packageName != context.packageName }
            .filter { includeSystem || (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 || (it.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0 }
            .mapNotNull { ai -> runCatching { analyzeOne(ai.packageName, admins, accEnabled, listeners) }.getOrNull() }
            .sortedWith(compareByDescending<AppInfo> { it.risk.score }.thenBy { it.label.lowercase() })
    }

    suspend fun analyzePackage(pkg: String): AppInfo? = withContext(Dispatchers.IO) {
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        val admins = runCatching { dpm.activeAdmins?.map { it.packageName }?.toSet().orEmpty() }.getOrDefault(emptySet())
        val acc = runCatching { Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) }.getOrNull().orEmpty()
        val lis = runCatching { Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") }.getOrNull().orEmpty()
        runCatching { analyzeOne(pkg, admins, acc, lis) }.getOrNull()
    }

    @Suppress("DEPRECATION")
    private fun analyzeOne(pkg: String, admins: Set<String>, accEnabled: String, listeners: String): AppInfo {
        val pm = context.packageManager
        val sigFlag = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val pi = pm.getPackageInfo(pkg, PackageManager.GET_PERMISSIONS or PackageManager.GET_SERVICES or sigFlag)
        val ai = pi.applicationInfo!!
        val requested = pi.requestedPermissions?.toList().orEmpty()
        val flags = pi.requestedPermissionsFlags
        val granted = requested.filterIndexed { i, _ -> flags != null && i < flags.size && (flags[i] and PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0 }
        val services = pi.services.orEmpty()
        val hasAcc = services.any { it.permission == android.Manifest.permission.BIND_ACCESSIBILITY_SERVICE }
        val hasListener = services.any { it.permission == android.Manifest.permission.BIND_NOTIFICATION_LISTENER_SERVICE }
        val certs = CertInfo.ofPackage(pi)
        val installer = runCatching {
            if (Build.VERSION.SDK_INT >= 30) pm.getInstallSourceInfo(pkg).installingPackageName else pm.getInstallerPackageName(pkg)
        }.getOrNull()
        val isSystem = (ai.flags and ApplicationInfo.FLAG_SYSTEM) != 0
        val iocPkg = ioc.byPackage(pkg)
        val iocCert = certs.firstNotNullOfOrNull { ioc.byCertSha1(it.sha1) }
        val facts = AppFacts(
            packageName = pkg,
            label = pm.getApplicationLabel(ai).toString(),
            isSystem = isSystem,
            targetSdk = ai.targetSdkVersion,
            installer = installer,
            requested = (requested + services.mapNotNull { it.permission }).toSet(),
            granted = granted.toSet(),
            accessibilityService = hasAcc,
            accessibilityEnabled = hasAcc && accEnabled.contains("$pkg/"),
            deviceAdmin = pkg in admins,
            notificationListener = hasListener && listeners.contains("$pkg/"),
            debugCertificate = certs.any { it.isDebug },
            certSha1 = certs.map { it.sha1 },
            iocMatch = iocPkg ?: iocCert,
            iocByCertificate = iocPkg == null && iocCert != null,
            launcherVisible = pm.getLaunchIntentForPackage(pkg) != null
        )
        return AppInfo(pkg, facts.label, pi.versionName, isSystem, installer, ai.targetSdkVersion, pi.firstInstallTime, pi.lastUpdateTime,
            requested, granted, certs, AppRiskRules.evaluate(facts), facts)
    }
}
