package com.nexusguard.app

import android.content.Intent
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.core.content.ContextCompat
import com.nexusguard.app.core.AppSettings
import com.nexusguard.app.ui.NexusRoot
import com.nexusguard.app.ui.screens.LockScreen
import com.nexusguard.app.ui.theme.DarkNexus
import com.nexusguard.app.ui.theme.NX
import com.nexusguard.app.ui.theme.NexusTheme
import com.nexusguard.app.security.PhishingAnalyzer

class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_ROUTE = "route"
    }

    private var sharedText by mutableStateOf<String?>(null)
    private var startRoute by mutableStateOf<String?>(null)
    private var unlocked by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(DarkNexus.bg.toArgb()),
            navigationBarStyle = SystemBarStyle.dark(DarkNexus.bg.toArgb())
        )
        super.onCreate(savedInstanceState)
        unlocked = savedInstanceState?.getBoolean("unlocked") ?: false
        handleIntent(intent)
        val settingsFlow = (application as NexusApp).container.settings.settings
        setContent {
            val s by settingsFlow.collectAsState(initial = null as AppSettings?)
            NexusTheme(amoled = s?.theme == "amoled") {
                Box(Modifier.fillMaxSize().background(NX.c.bg)) {
                    if (s?.appLock == true && !unlocked && Build.VERSION.SDK_INT >= 28) {
                        LockScreen { authenticate() }
                    } else {
                        NexusRoot(sharedText, startRoute) { sharedText = null }
                    }
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("unlocked", unlocked)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(i: Intent?) {
        if (i == null) return
        if (i.action == Intent.ACTION_SEND && i.type?.startsWith("text/") == true) {
            val txt = i.getStringExtra(Intent.EXTRA_TEXT) ?: return
            sharedText = PhishingAnalyzer.extractUrl(txt) ?: txt
        }
        i.getStringExtra(EXTRA_ROUTE)?.let { startRoute = it }
    }

    private fun authenticate() {
        if (Build.VERSION.SDK_INT < 28) { unlocked = true; return }
        val b = BiometricPrompt.Builder(this).setTitle("Desbloquear NEXUS GUARD").setSubtitle("Confirme que é você")
        if (Build.VERSION.SDK_INT >= 30) {
            b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
        } else if (Build.VERSION.SDK_INT >= 29) {
            @Suppress("DEPRECATION") b.setDeviceCredentialAllowed(true)
        } else {
            b.setNegativeButton("Cancelar", ContextCompat.getMainExecutor(this)) { _, _ -> }
        }
        b.build().authenticate(CancellationSignal(), ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) { unlocked = true }
        })
    }
}
