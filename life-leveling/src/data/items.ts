import type { AttrKey, Rarity, Slot } from '../core/types';

export interface ItemDef {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  desc: string;
  source: string; // como é obtido
  req?: { level?: number };
  effect?: { atk?: number; def?: number; hp?: number; spd?: number; energy?: number; attrBonus?: { attr: AttrKey; pct: number } };
  visual: { color: string; emissive?: string; variant: string };
  set?: string;
}

export const RARITY_INFO: Record<Rarity, { name: string; color: string; glow: number }> = {
  comum: { name: 'Comum', color: '#9aa4b2', glow: 0 },
  incomum: { name: 'Incomum', color: '#5fd38d', glow: 0.2 },
  raro: { name: 'Raro', color: '#4cc9ff', glow: 0.4 },
  epico: { name: 'Épico', color: '#b06bff', glow: 0.6 },
  lendario: { name: 'Lendário', color: '#ffb547', glow: 0.85 },
  mitico: { name: 'Mítico', color: '#ff4d8d', glow: 1 },
};

export const SLOT_INFO: Record<Slot, string> = {
  arma: 'Arma', armadura: 'Armadura', luvas: 'Luvas', botas: 'Botas', acessorio: 'Acessório', traje: 'Traje',
  emblema: 'Emblema', aura: 'Aura', animacao: 'Animação', companheiro: 'Companheiro',
};

export const SETS: Record<string, { name: string; desc: string; bonus: string }> = {
  vigia: { name: 'Vigia da Fenda', desc: 'O equipamento dos primeiros despertos que guardaram as fendas.', bonus: '+5% DEF e aura azul intensificada' },
  eclipse: { name: 'Eclipse Violeta', desc: 'Forjado na noite em que a lua engoliu o sol do Véu.', bonus: '+8% ATK e rastro violeta nos golpes' },
  aurora: { name: 'Aurora de Prata', desc: 'Relíquias de quem atravessou o limiar e voltou inteiro.', bonus: '+10% HP e brilho prateado' },
};

