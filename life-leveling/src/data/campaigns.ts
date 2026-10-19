import type { AttrWeights, Boss, Difficulty, MissionType, Recurrence } from '../core/types';

export interface MissionSeed {
  title: string;
  description: string;
  type: MissionType;
  difficulty: Difficulty;
  recurrence: Recurrence;
  attrs: AttrWeights;
  steps?: string[];
  days?: number; // prazo relativo
}

export interface CampaignTemplate {
  id: string;
  match: RegExp;
  title: string;
  summary: string;
  boss: { name: string; epithet: string; theme: Boss['theme']; lore: string };
  dailies: MissionSeed[];
  phases: { name: string; missions: MissionSeed[] }[];
}

export const TEMPLATES: CampaignTemplate[] = [
  {
    id: 'fisico', match: /(f[ií]sic|muscul|academia|treino|for[cç]a|emagre|peso|corpo|shape|hipertrof|correr|corrida)/i,
    title: 'A Provação da Força', summary: 'Construir um físico forte com treino progressivo, recuperação e consistência.',
    boss: { name: 'Colosso de Ferro', epithet: 'A Provação da Força', theme: 'forca', lore: 'Um gigante de metal enferrujado que só cede a quem volta dia após dia. Cada treino real arranca uma placa da sua armadura.' },
    dailies: [
      { title: 'Mobilidade matinal (10 min)', description: 'Alongamento e mobilidade articular leve.', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { condicionamento: 2, autocuidado: 1 } },
      { title: 'Beber 2 litros de água', description: 'Hidratação ao longo do dia.', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { autocuidado: 2 } },
    ],
    phases: [
      { name: 'Fase 1 — Fundação', missions: [
        { title: 'Definir rotina de treino da semana', description: 'Escolha dias, horários e divisão (ex.: A/B/C). Escreva no app.', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { organizacao: 2, disciplina: 1 }, days: 2 },
        { title: 'Primeiro treino registrado', description: 'Faça um treino e registre séries, repetições e cargas no módulo Treino.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { forca: 2, resistencia: 1 }, days: 3 },
      ] },
      { name: 'Fase 2 — Ritmo', missions: [
        { title: 'Treinar 3 vezes nesta semana', description: 'Três sessões completas. Registre cada uma.', type: 'principal', difficulty: 3, recurrence: 'semanal', attrs: { forca: 2, consistencia: 2 }, steps: ['Treino 1', 'Treino 2', 'Treino 3'], days: 7 },
        { title: 'Dormir 7h+ por 5 noites', description: 'Recuperação é parte do treino.', type: 'secundaria', difficulty: 2, recurrence: 'semanal', attrs: { autocuidado: 2, resistencia: 1 }, days: 7 },
      ] },
      { name: 'Fase 3 — Superação', missions: [
        { title: 'Bater um recorde pessoal', description: 'Aumente carga ou repetições em um exercício com boa técnica.', type: 'dominio', difficulty: 4, recurrence: 'unica', attrs: { forca: 3, disciplina: 1 }, days: 21 },
        { title: '4 semanas de treino consistente', description: 'Mínimo de 3 treinos por semana durante 4 semanas.', type: 'epica', difficulty: 4, recurrence: 'unica', attrs: { consistencia: 3, forca: 1, resistencia: 1 }, steps: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'], days: 30 },
      ] },
    ],
  },
  {
    id: 'programacao', match: /(program|c[oó]digo|backend|frontend|dev|software|api|python|javascript|typescript|java\b|app|sistema web)/i,
    title: 'O Guardião do Código', summary: 'Aprender programação construindo um projeto real, do zero ao deploy.',
    boss: { name: 'Guardião do Código', epithet: 'Sentinela do Compilador', theme: 'codigo', lore: 'Uma entidade feita de linhas de código que nunca rodaram. Ela só se desfaz quando algo que você construiu funciona de verdade.' },
    dailies: [
      { title: 'Bloco de foco: 25 min de código', description: 'Um pomodoro sem distrações programando ou estudando.', type: 'rapida', difficulty: 2, recurrence: 'diaria', attrs: { concentracao: 2, conhecimento: 1 } },
    ],
    phases: [
      { name: 'Fase 1 — Fundamentos', missions: [
        { title: 'Escolher a stack e preparar o ambiente', description: 'Instale a linguagem, editor e Git. Rode um "olá mundo".', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { organizacao: 1, conhecimento: 2 }, days: 3 },
        { title: 'Resolver 10 exercícios de lógica', description: 'Registre como evidência na Árvore de Conhecimento.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { inteligencia: 3, concentracao: 1 }, steps: ['3 exercícios', '6 exercícios', '10 exercícios'], days: 10 },
      ] },
      { name: 'Fase 2 — Construção', missions: [
        { title: 'Criar uma API com 3 rotas', description: 'GET, POST e DELETE, retornando JSON.', type: 'principal', difficulty: 4, recurrence: 'unica', attrs: { inteligencia: 2, conhecimento: 2 }, steps: ['Rota GET', 'Rota POST', 'Rota DELETE'], days: 14 },
        { title: 'Conectar a um banco de dados', description: 'Persistir dados da sua API em SQL.', type: 'principal', difficulty: 4, recurrence: 'unica', attrs: { inteligencia: 2, conhecimento: 2 }, days: 21 },
      ] },
      { name: 'Fase 3 — Lançamento', missions: [
        { title: 'Adicionar login e testes', description: 'Autenticação por usuário e pelo menos 5 testes automatizados.', type: 'dominio', difficulty: 5, recurrence: 'unica', attrs: { inteligencia: 3, disciplina: 1 }, days: 30 },
        { title: 'Publicar o projeto', description: 'Deploy funcionando + README no GitHub.', type: 'epica', difficulty: 4, recurrence: 'unica', attrs: { conhecimento: 2, comunicacao: 1, organizacao: 1 }, days: 40 },
      ] },
    ],
  },
  {
    id: 'financas', match: /(econom|dinheiro|finan|poupar|guardar|comprar|investir|d[ií]vida|renda|sal[aá]rio|reserva)/i,
    title: 'O Dragão do Tesouro', summary: 'Controlar o dinheiro, cortar desperdícios e juntar para o que importa.',
    boss: { name: 'Mammon, o Faminto', epithet: 'Dragão do Tesouro Escondido', theme: 'ouro', lore: 'Um dragão que se alimenta de gastos esquecidos. Cada real guardado com intenção é uma escama arrancada.' },
    dailies: [
      { title: 'Registrar os gastos do dia', description: 'Anote tudo que gastou hoje no módulo Finanças.', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { financas: 2, organizacao: 1 } },
    ],
    phases: [
      { name: 'Fase 1 — Mapa do Tesouro', missions: [
        { title: 'Criar a meta financeira', description: 'Defina o valor e o prazo do objetivo no módulo Finanças.', type: 'principal', difficulty: 1, recurrence: 'unica', attrs: { financas: 2, organizacao: 1 }, days: 1 },
        { title: 'Levantar todos os gastos fixos', description: 'Liste contas, assinaturas e dívidas.', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { financas: 2, organizacao: 2 }, days: 4 },
      ] },
      { name: 'Fase 2 — Cortes', missions: [
        { title: 'Cancelar ou reduzir 2 gastos', description: 'Assinaturas esquecidas, delivery, tarifas.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { financas: 3, disciplina: 1 }, steps: ['Corte 1', 'Corte 2'], days: 10 },
        { title: 'Guardar um valor nesta semana', description: 'Qualquer valor, registrado como economia na meta.', type: 'secundaria', difficulty: 2, recurrence: 'semanal', attrs: { financas: 2, consistencia: 1 }, days: 7 },
      ] },
      { name: 'Fase 3 — Acumulação', missions: [
        { title: 'Atingir 50% da meta', description: 'Metade do caminho guardado.', type: 'epica', difficulty: 4, recurrence: 'unica', attrs: { financas: 3, disciplina: 2 }, days: 60 },
        { title: 'Atingir 100% da meta', description: 'O tesouro é seu.', type: 'lendaria', difficulty: 5, recurrence: 'unica', attrs: { financas: 3, disciplina: 2 }, days: 120 },
      ] },
    ],
  },
  {
    id: 'aparencia', match: /(apar[eê]ncia|visual|estilo|pele|cabelo|roupa|autocuidado|cuidar de mim|sa[uú]de|sono|dormir|alimenta)/i,
    title: 'O Espelho Partido', summary: 'Cuidar de si: sono, pele, alimentação, estilo e apresentação.',
    boss: { name: 'O Reflexo Distorcido', epithet: 'Senhor do Espelho Partido', theme: 'espelho', lore: 'Uma figura que imita você, mas cansada e esquecida. Ela perde força cada vez que você cuida de si de verdade.' },
    dailies: [
      { title: 'Rotina de cuidados (manhã)', description: 'Higiene, pele e preparação para o dia.', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { autocuidado: 2 } },
      { title: 'Dormir no horário planejado', description: 'Telas desligadas 30 min antes.', type: 'secundaria', difficulty: 2, recurrence: 'diaria', attrs: { autocuidado: 2, disciplina: 1 } },
    ],
    phases: [
      { name: 'Fase 1 — Diagnóstico', missions: [
        { title: 'Foto de referência e metas', description: 'Registre uma foto (opcional, privada) e 3 metas de cuidado.', type: 'principal', difficulty: 1, recurrence: 'unica', attrs: { autocuidado: 2, organizacao: 1 }, days: 2 },
      ] },
      { name: 'Fase 2 — Rotina', missions: [
        { title: '14 dias de rotina de cuidados', description: 'Manhã e noite.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { autocuidado: 3, consistencia: 2 }, steps: ['7 dias', '14 dias'], days: 16 },
        { title: 'Organizar o guarda-roupa', description: 'Separe peças que combinam e doe o que não usa.', type: 'secundaria', difficulty: 2, recurrence: 'unica', attrs: { organizacao: 2, autocuidado: 1 }, days: 10 },
      ] },
      { name: 'Fase 3 — Nova Versão', missions: [
        { title: 'Montar 3 visuais completos', description: 'Combinações que fazem você se sentir bem.', type: 'dominio', difficulty: 3, recurrence: 'unica', attrs: { autocuidado: 2, comunicacao: 1 }, days: 25 },
      ] },
    ],
  },
  {
    id: 'disciplina', match: /(disciplin|procrastin|foco|produtiv|rotina|h[aá]bito|organiz|acordar cedo|tempo)/i,
    title: 'O Labirinto do Caos', summary: 'Construir uma rotina clara, vencer a procrastinação e organizar o ambiente.',
    boss: { name: 'Hidra da Procrastinação', epithet: 'Rainha do Labirinto do Caos', theme: 'caos', lore: 'Cada tarefa adiada faz crescer uma cabeça nova. Mas cada uma cortada de verdade não volta.' },
    dailies: [
      { title: 'Planejar o dia (5 min)', description: 'Escolha as 3 missões mais importantes de hoje.', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { organizacao: 2, disciplina: 1 } },
      { title: 'Concluir a missão nº 1 antes do meio-dia', description: 'A tarefa mais importante primeiro.', type: 'principal', difficulty: 2, recurrence: 'diaria', attrs: { disciplina: 2, concentracao: 1 } },
    ],
    phases: [
      { name: 'Fase 1 — Entrada', missions: [
        { title: 'Arrumar o espaço de trabalho', description: 'Mesa limpa, só o essencial.', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { organizacao: 3 }, days: 2 },
        { title: 'Montar a semana ideal', description: 'Blocos de tempo para trabalho, estudo, treino e descanso.', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { organizacao: 2, disciplina: 1 }, days: 3 },
      ] },
      { name: 'Fase 2 — Corredores', missions: [
        { title: 'Revisão semanal', description: 'O que funcionou, o que não, e o plano da próxima semana.', type: 'secundaria', difficulty: 2, recurrence: 'semanal', attrs: { organizacao: 2, consistencia: 1 }, days: 7 },
        { title: '5 dias seguindo o plano', description: 'Não precisa ser perfeito, precisa ser feito.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { disciplina: 3, consistencia: 1 }, steps: ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5'], days: 8 },
      ] },
      { name: 'Fase 3 — Centro do Labirinto', missions: [
        { title: 'Eliminar a tarefa mais adiada', description: 'Aquela que você evita há semanas.', type: 'dominio', difficulty: 4, recurrence: 'unica', attrs: { disciplina: 3, concentracao: 1 }, days: 14 },
      ] },
    ],
  },
  {
    id: 'comunicacao', match: /(comunica|falar|apresenta|timidez|social|amizade|networking|ingl[eê]s|idioma|escrever)/i,
    title: 'A Torre dos Ecos', summary: 'Falar com mais clareza e confiança, escrever melhor e criar conexões.',
    boss: { name: 'O Eco Silencioso', epithet: 'Guardião da Torre dos Ecos', theme: 'sombra', lore: 'Ele repete tudo que você não disse. Cada conversa corajosa o faz perder a voz.' },
    dailies: [
      { title: 'Iniciar uma conversa', description: 'Uma mensagem ou conversa que você normalmente evitaria.', type: 'rapida', difficulty: 2, recurrence: 'diaria', attrs: { comunicacao: 2 } },
    ],
    phases: [
      { name: 'Fase 1 — Primeiros sons', missions: [
        { title: 'Gravar 2 minutos falando sobre um tema', description: 'Ouça depois e anote 2 melhorias.', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { comunicacao: 3 }, days: 4 },
      ] },
      { name: 'Fase 2 — Ressonância', missions: [
        { title: 'Escrever um texto e pedir feedback', description: 'Post, e-mail importante ou artigo.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { comunicacao: 2, inteligencia: 1 }, days: 10 },
      ] },
      { name: 'Fase 3 — A Voz', missions: [
        { title: 'Apresentar algo para um grupo', description: 'Reunião, aula, vídeo público ou evento.', type: 'dominio', difficulty: 4, recurrence: 'unica', attrs: { comunicacao: 3, disciplina: 1 }, days: 21 },
      ] },
    ],
  },
];

/** Modelo genérico: funciona para qualquer objetivo escrito. */
export function genericTemplate(goal: string): CampaignTemplate {
  const g = goal.trim().replace(/^quero\s+/i, '').replace(/\.$/, '');
  const cap = g.charAt(0).toUpperCase() + g.slice(1);
  return {
    id: 'generico', match: /.*/,
    title: `A Fenda de ${cap.length > 34 ? cap.slice(0, 34) + '…' : cap}`,
    summary: `Campanha para: ${cap}. Dividida em fases pequenas, com prazos realistas.`,
    boss: { name: 'Sentinela do Limiar', epithet: 'Guardião do Objetivo', theme: 'tempo', lore: 'Ele guarda a porta entre quem você é e quem quer ser. Não pode ser enganado: só cede a etapas reais concluídas.' },
    dailies: [
      { title: `15 min dedicados: ${cap}`, description: 'Um bloco curto e diário de avanço.', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { consistencia: 2, disciplina: 1 } },
    ],
    phases: [
      { name: 'Fase 1 — Clareza', missions: [
        { title: 'Definir o que é "concluído"', description: 'Escreva como você vai saber que alcançou o objetivo (algo mensurável).', type: 'principal', difficulty: 1, recurrence: 'unica', attrs: { organizacao: 2, inteligencia: 1 }, days: 2 },
        { title: 'Listar os 5 primeiros passos', description: 'Ações concretas, cada uma com menos de 1 hora.', type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { organizacao: 2, disciplina: 1 }, days: 3 },
      ] },
      { name: 'Fase 2 — Avanço', missions: [
        { title: 'Executar os 5 passos', description: 'Marque cada um ao terminar.', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { disciplina: 2, consistencia: 1 }, steps: ['Passo 1', 'Passo 2', 'Passo 3', 'Passo 4', 'Passo 5'], days: 14 },
        { title: 'Revisão de progresso', description: 'O que mudou? Ajuste o plano.', type: 'secundaria', difficulty: 2, recurrence: 'semanal', attrs: { organizacao: 2 }, days: 7 },
      ] },
      { name: 'Fase 3 — Conquista', missions: [
        { title: 'Entregar o resultado final', description: 'A prova concreta de que o objetivo foi alcançado.', type: 'epica', difficulty: 4, recurrence: 'unica', attrs: { disciplina: 2, consistencia: 1, organizacao: 1 }, days: 30 },
      ] },
    ],
  };
}

export function pickTemplate(goal: string): CampaignTemplate {
  return TEMPLATES.find((t) => t.match.test(goal)) ?? genericTemplate(goal);
}

/** Banco de missões surpresa (opcionais, curtas, nunca obrigatórias). */
export const SURPRISE_POOL: MissionSeed[] = [
  { title: 'Caminhada de 15 minutos', description: 'Sem fone. Só observe ao redor.', type: 'surpresa', difficulty: 1, recurrence: 'unica', attrs: { condicionamento: 2, autocuidado: 1 } },
  { title: '20 flexões (pode dividir)', description: 'Em quantas séries precisar.', type: 'surpresa', difficulty: 2, recurrence: 'unica', attrs: { forca: 2, resistencia: 1 } },
  { title: 'Ler 10 páginas', description: 'Qualquer livro que te faça crescer.', type: 'surpresa', difficulty: 1, recurrence: 'unica', attrs: { conhecimento: 2, concentracao: 1 } },
  { title: 'Organizar uma gaveta', description: 'Só uma. Pequenas vitórias.', type: 'surpresa', difficulty: 1, recurrence: 'unica', attrs: { organizacao: 2 } },
  { title: 'Mandar mensagem para alguém importante', description: 'Alguém de quem você sente falta.', type: 'surpresa', difficulty: 1, recurrence: 'unica', attrs: { comunicacao: 2 } },
  { title: 'Revisar um gasto recorrente', description: 'Ainda faz sentido pagar por isso?', type: 'surpresa', difficulty: 1, recurrence: 'unica', attrs: { financas: 2 } },
  { title: '5 minutos de respiração', description: 'Inspire 4s, segure 4s, solte 6s.', type: 'surpresa', difficulty: 1, recurrence: 'unica', attrs: { autocuidado: 2, concentracao: 1 } },
  { title: 'Revisar o que estudou ontem', description: 'Escreva 3 coisas que lembra.', type: 'surpresa', difficulty: 2, recurrence: 'unica', attrs: { conhecimento: 1, inteligencia: 2 } },
];
