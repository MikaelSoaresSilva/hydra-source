# Titan Rotina

Planejador diário inteligente inspirado no Titan: monta a rotina do dia inteiro (horário, duração, ordem),
avisa com notificações reais, reorganiza tudo a partir de um pedido em português e transforma a disciplina em XP.

App Android (`com.titan.rotina`) + PWA. React 19 + TypeScript + Vite + Capacitor 8. Dados só no aparelho (IndexedDB).

## Como funciona

- **Montador do dia** (`src/domain/scheduler.ts`): cada atividade tem âncora — horário do relógio, "X min depois de acordar" ou
  "X min antes de dormir" — prioridade (essencial/importante/flexível), dias da semana e se é fixa. O dia é montado com
  acordar/dormir primeiro, depois os fixos e depois os flexíveis por prioridade, cada um no espaço livre mais próximo
  do horário preferido. Nunca gera conflito; o que não cabe aparece como "Não coube".
- **Sono**: horários separados para dias de semana e fim de semana, meta de 8–9 h, "Preparar para dormir" 30 min antes,
  rotina da manhã e skincare noturno acompanham os horários. Regularidade calculada pelos horários reais de "Acordar".
- **Descreva sua necessidade** (`src/domain/interpreter.ts` → `ops.ts`): interpretador local em português (offline) que
  transforma o pedido em operações (acordar, dormir, mover, pular hoje, duração, adicionar, remover, pausar, trabalho).
  O app mostra a prévia (o que muda, avisos de sono) e só aplica depois da confirmação; tem desfazer.
  Opcional: Claude (`src/ai.ts`) com a chave do próprio usuário, só quando o local não entende — devolve operações
  validadas pelo app.
- **Notificações** (`src/data/notify.ts`): no APK, notificações locais agendadas para hoje + 2 dias, com botões
  "Concluir" e "Adiar"; aviso de atraso; despertador em canal de prioridade máxima; reagendadas a cada mudança e
  restauradas após reiniciar o celular.
- **Evolução** (`src/domain/progress.ts`): XP (essencial 20, importante 15, flexível 10, +5 no horário), níveis,
  sequência de dias ≥ 80%, meta semanal (5 dias), histórico de 14 dias, atributos por categoria, 14 conquistas.
- **Início e término**: no formulário (Início/Término calculam a duração) e pela linha do tempo em Hoje → ⋯ → "Mudar início e término", só hoje ou todos os dias; avisa se cair fora do horário acordado.
- **Nutrição**: água e calorias/macros do dia com metas editáveis.
- **Backup**: exportar/restaurar JSON (no APK, pela folha de compartilhar do Android).

## Rodar e testar

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # testes unitários (Vitest)
npm run build && CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test   # e2e
```

## APK

```bash
NATIVE=1 npx vite build && npx cap sync android
cd android && TITAN_KEYSTORE_PROPS=/caminho/keystore.properties ./gradlew assembleRelease
```

A chave de assinatura nunca vai para o repositório (`android/.gitignore`). Usa a mesma chave do Titan.
