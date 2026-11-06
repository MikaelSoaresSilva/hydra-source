package com.nexusguard.app.core

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.FileProvider
import com.nexusguard.app.security.SettingsTarget
import java.io.File

/** Atalhos para as telas OFICIAIS do Android (o app nunca altera essas configurações sozinho). */
object Intents {

    private fun tryStart(ctx: Context, vararg intents: Intent): Boolean {
        for (i in intents) {
            try {
                ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true
            } catch (_: ActivityNotFoundException) { } catch (_: SecurityException) { }
        }
        Toast.makeText(ctx, "Não foi possível abrir essa tela neste aparelho.", Toast.LENGTH_LONG).show()
        return false
    }

    fun appDetails(ctx: Context, pkg: String) = tryStart(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))

    fun settings(ctx: Context, target: SettingsTarget) = when (target) {
        SettingsTarget.SECURITY -> tryStart(ctx, Intent(Settings.ACTION_SECURITY_SETTINGS), Intent(Settings.ACTION_SETTINGS))
        SettingsTarget.DEVELOPER -> tryStart(ctx, Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS), Intent(Settings.ACTION_SETTINGS))
        SettingsTarget.ACCESSIBILITY -> tryStart(ctx, Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        SettingsTarget.DEVICE_ADMIN -> tryStart(ctx, Intent().setClassName("com.android.settings", "com.android.settings.DeviceAdminSettings"), Intent(Settings.ACTION_SECURITY_SETTINGS))
        SettingsTarget.NOTIFICATION_LISTENER -> tryStart(ctx, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        SettingsTarget.SYSTEM_UPDATE -> tryStart(ctx, Intent("android.settings.SYSTEM_UPDATE_SETTINGS"), Intent(Settings.ACTION_DEVICE_INFO_SETTINGS), Intent(Settings.ACTION_SETTINGS))
        SettingsTarget.BIOMETRIC -> tryStart(ctx, Intent(if (Build.VERSION.SDK_INT >= 30) Settings.ACTION_BIOMETRIC_ENROLL else Settings.ACTION_SECURITY_SETTINGS), Intent(Settings.ACTION_SECURITY_SETTINGS))
        SettingsTarget.UNKNOWN_SOURCES -> tryStart(ctx, Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES), Intent(Settings.ACTION_SECURITY_SETTINGS))
        SettingsTarget.NONE -> false
    }

    /** Não existe ação pública para o DNS privado: tentamos as telas mais próximas, do mais específico ao genérico. */
    fun privateDns(ctx: Context) = tryStart(ctx,
        Intent("android.settings.PRIVATE_DNS_SETTINGS"),
        Intent().setClassName("com.android.settings", "com.android.settings.Settings\$PrivateDnsSettingsActivity"),
        Intent(Settings.ACTION_WIRELESS_SETTINGS),
        Intent(Settings.ACTION_SETTINGS))

    fun wifiPanel(ctx: Context) = if (Build.VERSION.SDK_INT >= 29) tryStart(ctx, Intent(Settings.Panel.ACTION_WIFI), Intent(Settings.ACTION_WIFI_SETTINGS))
    else tryStart(ctx, Intent(Settings.ACTION_WIFI_SETTINGS))

    fun internetPanel(ctx: Context) = if (Build.VERSION.SDK_INT >= 29) tryStart(ctx, Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY), Intent(Settings.ACTION_WIRELESS_SETTINGS))
    else tryStart(ctx, Intent(Settings.ACTION_WIRELESS_SETTINGS))

    fun mobileData(ctx: Context) = tryStart(ctx, Intent(Settings.ACTION_NETWORK_OPERATOR_SETTINGS), Intent(Settings.ACTION_DATA_ROAMING_SETTINGS), Intent(Settings.ACTION_WIRELESS_SETTINGS))

    fun captiveLogin(ctx: Context) = tryStart(ctx, Intent(Intent.ACTION_VIEW, Uri.parse("http://connectivitycheck.gstatic.com/generate_204")), Intent(Settings.ACTION_WIFI_SETTINGS))

    fun appNotifications(ctx: Context) = if (Build.VERSION.SDK_INT >= 26)
        tryStart(ctx, Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName))
    else appDetails(ctx, ctx.packageName)

    fun openUrl(ctx: Context, url: String) = tryStart(ctx, Intent(Intent.ACTION_VIEW, Uri.parse(if (url.contains("://")) url else "https://$url")))

    fun copy(ctx: Context, label: String, text: String) {
        ctx.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText(label, text))
        if (Build.VERSION.SDK_INT < 33) Toast.makeText(ctx, "Copiado: $text", Toast.LENGTH_SHORT).show()
    }

    fun shareText(ctx: Context, subject: String, text: String) {
        val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_SUBJECT, subject).putExtra(Intent.EXTRA_TEXT, text)
        tryStart(ctx, Intent.createChooser(i, subject))
    }

    fun shareFile(ctx: Context, name: String, mime: String, content: String) {
        val dir = File(ctx.cacheDir, "reports").apply { mkdirs() }
        val f = File(dir, name).apply { writeText(content) }
        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", f)
        val i = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        tryStart(ctx, Intent.createChooser(i, "Exportar relatório").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    }
}
