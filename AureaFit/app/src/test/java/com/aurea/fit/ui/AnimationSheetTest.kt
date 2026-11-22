package com.aurea.fit.ui

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.aurea.fit.domain.Anim
import com.aurea.fit.ui.components.ExerciseAnimation
import com.aurea.fit.ui.theme.AureaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w1200dp-h3000dp-xhdpi")
class AnimationSheetTest {
    @get:Rule val rule = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    @Test fun renderSheet() {
        val anims = Anim.entries
        rule.setContent {
            AureaTheme(1) {
                Column(Modifier.background(Color.White).padding(4.dp)) {
                    anims.chunked(4).forEach { row ->
                        Row {
                            row.forEach { a ->
                                Column(Modifier.width(295.dp).padding(2.dp)) {
                                    Text(a.name, fontSize = 10.sp)
                                    Row {
                                        Box(Modifier.weight(1f)) { ExerciseAnimation(a, fixedT = 0f) }
                                        Box(Modifier.weight(1f)) { ExerciseAnimation(a, fixedT = 1f) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        rule.waitForIdle()
        snap(rule.activity.window.decorView, "anim_sheet")
    }
}
