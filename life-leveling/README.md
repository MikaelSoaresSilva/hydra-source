# LIFE LEVELING: AWAKENING

**Minha vida é o mundo. Eu sou o protagonista. Minhas ações são as missões.**

Um RPG para Android em que suas tarefas, treinos, estudos e finanças reais fazem seu personagem 3D evoluir: níveis, ranks de E a SSS, chefes, campanhas, itens raros, talentos, arena de combate e um mestre de jogo chamado SISTEMA. Identidade 100% original (inspirado na *sensação* de progressão de RPGs como Solo Leveling, sem copiar nada).

---

## 1. Como instalar no celular (passo a passo)

1. Baixe o arquivo **`release/LifeLeveling-0.1.0.apk`** deste repositório para o celular
   (no GitHub: abra o arquivo → botão **Download raw file**).
2. Toque no arquivo baixado. O Android vai avisar que é um app de "fonte desconhecida".
3. Toque em **Configurações → Permitir desta fonte** (isso libera só o navegador/gerenciador de arquivos que você usou).
4. Volte e toque em **Instalar**.
5. Abra **Life Leveling**. Requisito: Android 7.0 ou mais novo, com WebView atualizado (Play Store → "Android System WebView").

> É um APK de teste ("debug"), assinado com a chave de desenvolvimento. Ele funciona normalmente, mas não é a versão para a Play Store (ver seção 8).

---

## 2. O que já funciona (e foi testado)

| Área | O que você encontra |
|---|---|
| **Abertura cinematográfica** | `[SISTEMA INICIADO]`, partículas, música sintetizada, registro do jogador em 4 etapas |
| **Personagem 3D real** | Modelo 3D (WebGL/Three.js) com esqueleto animado: repouso, caminhada, corrida, vitória, ataques, esquiva. Gira 360°, zoom por pinça, 4 cenários (Santuário, Forja, Coliseu, Limiar) |
| **Criador de personagem** | Pele, cabelo (6 estilos), barba, bigode, olhos, sobrancelhas, altura, largura, musculatura, cabeça. **Foto de referência**: você toca na foto e o app captura a cor real da pele, cabelo e olhos |
| **Missões** | 7 tipos (rápida, principal, secundária, domínio, épica, lendária, surpresa), dificuldade 1–5, prazo, etapas, recorrência (diária/semanal/mensal), editar, adiar, cancelar, histórico |
| **XP e níveis** | Curva balanceada, bônus de consistência (+2%/dia, máx. 20%), **XP nunca duplica** (cada conclusão tem uma chave única) |
| **Atributos** | 12 atributos com nível, barra, histórico, "como evoluir", radar e alerta de atributo parado. Cada missão afeta no máximo 3 |
| **Ranks E → SSS** | Critérios objetivos (nível, melhor sequência, chefes, equilíbrio de atributos) e **configuráveis**, com cerimônia de promoção |
| **Sequência sem culpa** | Escudos de consistência protegem 1 dia perdido; perder a sequência **nunca** apaga itens, níveis ou recorde. Missão "Retorno do Caçador" ao voltar |
| **Reorganização automática** | Missões atrasadas são redistribuídas a partir de hoje respeitando sua capacidade diária. Sem pilha infinita |
| **Campanhas e chefes** | Escreva qualquer objetivo ("quero aprender programação backend") → campanha com 3 fases, missões, prazos e um **chefe** com arte própria, introdução e barra de vida que só cai com etapas reais |
| **Equipamentos** | 32 itens originais com ícones próprios, 6 raridades, 10 espaços, efeitos no jogo, comparação, conjuntos favoritos ("visuais"), coleção e 3 conjuntos completáveis. Itens aparecem no modelo 3D (armas, armaduras, auras, capas, companheiros) |
| **Talentos** | 5 árvores (Lâmina, Sombra, Arcano, Bastião, Estratégia), 15 talentos, pontos por nível e por missões de domínio, redistribuição |
| **Arena 3D jogável** | Joystick + botões (ou teclado): ataque, combo de 3 golpes, golpe pesado, esquiva com invencibilidade, 8 habilidades especiais, energia, recargas, 4 tipos de inimigo com comportamento próprio (avisos vermelhos antes de atacar), chefe com 3 fases, vitória/derrota. **O combate básico nunca depende da vida real** — a evolução real só te deixa mais forte |
| **História** | 5 capítulos originais que se desbloqueiam com seu progresso e liberam novos cenários |
| **Conquistas** | 36 conquistas (5 secretas), títulos exibíveis, marcos de 7/30/60/90 dias |
| **Vida real** | Treino (séries, reps, carga, descanso, esforço, recordes, gráficos, peso/medidas, fotos privadas), Estudos (sessões + Árvore de Conhecimento que **exige prática e projeto** para "Dominado"), Finanças (metas, economias, gastos, gráfico), Autocuidado |
| **SISTEMA (mestre de jogo)** | 4 estilos (Sistema, Mentor, Narrador, Estrategista). Funciona **offline**: próxima missão, relatórios de 7/30 dias, explicação do XP, plano de retorno, rank, atributos, criação de campanhas. IA opcional (Claude) com sua chave |
| **Temporadas e eventos** | Temporadas de 30/60/90 dias com metas baseadas no seu ritmo, 3 níveis de recompensa e resumo; evento opcional de fim de semana |
| **Notificações** | Lembretes locais do Android (resumo diário, estudo, campanhas), horário de silêncio, categorias, máx. 3/dia |
| **Salvamento** | Salva automaticamente no aparelho a cada ação + backup automático diário (3 últimos) + exportar/importar JSON |
| **Configurações** | Qualidade gráfica (economia de bateria), reduzir movimento, som/música/volume, apagar fotos, apagar progresso |

