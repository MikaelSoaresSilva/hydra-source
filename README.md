# NEXUS GUARD

Central de **segurança** e **inteligência de conectividade** para Android — Kotlin, Jetpack Compose, Material 3, MVVM,
Coroutines/Flow, Room + SQLCipher, DataStore, WorkManager e Android Keystore. Sem root, sem acessibilidade, sem serviços ocultos.

Tudo o que o app mostra é medido no aparelho. O que não pode ser medido aparece como **"não disponível"**.

## Módulos

- **Segurança:** verificação do aparelho (16 itens com nota explicada), sinais de root, análise de apps (permissões, origem,
  assinatura, risco justificado), análise de APK/arquivos (tipo real, SHA-256, certificado, disfarces), proteção contra phishing
  (links compartilhados ou colados), diagnóstico de Wi-Fi, base pública de stalkerware, alertas e histórico cifrado.
- **Internet:** painel em tempo real (Wi-Fi e 4G/5G), latência/jitter/perda, comparação de DNS com recomendação de DNS privado,
  teste de velocidade (Cloudflare) com limite de dados, **OTIMIZAR MINHA INTERNET** (antes × depois), Modo Estabilidade.
- **NEXUS AI:** diagnóstico por regras sobre as medições reais (offline, gratuito) + modo online opcional com Gemini (sua chave).

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/INSTALACAO.md](docs/INSTALACAO.md) | Instalar o APK no celular (com dicas para Xiaomi/POCO) |
| [docs/COMPILACAO.md](docs/COMPILACAO.md) | Compilar, assinar a versão de lançamento, CI e atualizações futuras |
| [docs/RELATORIO_TESTES.md](docs/RELATORIO_TESTES.md) | Testes executados e resultados reais |
| [docs/RECURSOS.md](docs/RECURSOS.md) | Implementado / parcial / não implementado |
| [docs/PERMISSOES.md](docs/PERMISSOES.md) | Permissões e justificativas |
| [docs/POLITICA_DE_PRIVACIDADE.md](docs/POLITICA_DE_PRIVACIDADE.md) | Política de privacidade |
| [docs/LIMITACOES.md](docs/LIMITACOES.md) | Limitações reais do app |

## Créditos

Indicadores de stalkerware: [AssoEchap/stalkerware-indicators](https://github.com/AssoEchap/stalkerware-indicators) (CC-BY 4.0).
Teste de velocidade: infraestrutura pública da Cloudflare (speed.cloudflare.com).
