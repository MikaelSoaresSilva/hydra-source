package com.ascend.faceai

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.staticCompositionLocalOf
import com.ascend.faceai.analysis.CaptureType
import com.ascend.faceai.data.AppContainer
import com.ascend.faceai.data.PreparedPhoto
import com.ascend.faceai.ui.AppRoot
import com.ascend.faceai.ui.theme.AscendTheme

class AscendApp : Application() {
    lateinit var container: AppContainer
    val scan = ScanSession()
    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

/** Fotos da sessão de captura atual. Ficam só na memória até a análise terminar. */
class ScanSession {
    val photos = mutableStateMapOf<CaptureType, PreparedPhoto>()
    fun clear() = photos.clear()
}

val LocalContainer = staticCompositionLocalOf<AppContainer> { error("container") }
val LocalScan = staticCompositionLocalOf<ScanSession> { error("scan") }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        val app = application as AscendApp
        setContent {
            AscendTheme {
                androidx.compose.runtime.CompositionLocalProvider(LocalContainer provides app.container, LocalScan provides app.scan) {
                    AppRoot()
                }
            }
        }
    }
}
