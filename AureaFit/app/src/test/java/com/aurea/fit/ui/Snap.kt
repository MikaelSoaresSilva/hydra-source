package com.aurea.fit.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import java.io.File

/** Captura a View raiz num PNG (funciona no Robolectric com GraphicsMode NATIVE). */
fun snap(view: View, name: String): File {
    val w = view.width.coerceAtLeast(1); val h = view.height.coerceAtLeast(1)
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    view.draw(Canvas(bmp))
    val dir = File(System.getProperty("user.dir"), "build/screens").apply { mkdirs() }
    val out = File(dir, "$name.png")
    out.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return out
}
