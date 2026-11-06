# Limitações reais do NEXUS GUARD

Este documento existe para que ninguém espere do app algo que o Android (ou a física) não permite.

## Segurança

| Limitação | Por quê | O que o app faz no lugar |
|---|---|---|
| Não é um antivírus com base de assinaturas de malware | Uma base atualizada de milhões de amostras exige infraestrutura de servidor e licenciamento | Heurísticas locais + base pública de stalkerware (Echap) + consulta opcional ao VirusTotal pelo hash |
| Não lê arquivos privados nem a memória de outros apps | Isolamento de apps (sandbox) do Android. Contornar isso seria um ataque | Analisa o que o Android expõe: permissões, origem, assinatura, serviços declarados |
| Detecção de root é heurística | Ferramentas modernas (Magisk/KernelSU com ocultação) escondem-se de apps comuns | Mostra "indícios", nunca "certeza" |
| Estado do Play Protect não verificável | Não há API pública | Item "Não verificável" + instrução para conferir na Play Store |
| Estado do bootloader nem sempre disponível | Depende do fabricante expor `ro.boot.verifiedbootstate` | Item "Não verificável" quando ausente |
| Play Integrity API não implementada | Exige projeto no Google Cloud, app publicado na Play e um servidor próprio para validar o veredito (validar no aparelho é inseguro) | Verificações locais equivalentes (patch, bootloader, root, depuração) |
| Phishing: proteção só para links que você compartilha/cola | Interceptar a navegação exigiria VPN ou acessibilidade — o projeto proíbe acessibilidade e a VPN não foi implementada | Análise local instantânea + "Expandir link" + Safe Browsing opcional |
| Não detecta ataques ativos na rede Wi-Fi (ARP spoofing, Evil Twin com mesma senha) | Exige acesso de baixo nível à rede (root/modo monitor) | Avalia criptografia, portal cativo, proxy, DNS privado, VPN e orienta |
| Alertas em segundo plano para Wi-Fi inseguro não são instantâneos | O Android limita apps em segundo plano; um serviço permanente gastaria bateria | Verificação periódica (12 h via WorkManager), alerta ao abrir o app e durante o Modo Estabilidade |

## Internet

| Limitação | Por quê |
|---|---|
| O app **não altera** DNS, banda Wi-Fi, canal ou modo 4G/5G sozinho | O Android não permite que apps comuns mudem essas configurações. O app mede, recomenda e abre a tela oficial certa |
| Trocar DNS **não aumenta** a velocidade de download nem reduz o ping de jogos | DNS só afeta o tempo para descobrir o endereço de um site |
| O teste de velocidade mede até os servidores da Cloudflare | Outros serviços (YouTube, jogos) podem ter rota e desempenho diferentes |
| Perda de pacotes por ICMP pode não estar disponível | Algumas redes, operadoras e emuladores bloqueiam ping (ICMP). O app passa a medir por TCP e indica o método ("ICMP" ou "TCP") |
| Análise de canais congestionados é orientativa | Desde o Android 9, apps só podem varrer redes Wi-Fi poucas vezes por minuto e precisam de localização |
| Nome da rede Wi-Fi requer localização | Regra do Android; a permissão é opcional |
| Tecnologia exata 5G SA/NSA requer a permissão "Telefone" | Sem ela, o app infere pelo tipo de sinal |
| Modo Estabilidade pode ser espaçado com a tela desligada | Doze/otimização de bateria (e no HyperOS, a economia de bateria do fabricante) |
| Velocidade de enlace e "estimativa do sistema" não são medições de internet | São valores informados pelo rádio/sistema; o app rotula assim |

## NEXUS AI

- O modo padrão é um **motor de regras local** (não é um modelo de linguagem). Ele só responde com base nas medições salvas
  e nos temas que conhece (lentidão, estabilidade, ping, download, DNS, Wi-Fi, apps, links, segurança).
- O modo online (Google Gemini) é opcional, exige chave do usuário, conexão com a internet e está sujeito aos limites gratuitos
  e à política de privacidade do Google. **Não foi testado com uma chave real** neste ambiente (não há chave disponível);
  o código trata erros e cai para o modo local.

## VPN

Não implementada. A especificação permite VPN apenas se for real, transparente e criptografada; fazer uma VPN de verdade
exige servidores próprios (custo mensal) ou integração com um provedor. Uma "VPN" sem servidor seria enganosa — por isso ficou de fora.

## Testes

- Testes automáticos rodaram em **emulador Android 14 (API 34)** com rede real do servidor do GitHub (ver `RELATORIO_TESTES.md`).
- **Não houve teste no POCO X5 Pro físico** neste ambiente. Recursos que dependem do hardware real (sinal 5G, RSRP/RSRQ,
  tipo de segurança da sua rede, HyperOS matando o serviço) precisam ser conferidos no aparelho.
- Consumo de bateria foi avaliado indiretamente (`dumpsys batterystats` no emulador e desenho do código), não com medição física.

## Assinatura

O APK entregue é de **depuração** (assinado com a chave de depuração do servidor de build). A versão de lançamento assinada
precisa da sua chave — instruções em `COMPILACAO.md`. Nenhuma assinatura ou certificado foi inventado.
