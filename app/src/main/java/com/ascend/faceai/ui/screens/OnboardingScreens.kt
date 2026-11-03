package com.ascend.faceai.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.ascend.faceai.LocalContainer
import com.ascend.faceai.data.AppSettings
import com.ascend.faceai.ui.components.Eyebrow
import com.ascend.faceai.ui.onMain
import com.ascend.faceai.ui.components.GlassCard
import com.ascend.faceai.ui.components.GlowOrb
import com.ascend.faceai.ui.components.PrimaryButton
import com.ascend.faceai.ui.components.SecondaryButton
import com.ascend.faceai.ui.components.TopBar
import com.ascend.faceai.ui.theme.Ac
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(settings: AppSettings?, onReady: (AppSettings) -> Unit) {
    LaunchedEffect(settings) { if (settings != null) { kotlinx.coroutines.delay(650); onReady(settings) } }
    Box(Modifier.fillMaxSize().background(Ac.Bg), contentAlignment = Alignment.Center) {
        GlowOrb(Modifier.size(260.dp))
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("ASCEND", style = MaterialTheme.typography.displaySmall, color = Ac.TextHi)
            Eyebrow("Face AI", Ac.Cyan)
        }
    }
}

private data class Page(val eyebrow: String, val title: String, val text: String)

private val pages = listOf(
    Page("Visão computacional local", "Seu rosto, medido de verdade.", "478 pontos faciais e segmentação de cabelo e pele calculados no próprio celular — sem enviar fotos para lugar nenhum."),
    Page("Métricas explicáveis", "Cada nota mostra o porquê.", "Proporções, simetria, pele, cabelo e barba com justificativa, referência usada, limitações e nível de confiança."),
    Page("Evolução", "Um plano que se adapta a você.", "Plano de 7, 30, 60 e 90 dias, histórico com gráficos reais e comparação entre datas. Foque no que você pode mudar.")
)

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val c = LocalContainer.current
    val scope = rememberCoroutineScope()
    var page by remember { mutableIntStateOf(0) }
    val finish = { scope.launch { c.settings.setOnboardingDone(); onMain(onDone) }; Unit }
    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding().navigationBarsPadding().padding(24.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = finish, modifier = Modifier.testTag("skip")) { Text("Pular", color = Ac.TextMid) }
        }
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { GlowOrb(Modifier.size(280.dp)) }
        AnimatedContent(page, label = "page") { p ->
            Column {
                Eyebrow(pages[p].eyebrow, Ac.Cyan)
                Spacer(Modifier.height(10.dp))
                Text(pages[p].title, style = MaterialTheme.typography.displaySmall, color = Ac.TextHi)
                Spacer(Modifier.height(12.dp))
                Text(pages[p].text, style = MaterialTheme.typography.bodyLarge, color = Ac.TextMid)
            }
        }
        Spacer(Modifier.height(24.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            pages.indices.forEach { i ->
                Box(Modifier.padding(end = 6.dp).height(4.dp).width(if (i == page) 28.dp else 10.dp).clip(RoundedCornerShape(2.dp))
                    .background(if (i == page) Ac.Blue else Ac.SurfaceHi))
            }
        }
        Spacer(Modifier.height(20.dp))
        PrimaryButton(if (page < pages.lastIndex) "Continuar" else "Começar", Modifier.fillMaxWidth().testTag("onboarding_next")) {
            if (page < pages.lastIndex) page++ else finish()
        }
    }
}

