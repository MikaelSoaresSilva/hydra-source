# Titan — sistema pessoal de transformação física, estética e performance

App web responsivo (PWA instalável no celular) com quatro módulos integrados:

| Módulo | O que faz |
|---|---|
| **Titan Muscle** | Ciclo de 8 semanas gerado do seu perfil (dias, tempo, equipamentos, prioridades), prescrição semanal com RIR, progressão dupla automática, treino ao vivo com cronômetro, substituições, painel de braços, volume semanal, detecção de fadiga. |
| **Nutrição** | Meta calórica (Mifflin-St Jeor + faixa de erro), superávit conservador, macros, plano alimentar com alimentos brasileiros, trocas equivalentes, registro do consumo, lista de compras semanal/mensal, custo **somente com preços que você registra** (com data e fonte), ajuste gradual pela tendência semanal de peso. |
| **Titan Skin / Hair** | Rotinas manhã/noite e de lavagem editáveis, cadastro de produtos com detecção de ativos pelo INCI, bloqueio de combinações perigosas ou desconhecidas, introdução gradual (um ativo por vez), suspensão automática por reação, couro cabeludo priorizado com coceira persistente, barba/bigode/sobrancelhas. |
| **Titan Evolution** | Peso (diário × média 7 dias), medidas, check-in de sono/recuperação, fotos privadas com condições padronizadas e alerta de comparação não confiável, gráficos só com dados reais. |

O **painel Hoje** responde: o que fazer hoje, treino do dia, meta nutricional, refeições que faltam, pele/cabelo do dia, recuperação, hábito que mais prejudica a consistência, próxima meta mensurável e recomendações — cada uma com motivo, dados usados e o que será monitorado. As recomendações são **regras determinísticas** sobre seus registros; não há IA aprendendo com seus dados.

## Arquitetura

- **Front-end:** React 19 + TypeScript + Vite, PWA (`vite-plugin-pwa`), roteamento por hash (funciona em hospedagem estática).
- **Back-end:** Supabase — Auth (senha com hash, nunca em texto), PostgreSQL com **Row Level Security** em todas as tabelas, Storage privado para fotos, função `delete_my_account()`.
- **Validação:** no cliente (faixas nos formulários) **e** no banco (`CHECK` constraints, trigger que impede referenciar registros de outro usuário).
- **Offline:** toda escrita entra primeiro numa fila no IndexedDB e é enviada ao servidor; sem conexão, fica na fila e sincroniza quando a rede volta. Cada série do treino é salva individualmente.
- **Domínio puro e testável:** `src/domain/*` (cálculos de energia, plano alimentar, progressão, gerador de programa, agenda, skincare, cabelo, recomendações).
- **Modo local:** sem chaves do Supabase, o app roda com dados só no navegador (com aviso visível). Serve para testar; para uso real, configure a nuvem.

```
titan/
  src/domain/        regras e cálculos (com testes *.test.ts)
  src/data/          Supabase, fila offline, modo local, contexto
  src/pages/         telas (Hoje, Treino, Treino ao vivo, Braços, Nutrição, Cuidados, Evolução, Perfil, Onboarding)
  supabase/migrations/  esquema versionado (tabelas, RLS, storage)
  supabase/tests/       teste de isolamento RLS em PostgreSQL
  e2e/               teste ponta a ponta (Playwright, celular e desktop)
```

## Rodar localmente

Requisitos: Node 22+.

```bash
cd titan
npm install
cp .env.example .env.local   # preencha com seu projeto Supabase (ou deixe sem para o modo local)
npm run dev                  # http://localhost:5173
```

## Testes

```bash
npm run typecheck   # TypeScript
npm test            # 50 testes unitários: cálculos, progressão, agenda, plano alimentar, skincare, fila offline
npm run test:db     # migrações + RLS num PostgreSQL local (precisa de psql e PGHOST/PGUSER configurados)
npx vite build && npm run test:e2e   # fluxo completo no Chromium (celular e desktop)
```

