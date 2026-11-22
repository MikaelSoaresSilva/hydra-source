package com.aurea.fit.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aurea.fit.data.AuthResult
import com.aurea.fit.ui.AppViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun AureaLogo(size: androidx.compose.ui.unit.Dp, progress: Float = 1f, color: Color = Color(0xFFE9C49A), accent: Color = Color(0xFFF3A6C0)) {
    Canvas(Modifier.size(size)) {
        val w = this.size.width
        val path = Path().apply {
            moveTo(w * 0.31f, w * 0.70f)
            cubicTo(w * 0.35f, w * 0.48f, w * 0.43f, w * 0.30f, w * 0.5f, w * 0.30f)
            cubicTo(w * 0.57f, w * 0.30f, w * 0.65f, w * 0.48f, w * 0.69f, w * 0.70f)
        }
        val measure = androidx.compose.ui.graphics.PathMeasure().apply { setPath(path, false) }
        val seg = Path(); measure.getSegment(0f, measure.length * progress, seg, true)
        drawPath(seg, color, style = Stroke(w * 0.055f, cap = StrokeCap.Round))
        if (progress > 0.6f) drawLine(accent, Offset(w * 0.39f, w * 0.575f), Offset(w * 0.39f + w * 0.22f * ((progress - 0.6f) / 0.4f), w * 0.575f), w * 0.046f, cap = StrokeCap.Round)
        drawCircle(color, w * 0.037f * progress, Offset(w * 0.5f, w * 0.20f))
    }
}

/** 1. Tela de abertura (animação do logotipo). */
@Composable
fun SplashScreen(onDone: () -> Unit) {
    val p = remember { Animatable(0f) }
    LaunchedEffect(Unit) { p.animateTo(1f, tween(1100, easing = FastOutSlowInEasing)); delay(350); onDone() }
    Box(
        Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF3B1E2C), Color(0xFF7A2E4C)))),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            AureaLogo(160.dp, p.value)
            Text("Áurea", color = Color.White, style = MaterialTheme.typography.displaySmall, modifier = Modifier.alpha(p.value))
            Text("Treino • Nutrição • Evolução", color = Color(0xFFE9C49A), style = MaterialTheme.typography.labelLarge, modifier = Modifier.alpha(p.value))
        }
    }
}

/** 2. Cadastro e login (conta local, protegida por senha com hash PBKDF2). */
@Composable
fun AuthScreen(vm: AppViewModel, startRegister: Boolean, onLoggedIn: () -> Unit) {
    var register by remember { mutableStateOf(startRegister) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var pw by remember { mutableStateOf("") }
    var show by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val cs = MaterialTheme.colorScheme

    Column(
        Modifier.fillMaxSize().background(cs.background).verticalScroll(rememberScrollState()).imePadding()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(Modifier.size(110.dp).background(Brush.linearGradient(listOf(Color(0xFF3B1E2C), Color(0xFF7A2E4C))), MaterialTheme.shapes.extraLarge), contentAlignment = Alignment.Center) {
            AureaLogo(100.dp)
        }
        Spacer(Modifier.height(16.dp))
        Text("Áurea", style = MaterialTheme.typography.displaySmall, color = cs.primary)
        Text(
            "Seu treinador pessoal e guia de alimentação, para construir a melhor versão do seu corpo.",
            style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center, color = cs.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        Text(if (register) "Criar conta" else "Entrar", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(12.dp))
        if (register) {
            OutlinedTextField(name, { name = it }, label = { Text("Seu nome") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("name"))
            Spacer(Modifier.height(8.dp))
        }
        OutlinedTextField(
            email, { email = it }, label = { Text("E-mail") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().testTag("email")
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            pw, { pw = it }, label = { Text("Senha (mín. 6 caracteres)") }, singleLine = true,
            visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            trailingIcon = {
                IconButton(onClick = { show = !show }) { Icon(if (show) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (show) "Ocultar senha" else "Mostrar senha") }
            },
            modifier = Modifier.fillMaxWidth().testTag("password")
        )
        error?.let { Spacer(Modifier.height(8.dp)); Text(it, color = cs.error, style = MaterialTheme.typography.bodyMedium) }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                loading = true; error = null
                scope.launch {
                    val r = if (register) vm.register(name, email, pw) else vm.login(email, pw)
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        loading = false
                        when (r) { is AuthResult.Ok -> onLoggedIn(); is AuthResult.Error -> error = r.message }
                    }
                }
            },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth().height(52.dp).testTag("authSubmit")
        ) {
            if (loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = cs.onPrimary)
            else Text(if (register) "Criar minha conta" else "Entrar", fontSize = 16.sp)
        }
        TextButton(onClick = { register = !register; error = null }) {
            Text(if (register) "Já tenho conta neste celular — entrar" else "Ainda não tenho conta — criar")
        }
        Spacer(Modifier.height(8.dp))
        Text(
            "Seus dados ficam guardados somente neste celular. Nada é enviado para servidores sem sua autorização.",
            style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant, textAlign = TextAlign.Center
        )
    }
}
