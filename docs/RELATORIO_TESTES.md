# Relatório de testes — NEXUS GUARD 1.0.0

Ambiente: GitHub Actions (Ubuntu), JDK 17, Gradle 8.11.1, Android Gradle Plugin 8.7.3, Kotlin 2.1.0.
Rodada final: execução 42143647816 (commit eecc700) — 24/24 testes instrumentados e 23/23 unitários aprovados.
Emulador: **Android 14 (API 34)**, google_apis, x86_64, perfil Pixel 6 (1080×2400, 420 dpi), rede real do servidor do GitHub.
Logs completos, relatórios HTML/XML e capturas de tela: branch `nexus-ci-logs` do repositório.

## Resumo

| Etapa | Resultado |
|---|---|
| 1. Compilação (debug + APK de testes) | ✅ sem erros |
| 2. Correção de erros de compilação | ✅ (1 erro de sintaxe na 1ª rodada: comentário aninhado `META-INF/*`) |
| 3. Testes unitários (JVM) | ✅ **23/23** (LogicTest 11, PhishingAnalyzerTest 12) |
| 4. Testes das funções principais no emulador | ✅ **18/18** (CoreFeaturesTest) |
| 4b. Testes de interface ponta a ponta | ✅ **6/6** (UiFlowTest, 35 capturas) |
| Versão de lançamento com R8 (minificação) | ✅ compila (sem assinatura — chave do proprietário) |
| 5. Permissões | ✅ fluxo com permissões opcionais negadas e notificação concedida |
| 6. Troca Wi-Fi ↔ dados móveis | ✅ detectada (WIFI → CELLULAR "3G/T-Mobile" do emulador → WIFI) |
| 7. Queda e retorno da internet | ✅ queda detectada pelo monitor e pelo Modo Estabilidade (1 queda de ~6 s), retorno confirmado |
| 8. Resultados de conexão validados | ✅ valores coerentes (ver abaixo) |
| 9. Armazenamento seguro | ✅ banco não começa com `SQLite format 3` (cifrado); Keystore AES-GCM ida e volta |
| 10. Consumo de bateria | 🟡 não mensurável no emulador (ver abaixo) |
| 11. Tamanhos de tela | ✅ 360×640 dp, 411×914 dp e 514×1143 dp sem quebras de layout |

## Medições reais registradas no emulador (rodada final)

| Teste | Resultado |
|---|---|
| Keystore | criptografa/descriptografa corretamente |
| Banco cifrado | cabeçalho do arquivo aleatório (ex.: `bf a6 5e 53 44 e4 1d 0e`) |
| Base de stalkerware | 149 famílias, 628 domínios carregados |
| Verificação do aparelho | nota 61; detectou corretamente: patch de 2023 (FAIL), sem bloqueio de tela (FAIL), depuração USB ligada (FAIL — o emulador tem ADB ativo), criptografia OK, sem sinais de root |
| Análise de apps | 224 apps (com sistema), 224 certificados lidos |
| Análise do próprio APK | detectou APK, pacote correto, mesma assinatura do instalado, certificado de depuração |
| Arquivo disfarçado (`foto.jpg` com conteúdo EXE) | "Perigoso" (70) — "Tipo real não corresponde ao nome" |
| Phishing (`nubank-seguranca.xyz`) | "Provavelmente perigoso", marca Nubank identificada |
| Conexão | Wi-Fi validado, rede **aberta** (o Wi-Fi virtual do emulador não tem senha → classificada corretamente como insegura), 2,4 GHz canal 6, −50 dBm |
| Latência | ICMP bloqueado no emulador → fallback TCP automático: 8/8 respostas, mediana ≈ 11–13 ms |
| DNS | 7 resolvedores com 100% de sucesso (DNS da rede 10–19 ms; públicos 18–36 ms) |
| Portal cativo | "ok" (HTTP 204) |
| Velocidade (modo Leve, Cloudflare) | download ≈ 93–158 Mbps, upload ≈ 63–107 Mbps, ping ≈ 48–49 ms, sob carga ≈ 92–301 ms; dados usados ≈ 35 MB (dentro do limite de 36 MB) |
| Otimizador | nota 95–99 "Excelente"; problemas detectados: enlace Wi-Fi baixo (o emulador informa 1–2 Mbps), rede aberta, 2,4 GHz |
| Modo Estabilidade | serviço inicia/para; 4 verificações em 8 s, 0 falhas |

Os números variam entre rodadas porque são medições reais de rede.

## Bugs encontrados pelos testes e corrigidos

1. Comentário `/** … META-INF/*.RSA … */` abria comentário aninhado (erro de compilação).
2. Arquivos abertos via `file://` perdiam o nome → a detecção de disfarce pela extensão não funcionava nesse caso.
3. Latência ficava "sem respostas" em redes que bloqueiam ICMP → agora cai automaticamente para TCP e informa o método.
4. Nota da conexão ignorava problemas detectados (dava 100 com enlace de 2 Mbps) → problemas agora descontam.
5. Tela DNS recomendava um DNS público mesmo quando o DNS atual era mais rápido → agora informa que o atual já é o melhor.
6. Textos cortados em telas pequenas (aba "Segurança", botão "VERIFICAR", blocos "não disponível").

## Consumo de bateria e memória

- O emulador roda "na tomada" e o `dumpsys batterystats` não estima consumo para o app (0 mAh). **Não foi possível medir
  bateria de forma confiável sem um aparelho físico.**
- Medidas de projeto para economizar bateria: nenhum serviço permanente; verificação periódica só a cada 12 h com bateria não baixa
  (WorkManager); Modo Estabilidade só quando o usuário liga, com intervalo configurável (5/10/30 s), sem wakelock;
  cada verificação é uma conexão TCP de ~200 bytes; tema Preto AMOLED disponível.

## O que NÃO foi testado

- Aparelho físico (POCO X5 Pro / HyperOS), rede 5G real, tipos de segurança WPA2/WPA3 reais.
- Seletor de arquivos do sistema pela interface (a análise de arquivos foi testada chamando o mesmo código com arquivos reais).
- Consultas online com chaves de API (Gemini, Safe Browsing, VirusTotal) — nenhuma chave disponível.
- Bloqueio biométrico (o emulador não tem biometria cadastrada).
