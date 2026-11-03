# ASCEND FACE AI

Aplicativo Android nativo (Kotlin + Jetpack Compose) de análise facial, apresentação pessoal e evolução visual.
A visão computacional roda **no próprio celular** com MediaPipe — sem internet e sem enviar fotos.

## Instalar o APK

1. Baixe `AscendFaceAI-debug.apk` na página de releases (`ascend-latest`) do repositório.
2. No Android, abra o arquivo. Se pedir, permita **"Instalar apps desconhecidos"** para o navegador/gerenciador de arquivos.
3. Abra o **Ascend Face AI**, siga o onboarding, aceite o consentimento e faça a primeira análise.

Requisitos: Android 8.0 (API 26) ou superior; testado no emulador Android 14 (API 34).

## Estrutura

```
app/src/main/java/com/ascend/faceai/
  analysis/   Motor de análise em Kotlin puro (testável): geometria, pixels, qualidade, notas, plano, motor local
  data/       MediaPipe (FaceEngine), Room, DataStore, cofre de fotos AES-GCM, backend de IA, Supabase, PDF
  ui/         Tema, componentes (anel de nota, radar, gráfico, mapa facial) e telas
app/src/test/         Testes unitários (JVM)
app/src/androidTest/  Testes no emulador: visão computacional real, armazenamento, PDF, exclusão e jornada completa de UI
backend/              Supabase Edge Function (chat, simulador, exclusão de conta) + SQL + testes
docs/CONFIGURACAO.md  Como configurar IA, simulador, nuvem e versão assinada
.github/workflows/    Build, testes e publicação automática do APK
```

## Compilar

O CI (`.github/workflows/ascend-build.yml`) baixa os modelos do MediaPipe, compila, roda os testes unitários,
os testes do backend, os testes no emulador Android 14 e publica o APK. Para compilar localmente veja
`docs/CONFIGURACAO.md` (seção 4).

## Metodologia

Explicada dentro do app (Ajustes → Metodologia) e no código de `analysis/FaceAnalyzer.kt`.
Resumo: cada métrica é comparada a uma referência com tolerância, `nota = 100·exp(−½·((valor−ref)/tol)²)`;
categorias e nota geral são médias ponderadas. Notas são estimativas visuais, não verdades sobre beleza,
e o app não recomenda cirurgias, hormônios ou medicamentos.
