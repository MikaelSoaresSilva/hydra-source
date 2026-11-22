package com.ascend.faceai.ui.components

import android.graphics.Bitmap
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ascend.faceai.analysis.FaceReport
import com.ascend.faceai.ui.theme.Grotesk
import com.ascend.faceai.ui.theme.Inter
import kotlin.math.roundToInt

/** Um número do cartão: rótulo, nota 0–100 (ou null = não medido) e categoria para abrir ao tocar. */
data class Stat(val label: String, val score: Int?, val categoryId: String?)

object Tier {
    val Track = Color(0xFFDCDCDE)
    fun color(s: Int?): Color = when {
        s == null -> Color(0xFF4A4D57)
        s < 40 -> Color(0xFF9C1B40)   // vinho
        s < 55 -> Color(0xFFE0651C)   // laranja
        s < 70 -> Color(0xFFF2B630)   // âmbar
        s < 85 -> Color(0xFFC8E33A)   // lima
        else -> Color(0xFF2FE38C)     // verde
    }
}

/** As três páginas do cartão, só com notas realmente calculadas no relatório. */
fun statPages(r: FaceReport): List<List<Stat>> {
    fun cat(id: String) = r.category(id)?.takeIf { it.available }?.score
    fun met(cat: String, key: String) = r.category(cat)?.metrics?.firstOrNull { it.key == key }?.score?.roundToInt()
    val potential = (r.overall + r.potential).coerceAtMost(100)
    return listOf(
        listOf(
            Stat("Geral", r.overall, null), Stat("Potencial", potential, null),
            Stat("Masculinidade", cat("masculinidade"), "masculinidade"), Stat("Qualidade da pele", cat("pele"), "pele"),
            Stat("Mandíbula", cat("mandibula"), "mandibula"), Stat("Maçãs do rosto", cat("macas"), "macas")
        ),
        listOf(
            Stat("Olhos", cat("olhos"), "olhos"), Stat("Nariz", cat("nariz"), "nariz"),
            Stat("Simetria", cat("simetria"), "simetria"), Stat("Harmonia", cat("harmonia"), "harmonia"),
            Stat("Sobrancelhas", cat("sobrancelhas"), "sobrancelhas"), Stat("Cabelo", cat("cabelo"), "cabelo")
        ),
        listOf(
            Stat("Estrutura", cat("estrutura"), "estrutura"), Stat("Barba", cat("barba"), "barba"),
            Stat("Acne", met("pele", "spots"), "pele"), Stat("Olheiras", met("pele", "under_eye_skin") ?: met("olhos", "under_eye"), "olhos"),
            Stat("Textura da pele", met("pele", "texture"), "pele"), Stat("Tom da pele", met("pele", "tone") ?: met("pele", "tone_color"), "pele")
        )
    )
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
/** Cartão de resultado: foto circular, 6 notas grandes com barras coloridas, páginas deslizáveis. */
@Composable
fun ResultCards(r: FaceReport, photo: Bitmap?, onStat: (Stat) -> Unit, modifier: Modifier = Modifier) {
    val pages = remember(r.id) { statPages(r) }
    val pager = rememberPagerState { pages.size }
    Column(modifier.testTag("result_cards"), horizontalAlignment = Alignment.CenterHorizontally) {
        HorizontalPager(pager, Modifier.fillMaxWidth(), pageSpacing = 14.dp) { page ->
            ResultCard(photo, pages[page], page, onStat)
        }
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            pages.indices.forEach { i ->
                Box(Modifier.size(if (pager.currentPage == i) 18.dp else 7.dp, 7.dp).clip(CircleShape)
                    .background(if (pager.currentPage == i) Color.White else Color(0xFF3A3D46)))
            }
        }
        Text("Deslize para ver todas as notas · toque numa nota para os detalhes", style = TextStyle(fontFamily = Inter, fontSize = 11.5.sp, color = Color(0xFF6E7587)),
            modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun ResultCard(photo: Bitmap?, stats: List<Stat>, page: Int, onStat: (Stat) -> Unit) {
    val photoSize = 168.dp
    Box(Modifier.fillMaxWidth().padding(horizontal = 4.dp), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.padding(top = photoSize * 0.62f).fillMaxWidth()
                .clip(RoundedCornerShape(34.dp))
                .background(Brush.verticalGradient(listOf(Color(0xFF141216), Color(0xFF0B0A0C))))
                .border(BorderStroke(1.dp, Color(0x22FFFFFF)), RoundedCornerShape(34.dp))
                .padding(start = 26.dp, end = 26.dp, top = photoSize * 0.44f, bottom = 18.dp)
        ) {
            stats.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                    row.forEach { s -> StatCell(s, Modifier.weight(1f).testTag("stat_${page}_${s.label}"), onStat) }
                }
            }
            Text("ascend", style = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Medium, fontSize = 20.sp, color = Color(0xFF5B5E68)),
                modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 6.dp))
        }
        Box(
            Modifier.size(photoSize).clip(CircleShape).background(Color(0xFF1C1E25))
                .border(BorderStroke(3.dp, Color(0xFF0B0A0C)), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (photo != null) Image(photo.asImageBitmap(), "Sua foto", contentScale = ContentScale.Crop, modifier = Modifier.size(photoSize).clip(CircleShape))
        }
    }
}

@Composable
private fun StatCell(s: Stat, modifier: Modifier, onStat: (Stat) -> Unit) {
    val anim = remember(s) { Animatable(0f) }
    LaunchedEffect(s) { anim.animateTo(1f, tween(1100, easing = FastOutSlowInEasing)) }
    val shown = s.score?.let { (it * anim.value).roundToInt() }
    Column(modifier.clip(RoundedCornerShape(12.dp)).clickable(enabled = s.categoryId != null) { onStat(s) }.padding(vertical = 2.dp)) {
        Text(s.label, style = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 16.sp, color = Color(0xFFE9EAEE)), maxLines = 1)
        Text(shown?.toString() ?: "—", style = TextStyle(fontFamily = Grotesk, fontWeight = FontWeight.Bold, fontSize = 46.sp, color = Color.White, letterSpacing = (-1).sp))
        Spacer(Modifier.height(4.dp))
        Box(Modifier.fillMaxWidth().height(11.dp).clip(RoundedCornerShape(50)).background(if (s.score == null) Color(0xFF2A2C33) else Tier.Track)) {
            if (s.score != null) Box(
                Modifier.fillMaxWidth((s.score / 100f * anim.value).coerceIn(0.02f, 1f)).fillMaxHeight()
                    .clip(RoundedCornerShape(50)).background(Tier.color(s.score))
            )
        }
    }
}
