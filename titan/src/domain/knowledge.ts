// Biblioteca do Titan: conteúdo extraído dos materiais estudados. Cada artigo cita a fonte.
// Onde as fontes divergem, as duas posições aparecem (ver "Conflitos entre fontes").

export const SOURCES = {
  estrut: 'Musculação: estruturação do treinamento e controle de carga — CREF4/SC (2018)',
  forca: 'Treinamento de força: da teoria à prática — CREF4/SC (2019)',
  aplic: 'Musculação Aplicada — Léo de Paiva',
  pele: 'Cuidados com a pele — Biblioteca Virtual em Saúde / Ministério da Saúde',
  almanaque: 'Almanaque da pele, cabelos e unhas',
  corte: 'Corte de Cabelo Masculino (apostila)',
} as const;
export type SourceKey = keyof typeof SOURCES;

export type KModule = 'treino' | 'nutricao' | 'pele' | 'cabelo';
export const MODULE_LABEL: Record<KModule, string> = { treino: 'Treino', nutricao: 'Nutrição e saúde', pele: 'Pele', cabelo: 'Cabelo, barba e corte' };

export interface Article { id: string; module: KModule; title: string; sources: SourceKey[]; points: string[] }

export const ARTICLES: Article[] = [
  // ------------------------------------------------------------------ treino
  {
    id: 'adaptacoes', module: 'treino', title: 'O que acontece nas primeiras semanas', sources: ['forca'],
    points: [
      'Nas primeiras 8–12 semanas, boa parte do ganho de força é neural (coordenação e recrutamento), não tamanho muscular.',
      'A dor muscular tardia (DMIT) pode durar até ~96 h. No começo, evite sessões que causem dano excessivo: atrapalham as seguintes.',
      'As células satélite levam ~14 dias para amadurecer; consistência importa mais que sessões heroicas.',
      'Memória muscular: quem já foi treinado recupera massa e força mais rápido após uma pausa.',
    ],
  },
  {
    id: 'volume', module: 'treino', title: 'Volume, frequência e nível', sources: ['forca', 'estrut', 'aplic'],
    points: [
      'Mínimo de ~10 séries por grupo muscular por semana para hipertrofia, progredindo aos poucos. Na literatura há protocolos de até 45 séries semanais para membros inferiores em avançados, mas mais não é sempre melhor.',
      'Com o volume semanal igualado, a frequência importa pouco; ~2×/semana por músculo é um bom padrão.',
      'Séries por grupo por sessão (Ratamess): iniciante 1–3, intermediário 6–8, avançado 9–16. Exercícios por grupo: 1, 2 e 3–4.',
      'Nível pelo tempo de treino: iniciante < 6 meses (máquinas e multiarticulares), intermediário ~6–12 meses, avançado > 1 ano.',
      'Divisões: 3×/semana em dias alternados (corpo todo), 4× A/B, 5–6× ABC.',
      'Comece pelo grupo prioritário, sem fadiga prévia (sistema prioritário). No Titan, os braços.',
    ],
  },
  {
    id: 'intensidade', module: 'treino', title: 'Intensidade, falha e amplitude', sources: ['forca', 'aplic', 'estrut'],
    points: [
      'Cargas acima de ~30% de 1RM geram hipertrofia se a série chegar perto da falha. Por isso o Titan usa RIR (repetições em reserva).',
      'Falha técnica ≠ falha concêntrica: encerre a série quando a técnica quebrar, mesmo que ainda saia uma repetição "roubada".',
      'Nunca vá à falha no supino com barra livre sem alguém para ajudar.',
      'Amplitude completa gera mais ganho que a parcial (Pinto et al., 2012). As parciais ficam como técnica avançada pontual.',
      'Cadência entre 0,5 e 8 s por repetição funciona; o ritmo autosselecionado com controle na descida é suficiente.',
      'Descanso de 1–3 min entre séries. Com 30 s, a carga total do treino cai em relação a 60–120 s.',
    ],
  },
  {
    id: 'aquecimento', module: 'treino', title: 'Aquecimento e respiração', sources: ['aplic', 'estrut'],
    points: [
      '5–15 min de aquecimento: geral (bike, esteira, movimentos amplos) e depois específico (séries leves do 1º exercício).',
      'Respiração: em empurrar e agachar, solte o ar na fase concêntrica (subida/empurrada). Em remadas e extensões, a respiração ativa (puxa o ar ao abrir o tronco) é natural.',
      'A apneia (respiração bloqueada) aumenta a pressão arterial. Só faz sentido em cargas muito altas, para quem não tem problema cardiovascular.',
      'Cinto só para cargas próximas do máximo; para o restante, aprenda a estabilizar o tronco sem ele.',
    ],
  },
  {
    id: 'percentual', module: 'treino', title: '%1RM, zona de repetições máximas e calculadora', sources: ['estrut', 'forca'],
    points: [
      'Tabela de Baechle: 100% = 1 rep · 95% = 2 · 93% = 3 · 90% = 4 · 87% = 5 · 85% = 6 · 83% = 7 · 80% = 8 · 77% = 9 · 75% = 10 · 70% = 11 · 67% = 12 · 65% = 15.',
      'Prefira a zona de repetições máximas (ex.: carga para 8–12 RM) ao teste de 1RM, que é mais arriscado e pouco útil para hipertrofia.',
      'No leg press 45°, a força efetiva é ≈ 0,7× o peso das anilhas. No crossover com polia móvel, a carga sentida é ≈ metade da placa. Não compare cargas entre máquinas diferentes.',
      'Manifestações da força (Uchida): hipertrófica 8–12 reps, 70–85% 1RM, II–VI séries, 1–2 min de descanso; máxima 1–6 reps, 90–100%, 3–5 min; RML 15–25 reps, 55–65%, < 45 s.',
    ],
  },
  {
    id: 'variacao', module: 'treino', title: 'Como variar exercícios com critério', sources: ['estrut'],
    points: [
      'Varie por ação articular diferente, multi × monoarticular, amplitude, mono × biarticular, unilateral × bilateral, morfologia do músculo e cadeia aberta × fechada.',
      'Cabeça longa do bíceps: rosca com o ombro estendido (rosca inclinada a 45°, rosca bayesiana).',
      'Cabeça longa do tríceps: braço acima da cabeça (extensão overhead, tríceps testa).',
      'Postura: ombros protusos pedem mais remadas; ombros rodados para dentro pedem puxadas com rotação externa.',
    ],
  },
  {
    id: 'carga-interna', module: 'treino', title: 'Controle de carga: PSE da sessão, TQR e tonelagem', sources: ['forca', 'aplic'],
    points: [
      'Carga interna = PSE da sessão (escala CR10, perguntada ~30 min após o treino) × duração em minutos, em unidades arbitrárias (UA). O Titan calcula isso ao concluir o treino.',
      'Tonelagem (volume-carga) = séries × repetições × kg, por sessão, semana e mesociclo. Mostra se o trabalho está subindo.',
      'Escala TQR (6–20) antes do treino: abaixo de 13, a recuperação está insuficiente e o volume do dia deve cair. O Titan pergunta antes de iniciar e ajusta sozinho.',
      'Variações bruscas de carga semanal aumentam o risco de lesão e de queda de desempenho. Suba aos poucos.',
    ],
  },
  {
    id: 'periodizacao', module: 'treino', title: 'Periodização', sources: ['forca', 'estrut'],
    points: [
      'Linear: volume alto e intensidade baixa, que se invertem ao longo das semanas. Reversa: o oposto, útil para resistência.',
      'Ondulatória: diária, semanal, flexível ou parcial. Na flexível (McNamara 2010), a sessão do dia é escolhida pela prontidão; é o que o Titan faz com a TQR.',
      'Após um ciclo, 2–4 semanas de transição (fase regenerativa) com volume reduzido. O Titan faz deload na semana 8.',
      'Superávit calórico de até ~350 kcal para hipertrofia (CREF4/SC 2018). O Titan respeita esse teto.',
    ],
  },
  {
    id: 'recuperacao', module: 'treino', title: 'Heterocronismo da recuperação', sources: ['estrut'],
    points: [
      'Monteiro (2011): após um estímulo, repetir o MESMO tipo de estímulo exige ~48 h; um tipo diferente pode vir 24 h ou até 6 h depois.',
      'Na força: depois de um treino de hipertrofia, endurance pode vir ~6 h depois, potência/força máxima ~24 h depois, e hipertrofia de novo só após ~48 h.',
      'Por isso o mesmo músculo é treinado com ~48–72 h de intervalo, e grupos diferentes podem ser treinados em dias seguidos.',
      'Sono, alimentação e estresse mudam esse tempo. Use o check-in diário para o Titan perceber.',
    ],
  },
  {
    id: 'dor', module: 'treino', title: 'Dor e reabilitação', sources: ['forca'],
    points: [
      'Regra prática: o exercício deve ser indolor durante a execução e não piorar a dor no dia seguinte. Se piorar, reduza a carga ou a amplitude ou troque o exercício.',
      'Em tendinopatias, o trabalho excêntrico progressivo é usado em reabilitação, com dor leve tolerável. Faça isso com um fisioterapeuta, não sozinho.',
      'O Titan trava a progressão de carga quando você registra dor ≥ 4/10 e sugere substituir o exercício se a dor se repetir.',
    ],
  },
  {
    id: 'viagem', module: 'treino', title: 'Sem academia (viagem/casa)', sources: ['aplic'],
    points: [
      '"Um treino ruim é melhor que faltar." Em viagem, use peso do corpo, elásticos ou halteres leves com séries até perto da falha.',
      'Flexões, agachamento búlgaro, remada com elástico, mergulho entre cadeiras, prancha. Faça o mesmo número de séries do plano.',
    ],
  },
  // ------------------------------------------------------------------ nutrição/saúde
  {
    id: 'proteina', module: 'nutricao', title: 'Proteína e massa magra', sources: ['forca'],
    points: [
      'Por refeição: ~0,25 g de proteína por kg de massa magra (Moore et al., 2015). O Titan usa o peso total quando a massa magra não foi medida, o que é seguro.',
      'Cada kg de massa magra ganho aumenta o gasto diário em ~30–50 kcal; a meta calórica é revisada pela tendência de peso.',
    ],
  },
  {
    id: 'hidratacao', module: 'nutricao', title: 'Hidratação', sources: ['aplic', 'pele'],
    points: [
      'Pese-se antes e depois do treino: o peso perdido é basicamente água a repor.',
      'Urina clara indica boa hidratação; urina escura e concentrada indica que falta água.',
      'Meta geral de pelo menos 2 L/dia, mais em dias quentes e de treino. Registre no check-in.',
    ],
  },
  {
    id: 'cintura', module: 'nutricao', title: 'Circunferência da cintura', sources: ['aplic'],
    points: [
      'Homens: acima de 94 cm indica risco aumentado; acima de 102 cm, risco muito aumentado (OMS).',
      'No bulking, acompanhe a cintura junto com o peso: se ela sobe rápido enquanto os braços não mudam, o superávit está alto.',
    ],
  },
  {
    id: 'suplementos', module: 'nutricao', title: 'Suplementos', sources: ['aplic'],
    points: [
      'Suplementos podem vir contaminados ou com rótulo impreciso. Devem ser prescritos por nutricionista ou médico.',
      'O Titan não recomenda suplementos; foca em comida de verdade e consistência.',
    ],
  },
  // ------------------------------------------------------------------ pele
  {
    id: 'rotina-pele', module: 'pele', title: 'Rotina básica (pele oleosa e com acne)', sources: ['pele', 'almanaque'],
    points: [
      'Limpe 2×/dia com produto para pele oleosa ou acneica. Limpar demais causa efeito rebote: mais oleosidade.',
      'Esfoliação no máximo 1×/semana. O tônico é opcional.',
      'Hidrate, à noite pelo menos. Pele oleosa também precisa: prefira textura gel, gel-creme ou sérum.',
      'Protetor solar todo dia, o ano todo.',
      'Água (≥ 2 L), sono regular e não fumar fazem parte da rotina de pele.',
    ],
  },
  {
    id: 'protetor', module: 'pele', title: 'Protetor solar do jeito certo', sources: ['almanaque'],
    points: [
      'Quantidade: 1 colher de chá para rosto e pescoço (≈ 2 dedos, indicador e médio, cheios).',
      'Reaplique a cada 2 h de exposição e após suor ou água.',
      'FPS 30–50 = proteção alta; acima de 50 = muito alta. A proteção UVA aparece como PPD/PA (+ a ++++).',
      'Para pele oleosa: sérum, gel ou gel-creme com toque seco.',
      'Manchas (melasma, marcas pós-espinha, sardas) só melhoram com fotoproteção diária.',
    ],
  },
  {
    id: 'acne', module: 'pele', title: 'Acne: o que fazer e quando procurar médico', sources: ['almanaque', 'pele'],
    points: [
      'A acne vai do grau I (cravos) ao grau V (fulminante). A partir do grau III (nódulos e cistos, inflamação extensa), procure dermatologista.',
      'Nunca esprema cravos ou espinhas: inflama, mancha e pode deixar cicatriz.',
      'O Ministério da Saúde orienta procurar dermatologista assim que a acne aparecer, se possível.',
      'O app não diagnostica pela foto. Ele só descreve o que é visível e indica quando buscar avaliação.',
    ],
  },
  {
    id: 'sinais', module: 'pele', title: 'Sinais de alerta na pele', sources: ['almanaque'],
    points: [
      'Pinta ou lesão assimétrica, de borda irregular ou que muda de tamanho/cor: procure médico. Existem tipos diferentes de câncer de pele e o diagnóstico precoce muda o desfecho.',
      'Ferida que não cicatriza ou que sangra fácil também merece avaliação.',
    ],
  },
  {
    id: 'estrias', module: 'pele', title: 'Estrias no ganho de massa', sources: ['almanaque'],
    points: [
      'O ganho rápido de massa e de peso pode causar estrias.',
      'Mantenha a pele hidratada e ganhe peso no ritmo do plano: o superávit conservador também ajuda aqui.',
    ],
  },
  // ------------------------------------------------------------------ cabelo
  {
    id: 'couro-oleoso', module: 'cabelo', title: 'Couro cabeludo oleoso', sources: ['almanaque', 'corte'],
    points: [
      'Use água morna ou fria; água quente estimula a oleosidade.',
      'Evite massagem excessiva no couro e lavar em excesso: os dois causam efeito rebote.',
      'Xampu com pH entre 4,2 e 5,8; evite os "2 em 1", que dificultam a limpeza.',
      'Não prenda o cabelo molhado. Secador a pelo menos 20 cm. Elásticos frouxos.',
      'Lave bonés com frequência: acumulam suor e oleosidade.',
    ],
  },
  {
    id: 'tipos', module: 'cabelo', title: 'Tipos de cabelo (1a–4c)', sources: ['corte'],
    points: [
      'Tipo 1 é liso, tipo 2 ondulado (2a–2c), tipo 3 cacheado (3a–3c) e tipo 4 crespo (4a–4c).',
      'Cabelo com química: hidratação a cada ~2 semanas. A progressiva solta os cachos e muda o corte ideal.',
      'Seu perfil 2C–3A fica entre o ondulado marcado e o cacheado aberto. Desfiado sutil com tesoura e corte respeitando o cacho funcionam bem.',
    ],
  },
  {
    id: 'tecnicas', module: 'cabelo', title: 'Técnicas de corte e manutenção', sources: ['corte'],
    points: [
      'Repicar define cachos de ondulados e dá leveza a lisos finos. Desfiar tira volume de cacheados e crespos (sempre sutil, senão arrepia).',
      'Picotar é para liso grosso. Perfilar é para liso ou ondulado, feito em cabelo limpo e seco.',
      'Duração: desfiado com tesoura 2–3 meses, com navalha ~45 dias; curtos ~1 mês; graduado e desfiado: revisão a cada 2 meses; camadas: pontas a cada 3 meses; militar: ~15 dias.',
      'Evite navalha em cabelo crespo ou desvitalizado/poroso. Nunca passe máquina com o cabelo molhado.',
      'Pentes de máquina: nº 1 ≈ 3 mm, cada número ≈ +3 mm. Abaixo do 4 aparece o couro cabeludo (proteja do sol). Para disfarçar marcas, existem os pentes ½ e 1½.',
    ],
  },
  {
    id: 'cortes', module: 'cabelo', title: 'Cortes e formato do rosto', sources: ['corte'],
    points: [
      'Formatos: oval, redondo, quadrado, triangular e retangular.',
      'Graduado: ideal para oval, inadequado para quadrado. Desfiado: recomendado para redondo, evitar em oval com fio fino. Camadas: recomendado para triangular, contraindicado para crespo.',
      'Quadrado: corte assimétrico, com pontas desiguais puxadas para a testa, suaviza as linhas duras.',
      'Fades: baixo, médio, alto, skin, drop, taper, burst, box, com navalha ou com risco. Para crespos, o low fade é muito indicado.',
      'Outros estilos: undercut, risca, new order, side cut, pompadour, militar, surfista, franja longa, desconexo.',
    ],
  },
];

