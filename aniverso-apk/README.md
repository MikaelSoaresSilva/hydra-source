# AniVerso para Android (APK)

Esta pasta transforma o site da pasta `../aniverso` num aplicativo Android usando o
[Capacitor](https://capacitorjs.com). O app abre as telas do AniVerso dentro dele e busca os
dados na internet (AniList e MyDubList), igual ao site.

## Instalar o APK no celular

1. Copie o arquivo `AniVerso-1.0.apk` para o celular (ou baixe direto nele).
2. Toque no arquivo. Se aparecer "Instalação bloqueada", toque em **Configurações** e ative
   **Permitir desta fonte** para o app que você usou para abrir o arquivo (Arquivos, Chrome, Drive…).
3. Toque em **Instalar** e depois em **Abrir**.

O Android pode mostrar um aviso do Play Protect porque o app não veio da Play Store. Toque em
**Mais detalhes → Instalar mesmo assim**.

## Gerar o APK de novo (depois de mudar o site)

Precisa de: Node.js 22+, Java 21 e Android SDK (plataforma 36).

```bash
cd aniverso-apk
npm install
npm run apk
# resultado: android/app/build/outputs/apk/release/app-release.apk
```

Para o APK sair assinado, crie o arquivo `keystore.properties` nesta pasta (ele não vai para o git):

```properties
storeFile=keystore/aniverso-release.jks
storePassword=SUA_SENHA
keyAlias=aniverso
keyPassword=SUA_SENHA
```

Guarde o arquivo `.jks` e a senha em lugar seguro: atualizações do app precisam ser assinadas
com a mesma chave, senão o Android pede para desinstalar a versão antiga antes.

Ao lançar uma versão nova, aumente `versionCode` e `versionName` em `android/app/build.gradle`.

## Diferenças do app para o site

- O trailer abre no app do YouTube.
- Links de plataformas (Crunchyroll, Netflix…) abrem no app oficial, se estiver instalado, ou no navegador.
- O botão **voltar** do Android volta para a tela anterior.
