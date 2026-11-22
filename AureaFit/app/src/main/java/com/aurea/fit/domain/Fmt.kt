package com.aurea.fit.domain

import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.roundToLong

/*
 * Formatação numérica em Kotlin puro (sem java.lang.String.format), para que o
 * domínio compile tanto para Android (JVM) quanto para a web (iPhone).
 * Usa vírgula decimal, padrão brasileiro.
 */

/** Número com [decimals] casas decimais, ex.: 1.25.dec(1) = "1,3". */
fun Double.dec(decimals: Int): String {
    val factor = 10.0.pow(decimals).toLong()
    val scaled = (abs(this) * factor).roundToLong()
    val intPart = scaled / factor
    val sign = if (this < 0 && scaled != 0L) "-" else ""
    if (decimals == 0) return "$sign$intPart"
    val frac = (scaled % factor).toString().padStart(decimals, '0')
    return "$sign$intPart,$frac"
}

fun Int.pad2(): String = toString().padStart(2, '0')

/** Arredondamento "meio para cima", igual a Math.round. */
fun roundHalfUp(v: Double): Long = kotlin.math.floor(v + 0.5).toLong()
