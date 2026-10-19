import type { KnowledgeNode } from '../core/types';

type Seed = Omit<KnowledgeNode, 'evidence'>;

export const KNOWLEDGE_TREES: Record<string, { name: string; color: string }> = {
  backend: { name: 'Programação Backend', color: '#4cc9ff' },
  financas: { name: 'Educação Financeira', color: '#ffd166' },
  comunicacao: { name: 'Comunicação', color: '#ff9ff3' },
};

export const KNOWLEDGE_SEEDS: Seed[] = [
  { id: 'k_logica', tree: 'backend', name: 'Lógica de Programação', description: 'Variáveis, condições, laços, funções. Resolva 10 exercícios.', prereqs: [] },
  { id: 'k_linguagem', tree: 'backend', name: 'Uma Linguagem a Fundo', description: 'JavaScript/TypeScript ou Python: tipos, coleções, módulos, erros.', prereqs: ['k_logica'] },
  { id: 'k_git', tree: 'backend', name: 'Git e GitHub', description: 'Commits, branches, pull requests. Publique um repositório.', prereqs: ['k_logica'] },
  { id: 'k_http', tree: 'backend', name: 'HTTP e APIs REST', description: 'Métodos, status, JSON. Crie uma API com 3 rotas.', prereqs: ['k_linguagem'] },
  { id: 'k_db', tree: 'backend', name: 'Bancos de Dados', description: 'SQL, modelagem, índices. Conecte sua API a um banco.', prereqs: ['k_http'] },
  { id: 'k_auth', tree: 'backend', name: 'Autenticação', description: 'Senhas com hash, sessões/JWT, autorização por usuário.', prereqs: ['k_db'] },
  { id: 'k_auto', tree: 'backend', name: 'Automação e Deploy', description: 'Scripts, testes automatizados, CI e publicação.', prereqs: ['k_auth', 'k_git'] },
  { id: 'k_projeto', tree: 'backend', name: 'Projeto Final: Sistema Completo', description: 'Uma API publicada, com banco, login e testes.', prereqs: ['k_auto'] },

  { id: 'f_orcamento', tree: 'financas', name: 'Orçamento Pessoal', description: 'Registre gastos por 30 dias e monte seu orçamento.', prereqs: [] },
  { id: 'f_reserva', tree: 'financas', name: 'Reserva de Emergência', description: 'Entenda e comece sua reserva (meta de meses de custo).', prereqs: ['f_orcamento'] },
  { id: 'f_dividas', tree: 'financas', name: 'Controle de Dívidas', description: 'Juros, priorização e renegociação.', prereqs: ['f_orcamento'] },
  { id: 'f_invest', tree: 'financas', name: 'Investimentos Básicos', description: 'Renda fixa, risco, liquidez e diversificação.', prereqs: ['f_reserva'] },
  { id: 'f_renda', tree: 'financas', name: 'Renda Extra', description: 'Transforme uma habilidade em renda. Primeiro cliente/venda.', prereqs: ['f_orcamento'] },

  { id: 'c_escuta', tree: 'comunicacao', name: 'Escuta Ativa', description: 'Perguntas abertas, resumir o que ouviu, empatia.', prereqs: [] },
  { id: 'c_escrita', tree: 'comunicacao', name: 'Escrita Clara', description: 'Mensagens objetivas, estrutura, revisão.', prereqs: [] },
  { id: 'c_fala', tree: 'comunicacao', name: 'Falar em Público', description: 'Prepare e apresente uma fala de 5 minutos.', prereqs: ['c_escuta', 'c_escrita'] },
];

/**
 * Nível de domínio (0–4). Assistir aula sozinho nunca passa do nível 1.
 * 0 Não iniciado · 1 Aprendiz (lição) · 2 Praticante (exercício) · 3 Testado (teste ≥70) · 4 Dominado (projeto + prática/teste)
 */
export function masteryLevel(n: KnowledgeNode): number {
  const has = (t: string) => n.evidence.some((e) => e.type === t);
  const passedTest = n.evidence.some((e) => e.type === 'teste' && (e.score ?? 0) >= 70);
  const practice = has('exercicio') || passedTest;
  if (has('projeto') && practice) return 4;
  if (passedTest) return 3;
  if (has('exercicio')) return 2;
  if (n.evidence.length > 0) return 1;
  return 0;
}

export const MASTERY_LABEL = ['Não iniciado', 'Aprendiz', 'Praticante', 'Testado', 'Dominado'];

export function nodeUnlocked(n: KnowledgeNode, all: KnowledgeNode[]): boolean {
  return n.prereqs.every((p) => {
    const pn = all.find((x) => x.id === p);
    return pn ? masteryLevel(pn) >= 2 : true;
  });
}
