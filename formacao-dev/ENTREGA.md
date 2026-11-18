# Relatório de entrega — Formação Dev v1.0.0

## 1. Análise do APK anterior ("Backend Mastery AI v0.2.0")
- App Capacitor (site React empacotado para Android), pacote `com.backendmastery.ai`.
- Tinha: 46 aulas e 501 exercícios **só de Backend**, 9 projetos, revisão, alarmes configuráveis, backup.
- Limitações encontradas: nenhuma outra área (frontend, mobile, dados, jogos…); sem cronograma de 12 semanas;
  lembretes genéricos (dias úteis 19h por padrão); sem vídeos/cursos externos; sem Python, SQL ou HTML executáveis;
  resposta certa das questões extras quase sempre na última alternativa (padrão "adivinhável");
  5 exercícios cuja solução não rodava sozinha (dependia do código inicial).
- O código-fonte original não estava disponível: todo o conteúdo foi **extraído do APK** e preservado.

## 2. O que foi implementado
| Item | Situação |
|---|---|
| Trilha de 12 semanas, 24 sessões (sáb/dom 13h30–16h30), 3 meses com os objetivos pedidos | ✅ |
| Roteiro de cada sessão em blocos com horário (revisão, aula, pausa, prática, projeto, desafio, fechamento) | ✅ |
| 72 aulas (46 antigas + 26 novas) em 11 áreas, Backend como foco (maior nº de aulas) | ✅ |
| 626 exercícios com correção automática (7 tipos) | ✅ |
| JavaScript, Python, SQL e HTML/CSS executando no celular, offline | ✅ |
| Professor virtual: dicas, tipo de erro, tradução de erros, "explicar de outro jeito", reforço adaptativo | ✅ |
| Revisão espaçada automática + avaliações dos meses 1, 2 e final | ✅ |
| Progresso: %, horas, exercícios, notas, projetos, habilidades, pontos fracos, mapa das áreas, direção profissional | ✅ |
| 120 materiais externos (76 do YouTube), 83% em português, com nível, relação com a aula e orientação | ✅ |
| 12 projetos, incluindo o projeto final TaskFlow (API + PostgreSQL + JWT + front + testes + docs + deploy) | ✅ |
| Área de carreira: mercado, currículo, GitHub, vagas, entrevistas, checklist, avaliação honesta, plano pós-curso | ✅ |
| Notificações sáb/dom 13h30 e 15h15, mensagens pedidas, personalizáveis/desativáveis, teste em 5 s, diagnóstico | ✅ |
| Glossário (90 termos), biblioteca de conceitos, backup/restauração, tema claro/escuro | ✅ |

## 3. Testes executados (reais)
- **226 testes automatizados (Vitest)**: integridade do conteúdo; a solução de **cada** exercício de código
  (143 JS, 10 Python, 8 SQL) passa nos próprios testes; exemplos de Python/SQL das aulas executam; as respostas
  de "qual a saída?" conferem com a execução real; cronograma soma 180 min por sessão sem buracos;
  calendário; revisão espaçada; agendamento exato das 4 notificações; migração/backup.
- **31 testes de ponta a ponta no Chromium** (tela de celular 390×844): onboarding, todas as telas,
  execução de JS/Python/SQL, laço infinito interrompido, as 9 soluções de HTML/CSS aprovadas, resposta errada
  reprovada com dica, revisão, avaliação, persistência após recarregar, tema claro, zero erros de JavaScript.
- **211 links externos verificados** (YouTube via oEmbed): 0 com problema na verificação final.
- **APK**: compilado com Gradle, assinado (esquemas v1 e v2) e verificado com `apksigner verify`; permissões conferidas com `aapt2`.

## 4. Problemas encontrados e corrigidos
- Banco SQL não carregava no navegador (arquivo `.wasm` com outro nome na versão do sql.js) — corrigido e coberto por teste.
- IDs de exercícios novos repetidos com os antigos (`e-data-*`, `e-ai-*`) — renomeados.
- 5 soluções antigas incompletas — completadas.
- 2 links de documentação quebrados (MDN e Coursera) — substituídos.
- Alternativas sempre na mesma posição — agora são embaralhadas de forma estável.
- Plugin de notificações reagendava a semana seguinte com um alarme que o Android pode adiar no modo
  economia — corrigido para `setExactAndAllowWhileIdle` (script `scripts/patch-local-notifications.mjs`).
- Data duplicada no cabeçalho da sessão e selo "já acertou" aparecendo cedo — corrigidos.

## 5. Limitações (com transparência)
- **Não foi possível testar o APK num Android real ou emulador**: o ambiente de nuvem não tem aceleração (KVM).
  O app web foi testado no Chromium (o mesmo motor do WebView do Android) e o APK foi validado estruturalmente.
  Recomendo: instalar, abrir Ajustes → "Testar (5 s)" e conferir o diagnóstico das notificações.
- O app novo tem outro identificador (`com.formacaodev.app`) e outra assinatura: ele é instalado **ao lado** do app
  antigo (não substitui). O progresso do app antigo não é transferido automaticamente.
- Fabricantes como Xiaomi, Samsung e Motorola podem bloquear alarmes por economia de bateria: o app explica
  como liberar (Ajustes → Diagnóstico).
- Vídeos e sites externos precisam de internet e podem sair do ar no futuro (o app continua funcionando).
- Python roda com o Skulpt (subconjunto do Python 3): ótimo para o básico do curso; bibliotecas como pandas
  devem ser usadas no Google Colab (indicado nas aulas).
- Exercícios "explique com suas palavras" são corrigidos por palavras-chave, não por IA.
- 72 horas formam um iniciante com base sólida e portfólio inicial, **não** garantem qualificação completa;
  o app diz isso claramente e traz um plano para os meses seguintes.
