# Compilação e atualizações futuras

## Requisitos

- JDK 17
- Android SDK com plataforma 35 (Android Studio Ladybug ou mais novo já instala)
- Gradle 8.11.1 (o wrapper `./gradlew` baixa sozinho)

## Compilar

```bash
git clone -b nexus-guard https://github.com/MikaelSoaresSilva/hydra-source.git nexus-guard
cd nexus-guard
./gradlew assembleDebug          # APK de depuração: app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest      # testes unitários (JVM)
./gradlew connectedDebugAndroidTest   # testes no aparelho/emulador conectado
```

No Android Studio: **File → Open** na pasta do projeto e clique em ▶ Run.

## Versão de lançamento assinada (Play Store)

A chave de assinatura é **sua** e nunca deve ir para o GitHub. Gere uma vez e guarde em local seguro
(perder a chave impede atualizar o app na Play Store):

```bash
keytool -genkey -v -keystore nexus-release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias nexus
cp keystore.properties.example keystore.properties   # edite caminho e senhas
./gradlew bundleRelease     # app/build/outputs/bundle/release/app-release.aab (Play Store)
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

O `build.gradle.kts` lê `keystore.properties` automaticamente. Sem esse arquivo, o build de release sai **sem assinatura**
(serve só para verificar a minificação).

## Integração contínua (GitHub Actions)

Cada `git push` no branch `nexus-guard` executa `.github/workflows/nexus-build.yml`:

1. Compila o APK de depuração, o APK de testes e roda os testes unitários.
2. Compila o release (verifica R8/minificação).
3. Sobe um emulador Android 14 (API 34) e roda os testes instrumentados (funções reais + telas + capturas).
4. Publica logs, relatórios e capturas no branch `nexus-ci-logs`.
5. Publica o APK na release `nexus-latest`.

## Estrutura do código

```
app/src/main/java/com/nexusguard/app/
├── NexusApp.kt / MainActivity.kt     inicialização, compartilhamento de links, bloqueio biométrico
├── core/        Keystore (AES-GCM), DataStore, notificações, atalhos para telas oficiais, injeção de dependências
├── data/        Room + SQLCipher (histórico, alertas, eventos de estabilidade), exportação
├── security/    verificação do aparelho, root, apps, APK/arquivos, phishing, Wi-Fi, reputação, worker periódico
├── network/     monitor de conexão, latência, DNS, velocidade, estabilidade, diagnóstico, otimizador
├── ai/          NEXUS AI (regras locais) e cliente Gemini opcional
└── ui/          tema, componentes, gráficos, ViewModels (MVVM) e telas Compose
```

## Atualizações futuras — roteiro sugerido

- **Base de indicadores:** `app/src/main/assets/stalkerware_ioc.json` vem de
  [AssoEchap/stalkerware-indicators](https://github.com/AssoEchap/stalkerware-indicators) (CC-BY 4.0).
  Para atualizar, rode o script do README de docs (conversão YAML → JSON) e recompile.
- **Marcas monitoradas no phishing:** lista `brands` em `security/PhishingAnalyzer.kt`.
- **Resolvedores DNS:** lista `resolvers` em `network/Measurements.kt`.
- **Nova versão:** aumente `versionCode` e `versionName` em `app/build.gradle.kts`.
- **Play Integrity:** exige projeto no Google Cloud e um servidor próprio para validar o veredito; ver `LIMITACOES.md`.

### Script de atualização da base de stalkerware

```bash
curl -sSfL -o ioc.yaml https://raw.githubusercontent.com/AssoEchap/stalkerware-indicators/master/ioc.yaml
python3 - <<'PY'
import yaml, json
d = yaml.safe_load(open('ioc.yaml'))
out = [{"n": e.get("name"), "p": e.get("packages") or [], "c": [c.upper() for c in (e.get("certificates") or [])], "w": e.get("websites") or []} for e in d]
json.dump({"source": "AssoEchap/stalkerware-indicators (CC-BY 4.0)", "entries": out}, open('app/src/main/assets/stalkerware_ioc.json', 'w'), separators=(',', ':'))
PY
```
