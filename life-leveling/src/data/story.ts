// Narrativa original de LIFE LEVELING: AWAKENING. Funciona 100% offline.

export interface StoryCtx { level: number; missionsDone: number; bosses: number; bestStreak: number; mastered: number; campaignsDone: number; rankIndex: number }

export interface Chapter {
  id: string;
  num: string;
  title: string;
  region: SceneId;
  objective: string;
  unlock: (c: StoryCtx) => boolean;
  progress: (c: StoryCtx) => [number, number];
  pages: string[];
}

export type SceneId = 'santuario' | 'forja' | 'coliseu' | 'limiar';

export const SCENES: Record<SceneId, { name: string; desc: string; fog: string; key: string; rim: string; floor: string }> = {
  santuario: { name: 'Santuário de Status', desc: 'Uma câmara circular de vidro escuro onde o Sistema projeta seus dados.', fog: '#05060c', key: '#4cc9ff', rim: '#7b6cff', floor: '#0b1020' },
  forja: { name: 'A Forja', desc: 'Salão de treino com brasas que nunca se apagam.', fog: '#0d0604', key: '#ff7a3d', rim: '#ffd166', floor: '#1a0d08' },
  coliseu: { name: 'Coliseu de Obsidiana', desc: 'Arena suspensa sobre o vazio, onde as Fendas despejam seus monstros.', fog: '#08040d', key: '#c06bff', rim: '#ff4d8d', floor: '#120a1c' },
  limiar: { name: 'O Limiar', desc: 'O espaço antes do portal. Aqui você se prepara para o que vem.', fog: '#02080a', key: '#5fd38d', rim: '#4cc9ff', floor: '#061214' },
};

export const CHAPTERS: Chapter[] = [
  {
    id: 'cap1', num: 'I', title: 'O Despertar', region: 'santuario',
    objective: 'Conclua 3 missões para estabilizar sua conexão com o Sistema.',
    unlock: () => true,
    progress: (c) => [Math.min(c.missionsDone, 3), 3],
    pages: [
      'Ninguém lembra quando as Fendas começaram a aparecer. Rasgos finos no ar, visíveis só para alguns. Quem as vê, ouve uma voz.',
      'A voz se apresenta como SISTEMA. Não explica de onde vem. Diz apenas que escolheu você, e que escolha não é o mesmo que destino.',
      '"Toda força começa como uma tarefa pequena feita de verdade", diz. "Mostre que você consegue terminar o que começa."',
    ],
  },
  {
    id: 'cap2', num: 'II', title: 'A Forja', region: 'forja',
    objective: 'Alcance o nível 5 e mantenha uma sequência de 3 dias.',
    unlock: (c) => c.missionsDone >= 3,
    progress: (c) => [Math.min(c.level, 5) + Math.min(c.bestStreak, 3), 8],
    pages: [
      'O Sistema abre uma porta que você não sabia que existia. Do outro lado, brasas. Bigornas. O som de metal sendo dobrado.',
      '"Aqui não se forja aço", explica. "Forja-se repetição. Um dia de esforço é faísca. Dias seguidos são fogo."',
      'Sua primeira árvore de talentos se acende. Cada ponto é uma escolha: quem você quer ser quando a próxima Fenda abrir?',
    ],
  },
  {
    id: 'cap3', num: 'III', title: 'O Teste do Caçador', region: 'coliseu',
    objective: 'Derrote seu primeiro Chefe de objetivo e alcance o nível 10.',
    unlock: (c) => c.level >= 5 && c.bestStreak >= 3,
    progress: (c) => [Math.min(c.bosses, 1) * 5 + Math.min(c.level, 10), 15],
    pages: [
      'A primeira Fenda grande se abre sobre o Coliseu de Obsidiana. De dentro dela, algo observa.',
      'Os Chefes do Véu não são monstros comuns. Cada um se alimenta de algo que você deixou pela metade: um projeto, uma promessa, uma meta.',
      '"Não se derrota um Chefe com um golpe", avisa o Sistema. "Derrota-se fase por fase. Etapa real por etapa real."',
    ],
  },
  {
    id: 'cap4', num: 'IV', title: 'A Ascensão', region: 'limiar',
    objective: 'Alcance o rank C, conclua uma campanha e domine uma habilidade real.',
    unlock: (c) => c.bosses >= 1 && c.level >= 10,
    progress: (c) => [Math.min(c.rankIndex, 2) + Math.min(c.campaignsDone, 1) + Math.min(c.mastered, 1), 4],
    pages: [
      'Você começa a notar: as pessoas ao redor percebem a mudança antes de você. A postura. O jeito de cumprir o que diz.',
      'No Limiar, o Sistema revela algo novo: outros despertos existiram. Muitos pararam. O Véu guarda os ecos deles.',
      '"Eles não falharam por cair", diz o Sistema. "Falharam por acreditar que cair era o fim. Você já voltou antes. Lembre disso."',
    ],
  },
  {
    id: 'cap5', num: 'V', title: 'Além dos Limites', region: 'limiar',
    objective: 'Capítulo contínuo: o Sistema passa a criar desafios a partir da sua evolução.',
    unlock: (c) => c.rankIndex >= 2 && c.campaignsDone >= 1 && c.mastered >= 1,
    progress: (c) => [c.level, 100],
    pages: [
      'As Fendas mudam de forma. Agora elas respondem a você: às áreas em que cresceu e às que deixou de lado.',
      '"Daqui em diante, não há roteiro", anuncia o Sistema. "Há apenas o próximo limite. E você já sabe o que fazer com limites."',
      'O Capítulo V não termina. Ele acompanha sua vida. Novas campanhas surgirão do que você registrar e do que quiser conquistar.',
    ],
  },
];
