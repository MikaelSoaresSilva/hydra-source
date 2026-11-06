package com.nexusguard.app

import com.nexusguard.app.security.DomainUtils
import com.nexusguard.app.security.PhishingAnalyzer
import com.nexusguard.app.security.RiskLevel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PhishingAnalyzerTest {
    private val a = PhishingAnalyzer(setOf("thetruthspy.com"))

    private fun level(url: String) = a.analyze(url).level

    @Test fun registrableDomain() {
        assertEquals("nubank.com.br", DomainUtils.registrableDomain("login.secure.nubank.com.br"))
        assertEquals("google.com", DomainUtils.registrableDomain("accounts.google.com"))
        assertEquals("site-falso.github.io", DomainUtils.registrableDomain("site-falso.github.io"))
        assertEquals("bbc.co.uk", DomainUtils.registrableDomain("www.bbc.co.uk"))
        assertEquals(2, DomainUtils.subdomainDepth("a.b.example.com"))
    }

    @Test fun ipDetection() {
        assertTrue(DomainUtils.isIpAddress("192.168.0.1"))
        assertTrue(DomainUtils.isIpAddress("[2001:db8::1]"))
        assertTrue(DomainUtils.isIpAddress("3232235777"))
        assertFalse(DomainUtils.isIpAddress("example.com"))
        assertFalse(DomainUtils.isIpAddress("999.1.1.1"))
    }

    @Test fun levenshtein() {
        assertEquals(1, DomainUtils.levenshtein("nubank", "nubamk"))
        assertEquals(0, DomainUtils.levenshtein("abc", "abc"))
        assertEquals(3, DomainUtils.levenshtein("kitten", "sitting"))
    }

    @Test fun legitimateSitesAreNotFlaggedHigh() {
        listOf(
            "https://www.nubank.com.br/",
            "https://accounts.google.com/signin",
            "https://www.itau.com.br",
            "https://www.caixa.gov.br/voce/",
            "https://www.gov.br/receitafederal/pt-br",
            "https://pt.wikipedia.org/wiki/Brasil",
            "https://www.amazon.com.br/dp/B0",
            "https://www.mercadolivre.com.br/",
            "https://www.amazonas.am.gov.br",
            "https://pineapple.com",
            "https://itauna.mg.gov.br",
            "https://caixadeferramentas.com.br"
        ).forEach { url ->
            val r = a.analyze(url)
            assertTrue("$url deu ${r.level} ${r.findings}", r.level == RiskLevel.NONE_FOUND || r.level == RiskLevel.ATTENTION)
            assertNull("$url marcou marca ${r.impersonatedBrand}", r.impersonatedBrand)
        }
    }

    @Test fun brandImpersonation() {
        val r = a.analyze("https://nubank-seguranca-atualizar.xyz/login")
        assertEquals("Nubank", r.impersonatedBrand)
        assertTrue(r.level == RiskLevel.DANGEROUS || r.level == RiskLevel.SUSPICIOUS)
        assertEquals("Itaú", a.analyze("http://itau.conta-segura.top/").impersonatedBrand)
        assertEquals("Nubank", a.analyze("https://nubamk.com.br").impersonatedBrand)
        assertEquals("Mercado Livre", a.analyze("mercadolivre-ofertas.shop/pix").impersonatedBrand)
    }

    @Test fun fakeGovBr() {
        val r = a.analyze("https://gov.br.regularizar-cpf.com/")
        assertTrue(r.findings.any { it.title.contains("governo") })
        assertTrue(r.score >= 35)
    }

    @Test fun ipAtAndPunycode() {
        assertEquals(RiskLevel.DANGEROUS, level("http://bradesco.com.br@185.22.33.10/login"))
        assertTrue(a.analyze("https://xn--pple-43d.com").findings.any { it.title.contains("imitam") })
        assertTrue(a.analyze("http://192.168.1.50:8080/admin").findings.any { it.title.contains("IP") })
    }

    @Test fun apkDownloadAndShortener() {
        val r = a.analyze("https://bit.ly/3abcde")
        assertTrue(r.isShortener)
        assertTrue(a.analyze("https://cdn.exemplo.com/whatsapp-gold.apk").findings.any { it.title.contains("executável") })
    }

    @Test fun javascriptScheme() {
        assertEquals(RiskLevel.DANGEROUS, level("javascript:alert(1)"))
    }

    @Test fun iocDomain() {
        assertTrue(a.analyze("https://my.thetruthspy.com/login").findings.any { it.title.contains("indicadores") })
    }

    @Test fun extractFromSharedText() {
        assertEquals("https://bit.ly/x1", PhishingAnalyzer.extractUrl("Olá! Seu pacote foi taxado, pague em https://bit.ly/x1."))
        assertEquals("www.exemplo.com/a", PhishingAnalyzer.extractUrl("veja www.exemplo.com/a"))
        assertNull(PhishingAnalyzer.extractUrl("sem link aqui"))
        assertEquals(RiskLevel.INVALID, level("sem link aqui"))
    }

    @Test fun freeHosting() {
        val r = a.analyze("https://banco-login.netlify.app")
        assertNotNull(r.findings.firstOrNull { it.title.contains("gratuito") })
    }
}
