package com.ascend.faceai.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.ascend.faceai.R

object Ac {
    val Bg = Color(0xFF06070A)
    val Graphite = Color(0xFF0E1016)
    val Surface = Color(0xFF141720)
    val SurfaceHi = Color(0xFF1C202B)
    val Stroke = Color(0x1AFFFFFF)
    val StrokeHi = Color(0x33FFFFFF)
    val Metal = Color(0xFF9AA3B5)
    val TextHi = Color(0xFFF4F6FB)
    val TextMid = Color(0xFFB2B9C7)
    val TextLow = Color(0xFF6E7587)
    val Blue = Color(0xFF4C7DFF)
    val Violet = Color(0xFF8B5CF6)
    val Cyan = Color(0xFF38D6FF)
    val Good = Color(0xFF34D399)
    val Warn = Color(0xFFFBBF24)
    val Bad = Color(0xFFF87171)
    val accent = Brush.linearGradient(listOf(Blue, Violet))
    val accentH = Brush.horizontalGradient(listOf(Blue, Violet))

    fun scoreColor(s: Int?): Color = when {
        s == null -> Metal
        s >= 80 -> Good
        s >= 60 -> Cyan
        s >= 45 -> Warn
        else -> Bad
    }
}

val Grotesk = FontFamily(Font(R.font.grotesk_medium, FontWeight.Medium), Font(R.font.grotesk_bold, FontWeight.Bold))
val Inter = FontFamily(Font(R.font.inter_regular, FontWeight.Normal), Font(R.font.inter_medium, FontWeight.Medium), Font(R.font.inter_semibold, FontWeight.SemiBold))

private val typo = Typography(
    displayLarge = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 56.sp, letterSpacing = (-1.5).sp),
    displaySmall = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 34.sp, letterSpacing = (-0.8).sp),
    headlineMedium = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 26.sp, letterSpacing = (-0.4).sp),
    headlineSmall = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 21.sp),
    titleLarge = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Medium, fontSize = 19.sp),
    titleMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
    titleSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp),
    bodyLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 13.5.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, letterSpacing = 0.2.sp),
    labelMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 0.3.sp),
    labelSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 10.5.sp, letterSpacing = 1.1.sp)
)

@Composable
fun AscendTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Ac.Blue, secondary = Ac.Violet, tertiary = Ac.Cyan,
            background = Ac.Bg, surface = Ac.Surface, surfaceVariant = Ac.SurfaceHi,
            onPrimary = Color.White, onBackground = Ac.TextHi, onSurface = Ac.TextHi, onSurfaceVariant = Ac.TextMid,
            outline = Ac.StrokeHi, error = Ac.Bad
        ),
        typography = typo,
        content = content
    )
}
