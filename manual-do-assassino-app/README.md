# Manual do Assassino (app Android)

App offline com uma biblioteca de livros (*Manual do Assassino* e *O Código do Viking*), com sumário, progresso das tarefas salvo no celular para cada livro, tema claro/escuro e ajuste do tamanho da letra.

- `livros/*.md`: o texto de cada livro. Edite aqui para mudar o conteúdo.
- `build_html.py`: transforma os livros na página do app (`android/assets/index.html`). Para adicionar um livro, coloque o `.md` em `livros/` e inclua-o na lista `BOOKS`.
- `make_icon.py`: desenha os ícones.
- `android/`: código Android (uma tela com WebView, sem internet).
- `build.sh`: gera e assina `ManualDoAssassino.apk`.

## Gerar o APK

Precisa de Python 3 com `markdown` e `Pillow`, JDK 17+ e Android SDK com `platforms;android-35` e `build-tools;35.0.0`.

```
ANDROID_SDK=/caminho/do/sdk ./build.sh
```

A chave de assinatura (`assinatura.jks`) fica fora do git. Use sempre a mesma chave para que as atualizações instalem por cima sem apagar o progresso.