---

## 3. Testes executados (resultado real)

**Testes automáticos do núcleo — 26/26 passaram** (`npm test`): curva de XP, cálculo de XP, limite de 3 atributos, XP não duplicado (inclusive missões diárias e etapas), recompensa de nível, sequência sem punição, escudo, reorganização de atrasadas, campanha → chefe derrotado só com etapas reais, domínio de conhecimento exige prática+projeto, recordes de treino, limite de XP de treino, meta financeira, ranks, talentos, migração de save, mescla de 2 aparelhos sem duplicar XP, dados da nuvem sem fotos/chaves, validação de campanhas da IA, combate (um jogador ativo vence; ficar parado perde).

**Testes de aceitação no navegador em tela de celular (Pixel 7) — 17/17 passaram** (`npm run e2e`):

| # | Critério | Resultado |
|---|---|---|
| 1 | Abrir e navegar | ✅ |
| 2 | Criar e personalizar personagem (avatar 3D em WebGL) | ✅ |
| 3 | Criar missão | ✅ |
| 4 | Concluir missão e receber XP | ✅ |
| 5 | XP calculado corretamente (Principal D3 = 35 XP) | ✅ |
| 6 | Sem XP duplicado | ✅ |
| 7 | Subir de nível entrega a recompensa (Nível 2 → Luvas da Forja) | ✅ |
| 8 | Visualizar e equipar item | ✅ |
| 9 | Progresso permanece ao fechar e reabrir | ✅ |
| 10 | Recuperar em outro aparelho com a nuvem | ⚠️ **Código pronto, mas NÃO testado de ponta a ponta** — precisa de um projeto Supabase seu (seção 5). A lógica de mescla foi testada |
| 11 | Dados de usuários isolados | ⚠️ Garantido pelas regras RLS em `supabase/schema.sql`; **não testado** sem um servidor real |
| 12 | Erros compreensíveis | ✅ |
| 13 | Funciona em tela de celular (sem rolagem lateral) | ✅ |
| 14 | Recursos correspondem ao prometido | ✅ (limitações listadas abaixo) |

Também verificado: APK compila e é válido (pacote `com.lifeleveling.awakening`, Android 7+ alvo 16, assinatura debug). **Não foi possível rodar em um emulador Android** neste servidor (sem virtualização); o app foi testado no Chromium, o mesmo motor do WebView do Android.

Capturas reais dos testes em [`docs/screens/`](docs/screens).

---

## 4. Limitações honestas

- **Rosto a partir de foto:** a foto é usada como referência e para capturar cores reais. Reconstruir um rosto 3D idêntico exigiria modelos de visão computacional pesados (servidor ou SDKs pagos). O modelo é estilizado e ajustável à mão.
- **Gráficos:** personagem e cenários são modelos 3D procedurais (feitos por código), não arte de estúdio de um jogo AAA. Para isso seria preciso Unity/Unreal + artistas 3D. A arquitetura permite trocar o avatar por arquivos `.glb` no futuro.
- **Música e sons** são sintetizados em tempo real (sem arquivos de áudio), por isso são simples, mas 100% originais.
- **Nuvem e IA são opcionais** e dependem de você configurar (seções 5 e 6). Sem elas, tudo funciona offline no aparelho. Se desinstalar o app **sem** nuvem nem backup exportado, o progresso local é perdido.

