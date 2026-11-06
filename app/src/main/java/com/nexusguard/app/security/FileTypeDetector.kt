package com.nexusguard.app.security

import java.util.Locale

enum class DetectedType(val label: String, val executable: Boolean) {
    ZIP("Arquivo ZIP", false), APK("Aplicativo Android (APK)", true), PE("Executável Windows (EXE/DLL)", true),
    ELF("Executável Linux/Android (ELF)", true), DEX("Código Android (DEX)", true), PDF("Documento PDF", false),
    PNG("Imagem PNG", false), JPEG("Imagem JPEG", false), GIF("Imagem GIF", false), WEBP("Imagem WebP", false),
    MP4("Vídeo MP4/MOV", false), RAR("Arquivo RAR", false), SEVEN_Z("Arquivo 7-Zip", false), GZIP("Arquivo GZIP", false),
    SCRIPT("Script (#!)", true), OLE("Documento Office antigo (pode conter macros)", false), HTML("Página HTML", false),
    MP3("Áudio MP3", false), OGG("Áudio OGG", false), TEXT("Texto", false), UNKNOWN("Desconhecido", false)
}

data class FileVerdict(val type: DetectedType, val findings: List<Finding>, val score: Int)

/** Identificação do tipo real do arquivo pelos primeiros bytes ("assinatura mágica") e análise do nome. */
object FileTypeDetector {

