plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
}

/*
 * Versão web (PWA) para iPhone: compila para JavaScript EXATAMENTE as mesmas regras
 * de negócio do app Android (pasta app/.../domain), garantindo os mesmos cálculos.
 */
kotlin {
    js(IR) {
        browser()
        useEsModules()
        binaries.executable()
        compilerOptions { target.set("es2015") }
    }
    sourceSets {
        jsMain {
            kotlin.srcDir("../app/src/main/java/com/aurea/fit/domain")
            dependencies { implementation(libs.kotlinx.serialization.json) }
        }
    }
}

/** Monta a pasta web/server/public (pronta para publicar): interface + núcleo compilado + lista offline. */
val assemblePwa by tasks.registering {
    dependsOn("compileProductionExecutableKotlinJs")
    val dist = layout.projectDirectory.dir("server/public").asFile
    val pwa = layout.projectDirectory.dir("pwa").asFile
    val coreDir = layout.buildDirectory.dir("compileSync/js/main/productionExecutable/kotlin").get().asFile
    doLast {
        dist.deleteRecursively(); dist.mkdirs()
        pwa.copyRecursively(dist)
        val coreOut = File(dist, "core").apply { mkdirs() }
        coreDir.listFiles { f -> f.name.endsWith(".mjs") }!!.forEach { it.copyTo(File(coreOut, it.name), true) }
        val files = dist.walkTopDown().filter { it.isFile && it.name != "sw.js" && it.name != "netlify.toml" }
            .map { "./" + it.relativeTo(dist).invariantSeparatorsPath }.sorted().toList()
        val list = (listOf("./") + files).joinToString(",\n  ", "[\n  ", "\n]") { "\"$it\"" }
        val sw = File(dist, "sw.js")
        sw.writeText(sw.readText().replace("__FILES__", list).replace("__BUILD__", System.currentTimeMillis().toString()))
        println("PWA pronta em: ${dist.absolutePath} (${files.size} arquivos)")
    }
}