---

## 5. Ativar a nuvem (trocar de celular sem perder nada) — opcional

1. Crie uma conta grátis em **supabase.com** → **New project**.
2. No projeto: **SQL Editor** → cole todo o arquivo `supabase/schema.sql` → **Run**. Isso cria a tabela, o isolamento por usuário, a validação no servidor, histórico de versões e exclusão de conta.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. No app: **⚙ Configurações → Conta na nuvem** → cole URL e chave → e-mail + senha → **Criar conta** (confirme o e-mail) → **Entrar** → **Sincronizar agora**.
5. No outro celular: instale, faça o registro inicial rápido, vá em Configurações, entre na mesma conta e sincronize.

Fotos e chaves de API **nunca** são enviadas para a nuvem. A sincronização mescla os dois lados sem duplicar XP.

## 6. Ativar a IA do SISTEMA — opcional

1. Crie uma chave em **console.anthropic.com** (o uso é cobrado na sua conta Anthropic).
2. No app: **⚙ → IA do SISTEMA** → ative, cole a chave, escolha o modelo (padrão Claude Opus 5.5; Haiku 5.5 é o mais barato) e o limite diário.
3. A IA conversa usando seus dados reais e pode gerar campanhas personalizadas. **Toda campanha da IA é validada** pelo app (atributos válidos, no máximo 3 por missão, prazos coerentes) e o **XP é sempre calculado pelo jogo**, nunca pela IA.

A chave fica só no aparelho. Para um app público, o ideal é passar a chamada por um servidor (ex.: Supabase Edge Function) — ver roadmap.

---

## 7. Arquitetura (para quem for programar)

```
life-leveling/
├── src/core/        Regras do jogo, sem interface (testáveis)
│   ├── engine.ts      missões, XP idempotente, sequência, chefes, campanhas, itens, vida real
│   ├── progression.ts curvas de nível, atributos, ranks
│   ├── combat.ts      simulação da arena (independente do 3D)
│   ├── gm.ts          SISTEMA offline + validação de campanhas da IA
│   └── save.ts        migração de saves, mescla entre aparelhos, dados seguros p/ nuvem
├── src/data/        Conteúdo: itens, conquistas, talentos, história, campanhas, conhecimento
├── src/three/       Avatar 3D, cenários, arena (React Three Fiber)
├── src/ui/          Telas
├── src/services/    Som, notificações, IA (Claude), nuvem (Supabase)
├── supabase/        Esquema SQL com isolamento por usuário (RLS)
├── tests/           Testes unitários (Vitest) e de aceitação (Playwright)
├── android/         Projeto Android (Capacitor)
└── release/         APK pronto
```

**Por que esta tecnologia:** React + TypeScript + Three.js empacotados com Capacitor dão um APK instalável com 3D real, funcionando offline, com uma única base de código fácil de evoluir. Unity/Unreal dariam gráficos superiores, mas tornariam muito mais lento construir a parte de produtividade (formulários, gráficos, sincronização), que é o coração do app. Os módulos de jogo, progressão, dados, IA e interface ficam separados para permitir trocar o motor 3D no futuro.

### Comandos

```bash
npm install          # instalar dependências
npm run dev          # abrir no navegador (http://localhost:5173)
npm test             # testes do núcleo
npm run build && npm run e2e   # testes de aceitação em tela de celular
npm run android:apk  # gerar o APK (requer Android SDK + Java 21) → release/
```

O GitHub Actions (`.github/workflows/life-leveling-apk.yml`) roda os testes e gera o APK automaticamente a cada atualização.

---

## 8. Próximos passos sugeridos

1. Testar no seu celular e me mandar o que achou (desempenho, visual, o que falta).
2. APK de **release** assinado com sua própria chave (necessário para Play Store).
3. Proxy da IA no servidor (Edge Function) para não precisar de chave no aparelho.
4. Avatar em `.glb` feito por artista (ou gerado), com roupas modeladas.
5. Mais Fendas, inimigos e chefes na arena; mais itens e um capítulo VI.
6. Importar evidências do GitHub automaticamente para a Árvore de Conhecimento.
