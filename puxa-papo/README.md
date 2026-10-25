# Puxa Papo

App Android de sugestões de conversa (WebView + IA Gemini/Claude). Todo o app fica em `app/index.html`.

## v1.5 — áudio
- **🎧 Áudios dela**: escolher mensagens de voz (opus/ogg do WhatsApp, mp3, m4a, wav, aac) ou compartilhar o áudio direto do WhatsApp pro Puxa Papo.
- **🎤 Gravar áudio**: grava pelo microfone (pra explicar a situação falando). Cada áudio pode ser marcado como "Áudio dela", "Áudio meu" ou "Eu explicando".
- A IA ouve os áudios, transcreve, repara no tom de voz e responde cada áudio dela (uma por uma).
- Objetivo novo: *Responder por áudio* (roteiro curto pra você gravar).
- Áudio usa o Google Gemini (o Claude não ouve áudio). Limite ~12 MB por áudio.
- A parte Android agora é compilada do código-fonte (`android/`), com a permissão de microfone.

## v1.4 — com o Manual do Assassino
- A IA recebe um resumo do livro *Manual do Assassino* (Cialdini, Chris Voss, Carnegie, Kahneman, Heath, Greene filtrado, Cabane, Aron, Aronson, Fiske, Ekman) adaptado pra conversa por texto, mais a parte de emoções do *Código do Viking*.
- Cada sugestão mostra a técnica usada (ex: "📚 Espelhamento · Chris Voss"), o resultado traz uma "📚 Lição do Manual" e um "🛡️ Sinal de alerta" se ela usar alguma tática de manipulação (Cap. 6 do livro).
- Objetivos novos: *Ela tá chateada*, *Consertar mancada*, *Ela disse não*. Refinar: *usando mais o Manual*.
- Segue a regra do próprio livro: persuasão honesta, táticas sujas só como defesa. Dá pra desligar em Ajustes.

## v1.3
- **Servidor lotado (503) resolvido sozinho**: tenta de novo, troca para outro modelo livre (até 6) e, se houver chave do Claude também, passa pra ele. Lembra por 30 min qual funcionou.
- Mostra "Servidor lotado, tentando outro..." durante a troca; 429 pula direto; chave errada para na hora.
- Ajustes: **🔎 Procurar o melhor servidor** (testa vários e escolhe o mais rápido) e opção de desligar a troca automática.

## v1.2
- **Sobre mim** já vem preenchido com o que se sabe do Mikael (botão "Preencher automático" restaura).

## v1.1 (o que mudou)
- **📝 Descrição**: campo para descrever a situação ou colar/escrever a conversa (`Ela:` / `Eu:`). Funciona **sem print**. Também no Story ("Descrição do story") e na Música.
- **🙋 Sobre mim**: em *Meu estilo*, sua descrição pessoal, enviada à IA em toda análise.
- **Lê a conversa inteira**: até 10 prints, em ordem, sem duplicar mensagens repetidas entre prints.
- **📩 Respondendo uma por uma**: se ela mandou várias mensagens, uma resposta pronta (+ outra opção) para **cada** mensagem, na ordem, com Copiar / Enviar / Editar e "Copiar todas em ordem".
  Escolha: *Só as que eu ainda não respondi* (padrão) ou *Todas as mensagens dela*. Dá para desligar.
- No Story, vários stories = uma resposta para cada.

## Instalar
`dist/PuxaPapo-v1.5.apk` usa a mesma assinatura da v1.0, então instala **por cima** e mantém chave da IA, estilo e histórico.

## Reconstruir
```
./build.sh 6 1.5     # versionCode versionName
```
Compila `android/` (Java, manifesto, ícones) + `app/index.html`, alinha e assina. Baixa sozinho as build-tools 36, o android.jar (API 30) e a chave do uber-apk-signer.

## Testar
```
npm i playwright   # ou aponte PLAYWRIGHT para uma instalação existente
node tests/test.js .
```
Os testes simulam a resposta da IA (sem chave real).
