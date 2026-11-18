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
- **Junto com outra atividade** (`Activity.join`): nos dias em que a atividade-mãe acontece, a outra fica dentro dela num horário escolhido, sem ocupar espaço (ex.: Almoço 11:30–12:50 dentro do Trabalho); nos outros dias usa o horário normal. Cartão "Trabalho e almoço" em Rotina; ao criar um Trabalho o almoço entra junto sozinho. "Unir as duas" junta duas atividades numa só.
- **Opcional e encurtável** (`optional`, `minDuration`): estudos nos dias de semana entram se der (depois de refeições/treino, antes do lazer), encurtam até 30 min e saem sem aviso se não couber; no fim de semana "Estudos (fim de semana)" é essencial (1 h 30, encurta até 45 min, nunca sai).
- **Banho e encadeamento** (`Anchor` tipo `rel`): uma atividade pode começar logo depois (ou terminar logo antes) de outra; nos dias sem ela, usa um horário próprio. Banho fica logo depois da academia/luta/recuperação (sem treino: 21:00); lanche pós-treino logo depois do banho.
- **Trabalho conectado** (`domain/work.ts`): ao mudar o horário do trabalho (formulário, linha do tempo, IA ou cartão "Trabalho e almoço"), o acordar anda junto (dormir acompanha, mesmas horas de sono) e nunca fica tarde demais para a manhã + deslocamento caberem; "Ida para o trabalho"/"Volta para casa" grudadas no trabalho quando há deslocamento; almoço dentro do expediente; tarde/noite reencaixadas. Também por dia (ajuste "só hoje"). A prévia da IA mostra esses ajustes.
- **Prioridades dos dias de semana** (v1.5): prioridade "Máxima" (0) para academia, as 4 refeições (café, almoço, lanche da tarde, jantar) e o trabalho; estudos viram máxima só nos **dias de estudo** (`Activity.focusDays`, cartão em Rotina ou "vou estudar terça e quinta"). Refeições têm janela (`maxShift`: jantar não vira café); "logo depois" nunca antes da mãe; lanche da tarde e jantar entram junto com o trabalho quando caem no expediente; lanche pós-treino sai quando o jantar vem até 1h30 depois do treino. Se o essencial não cabe, o sono encurta até a meta mínima (8 h) e o app avisa. Noite antes de um dia que acorda mais cedo (domingo) garante 8 h. Teste de estresse: 96 combinações de trabalho × 7 dias + 20 trocas de horário.
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
