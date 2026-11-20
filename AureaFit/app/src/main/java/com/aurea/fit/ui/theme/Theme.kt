package com.aurea.fit.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* Paleta Áurea: rosa profundo, ameixa e dourado — feminina, sofisticada e motivadora. */
private val Rose = Color(0xFFB4436C)
private val RoseLight = Color(0xFFF2A7C3)
private val Plum = Color(0xFF5B2A4A)
private val Gold = Color(0xFFC9965F)
private val GoldLight = Color(0xFFE9C49A)

private val LightColors = lightColorScheme(
    primary = Rose,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFD9E3),
    onPrimaryContainer = Color(0xFF3E0021),
    secondary = Plum,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF4DCEA),
    onSecondaryContainer = Color(0xFF2E0F24),
    tertiary = Color(0xFF8A5A2B),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFE1C4),
    onTertiaryContainer = Color(0xFF2E1500),
    background = Color(0xFFFFF8F5),
    onBackground = Color(0xFF231A1C),
    surface = Color(0xFFFFFBFA),
    onSurface = Color(0xFF231A1C),
    surfaceVariant = Color(0xFFF5E6E8),
    onSurfaceVariant = Color(0xFF5A4448),
    surfaceContainer = Color(0xFFFAEEEE),
    surfaceContainerHigh = Color(0xFFF6E7E8),
    outline = Color(0xFF8E7377),
    outlineVariant = Color(0xFFE2C9CD),
    error = Color(0xFFBA1A1A)
)

private val DarkColors = darkColorScheme(
    primary = RoseLight,
    onPrimary = Color(0xFF5E1136),
    primaryContainer = Color(0xFF7E2A4D),
    onPrimaryContainer = Color(0xFFFFD9E3),
    secondary = Color(0xFFE2B8D2),
    onSecondary = Color(0xFF45213A),
    secondaryContainer = Color(0xFF5E3752),
    onSecondaryContainer = Color(0xFFFFD7EE),
    tertiary = GoldLight,
    onTertiary = Color(0xFF472A05),
    tertiaryContainer = Color(0xFF633F17),
    onTertiaryContainer = Color(0xFFFFDCBC),
    background = Color(0xFF16110F),
    onBackground = Color(0xFFEFDFE0),
    surface = Color(0xFF1C1517),
    onSurface = Color(0xFFEFDFE0),
    surfaceVariant = Color(0xFF3A2E31),
    onSurfaceVariant = Color(0xFFD9C1C5),
    surfaceContainer = Color(0xFF261D20),
    surfaceContainerHigh = Color(0xFF30262A),
    outline = Color(0xFFA28C90),
    outlineVariant = Color(0xFF524246),
    error = Color(0xFFFFB4AB)
)

@Immutable
data class AureaExtras(val gold: Color, val plum: Color, val success: Color, val warning: Color, val water: Color)

val LocalExtras = staticCompositionLocalOf { AureaExtras(Gold, Plum, Color(0xFF2E7D5B), Color(0xFFB26A00), Color(0xFF3A86C8)) }

private val Display = FontFamily.Serif
private val Body = FontFamily.SansSerif

private val AureaTypography = Typography(
    displaySmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 40.sp),
    headlineLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 30.sp, lineHeight = 36.sp),
    headlineMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 26.sp, lineHeight = 32.sp),
    headlineSmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Body, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Body, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Body, fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp)
)

private val AureaShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp)
)

@Composable
fun AureaTheme(themeMode: Int = 0, content: @Composable () -> Unit) {
    val dark = when (themeMode) { 1 -> false; 2 -> true; else -> isSystemInDarkTheme() }
    val extras = if (dark) AureaExtras(GoldLight, Color(0xFFE2B8D2), Color(0xFF7FD6AE), Color(0xFFFFC266), Color(0xFF8CC8FF))
    else AureaExtras(Gold, Plum, Color(0xFF2E7D5B), Color(0xFFB26A00), Color(0xFF2F78B7))
    androidx.compose.runtime.CompositionLocalProvider(LocalExtras provides extras) {
        MaterialTheme(
            colorScheme = if (dark) DarkColors else LightColors,
            typography = AureaTypography,
            shapes = AureaShapes,
            content = content
        )
    }
}