## Configurar o Supabase (conta, banco e fotos)

1. Crie um projeto gratuito em <https://supabase.com> (região São Paulo, `sa-east-1`).
2. **SQL Editor →** execute, na ordem, `supabase/migrations/20261014000001_schema.sql`, `20261014000002_storage.sql` e `20261015000003_knowledge_appearance.sql` , `20261020000004_metrics_detail.sql` e `20261020000005_habits.sql`.
   (Ou, com a CLI: `supabase link --project-ref SEU_REF && supabase db push`.)
3. **Authentication → Providers → Email:** habilitado. Recomendado: "Confirm email" ligado e senha mínima de 8 caracteres.
4. **Authentication → URL Configuration:** em *Site URL* e *Redirect URLs* coloque a URL onde o app será publicado (ex.: `https://SEU-USUARIO.github.io/hydra-source/`) e `http://localhost:5173` para desenvolvimento.
5. **Project Settings → API:** copie `Project URL` e a chave `anon public` para `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   A chave `anon` é pública por design — a segurança vem do RLS. **Nunca** coloque a `service_role` no front-end ou no repositório.

## Publicar e instalar no celular

O workflow `.github/workflows/titan.yml` roda os testes e, a cada push na `main`, publica no **GitHub Pages**:

1. GitHub → **Settings → Pages → Source: GitHub Actions**. (Em repositório privado, o Pages exige plano pago; alternativas: tornar o repositório público, ou publicar a pasta `titan/dist` na Vercel/Netlify/Cloudflare Pages com as mesmas variáveis.)
2. **Settings → Secrets and variables → Actions → Variables:** crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Faça merge na `main`. A URL fica em `https://SEU-USUARIO.github.io/hydra-source/`.
4. No celular:
   - **Android (Chrome):** abra a URL → menu ⋮ → **Instalar app** / "Adicionar à tela inicial".
   - **iPhone (Safari):** abra a URL → Compartilhar → **Adicionar à Tela de Início**.
5. Entre com a mesma conta no PC e no celular: os dados sincronizam pela nuvem.

Para hospedar em outro lugar: `BASE_PATH=/ npx vite build` e envie `dist/` (qualquer hospedagem estática com HTTPS).

## APK para Android

O app também é empacotado como APK nativo (Capacitor 8, pacote `com.titan.transformacao`, Android 7+).

**Instalar:** copie `Titan.apk` para o celular → abra → permita "instalar apps desta fonte" → Instalar. O Play Protect pode avisar que o app é desconhecido (não está na Play Store); toque em "Instalar mesmo assim".

