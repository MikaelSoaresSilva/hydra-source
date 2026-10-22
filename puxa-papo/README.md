# Puxa Papo

App Android de sugestões de conversa (WebView + IA Gemini/Claude). Todo o app fica em `app/index.html`.

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
`dist/PuxaPapo-v1.2.apk` usa a mesma assinatura da v1.0, então instala **por cima** e mantém chave da IA, estilo e histórico.

## Reconstruir
```
./build.sh PuxaPapo-original.apk 3 1.2
```

## Testar
```
npm i playwright   # ou aponte PLAYWRIGHT para uma instalação existente
node tests/test.js .
```
Os testes simulam a resposta da IA (sem chave real).
