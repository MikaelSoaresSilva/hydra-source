import type { AttrKey } from '../core/types';

export const ATTRS: Record<AttrKey, { name: string; short: string; color: string; how: string; real: string }> = {
  forca: { name: 'Força', short: 'FOR', color: '#ff6b6b', how: 'Treinos de musculação, exercícios com carga e progressão de peso.', real: 'Cargas e repetições no módulo Treino' },
  resistencia: { name: 'Resistência', short: 'RES', color: '#ff9f43', how: 'Treinos longos, séries altas, manter o esforço mesmo cansado.', real: 'Duração e volume dos treinos' },
  condicionamento: { name: 'Condicionamento', short: 'CON', color: '#feca57', how: 'Cardio, caminhadas, corrida, mobilidade e esportes.', real: 'Minutos de atividade' },
  inteligencia: { name: 'Inteligência', short: 'INT', color: '#4cc9ff', how: 'Resolver problemas, exercícios práticos, projetos e testes.', real: 'Evidências práticas na Árvore de Conhecimento' },
  conhecimento: { name: 'Conhecimento', short: 'CNH', color: '#48dbfb', how: 'Sessões de estudo, leitura, aulas e revisões.', real: 'Horas estudadas' },
  disciplina: { name: 'Disciplina', short: 'DIS', color: '#a29bfe', how: 'Cumprir missões principais e o que você planejou, no prazo.', real: 'Missões principais concluídas' },
  concentracao: { name: 'Concentração', short: 'FOC', color: '#7b6cff', how: 'Blocos de foco sem distração, estudo profundo.', real: 'Sessões de estudo de 25 min ou mais' },
  consistencia: { name: 'Consistência', short: 'CST', color: '#c06bff', how: 'Voltar todos os dias. Missões diárias e sequências.', real: 'Dias ativos e sequência' },
  organizacao: { name: 'Organização', short: 'ORG', color: '#1dd1a1', how: 'Planejar a semana, arrumar o ambiente, revisar tarefas.', real: 'Missões de organização' },
  comunicacao: { name: 'Comunicação', short: 'COM', color: '#ff9ff3', how: 'Conversas difíceis, apresentações, escrever, networking.', real: 'Missões sociais registradas' },
  autocuidado: { name: 'Autocuidado', short: 'AUT', color: '#5fd38d', how: 'Sono, água, alimentação, higiene, descanso e aparência.', real: 'Registros de autocuidado' },
  financas: { name: 'Independência Financeira', short: 'FIN', color: '#ffd166', how: 'Economizar, registrar gastos, aprender sobre dinheiro, renda extra.', real: 'Valores economizados nas metas' },
};

export const CLASSES = [
  { id: 'guerreiro', name: 'Guerreiro em Ascensão', desc: 'Corpo como fundação. Bônus visual de aura carmesim; habilidades de impacto.', attrs: ['forca', 'resistencia', 'disciplina'] as AttrKey[], color: '#ff5d73', branch: 'lamina' },
  { id: 'sombra', name: 'Andarilho das Sombras', desc: 'Velocidade e precisão. Rotinas curtas e certeiras, combos rápidos.', attrs: ['condicionamento', 'concentracao', 'consistencia'] as AttrKey[], color: '#9b7bff', branch: 'sombra' },
  { id: 'arcano', name: 'Arcanista do Véu', desc: 'Conhecimento é poder. Estudos e projetos alimentam habilidades arcanas.', attrs: ['inteligencia', 'conhecimento', 'concentracao'] as AttrKey[], color: '#4cc9ff', branch: 'arcano' },
  { id: 'bastiao', name: 'Bastião Inabalável', desc: 'Resiliência e autocuidado. Defesa alta e recuperação constante.', attrs: ['resistencia', 'autocuidado', 'consistencia'] as AttrKey[], color: '#5fd38d', branch: 'bastiao' },
  { id: 'estrategista', name: 'Estrategista do Limiar', desc: 'Planejamento, dinheiro e comunicação. Vence antes da batalha começar.', attrs: ['organizacao', 'financas', 'comunicacao'] as AttrKey[], color: '#ffd166', branch: 'estrategia' },
];
