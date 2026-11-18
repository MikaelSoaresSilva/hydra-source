# Formação Dev (app Android)

Plataforma de aprendizagem de programação do zero, com foco em **Backend**, em **12 semanas**
(3 h no sábado + 3 h no domingo, 13h30–16h30 = ~72 h). Evolução do app "Backend Mastery AI v0.2.0":
todo o conteúdo antigo (46 aulas, 501 exercícios, 9 projetos) foi preservado e ampliado.

## O que tem no app

- **Trilha de 12 semanas / 24 sessões** com roteiro de cada sessão em blocos (revisão, aula, pausa, prática, projeto, desafio, fechamento).
- **72 aulas** (62 obrigatórias + 10 de aprofundamento) em 11 áreas: fundamentos, ferramentas, frontend, backend (foco), mobile, desktop, IA e automação, dados, jogos, nuvem/segurança/outras, carreira.
- **626 exercícios** com correção automática: múltipla escolha, "qual a saída?", explique com suas palavras, código JavaScript, Python, SQL e HTML/CSS.
- **Executores no próprio celular (offline)**: JavaScript (Web Worker com limite de tempo), Python (Skulpt), SQL (SQLite/sql.js) e HTML/CSS/JS (pré-visualização).
- **Professor virtual**: dicas progressivas, explicação do tipo de erro, tradução de mensagens de erro, "explicar de outro jeito", revisão espaçada (1, 3, 7, 14, 30, 60 dias), reforço adaptativo por habilidade, avaliações mensais e final.
- **Progresso**: % da formação, horas estudadas, exercícios, notas, projetos, habilidades dominadas, pontos fracos e **mapa visual das áreas**.
- **120 materiais externos** (76 vídeos/playlists do YouTube, cursos, simuladores, documentação, vagas), 83% em português, todos verificados por script.
- **Projetos de portfólio** (página pessoal → APIs → projeto final TaskFlow com Node.js, PostgreSQL, JWT, testes e deploy).
- **Carreira**: mercado, checklist, currículo, GitHub, vagas, entrevistas, avaliação honesta e plano para depois dos 3 meses.
- **Lembretes**: sábado e domingo às 13h30 e 15h15, funcionam com o app fechado, sobrevivem à reinicialização do celular, personalizáveis.
- **Backup/restauração** do progresso (arquivo JSON).

## Estrutura

```
src/data/        conteúdo (aulas, cronograma, recursos, glossário, carreira, projetos)
src/data/old/    conteúdo extraído do APK anterior (preservado)
src/engine/      lógica: executores JS/Python/SQL, correção HTML, revisão espaçada, progresso, notificações
src/ui/          telas (Preact)
tests/           testes: conteúdo (todas as soluções passam nos testes), motor, e2e no Chromium
scripts/         verificação de links, ícones, correção do plugin de notificações
android/         projeto Android (Capacitor 7)
```

## Comandos

```bash
npm install                 # também aplica a correção do plugin de notificações (postinstall)
npm run dev                 # rodar no navegador
npm test                    # testes de conteúdo e lógica (Vitest)
npx vite build && node tests/e2e.mjs   # teste de ponta a ponta no Chromium
npx tsx scripts/check-links.mjs        # verifica todos os links externos
npm run android:sync        # compila a web e copia para o projeto Android
cd android && ./gradlew assembleRelease # gera o APK (precisa do Android SDK e de android/keystore.properties)
```

### Assinatura do APK
O arquivo `android/keystore.properties` e a chave `.jks` **não vão para o Git** (o repositório é público).
Formato do `keystore.properties`:
```
storeFile=/caminho/formacao-dev.jks
storePassword=...
keyAlias=formacaodev
keyPassword=...
```
Guarde a chave: atualizações futuras do app precisam ser assinadas com ela (senão é preciso desinstalar e perder o progresso local).