**Dados no APK:**
- Gerado **sem** chaves do Supabase → modo local: tudo fica salvo no próprio celular (continua após fechar o app ou reiniciar), mas **é apagado se desinstalar** e não sincroniza com o PC. Faça backup em Perfil → Exportar JSON.
- Gerado **com** `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no `.env.local` (ou nas variables do repositório, pelo CI) → conta na nuvem, igual à versão web.

**Gerar um novo APK** (precisa de JDK 21 e Android SDK 36):

```bash
cd titan
# android/keystore.properties (fora do git): storeFile, storePassword, keyAlias=titan, keyPassword
npm run apk     # → android/app/build/outputs/apk/release/app-release.apk
```

Ou pelo GitHub: crie os secrets `TITAN_KEYSTORE_B64` (`base64 -w0 titan-release.jks`) e `TITAN_KEYSTORE_PASSWORD`, e rode o workflow manualmente; o APK sai como artefato.

**Guarde a chave (`titan-release.jks` + senha).** Atualizações precisam ser assinadas com a mesma chave; sem ela, o Android exige desinstalar a versão antiga (o que apaga os dados locais). Nunca coloque a chave no repositório.

## Treino ativo: Protocolo JKK

`src/domain/jkk.ts` transcreve o PDF "Protocolo JKK" (5 dias: seg, ter, qua, sex, sáb): exercícios, séries, faixas de repetição, descansos, orientações e origem de cada item, além das seções "O que vi nas fotos", "Como treinar", "Flancos" e "De onde veio cada coisa". O plano é fechado (só registro), usa RIR 1–2 com a última série dos isolados até a falha, progressão dupla, aquecimento de 2 séries leves no 1º exercício e deload a cada 6–8 semanas com metade das séries e as mesmas cargas. Ao abrir a aba Treino, o JKK substitui o ciclo anterior (o histórico de séries é mantido).

## Base de conhecimento e análise de aparência

- `src/domain/knowledge.ts` e `src/domain/science.ts` reúnem o conteúdo dos materiais estudados (CREF4/SC 2018 e 2019, Musculação Aplicada, Ministério da Saúde/BVS, Almanaque da pele, apostila de corte masculino), cada ponto com a fonte. Telas: **Biblioteca** (artigos, calculadora de 1RM por %, sistemas de treino, divergências entre fontes) e **Aparência**.
- O motor de treino agora garante ≥10 séries semanais nos músculos prioritários (quando cabe no tempo), pergunta a prontidão (TQR 6–20) antes da sessão e reduz o volume se < 13, e calcula a carga interna (PSE × minutos) e a tonelagem por semana.
- **Aparência → Questionário** (sem IA): formato do rosto por autoavaliação, depois cortes pelas regras da apostila, adaptados à curvatura do cabelo, mais massagem facial e cuidados.
- **Aparência → Foto + IA**: envia 1–3 fotos (reduzidas, sem EXIF) ao modelo `claude-opus-5-5` com saída estruturada em JSON (validada no app com zod) e `fallbacks: "default"` (se o modelo recusar, a API reexecuta no modelo de reserva recomendado pela Anthropic). Dois caminhos:
  - **Nuvem:** Edge Function `supabase/functions/analyze-appearance` com a chave guardada como segredo:
    `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` e `supabase functions deploy analyze-appearance`. Limite de 10 análises por usuário por dia.
  - **Sem nuvem (APK local):** o usuário cola a própria chave da API, que fica só no aparelho e pode ser removida.

## Privacidade e segurança

- Cada usuário só acessa as próprias linhas (RLS testado: outro usuário não lê, não altera, não insere em nome alheio, não usa programa alheio, não envia foto para a pasta alheia; anônimo não lê nada).
- Fotos: bucket privado, pasta por usuário, links temporários de 1 h; metadados EXIF/GPS removidos antes do envio; a imagem não é editada.
- Por padrão nenhum dado vai para serviços de IA. A única exceção é a **análise de aparência por foto**, desligada por padrão: só funciona se você ligar (Perfil ou tela Aparência) e confirmar cada envio, vendo antes exatamente quais fotos e dados de perfil serão enviados à Anthropic. A chave da API do usuário (modo sem nuvem) fica só no aparelho e não entra no backup.
- **Exportar** (JSON com todos os registros) e **Excluir conta e dados** (apaga fotos, linhas e o usuário de autenticação) em Perfil.
- Logs de erro não incluem conteúdo pessoal (só tabela e código do erro).

## Limites conhecidos (honestos)

- Valores nutricionais dos alimentos-base são aproximações da TACO/USDA; cadastre alimentos do rótulo quando precisar de precisão.
- Preços: o app não busca preços na internet — usa só os que você registrar.
- Links de demonstração são **buscas** no YouTube, não vídeos verificados.
- O app não diagnostica pele, couro cabeludo ou lesões; sinaliza quando procurar dermatologista ou outro profissional.
- Simulações de resultado não existem no app; nenhuma foto é alterada.
- A análise por IA foi testada com respostas simuladas (formato, validação, recusa, erros); a chamada real à API depende de uma chave válida e não foi executada no desenvolvimento.
- Formato do rosto e tipo de cabelo são estimativas (questionário ou foto 2D), não medidas.
