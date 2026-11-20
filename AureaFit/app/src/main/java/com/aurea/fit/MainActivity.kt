package com.aurea.fit

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.aurea.fit.ui.AppViewModel
import com.aurea.fit.ui.nav.AppNav
import com.aurea.fit.ui.theme.AureaTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()
    private val notifPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_Aurea)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val open = intent?.getStringExtra("open")
        setContent {
            val settings by vm.settings.collectAsState()
            val profile by vm.profile.collectAsState()
            LaunchedEffect(settings.secureScreen) {
                if (settings.secureScreen) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
            // Pede permissão de notificação (Android 13+) depois que o plano existe.
            LaunchedEffect(profile != null) {
                if (profile != null && settings.notificationsEnabled && Build.VERSION.SDK_INT >= 33) {
                    notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            AureaTheme(settings.themeMode) { AppNav(vm, open) }
        }
    }

    override fun onResume() {
        super.onResume()
        vm.refreshDay()
    }
}
