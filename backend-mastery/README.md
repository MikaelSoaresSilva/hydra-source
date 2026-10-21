# Backend Mastery AI: edição expandida

Versão modificada do APK **Backend Mastery AI** (`com.backendmastery.ai`), focada em backend.

## O que mudou

| | Antes | Agora |
|---|---|---|
| Aulas | 30 | **46** (16 novas) |
| Exercícios por aula | 1 a 4 | **mínimo de 10** (+ 1 de transferência usado nas revisões) |
| Exercícios no total | 104 | **506** |
| Competências | 31 | **47** |

### Aulas novas (todas de backend)
- **Fase 2:** Algoritmos, estruturas de dados e Big O · Por dentro do Node (event loop, streams, eventos)
- **Fase 4:** Redes para backend (IP, DNS, TCP, portas, HTTPS) · Arquitetura em camadas, SOLID e padrões de projeto
- **Fase 5:** Design de APIs (paginação, versionamento, erros, OpenAPI) · Tempo real (WebSockets, SSE, webhooks) · GraphQL, gRPC e REST
- **Fase 6:** Índices, transações, ACID e performance SQL · Cache e Redis · NoSQL/MongoDB
- **Fase 7:** OWASP na prática (IDOR, XSS, CSRF, CORS, SSRF, rate limit)
- **Fase 8:** Mensageria (filas, pub/sub, RabbitMQ, Kafka, outbox)
- **Fase 9:** Linux para servidores · Observabilidade (logs, métricas, tracing, SLO) · System design
- **Fase 10:** Entrevistas técnicas de backend

Os exercícios usam os 4 tipos que o app já tinha: pergunta rápida, preveja a saída, código com testes automáticos e "explique com suas palavras".

## Como foi testado
1. `build.mjs` **valida** tudo antes de gerar o APK: ids únicos, no mínimo 10 exercícios por aula, e roda a solução de cada exercício de código contra os testes (o mesmo algoritmo do app). Também executa o código de cada "preveja a saída" e confere o resultado.
2. Um robô (Chromium + Playwright) abriu o app modificado, passou por **todas as 46 aulas** e respondeu os **460 exercícios das aulas** pela interface. O próprio app aceitou todas as respostas e não apareceu nenhum erro de JavaScript.

## Como instalar no celular
1. **Faça backup do seu progresso:** no app antigo, abra *Mais → Configurações → Exportar dados (JSON)*.
2. **Desinstale o app antigo.** O APK novo tem outra assinatura digital, e por isso o Android não deixa instalar por cima.
3. Instale `dist/BackendMastery-2.3-expandido.apk` (autorize "instalar apps desconhecidos" se o Android pedir).
4. Na primeira tela, escolha **"Já usava o app? Restaurar um backup"** e selecione o arquivo exportado.

## Como gerar o APK de novo
Requisitos: Node 18+, Java (`keytool`), `zip`/`unzip` e as Android build-tools (`zipalign` e `apksigner`).
```bash
node backend-mastery/build.mjs caminho/do/original.apk --build-tools /caminho/build-tools/34.0.0 \
  --out backend-mastery/dist/BackendMastery-2.3-expandido.apk
# só validar o conteúdo, sem gerar APK:
node backend-mastery/build.mjs caminho/do/original.apk --check
```
Para adicionar exercícios, edite os arquivos em `content/`. Cada arquivo exporta `extras` (exercícios extras para as aulas originais), `lessons` (aulas novas) e `competencies`.

**Chave de assinatura:** `signing/backend-mastery.keystore` **não vai para o Git**, porque o repositório é público. Guarde a sua cópia. Com ela, as próximas versões instalam por cima, sem precisar desinstalar. Sem ela, o script cria uma chave nova, e aí será preciso desinstalar de novo.

## Como funciona por dentro
O app é feito em Capacitor (React). O conteúdo novo fica em `assets/public/bma-extra.js` e entra no app por dois "ganchos" no bundle JS:
- a lista de aulas passa por `window.__bmaMerge(...)`, que acrescenta os exercícios e insere as aulas novas;
- a lista de competências recebe as competências novas.

O código nativo (Java/Kotlin) não foi alterado.
