# Ascend Face AI — Funcionalidades e relatório de testes

## Funcionalidades implementadas e funcionando offline

| Área | O que faz (de verdade) |
|---|---|
| Visão computacional | MediaPipe Face Landmarker: 478 pontos 3D, 52 coeficientes de expressão e pose da cabeça. Segmentação multiclasse (cabelo, pele, fundo, roupa, acessórios) com o modelo `selfie_multiclass` rodando no TensorFlow Lite (CPU, funciona em qualquer aparelho). |
| Captura guiada | Câmera (CameraX) com guia oval, linhas de olhos/eixo, dica ao vivo (rosto, distância, centralização, rotação, inclinação, luz), troca de câmera e galeria. 4 tipos: frontal (obrigatória), 45°, perfil esquerdo e direito, com ícone de posição da cabeça. |
| Controle de qualidade | Nº de rostos, brilho, luz desigual, nitidez (variância do Laplaciano), rotação/inclinação/pitch, tamanho e centralização, olhos fechados, sorriso/boca aberta, obstruções (óculos, mão, cabelo). Fotos ruins são recusadas com instruções. |
| Medições | Terços faciais (com linha do cabelo detectada por segmentação), regra dos quintos, simetria por reflexão (38 pares de pontos + olhos, sobrancelhas, nariz/boca, mandíbula), formato do rosto, mandíbula (largura, proporção do queixo, definição por contraste de contorno), maçãs, olhos (inclinação, abertura, espaçamento, olheiras), nariz (desvio, simetria, comprimento; largura descritiva), sobrancelhas, pele (vermelhidão, pontos, manchas, textura, uniformidade, brilho, olheiras), cabelo (volume no topo/laterais, equilíbrio, franja, comprimento, estilo estimado), barba (presença, cobertura, simetria), perfil (convexidade, linha E, projeções). |
| Notas | 11 categorias de 0 a 100 + nota geral + potencial de evolução. Cada nota tem justificativa, o que pesou, ponto forte, oportunidade, recomendações, limitações e nível de confiança. Metodologia explícita (Ajustes → Metodologia). |
| Relatório | Foto com a malha de pontos e marcadores clicáveis por região, anel de nota, potencial, radar de harmonia, ranking, pontos fortes/melhorar, separação "pouco modificável / cuidados / grooming / profissional". |
| Plano Glow Up | 7, 30, 60 e 90 dias gerado pelas suas medições. Cada tarefa: descrição, objetivo, frequência, dificuldade, custo estimado, prioridade, cuidados e contraindicações. Marcações salvas. |
| Histórico | Análises em ordem cronológica, gráfico de evolução (geral ou por categoria), comparação lado a lado entre duas datas com diferenças por categoria. |
| PDF | Exportação nativa do relatório completo, com compartilhamento. |
| Assistente | Sem backend: "motor local de regras" claramente identificado (não finge ser IA), respondendo às 8 perguntas com seus números. Com backend: IA real (Anthropic ou OpenAI). |
| Privacidade (LGPD) | Consentimento específico + confirmação de maioridade, política completa, fotos guardadas só como recorte reduzido criptografado (AES-256-GCM, chave no Android Keystore), backup do Android desativado, só HTTPS, exclusão de fotos / análises / conta, revogação de consentimento. |

## Funcionalidades que dependem de configuração externa

| Recurso | Estado sem configurar | O que configurar |
|---|---|---|
| ASCEND AI com IA de verdade | Mostra "Modo local: motor de regras (sem IA)" | Backend + chave Anthropic/OpenAI (docs/CONFIGURACAO.md) |
| Simulador de visual | Mostra "Indisponível" e o que falta | Backend + chave OpenAI (`gpt-image-1`) |
| Login e sincronização | "Modo local", nada é sincronizado | Projeto Supabase |
| Excluir conta na nuvem | — | Backend + `SUPABASE_SERVICE_ROLE_KEY` |

## Testes executados (GitHub Actions, emulador Android 14 / API 34)

**Unitários (JVM)** — 14 testes: função de nota, reflexão na linha média, preenchimento de polígonos,
componentes conectados, detecção de desfoque, conversão de cor L\*a\*b\*, regras de formato do rosto,
motor local de respostas, gerador de plano.

**Backend** — 10 cenários com APIs simuladas: token inválido negado, /health, chat Anthropic e OpenAI,
pergunta vazia, simulador, simulador sem chave, exclusão de conta, rota inexistente.

**Visão computacional real no Android** (foto de retrato pública do MediaPipe):
- 1 rosto detectado, 478 pontos, segmentação ok, 11 categorias com notas válidas.
- Duas pessoas na foto → recusada ("Foram detectados 2 rostos").
- Foto escurecida → recusada ("Foto muito escura").
- Foto desfocada → nitidez 6 vs 1444 da original → recusada.
- Imagem sem rosto → recusada.
- Sorriso detectado → aviso de que altera as medições.

**Armazenamento e privacidade**: análise salva no Room; foto no disco NÃO é JPEG legível (criptografada)
e é recuperada com a chave do Keystore; plano persistente; assistente sem backend responde como "local";
PDF gerado (~900 KB); exclusão de uma análise apaga relatório e foto; "excluir tudo" zera o banco.

**Jornada completa de interface** (21 capturas de tela): onboarding → consentimento → login opcional →
painel vazio → scanner → **câmera real do emulador** (capturou, e o app recusou corretamente por não haver rosto)
→ análise → relatório → detalhe da categoria → painel → evolução → plano (fases) → assistente →
ajustes → simulador (indisponível, sem fingir) → exclusão de todos os dados.

## Limitações conhecidas (honestas)

- Os testes de câmera com rosto real foram feitos com imagem injetada; a câmera em si foi testada no emulador (cena sem rosto). Recomenda-se testar no seu celular.
- No emulador o MediaPipe roda por tradução ARM (~14 s por foto). Em celular real ARM leva cerca de 1 s.
- IA externa, simulador e nuvem têm código e testes com respostas simuladas, mas não foram testados contra as APIs reais (precisam das suas chaves).
- Fotos de perfil completo (90°) podem não ser detectadas pelo MediaPipe; 60–75° funciona melhor.
- Referências de proporção vêm do rosto médio canônico do MediaPipe e de convenções estéticas; não representam todas as etnias. Por isso a largura do nariz não entra na nota.