    private val executableExt = setOf("apk", "xapk", "apks", "apkm", "exe", "scr", "com", "bat", "cmd", "msi", "jar", "dex", "so", "sh", "ps1", "vbs", "vbe", "js", "jse", "wsf", "hta", "lnk", "pif", "cpl", "reg", "elf", "bin", "run", "app", "dmg", "deb", "rpm")
    private val macroExt = setOf("docm", "xlsm", "pptm", "dotm", "xltm", "xlam", "ppam")
    private val docLikeExt = setOf("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "jpeg", "png", "gif", "mp4", "mp3", "webp", "heic", "csv", "odt", "rtf", "mov", "zip", "rar")
    private val imageOrMediaExt = setOf("jpg", "jpeg", "png", "gif", "webp", "heic", "mp4", "mp3", "mov", "avi", "mkv", "wav", "ogg", "pdf", "txt", "doc", "docx")

    fun detect(head: ByteArray): DetectedType {
        fun at(i: Int) = if (i < head.size) head[i].toInt() and 0xFF else -1
        fun ascii(off: Int, s: String) = s.indices.all { at(off + it) == s[it].code }
        return when {
            ascii(0, "PK\u0003\u0004") -> ZIP_OR_APK_PLACEHOLDER
            ascii(0, "MZ") -> DetectedType.PE
            at(0) == 0x7F && ascii(1, "ELF") -> DetectedType.ELF
            ascii(0, "dex\n") -> DetectedType.DEX
            ascii(0, "%PDF") -> DetectedType.PDF
            at(0) == 0x89 && ascii(1, "PNG") -> DetectedType.PNG
            at(0) == 0xFF && at(1) == 0xD8 && at(2) == 0xFF -> DetectedType.JPEG
            ascii(0, "GIF8") -> DetectedType.GIF
            ascii(0, "RIFF") && ascii(8, "WEBP") -> DetectedType.WEBP
            ascii(4, "ftyp") -> DetectedType.MP4
            ascii(0, "Rar!") -> DetectedType.RAR
            at(0) == 0x37 && at(1) == 0x7A && at(2) == 0xBC && at(3) == 0xAF -> DetectedType.SEVEN_Z
            at(0) == 0x1F && at(1) == 0x8B -> DetectedType.GZIP
            ascii(0, "#!") -> DetectedType.SCRIPT
            at(0) == 0xD0 && at(1) == 0xCF && at(2) == 0x11 && at(3) == 0xE0 -> DetectedType.OLE
            ascii(0, "ID3") || (at(0) == 0xFF && (at(1) and 0xE0) == 0xE0) -> DetectedType.MP3
            ascii(0, "OggS") -> DetectedType.OGG
            looksLikeHtml(head) -> DetectedType.HTML
            looksLikeText(head) -> DetectedType.TEXT
            else -> DetectedType.UNKNOWN
        }
    }

    /** ZIP e APK têm a mesma assinatura; quem chama confirma se há AndroidManifest.xml. */
    private val ZIP_OR_APK_PLACEHOLDER = DetectedType.ZIP

    private fun looksLikeHtml(head: ByteArray): Boolean {
        val s = String(head, 0, minOf(head.size, 512), Charsets.ISO_8859_1).trimStart().lowercase(Locale.ROOT)
        return s.startsWith("<!doctype html") || s.startsWith("<html") || s.startsWith("<head") || s.startsWith("<script")
    }

    private fun looksLikeText(head: ByteArray): Boolean {
        if (head.isEmpty()) return false
        val n = minOf(head.size, 512)
        var printable = 0
        for (i in 0 until n) {
            val c = head[i].toInt() and 0xFF
            if (c == 9 || c == 10 || c == 13 || c in 32..126 || c >= 0xC2) printable++
        }
        return printable.toDouble() / n > 0.95
    }

    fun extensions(name: String): List<String> =
        name.lowercase(Locale.ROOT).split('.').drop(1).map { it.trim() }.filter { it.isNotEmpty() && it.length <= 5 }

    /**
     * Combina o tipo real com o nome do arquivo. [isApk] indica que o ZIP contém AndroidManifest.xml.
     */
    fun evaluate(name: String, head: ByteArray, isApk: Boolean = false): FileVerdict {
        var type = detect(head)
        if (type == DetectedType.ZIP && isApk) type = DetectedType.APK
        val findings = mutableListOf<Finding>()
        val exts = extensions(name)
        val last = exts.lastOrNull()

        if (exts.size >= 2) {
            val prev = exts[exts.size - 2]
            if (prev in docLikeExt && last in executableExt) {
                findings += Finding(Severity.HIGH, "Extensão dupla enganosa (.$prev.$last)",
                    "O nome tenta parecer um arquivo comum (.$prev), mas a extensão real é .$last, que instala ou executa programas.")
            }
        }
        if (last != null && last in executableExt) {
            findings += Finding(if (type.executable) Severity.MEDIUM else Severity.LOW, "Arquivo executável/instalável (.$last)",
                "Arquivos desse tipo podem instalar ou rodar programas. Abra apenas se souber exatamente de onde vieram.")
        }
        if (last != null && last in macroExt) {
            findings += Finding(Severity.MEDIUM, "Documento com macros (.$last)", "Macros são pequenos programas dentro do documento e são usadas para espalhar malware.")
        }
        if (type == DetectedType.OLE) {
            findings += Finding(Severity.LOW, "Formato Office antigo", "Esse formato pode conter macros. Não ative \"conteúdo\" ou \"macros\" se o documento pedir.")
        }
        if (type.executable && last != null && last in imageOrMediaExt) {
            findings += Finding(Severity.CRITICAL, "Tipo real não corresponde ao nome",
                "O arquivo diz ser .$last, mas o conteúdo é ${type.label}. Disfarçar executáveis como fotos ou documentos é uma técnica clássica de malware.")
        } else if (type == DetectedType.HTML && last in setOf("pdf", "doc", "docx", "jpg", "png", "xls", "xlsx")) {
            findings += Finding(Severity.HIGH, "Página web disfarçada de documento",
                "O conteúdo é HTML, não .$last. Arquivos assim costumam abrir páginas falsas de login quando são abertos.")
        }
        if (name.any { it == '‮' || it == '‭' }) {
            findings += Finding(Severity.CRITICAL, "Caractere de inversão de texto no nome",
                "O nome contém um caractere invisível que inverte a leitura (ex.: \"fotogpj.apk\" aparece como \"fotokpa.jpg\").")
        }
        if (type == DetectedType.APK) {
            findings += Finding(Severity.INFO, "É um aplicativo Android", "Veja abaixo a análise de assinatura, certificado e permissões do APK.")
        }
        val score = findings.sumOf { it.severity.weight }.coerceIn(0, 100)
        return FileVerdict(type, findings.sortedByDescending { it.severity.weight }, score)
    }
}
