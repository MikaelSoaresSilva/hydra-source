# Permissões usadas e justificativas

Princípio do menor privilégio: o app pede apenas o necessário e funciona com as permissões opcionais negadas
(as informações dependentes delas aparecem como "não disponível").

| Permissão | Tipo | Para quê | Se negada |
|---|---|---|---|
| `INTERNET` | normal (automática) | Testes de velocidade, latência, DNS, portal cativo; consultas opcionais de reputação e NEXUS AI online | — |
| `ACCESS_NETWORK_STATE` | normal | Tipo de conexão, internet validada, portal cativo, VPN, DNS privado, proxy | — |
| `ACCESS_WIFI_STATE` | normal | Sinal (RSSI), banda, canal, velocidade de enlace, padrão e tipo de segurança do Wi-Fi conectado | — |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | perigosa, **opcional** | O Android só revela o **nome** da rede Wi-Fi (SSID) e, até o Android 11, o tipo de segurança a apps com localização. A localização não é usada nem salva | Nome da rede aparece como "oculto"; em Android 12+ a segurança continua visível |
| `READ_PHONE_STATE` | perigosa, **opcional** | Tecnologia exata da rede móvel (5G SA × 5G NSA × 4G+). Não lê chamadas, contatos nem número | Tecnologia é inferida pelo tipo de sinal |
| `POST_NOTIFICATIONS` | perigosa (Android 13+) | Alertas de Wi-Fi inseguro, quedas, apps/links/arquivos suspeitos e notificação do Modo Estabilidade | Alertas ficam só no histórico do app |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | normal | Modo Estabilidade com notificação fixa e botão "Encerrar", só enquanto o usuário quiser | — |
| `QUERY_ALL_PACKAGES` | normal (restrita na Play Store) | Função principal de segurança: analisar permissões, origem e assinatura dos apps e procurar apps de espionagem conhecidos | — |

## O que o app NÃO usa

- Root, serviço de acessibilidade, administrador do dispositivo, leitor de notificações.
- SMS, chamadas, contatos, câmera, microfone, armazenamento amplo (`MANAGE_EXTERNAL_STORAGE`).
- Arquivos: só os que o usuário escolhe pelo seletor oficial (Storage Access Framework).

## Observação para a Play Store

`QUERY_ALL_PACKAGES` exige declaração no Play Console. Apps de segurança/antimalware estão entre os usos permitidos;
é preciso explicar no formulário que a lista de apps é usada para avaliação de risco no próprio aparelho.
O tipo de serviço `specialUse` também exige justificativa no Play Console (texto já incluído no manifesto).
