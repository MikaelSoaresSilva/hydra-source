package com.ascend.faceai.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.ascend.faceai.ui.theme.Ac

/** Comparação antes/depois com divisória arrastável. */
@Composable
fun BeforeAfter(before: Bitmap, after: Bitmap, leftLabel: String = "Atual", rightLabel: String = "Simulação") {
    var split by remember { mutableFloatStateOf(0.5f) }
    Column {
        BoxWithConstraints(Modifier.fillMaxWidth().aspectRatio(before.width.toFloat() / before.height).clip(RoundedCornerShape(22.dp))) {
            val mw = maxWidth
            Image(after.asImageBitmap(), rightLabel, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            Box(Modifier.fillMaxHeight().width(mw * split).clipToBounds()) {
                Image(before.asImageBitmap(), leftLabel, contentScale = ContentScale.Crop, alignment = Alignment.CenterStart,
                    modifier = Modifier.wrapContentWidth(Alignment.Start, unbounded = true).width(mw).fillMaxHeight())
            }
            Box(Modifier.offset(x = mw * split - 1.dp).fillMaxHeight().width(2.dp).background(Ac.TextHi))
            Text(leftLabel, style = MaterialTheme.typography.labelMedium, color = Color.White,
                modifier = Modifier.align(Alignment.TopStart).padding(10.dp).clip(RoundedCornerShape(50)).background(Color(0x99000000)).padding(horizontal = 10.dp, vertical = 4.dp))
            Text(rightLabel, style = MaterialTheme.typography.labelMedium, color = Color.White,
                modifier = Modifier.align(Alignment.TopEnd).padding(10.dp).clip(RoundedCornerShape(50)).background(Color(0x99000000)).padding(horizontal = 10.dp, vertical = 4.dp))
        }
        Slider(split, { split = it }, colors = SliderDefaults.colors(thumbColor = Ac.Blue, activeTrackColor = Ac.Blue, inactiveTrackColor = Ac.SurfaceHi))
        Text("Arraste: esquerda = $leftLabel · direita = $rightLabel", style = MaterialTheme.typography.bodySmall, color = Ac.TextLow)
    }
}
