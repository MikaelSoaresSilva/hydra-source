# Política de privacidade

(Mesmo texto exibido dentro do app, em Ajustes › Política de privacidade.)

```
POLÍTICA DE PRIVACIDADE — NEXUS GUARD
Versão 1.0 • novembro de 2026

1. Resumo
O NEXUS GUARD funciona no seu aparelho. Não há contas, anúncios, rastreadores, SDKs de análise ou servidores próprios. Nós não vendemos, não compartilhamos e não recebemos seus dados.

2. Dados tratados no aparelho
• Configurações de segurança do sistema (versão do Android, patch, bloqueio de tela, depuração etc.).
• Lista de apps instalados, suas permissões, origem e certificados (para a análise de risco).
• Informações da conexão (tipo, sinal, banda, DNS, portal cativo) e resultados de medições.
• Links e arquivos que VOCÊ escolher analisar. Arquivos são lidos apenas para calcular hash e inspecionar a estrutura; uma cópia temporária de APK/ZIP é apagada ao fim da análise.
Tudo é salvo em banco de dados local criptografado (SQLCipher/AES-256, chave protegida pelo Android Keystore), excluído do backup na nuvem. Você pode apagar tudo em Ajustes.

3. Conexões de rede realizadas
• Teste de velocidade: servidores da Cloudflare (speed.cloudflare.com), que recebem seu IP como qualquer site.
• Latência e estabilidade: pequenas conexões a 1.1.1.1, 8.8.8.8 e 9.9.9.9.
• Diagnóstico DNS: consultas de nomes populares e aleatórios a resolvedores públicos (Cloudflare, Google, Quad9, AdGuard, OpenDNS) e ao DNS da sua rede.
• Portal cativo: connectivitycheck.gstatic.com (mesmo endpoint usado pelo Android).
• "Expandir link" (quando você toca): pedido HEAD ao link para ler o redirecionamento.
Nenhuma dessas conexões envia dados pessoais.

4. Serviços opcionais (desligados por padrão, exigem sua chave)
• Google Safe Browsing: recebe o link que você pediu para consultar.
• VirusTotal: recebe somente o hash SHA-256 do arquivo.
• Google Gemini (NEXUS AI online): recebe um resumo técnico das medições (sem nome da rede, sem lista de apps, sem identificadores) e sua pergunta.
Cada serviço tem sua própria política de privacidade. Chaves ficam criptografadas no aparelho.

5. O que o app NÃO faz
Não lê mensagens, chamadas, contatos, senhas, fotos ou histórico de navegação; não coleta localização (a permissão opcional só existe porque o Android a exige para revelar o nome do Wi-Fi); não usa root nem acessibilidade; não executa arquivos; não possui funções ocultas.

6. Seus direitos (LGPD)
Como os dados ficam apenas no seu aparelho, você tem controle total: pode exportá-los (Ajustes › Exportar) e apagá-los a qualquer momento (Ajustes › Apagar tudo) ou desinstalando o app.

7. Limitações
Nenhum aplicativo garante proteção absoluta. As análises indicam riscos com base em sinais verificáveis e podem não detectar ameaças desconhecidas.

8. Contato
Dúvidas: responsável pelo projeto (Mikael) — informe um e-mail de contato antes de publicar na Play Store.
```
