# Como instalar o NEXUS GUARD no celular

Testado no emulador Android 14 (API 34). Aparelho de referência: Xiaomi POCO X5 Pro 5G (HyperOS / Android 14).
Funciona do Android 8.0 (API 26) em diante.

## Passo a passo

1. Baixe o arquivo **NexusGuard-debug.apk** no celular.
2. Toque no arquivo (na notificação de download ou no app **Arquivos**).
3. Se aparecer *"Por segurança, seu telefone não tem permissão para instalar apps desta fonte"*:
   toque em **Configurações** → ative **Permitir desta fonte** → volte.
4. Toque em **Instalar**.
5. Se o Google Play Protect avisar *"App desconhecido"*, toque em **Mais detalhes → Instalar mesmo assim**.
   O aviso aparece porque o app não veio da Play Store (é normal para um APK de teste).
6. Na Xiaomi/POCO pode aparecer a tela de verificação da MIUI/HyperOS — toque em **Instalar** de novo.
7. Abra o **NEXUS GUARD**, leia a política, marque **Li e aceito** e toque em **COMEÇAR**.
   Permita as notificações para receber alertas (opcional).

Depois de instalar, desative de novo "Permitir desta fonte" no app que você usou para abrir o APK.

## Atualizar

Instale o APK novo por cima do antigo. Os dados são mantidos, desde que os dois APKs tenham a mesma assinatura
(APKs de depuração gerados pelo CI usam a chave de depuração do runner; se o Android disser
"o pacote está em conflito", desinstale a versão anterior e instale a nova).

## Dicas para Xiaomi / POCO (HyperOS)

- **Modo Estabilidade em segundo plano:** Configurações → Apps → NEXUS GUARD → Economia de bateria → **Sem restrições**.
  Sem isso, o HyperOS pode pausar o monitoramento com a tela desligada.
- **DNS privado:** Configurações → Conexão e compartilhamento → DNS privado.
- **Nome da rede Wi-Fi:** só aparece se você conceder a permissão de localização (opcional).