@Composable
fun ConsentScreen(onPrivacy: () -> Unit, onAccepted: () -> Unit) {
    val c = LocalContainer.current
    val scope = rememberCoroutineScope()
    var processing by remember { mutableStateOf(false) }
    var adult by remember { mutableStateOf(false) }
    var external by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(Ac.Bg).statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(22.dp)) {
        Eyebrow("LGPD · Dados biométricos", Ac.Cyan)
        Spacer(Modifier.height(8.dp))
        Text("Antes de começar", style = MaterialTheme.typography.headlineMedium, color = Ac.TextHi)
        Spacer(Modifier.height(10.dp))
        Text("Fotos do rosto são dados pessoais sensíveis. Veja exatamente o que o Ascend faz com elas:", style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid)
        Spacer(Modifier.height(16.dp))
        GlassCard(Modifier.fillMaxWidth()) {
            listOf(
                "A análise roda 100% no seu celular. Nenhuma foto é enviada sem você pedir.",
                "Guardamos apenas um recorte reduzido do rosto, criptografado (AES-256) com chave do Android Keystore. A foto original não é salva.",
                "Não criamos identificação biométrica, não fazemos reconhecimento de identidade e não vendemos dados.",
                "Você pode excluir fotos, relatórios ou tudo a qualquer momento em Ajustes.",
                "Resultados são estimativas visuais — não são diagnóstico médico nem verdade sobre beleza."
            ).forEach { Text("•  $it", style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi, modifier = Modifier.padding(vertical = 4.dp)) }
            TextButton(onClick = onPrivacy) { Text("Ler a política de privacidade completa", color = Ac.Blue) }
        }
        Spacer(Modifier.height(16.dp))
        CheckRow(processing, "Autorizo o processamento local das minhas fotos para análise facial (obrigatório).", "c_process") { processing = it }
        CheckRow(adult, "Confirmo que tenho 18 anos ou mais (obrigatório).", "c_adult") { adult = it }
        CheckRow(external, "Opcional: autorizo enviar meus relatórios (e fotos, só quando eu usar o simulador) a serviços externos de IA que eu configurar. Posso mudar depois.", "c_ext") { external = it }
        Spacer(Modifier.height(18.dp))
        PrimaryButton("Aceitar e continuar", Modifier.fillMaxWidth().testTag("consent_accept"), enabled = processing && adult) {
            scope.launch { c.settings.giveConsent(external); onMain(onAccepted) }
        }
    }
}

@Composable
fun CheckRow(checked: Boolean, text: String, tag: String, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { onChange(!checked) }.padding(vertical = 6.dp).testTag(tag), verticalAlignment = Alignment.Top) {
        Checkbox(checked, onChange, colors = CheckboxDefaults.colors(checkedColor = Ac.Blue, uncheckedColor = Ac.Metal))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Ac.TextHi, modifier = Modifier.padding(top = 12.dp))
    }
}

@Composable
fun AscendField(value: String, onChange: (String) -> Unit, label: String, password: Boolean = false, modifier: Modifier = Modifier, keyboard: KeyboardType = KeyboardType.Text) {
    OutlinedTextField(
        value, onChange, label = { Text(label) }, singleLine = true, modifier = modifier.fillMaxWidth(),
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Ac.Blue, unfocusedBorderColor = Ac.StrokeHi, focusedLabelColor = Ac.Blue, unfocusedLabelColor = Ac.TextLow,
            focusedTextColor = Ac.TextHi, unfocusedTextColor = Ac.TextHi, cursorColor = Ac.Blue
        )
    )
}