export const ITEMS: ItemDef[] = [
  // ── Iniciais
  { id: 'adaga_iniciado', name: 'Adaga do Iniciado', slot: 'arma', rarity: 'comum', desc: 'Leve, simples e honesta. Todo desperto começa com algo assim.', source: 'Inicial', effect: { atk: 2 }, visual: { color: '#b8c2cc', variant: 'adaga' } },
  { id: 'jaqueta_desperto', name: 'Jaqueta do Desperto', slot: 'armadura', rarity: 'comum', desc: 'Tecido escuro com fibras que brilham levemente quando o Sistema fala.', source: 'Inicial', effect: { def: 2 }, visual: { color: '#1b2233', emissive: '#2a6cff', variant: 'jaqueta' } },
  { id: 'botas_trilha', name: 'Botas de Trilha', slot: 'botas', rarity: 'comum', desc: 'Para quem vai caminhar muito.', source: 'Inicial', effect: { spd: 1 }, visual: { color: '#2b2b33', variant: 'botas' } },
  // ── Recompensas de nível
  { id: 'luvas_forja', name: 'Luvas da Forja', slot: 'luvas', rarity: 'incomum', desc: 'Couro endurecido nas brasas da Forja. Aderência firme em qualquer barra.', source: 'Nível 2', req: { level: 2 }, effect: { atk: 2, attrBonus: { attr: 'forca', pct: 3 } }, visual: { color: '#5b3a29', emissive: '#ff7a3d', variant: 'luvas' } },
  { id: 'emblema_primeira_luz', name: 'Emblema da Primeira Luz', slot: 'emblema', rarity: 'incomum', desc: 'Marca de quem completou o primeiro dia de verdade.', source: 'Nível 3', req: { level: 3 }, visual: { color: '#4cc9ff', emissive: '#4cc9ff', variant: 'losango' } },
  { id: 'aura_brasa', name: 'Aura de Brasa', slot: 'aura', rarity: 'incomum', desc: 'Faíscas quentes sobem dos ombros. Sinal de esforço recente.', source: 'Nível 4', req: { level: 4 }, visual: { color: '#ff7a3d', variant: 'brasa' } },
  { id: 'espada_vigia', name: 'Lâmina do Vigia', slot: 'arma', rarity: 'raro', desc: 'Uma espada reta, sem enfeites, feita para durar a vigília inteira.', source: 'Nível 5', req: { level: 5 }, effect: { atk: 6 }, set: 'vigia', visual: { color: '#c9d6e3', emissive: '#4cc9ff', variant: 'espada' } },
  { id: 'armadura_vigia', name: 'Couraça do Vigia', slot: 'armadura', rarity: 'raro', desc: 'Placas leves sobre tecido reforçado, com runas de alerta.', source: 'Nível 7', req: { level: 7 }, effect: { def: 6, hp: 10 }, set: 'vigia', visual: { color: '#26324a', emissive: '#4cc9ff', variant: 'couraca' } },
  { id: 'companheiro_fagulha', name: 'Fagulha', slot: 'companheiro', rarity: 'raro', desc: 'Um pequeno espírito de luz que decidiu te seguir. Ninguém sabe por quê.', source: 'Nível 8', req: { level: 8 }, visual: { color: '#9be7ff', variant: 'orbe' } },
  { id: 'luvas_vigia', name: 'Manoplas do Vigia', slot: 'luvas', rarity: 'raro', desc: 'Protegem os punhos e firmam o golpe.', source: 'Nível 10', req: { level: 10 }, effect: { atk: 3, def: 3 }, set: 'vigia', visual: { color: '#3a4a66', emissive: '#4cc9ff', variant: 'manoplas' } },
  { id: 'botas_vigia', name: 'Grevas do Vigia', slot: 'botas', rarity: 'raro', desc: 'Passos silenciosos sobre pedra e metal.', source: 'Nível 12', req: { level: 12 }, effect: { spd: 2, def: 2 }, set: 'vigia', visual: { color: '#2c3a55', emissive: '#4cc9ff', variant: 'grevas' } },
  { id: 'aura_abismo', name: 'Aura do Abismo Azul', slot: 'aura', rarity: 'epico', desc: 'Chamas frias, azul-elétrico, que dançam ao seu redor.', source: 'Nível 15', req: { level: 15 }, visual: { color: '#2a7bff', variant: 'chama' } },
  { id: 'animacao_despertar', name: 'Pose: Despertar', slot: 'animacao', rarity: 'epico', desc: 'Pose de vitória: punho erguido enquanto a energia explode para cima.', source: 'Nível 18', req: { level: 18 }, visual: { color: '#4cc9ff', variant: 'despertar' } },
  { id: 'foice_eclipse', name: 'Foice do Eclipse', slot: 'arma', rarity: 'epico', desc: 'Uma lâmina curva que parece engolir a luz ao redor.', source: 'Nível 20', req: { level: 20 }, effect: { atk: 12 }, set: 'eclipse', visual: { color: '#2b1840', emissive: '#b06bff', variant: 'foice' } },
  { id: 'traje_eclipse', name: 'Manto do Eclipse', slot: 'traje', rarity: 'epico', desc: 'Um manto longo cujas bordas se desfazem em fumaça violeta.', source: 'Nível 25', req: { level: 25 }, effect: { def: 5, energy: 10 }, set: 'eclipse', visual: { color: '#1a1026', emissive: '#b06bff', variant: 'manto' } },
  { id: 'armadura_eclipse', name: 'Armadura do Eclipse', slot: 'armadura', rarity: 'epico', desc: 'Placas negras com veios violeta que pulsam como um coração.', source: 'Nível 30', req: { level: 30 }, effect: { def: 12, hp: 25 }, set: 'eclipse', visual: { color: '#17121f', emissive: '#c06bff', variant: 'placas' } },
  { id: 'luvas_eclipse', name: 'Garras do Eclipse', slot: 'luvas', rarity: 'epico', desc: 'Dedos afiados como obsidiana.', source: 'Nível 35', req: { level: 35 }, effect: { atk: 8 }, set: 'eclipse', visual: { color: '#1f1430', emissive: '#c06bff', variant: 'garras' } },
  { id: 'aura_monarca', name: 'Aura do Soberano Silencioso', slot: 'aura', rarity: 'lendario', desc: 'Uma pressão quase visível. O ar fica pesado ao seu redor.', source: 'Nível 40', req: { level: 40 }, visual: { color: '#9b5bff', variant: 'tempestade' } },
  { id: 'espada_aurora', name: 'Aurora, a Que Retorna', slot: 'arma', rarity: 'lendario', desc: 'Uma espada de prata viva. Dizem que volta para a mão de quem nunca desiste de verdade.', source: 'Nível 50', req: { level: 50 }, effect: { atk: 20, hp: 20 }, set: 'aurora', visual: { color: '#eef3ff', emissive: '#bfe3ff', variant: 'montante' } },
  { id: 'armadura_aurora', name: 'Couraça da Aurora', slot: 'armadura', rarity: 'lendario', desc: 'Prata polida que reflete um céu que ainda não nasceu.', source: 'Nível 60', req: { level: 60 }, effect: { def: 20, hp: 40 }, set: 'aurora', visual: { color: '#c8d3e6', emissive: '#ffffff', variant: 'placas' } },
  { id: 'botas_aurora', name: 'Passos da Aurora', slot: 'botas', rarity: 'lendario', desc: 'Cada passo deixa um rastro de luz que demora a apagar.', source: 'Nível 70', req: { level: 70 }, effect: { spd: 4, def: 6 }, set: 'aurora', visual: { color: '#d7e1f2', emissive: '#ffffff', variant: 'grevas' } },
  { id: 'companheiro_corvo', name: 'Corvo do Limiar', slot: 'companheiro', rarity: 'lendario', desc: 'Um corvo feito de sombra e estrelas. Observa tudo.', source: 'Nível 80', req: { level: 80 }, visual: { color: '#2b1840', variant: 'corvo' } },
  { id: 'aura_mitica', name: 'Coroa de Relâmpagos', slot: 'aura', rarity: 'mitico', desc: 'Relâmpagos prateados orbitam sua cabeça. Poucos chegaram até aqui.', source: 'Nível 100', req: { level: 100 }, visual: { color: '#e8f4ff', variant: 'relampago' } },
  // ── Sequências (marcos de consistência)
  { id: 'emblema_7', name: 'Selo da Semana', slot: 'emblema', rarity: 'incomum', desc: '7 dias. O começo de um hábito.', source: 'Sequência de 7 dias', visual: { color: '#5fd38d', emissive: '#5fd38d', variant: 'escudo' } },
  { id: 'acessorio_30', name: 'Anel dos Trinta Sóis', slot: 'acessorio', rarity: 'raro', desc: '30 dias. Você provou que volta.', source: 'Sequência de 30 dias', effect: { attrBonus: { attr: 'consistencia', pct: 5 } }, visual: { color: '#ffd166', emissive: '#ffd166', variant: 'anel' } },
  { id: 'traje_60', name: 'Capa dos Sessenta Dias', slot: 'traje', rarity: 'epico', desc: '60 dias. A capa de quem virou outra pessoa.', source: 'Sequência de 60 dias', effect: { def: 4 }, visual: { color: '#101a2e', emissive: '#4cc9ff', variant: 'capa' } },
  { id: 'animacao_90', name: 'Pose: Ascensão', slot: 'animacao', rarity: 'lendario', desc: '90 dias. Você levita brevemente ao vencer.', source: 'Sequência de 90 dias', visual: { color: '#ffb547', variant: 'levitar' } },
  // ── Chefes e arena
  { id: 'acessorio_codigo', name: 'Amuleto do Compilador', slot: 'acessorio', rarity: 'epico', desc: 'Fragmento do Guardião do Código. Zumbe baixinho quando algo funciona.', source: 'Derrotar um Chefe de objetivo', effect: { attrBonus: { attr: 'inteligencia', pct: 5 } }, visual: { color: '#4cc9ff', emissive: '#4cc9ff', variant: 'amuleto' } },
  { id: 'emblema_chefe', name: 'Marca do Caçador de Chefes', slot: 'emblema', rarity: 'raro', desc: 'Concedida a quem derrubou um grande objetivo.', source: 'Primeiro chefe derrotado', visual: { color: '#ff5d73', emissive: '#ff5d73', variant: 'presa' } },
  { id: 'arma_arena', name: 'Lâmina da Arena', slot: 'arma', rarity: 'raro', desc: 'Conquistada no Coliseu de Obsidiana, golpe a golpe.', source: 'Vencer a Fenda I na arena', effect: { atk: 5, spd: 1 }, visual: { color: '#ffb547', emissive: '#ff7a3d', variant: 'espada' } },
  { id: 'companheiro_sombra', name: 'Sombra Domada', slot: 'companheiro', rarity: 'epico', desc: 'Uma sombra derrotada que decidiu lutar ao seu lado.', source: 'Vencer a Fenda III na arena', visual: { color: '#1a1026', variant: 'sombra' } },
  { id: 'traje_temporada', name: 'Insígnia de Temporada', slot: 'traje', rarity: 'epico', desc: 'Concedida a quem fecha uma temporada pessoal.', source: 'Concluir uma temporada', visual: { color: '#22183a', emissive: '#ffd166', variant: 'capa' } },
];

export const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Recompensas fixas por nível (previsíveis e testáveis). */
export const LEVEL_REWARDS: Record<number, string> = Object.fromEntries(
  ITEMS.filter((i) => i.req?.level && i.source.startsWith('Nível')).map((i) => [i.req!.level!, i.id]),
);

export const STARTER_ITEMS = ['adaga_iniciado', 'jaqueta_desperto', 'botas_trilha'];