export interface TrainingSystem { name: string; goal: string; level: string; weeks: string; how: string; advancedOnly: boolean }

/** Catálogo de sistemas de treinamento (CREF4/SC 2018). Opcional — o plano base não depende deles. */
export const TRAINING_SYSTEMS: TrainingSystem[] = [
  { name: 'Série simples', goal: 'Adaptação', level: 'Iniciante', weeks: 'Início do treino', how: '1 série por exercício, 8–15 repetições.', advancedOnly: false },
  { name: 'Circuito', goal: 'Condicionamento e resistência', level: 'Iniciante a avançado', weeks: 'Indefinido', how: 'Vários exercícios em sequência com no máximo 15 s de intervalo; contam-se passagens, não séries.', advancedOnly: false },
  { name: 'Bi-set / tri-set', goal: 'Variação do sistema de passagens', level: 'Não especificado na fonte', weeks: 'Não especificado', how: 'Grupos de 2 (bi) ou 3 (tri) exercícios seguidos, com intervalo só após o último. Direcionado ao mesmo grupo muscular, o tri-set é bem mais difícil.', advancedOnly: false },
  { name: 'Supersérie I', goal: 'Força hipertrófica', level: 'Avançado', weeks: '~2', how: 'Mais de 4 exercícios do mesmo grupo sem intervalo; descanso só após a passagem completa.', advancedOnly: true },
  { name: 'Supersérie II', goal: 'Força hipertrófica', level: 'Intermediário/avançado', weeks: '~4', how: '2 exercícios sem intervalo em sequência agonista/antagonista (ex.: rosca + tríceps).', advancedOnly: false },
  { name: 'Séries múltiplas', goal: 'Hipertrofia e força', level: 'Todos', weeks: 'Indefinido', how: 'Todas as séries de um exercício antes do próximo. É o padrão do Titan.', advancedOnly: false },
  { name: 'Pirâmide (crescente, decrescente, truncada)', goal: 'Hipertrofia e força máxima', level: 'Intermediário/avançado', weeks: 'Indefinido', how: 'Crescente: sobe a carga e cai a repetição. Decrescente: o inverso. Truncada: para no meio da pirâmide.', advancedOnly: false },
  { name: 'Exaustão', goal: 'Hipertrofia, RML, força', level: 'Avançado', weeks: '~2', how: 'Repetições até a falha concêntrica momentânea.', advancedOnly: true },
  { name: 'Repetições forçadas', goal: 'Hipertrofia e força máxima', level: 'Intermediário/avançado', weeks: 'Esporádico', how: 'Perto da falha, um parceiro ajuda até ~75% na subida; a descida é feita sozinho.', advancedOnly: true },
  { name: 'Roubada', goal: 'Hipertrofia e força máxima', level: 'Avançado', weeks: 'Esporádico', how: 'Impulso do corpo nas últimas repetições. Iniciantes devem evitar (risco de lesão); não usar em exercícios que envolvem grandes grupos musculares.', advancedOnly: true },
  { name: 'Negativa', goal: 'Hipertrofia e força máxima', level: 'Avançado', weeks: '~2', how: 'Só a fase excêntrica, com 105–120% de 1RM e ajuda na subida. Gera mais microlesão: recuperação maior.', advancedOnly: true },
  { name: 'Queima', goal: 'Hipertrofia e resistência', level: 'Avançado', weeks: '~2', how: 'Ao chegar à falha, algumas repetições parciais antes ou depois do ponto de desvantagem mecânica.', advancedOnly: true },
  { name: 'Parciais (rosca 21)', goal: 'Hipertrofia e resistência', level: 'Avançado', weeks: '~2', how: 'Repetições na parte do movimento antes do ponto de desvantagem mecânica (90° na rosca), depois na parte após ele, e por fim completas. A fonte exemplifica com 6 + 6 + 6.', advancedOnly: true },
  { name: 'Superlento', goal: 'Hipertrofia', level: 'Avançado', weeks: '~1', how: '10–30 s por repetição, de preferência em monoarticulares, como a rosca direta.', advancedOnly: true },
  { name: 'Drop-set', goal: 'Hipertrofia', level: 'Avançado', weeks: '2–3', how: 'Ao fim da série, retira ~20% da carga (a literatura cita 20–40%) e continua, com no máximo 30 s de pausa.', advancedOnly: true },
  { name: 'Blitz', goal: 'Hipertrofia', level: 'Avançado', weeks: '~4', how: 'Um grupo muscular por dia, com ≥ 72 h até repetir o grupo.', advancedOnly: true },
  { name: 'Prioritário', goal: 'Hipertrofia, força', level: 'Todos', weeks: 'Indefinido', how: 'O grupo prioritário vem primeiro, sem fadiga prévia. O Titan aplica isso aos braços.', advancedOnly: false },
  { name: 'Pré-exaustão', goal: 'Hipertrofia', level: 'Intermediário/avançado', weeks: '~4', how: 'Monoarticular antes do multiarticular do mesmo músculo (ex.: crucifixo antes do supino).', advancedOnly: false },
  { name: 'Choque', goal: 'Hipertrofia e resistência', level: 'Avançado', weeks: '~4', how: 'Treinos sempre diferentes, sem repetir exercícios ou com a ordem trocada. Na prática, é uma forma de periodização.', advancedOnly: true },
  { name: 'Onda', goal: 'Hipertrofia, força e resistência', level: 'Avançado', weeks: 'Até 4', how: 'Alterna séries pesadas de poucas repetições com séries moderadas de muitas repetições.', advancedOnly: true },
  { name: 'Isométrico', goal: 'Força, resistência', level: 'Todos', weeks: 'Indefinido', how: 'Contrações estáticas de 3–10 s num ângulo. É menos eficiente para hipertrofia que o treino dinâmico.', advancedOnly: false },
  { name: 'Seis-vinte', goal: 'Força e resistência', level: 'Todos', weeks: 'Indefinido', how: 'Na mesma sessão, séries de 6 e de 20 repetições para o mesmo grupo.', advancedOnly: false },
  { name: 'Rest-pause', goal: 'Hipertrofia e força máxima', level: 'Avançado', weeks: '2–4', how: 'Até 5 repetições perto de 100% de 1RM, pausas < 15 s, repetindo até a meta (ex.: 8 reps a 95%).', advancedOnly: true },
];

/** Pontos em que as fontes discordam — apresentados lado a lado, sem esconder. */
export const CONFLICTS = [
  {
    topic: 'Com que frequência lavar o cabelo',
    a: { source: 'corte' as SourceKey, text: '"Lave os cabelos todos os dias", com o xampu certo.' },
    b: { source: 'almanaque' as SourceKey, text: 'Evite lavar com muita frequência: no couro oleoso, o excesso causa efeito rebote.' },
    titan: 'O Titan segue a frequência do seu perfil (lavagens por semana) e ajusta pelos registros de coceira e oleosidade. Lave depois de suar muito no treino, com água morna e sem esfregar demais.',
  },
  {
    topic: 'Quantas séries por grupo muscular',
    a: { source: 'estrut' as SourceKey, text: 'Ratamess: iniciante 1–3 séries por grupo por sessão; avançado 9–16.' },
    b: { source: 'forca' as SourceKey, text: 'Tabela 6.1: pelo menos 10 séries por grupo por semana, aumentando aos poucos.' },
    titan: 'São medidas diferentes (por sessão × por semana). O Titan garante ≥ 10 séries semanais nos músculos prioritários dentro do tempo disponível.',
  },
];