/** Login opcional (Supabase). Sem configuração de nuvem, o app segue em modo local. */
@Composable
fun LoginScreen(onDone: () -> Unit, onBack: (() -> Unit)?) {
    val c = LocalContainer.current
    val s by c.settings.flow.collectAsState(initial = AppSettings())
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var url by remember(s.supabaseUrl) { mutableStateOf(s.supabaseUrl) }
    var key by remember(s.supabaseAnonKey) { mutableStateOf(s.supabaseAnonKey) }
    var msg by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding().verticalScroll(rememberScrollState())) {
        TopBar("Conta (opcional)", onBack)
        Column(Modifier.padding(horizontal = 20.dp)) {
            Text("Use o app sem conta: tudo funciona offline e fica só neste aparelho. Crie uma conta apenas se quiser sincronizar seus relatórios entre aparelhos.",
                style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid)
            Spacer(Modifier.height(16.dp))
            if (s.loggedIn) {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("Conectado como ${s.userEmail}", style = MaterialTheme.typography.titleMedium, color = Ac.Good)
                    Spacer(Modifier.height(10.dp))
                    SecondaryButton("Sair da conta", Modifier.fillMaxWidth()) { scope.launch { c.settings.clearSession(); msg = "Você saiu da conta." } }
                }
            } else {
                GlassCard(Modifier.fillMaxWidth()) {
                    Eyebrow("1 · Servidor de sincronização (Supabase)")
                    Spacer(Modifier.height(8.dp))
                    if (!s.cloudConfigured) Text("Sincronização ainda não configurada. Informe a URL e a chave pública (anon) do seu projeto Supabase — instruções no arquivo docs/CONFIGURACAO.md.",
                        style = MaterialTheme.typography.bodySmall, color = Ac.Warn)
                    Spacer(Modifier.height(8.dp))
                    AscendField(url, { url = it }, "URL do projeto (https://xxxx.supabase.co)", keyboard = KeyboardType.Uri)
                    Spacer(Modifier.height(8.dp))
                    AscendField(key, { key = it }, "Chave pública anon")
                    Spacer(Modifier.height(10.dp))
                    SecondaryButton("Salvar servidor", Modifier.fillMaxWidth()) { scope.launch { c.settings.setSupabase(url, key); msg = "Servidor salvo." } }
                }
                Spacer(Modifier.height(12.dp))
                GlassCard(Modifier.fillMaxWidth()) {
                    Eyebrow("2 · Entrar ou criar conta")
                    Spacer(Modifier.height(8.dp))
                    AscendField(email, { email = it }, "E-mail", keyboard = KeyboardType.Email)
                    Spacer(Modifier.height(8.dp))
                    AscendField(pass, { pass = it }, "Senha (mín. 6 caracteres)", password = true)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PrimaryButton(if (busy) "Aguarde…" else "Entrar", Modifier.weight(1f), enabled = s.cloudConfigured && !busy && email.isNotBlank() && pass.length >= 6) {
                            scope.launch { busy = true; msg = runCatching { c.cloud.signIn(email, pass, false); "Login feito." }.getOrElse { it.message }; busy = false }
                        }
                        SecondaryButton("Criar conta", Modifier.weight(1f), enabled = s.cloudConfigured && !busy && email.isNotBlank() && pass.length >= 6) {
                            scope.launch { busy = true; msg = runCatching { c.cloud.signIn(email, pass, true); "Conta criada e conectada." }.getOrElse { it.message }; busy = false }
                        }
                    }
                }
            }
            msg?.let { Spacer(Modifier.height(10.dp)); Text(it, style = MaterialTheme.typography.bodyMedium, color = Ac.Cyan) }
            Spacer(Modifier.height(16.dp))
            PrimaryButton(if (onBack == null) "Continuar sem conta (modo local)" else "Concluir", Modifier.fillMaxWidth().testTag("login_skip")) {
                scope.launch { c.settings.setLoginSkipped(true); onMain(onDone) }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun TextScreen(title: String, onBack: () -> Unit, sections: List<Pair<String, String>>) {
    Column(Modifier.fillMaxSize().background(Ac.Bg).navigationBarsPadding()) {
        TopBar(title, onBack)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            sections.forEach { (h, t) ->
                Text(h, style = MaterialTheme.typography.titleLarge, color = Ac.TextHi, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                Text(t, style = MaterialTheme.typography.bodyMedium, color = Ac.TextMid)
            }
            Spacer(Modifier.height(30.dp))
        }
    }
}

@Composable
fun PrivacyScreen(onBack: () -> Unit) = TextScreen("Política de privacidade", onBack, listOf(
    "Quem somos" to "Ascend Face AI é um aplicativo de análise visual da apresentação facial. Esta política segue a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).",
    "Quais dados tratamos" to "Fotos do rosto que você captura ou escolhe; medidas derivadas (proporções, indicadores de pele, cabelo e barba); relatórios; marcações do plano; mensagens do assistente; e, se você criar conta, e-mail e identificador de usuário.",
    "Base legal" to "Consentimento específico e destacado (art. 11, I, da LGPD), pedido antes do primeiro uso. Você pode revogá-lo em Ajustes a qualquer momento.",
    "Onde os dados ficam" to "Por padrão, somente no seu aparelho. Fotos são guardadas como recortes reduzidos do rosto, criptografados com AES-256-GCM e chave protegida pelo Android Keystore. O backup automático do Android está desativado para os dados do app.",
    "Envio a terceiros" to "Nada é enviado sem ação sua. Se você configurar e autorizar a IA externa: no assistente enviamos apenas os relatórios em texto (sem fotos); no simulador enviamos a foto escolhida para gerar a imagem. A sincronização em nuvem (opcional) envia apenas relatórios em texto para o servidor Supabase que você configurar. Todo tráfego usa HTTPS.",
    "O que NÃO fazemos" to "Não vendemos dados. Não fazemos identificação biométrica nem reconhecimento de identidade. Não treinamos modelos com suas fotos. Não exibimos publicidade.",
    "Retenção e exclusão" to "Os dados ficam até você apagá-los. Em Ajustes você pode excluir só as fotos, todas as análises, ou a conta e todos os dados (inclusive na nuvem, quando configurada).",
    "Seus direitos" to "Acesso, correção, portabilidade (exportação em PDF), anonimização, revogação do consentimento e eliminação, conforme o art. 18 da LGPD.",
    "Menores de idade" to "O app é destinado a maiores de 18 anos.",
    "Limitações" to "As análises são estimativas automáticas e não substituem avaliação médica, dermatológica, odontológica ou psicológica. Se a sua aparência causa sofrimento significativo, procure apoio profissional."
))

@Composable
fun MethodologyScreen(onBack: () -> Unit) = TextScreen("Metodologia", onBack, listOf(
    "Detecção" to "MediaPipe Face Landmarker localiza 478 pontos 3D do rosto, 52 coeficientes de expressão e a pose da cabeça. MediaPipe Image Segmenter (multiclasse) separa cabelo, pele do rosto, pele do corpo, roupa, acessórios e fundo. Tudo roda no aparelho.",
    "Qualidade da foto" to "Antes da análise medimos: número de rostos, brilho médio, equilíbrio de luz entre os lados, nitidez (variância do Laplaciano), rotação/inclinação da cabeça, tamanho e centralização do rosto, olhos abertos e obstruções. A qualidade reduz a confiança das notas.",
    "Como uma nota é calculada" to "Cada métrica pontuável é comparada a uma referência com uma tolerância: nota = 100 × exp(−½ × ((valor − referência) ÷ tolerância)²). Exatamente na referência = 100; a uma tolerância de distância ≈ 61; a duas ≈ 14. A nota da categoria é a média ponderada das suas métricas; a nota geral é a média ponderada das categorias disponíveis.",
    "Referências" to "As referências de proporção foram calibradas no rosto médio canônico do próprio MediaPipe (o mesmo sistema de pontos usado na medição), que corresponde às proporções clássicas como a regra dos quintos e dos terços. Em alguns itens usamos convenções estéticas leves (ex.: cantos dos olhos levemente para cima, mandíbula pouco acima da média). São referências estatísticas — não verdades sobre beleza — e variam entre etnias, idades e culturas.",
    "Pele" to "Indicadores aproximados em espaço de cor CIE L*a*b*: área avermelhada, pontos avermelhados e escuros por contraste local, microcontraste (textura/poros), uniformidade de tom após remover o gradiente de iluminação, reflexos especulares (brilho) e luminosidade abaixo dos olhos. Não é diagnóstico.",
    "Cabelo e barba" to "A partir da segmentação: volume no topo, volume lateral, equilíbrio entre os lados, cobertura da testa e comprimento estimado; barba por cobertura de pelos/escurecimento relativo na parte inferior do rosto. Referências de volume variam com o formato do rosto.",
    "Potencial de evolução" to "Soma ponderada da distância até 100 nas categorias modificáveis, multiplicada pelo quanto cada uma costuma ser modificável (pele 60%, cabelo 70%, sobrancelhas 60%, barba 70%, pequenas parcelas em olhos, mandíbula e maçãs). É uma margem de oportunidade, não uma previsão.",
    "Confiança" to "Combina a qualidade da foto com a confiabilidade típica de cada tipo de medida (geometria > cabelo > pele > barba > perfil).",
    "O que a foto não consegue medir" to "Desenvolvimento ósseo, posição da maxila, mordida, volume real dos tecidos e diagnóstico de pele exigem avaliação profissional e exames. O perfil é estimado pela malha do MediaPipe e é aproximado."
))
