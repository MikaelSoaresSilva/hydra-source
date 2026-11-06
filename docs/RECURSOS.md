# Recursos: implementados, parciais e não implementados

Legenda: ✅ implementado e funcional • 🟡 parcial (funciona com limites explicados) • ❌ não implementado

## Módulo A — Segurança

| Recurso | Estado | Observação |
|---|---|---|
| Painel geral com pontuação baseada em verificações reais | ✅ | 16 itens; itens não verificáveis ficam fora da nota |
| Versão do Android e idade do patch de segurança | ✅ | |
| Bloqueio de tela, criptografia, depuração USB/sem fio, opções do desenvolvedor | ✅ | |
| Sinais de root (heurística, sem afirmar certeza) | ✅ | Arquivos `su`, apps de root, test-keys, propriedades, montagens |
| Estado do bootloader (inicialização verificada) | 🟡 | Depende do fabricante expor a propriedade |
| Apps autorizados a instalar APKs, acessibilidade ativa, administradores, leitores de notificação | ✅ | |
| Base pública de stalkerware (149 famílias, pacotes + certificados) | ✅ | Offline, embutida |
| Recomendações + botão para a tela oficial de cada item | ✅ | |
| Histórico de verificações | ✅ | Banco local cifrado |
| Análise de apps: permissões concedidas, origem, assinatura, risco com justificativas | ✅ | Não afirma infecção |
| Abrir configurações do app | ✅ | |
| Análise de APK escolhido: pacote, versão, SDK, permissões, certificado, DEX, libs, código embutido | ✅ | |
| APK com assinatura diferente da versão instalada (app adulterado) | ✅ | |
| Arquivos: tipo real pelos bytes, extensão dupla, disfarce, RTL, macros, SHA-256 | ✅ | |
| Consulta de hash no VirusTotal | 🟡 | Link no navegador (sempre) e API opcional com chave do usuário |
| Phishing: análise local de links compartilhados/colados | ✅ | Marcas BR, typosquatting, punycode, IP, encurtadores, TLDs, hospedagem grátis, gov.br falso |
| Expandir link encurtado sem abrir a página | ✅ | |
| Reputação em fonte confiável (Google Safe Browsing) | 🟡 | Opcional, exige chave do usuário |
| Alerta antes de abrir link perigoso | ✅ | Diálogo de confirmação |
| Wi-Fi: rede aberta/fraca/WPA2/WPA3, portal cativo, proxy, DNS privado, VPN | ✅ | Tipo de segurança em Android 12+ (ou com localização em versões anteriores) |
| Notificações (Wi-Fi inseguro, links, arquivos, apps críticos, configurações, revisão periódica) | ✅ | Canais separados; respeitam ajustes |
| Verificação periódica em segundo plano | ✅ | WorkManager, 12 h, desligável |
| Diagnóstico de privacidade (permissões sensíveis por app) | ✅ | |
| Armazenamento local seguro | ✅ | SQLCipher AES-256 + Android Keystore; sem backup na nuvem |
| Bloqueio do app com biometria/PIN | ✅ | Android 9+ |
| Play Integrity API | ❌ | Requer servidor próprio + Google Cloud (ver LIMITACOES) |
| Proteção de navegação em tempo real (todos os links) | ❌ | Exigiria VPN/acessibilidade |

## Módulo B — Internet

| Recurso | Estado | Observação |
|---|---|---|
| Tipo de conexão, internet validada, portal cativo, tarifada, VPN em tempo real | ✅ | NetworkCallback |
| Sinal Wi-Fi (dBm/nível), banda, canal, enlace ↑↓, padrão Wi-Fi, gateway | ✅ | |
| Rede móvel: tecnologia, nível, RSRP/RSRQ/SINR, operadora, roaming | ✅ | Tecnologia exata com permissão opcional |
| Latência, jitter, perda de pacotes | ✅ | ICMP com fallback TCP (método indicado) |
| Tempo de resposta DNS e comparação de 6 resolvedores + DNS atual | ✅ | Consultas UDP reais, populares e não armazenadas |
| Recomendação de DNS privado + instruções + atalho | ✅ | Avisa que não aumenta download |
| Teste de velocidade (download, upload, ping, ping sob carga, jitter) | ✅ | Cloudflare; limites rígidos de dados; aviso em rede tarifada |
| Histórico e gráficos de desempenho; exportação CSV | ✅ | |
| Botão OTIMIZAR MINHA INTERNET (10 etapas, antes × depois) | ✅ | Ajustes aplicados pelo usuário nas telas oficiais (o Android não permite automático) |
| Diagnóstico por regras (sinal, banda, latência, jitter, perda, DNS, bufferbloat, quedas, proxy) | ✅ | |
| Modo Estabilidade (quedas, oscilações, trocas de rede, gráfico, notificação encerrável) | ✅ | |
| Orientação 2,4/5/6 GHz, canal, posicionamento do roteador | ✅ | |
| Análise de congestionamento de canais vizinhos | 🟡 | Orientativa (limites de varredura do Android) |
| Comparação entre redes diferentes | 🟡 | Pelo histórico (cada teste registra o tipo de conexão) |

## NEXUS AI

| Recurso | Estado | Observação |
|---|---|---|
| Modo local por regras com dados reais (7 perguntas do escopo + segurança, apps, links) | ✅ | Diz o que falta medir; não inventa |
| Modo online opcional (Google Gemini, chave do usuário) | 🟡 | Implementado; não testado com chave real |

## Interface e configurações

| Recurso | Estado |
|---|---|
| Tela inicial, abas Segurança / Internet / NEXUS AI / Ajustes | ✅ |
| Tema escuro e Preto AMOLED, animações, gráficos | ✅ |
| Privacidade, notificações, permissões explicadas, política de privacidade | ✅ |
| Exportação de relatório (.txt) e testes (.csv); apagar histórico; apagar tudo | ✅ |
| VPN | ❌ (ver LIMITACOES) |
