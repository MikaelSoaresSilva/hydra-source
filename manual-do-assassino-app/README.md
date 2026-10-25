# Manual do Assassino (app Android)

App offline que mostra o livro *Manual do Assassino*, com sumário, progresso das tarefas salvo no celular, tema claro/escuro e ajuste do tamanho da letra.

- `livro.md`: o texto do livro. Edite aqui para mudar o conteúdo.
- `build_html.py`: transforma o livro na página do app (`android/assets/index.html`).
- `make_icon.py`: desenha os ícones.
- `android/`: código Android (uma tela com WebView, sem internet).
- `build.sh`: gera e assina `ManualDoAssassino.apk`.

## Gerar o APK

Precisa de Python 3 com `markdown` e `Pillow`, JDK 17+ e Android SDK com `platforms;android-35` e `build-tools;35.0.0`.

```
ANDROID_SDK=/caminho/do/sdk ./build.sh
```

A chave de assinatura (`assinatura.jks`) fica fora do git. Use sempre a mesma chave para que as atualizações instalem por cima sem apagar o progresso.
