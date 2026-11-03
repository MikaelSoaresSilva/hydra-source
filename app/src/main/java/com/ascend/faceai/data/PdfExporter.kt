package com.ascend.faceai.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.ascend.faceai.analysis.FaceReport
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Gera o relatório em PDF com a API nativa do Android (sem dependências externas). */
object PdfExporter {
    private const val W = 595
    private const val H = 842
    private const val M = 40f

    fun export(context: Context, r: FaceReport, photo: Bitmap?): File {
        val doc = PdfDocument()
        var pageNo = 1
        var page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
        var c: Canvas = page.canvas
        var y = M

        val title = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(15, 18, 30); textSize = 22f; isFakeBoldText = true }
        val h2 = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(40, 60, 160); textSize = 14f; isFakeBoldText = true }
        val body = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(40, 44, 55); textSize = 9.5f }
        val small = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(110, 115, 130); textSize = 8f }
        val bar = Paint(Paint.ANTI_ALIAS_FLAG)

        fun newPage() {
            doc.finishPage(page); pageNo++
            page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create()); c = page.canvas; y = M
        }
        fun ensure(h: Float) { if (y + h > H - M) newPage() }
        fun text(s: String, p: TextPaint, width: Float = W - 2 * M, x: Float = M) {
            val l = StaticLayout.Builder.obtain(s, 0, s.length, p, width.toInt()).setAlignment(Layout.Alignment.ALIGN_NORMAL).setLineSpacing(1.5f, 1f).build()
            ensure(l.height.toFloat())
            c.save(); c.translate(x, y); l.draw(c); c.restore(); y += l.height + 4
        }

        text("ASCEND FACE AI — Relatório de análise", title)
        text("Data: ${SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")).format(Date(r.createdAt))} · Metodologia v${r.methodologyVersion}", small)
        y += 6
        val top = y
        if (photo != null) {
            val ph = 200f; val pw = ph * photo.width / photo.height
            c.drawBitmap(photo, null, RectF(M, y, M + pw, y + ph), null)
            val x2 = M + pw + 16; val w2 = W - M - x2
            y = top
            text("Nota geral: ${r.overall}/100", h2, w2, x2)
            text("Potencial de evolução: +${r.potential} pontos (fatores modificáveis)", body, w2, x2)
            text("Confiança geral: ${(r.overallConfidence * 100).toInt()}%", body, w2, x2)
            text("Formato do rosto: ${r.faceShape}", body, w2, x2)
            text(r.summary, body, w2, x2)
            y = maxOf(y, top + ph) + 10
        } else {
            text("Nota geral: ${r.overall}/100 · Potencial +${r.potential}", h2); text(r.summary, body)
        }

        text("Notas por categoria", h2)
        r.categories.forEach { cat ->
            ensure(16f)
            c.drawText(cat.name, M, y + 9, body)
            val bx = M + 190; val bw = 260f
            bar.color = Color.rgb(230, 232, 240); c.drawRoundRect(RectF(bx, y + 2, bx + bw, y + 10), 4f, 4f, bar)
            if (cat.score != null) {
                bar.color = Color.rgb(76, 125, 255); c.drawRoundRect(RectF(bx, y + 2, bx + bw * cat.score / 100f, y + 10), 4f, 4f, bar)
            }
            c.drawText(cat.score?.toString() ?: "n/d", bx + bw + 10, y + 9, body)
            c.drawText("conf. ${(cat.confidence * 100).toInt()}%", bx + bw + 32, y + 9, small)
            y += 16
        }
        y += 8
        r.categories.forEach { cat ->
            ensure(60f)
            text("${cat.name} — ${cat.score ?: "não avaliado"}", h2)
            text(cat.justification, body)
            cat.metrics.forEach { m -> text("• ${m.label}: ${m.display}  (ref. ${m.reference})${m.score?.let { "  → ${it.toInt()}" } ?: ""}", small) }
            if (cat.recommendations.isNotEmpty()) text("Recomendações: " + cat.recommendations.joinToString(" "), body)
            text("Limitações: " + cat.limitations.joinToString(" "), small)
            y += 4
        }
        text("Aviso: este relatório é uma estimativa visual automatizada baseada em proporções de referência. Não é diagnóstico médico, dermatológico ou odontológico e não representa uma verdade universal sobre beleza.", small)
        doc.finishPage(page)

        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "ascend_relatorio_${SimpleDateFormat("yyyyMMdd_HHmm", Locale.US).format(Date(r.createdAt))}.pdf")
        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }
}
