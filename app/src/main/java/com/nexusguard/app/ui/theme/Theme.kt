package com.nexusguard.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.nexusguard.app.R

@Immutable
data class NexusColors(
    val bg: Color,
    val surface: Color,
    val surfaceHigh: Color,
    val stroke: Color,
    val blue: Color = Color(0xFF1F8BFF),
    val cyan: Color = Color(0xFF3CC8FF),
    val purple: Color = Color(0xFF8B5CF6),
    val text: Color = Color(0xFFF4F7FF),
    val muted: Color = Color(0xFF8A93B2),
    val success: Color = Color(0xFF22D39A),
    val warn: Color = Color(0xFFFFB547),
    val danger: Color = Color(0xFFFF4D6A)
) {
    val accent get() = Brush.linearGradient(listOf(blue, purple))
    val accentH get() = Brush.horizontalGradient(listOf(blue, purple))
}

val DarkNexus = NexusColors(bg = Color(0xFF04050A), surface = Color(0xFF0B0E1A), surfaceHigh = Color(0xFF121729), stroke = Color(0xFF1E2540))
val AmoledNexus = NexusColors(bg = Color(0xFF000000), surface = Color(0xFF07080F), surfaceHigh = Color(0xFF0E111E), stroke = Color(0xFF181D33))

val LocalNexus = staticCompositionLocalOf { DarkNexus }

val Grotesk = FontFamily(Font(R.font.grotesk_medium, FontWeight.Medium), Font(R.font.grotesk_bold, FontWeight.Bold))
val Inter = FontFamily(Font(R.font.inter_regular, FontWeight.Normal), Font(R.font.inter_medium, FontWeight.Medium), Font(R.font.inter_semibold, FontWeight.SemiBold))

private val typography = Typography(
    displaySmall = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 34.sp, letterSpacing = (-0.5).sp),
    headlineSmall = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 24.sp),
    titleLarge = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    titleSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
    bodyLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, letterSpacing = 0.6.sp),
    labelMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 0.4.sp),
    labelSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 11.sp, letterSpacing = 0.8.sp)
)

@Composable
fun NexusTheme(amoled: Boolean = false, content: @Composable () -> Unit) {
    val c = if (amoled) AmoledNexus else DarkNexus
    val scheme = darkColorScheme(
        primary = c.blue, onPrimary = Color.White, secondary = c.purple, onSecondary = Color.White,
        background = c.bg, onBackground = c.text, surface = c.surface, onSurface = c.text,
        surfaceVariant = c.surfaceHigh, onSurfaceVariant = c.muted, outline = c.stroke, error = c.danger,
        surfaceContainer = c.surface, surfaceContainerHigh = c.surfaceHigh, surfaceContainerLow = c.surface
    )
    CompositionLocalProvider(LocalNexus provides c) {
        MaterialTheme(colorScheme = scheme, typography = typography, content = content)
    }
}

object NX {
    val c: NexusColors @Composable get() = LocalNexus.current
}
