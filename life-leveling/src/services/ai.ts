// IA opcional do SISTEMA (Claude). A chave é digitada pelo próprio jogador e fica só no aparelho;
// nenhuma chave é embutida no código. Sem chave, sem internet ou acima do limite diário,
// o SISTEMA usa o modo offline (core/gm.ts).
import Anthropic from '@anthropic-ai/sdk';
import type { GameState, Settings } from '../core/types';
import { aiContext, validateAiCampaign } from '../core/gm';
import type { CampaignTemplate } from '../data/campaigns';
import { dayKey } from '../core/util';

const STYLE_PROMPT: Record<Settings['gmStyle'], string> = {
  sistema: 'Fale como um SISTEMA de RPG: mensagens curtas, frias, misteriosas e diretas, com cabeçalho [ SISTEMA ].',
  mentor: 'Fale como um mentor paciente: explique, planeje e oriente com clareza e gentileza.',
  narrador: 'Fale como narrador épico de um RPG sombrio e sério (nada infantil), mas sempre ligado às ações reais do jogador.',
  estrategista: 'Fale como estrategista: analise prioridades, liste recomendações numeradas e justifique.',
};

const BASE_SYSTEM = `Você é o SISTEMA, mestre de jogo do aplicativo LIFE LEVELING: AWAKENING, um RPG em que a vida real do jogador é o mundo.
Regras obrigatórias:
- Use somente os dados fornecidos no contexto. Nunca invente registros, números ou conquistas.
- Separe FATOS (dados registrados) de RECOMENDAÇÕES (sugestões suas).
- Respeite recuperação, sono e limites: nunca incentive excesso de treino ou culpa.
- Responda em português do Brasil, de forma concisa (no máximo ~180 palavras).
- Atributos são indicadores do jogo, não diagnósticos.`;

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: string };

function canUse(s: GameState): string | null {
  const ai = s.settings.ai;
  if (!ai.enabled) return 'IA desativada nas configurações.';
  if (!ai.apiKey.trim()) return 'Nenhuma chave de API configurada.';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sem conexão com a internet.';
  const used = ai.usedDay === dayKey() ? ai.usedToday : 0;
  if (used >= ai.dailyLimit) return `Limite diário de ${ai.dailyLimit} chamadas atingido.`;
  return null;
}

function client(s: GameState) {
  return new Anthropic({ apiKey: s.settings.ai.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 });
}

function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Chave de API inválida.';
  if (e instanceof Anthropic.RateLimitError) return 'Limite de uso da API atingido. Tente mais tarde.';
  if (e instanceof Anthropic.BadRequestError) return `Requisição recusada: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Falha de conexão com a IA.';
  if (e instanceof Anthropic.APIError) return `Erro da IA (${e.status}).`;
  return 'Falha inesperada na IA.';
}

async function ask(s: GameState, system: string, user: string, maxTokens: number): Promise<AiResult<string>> {
  const blocked = canUse(s);
  if (blocked) return { ok: false, error: blocked };
  try {
    const response = await client(s).beta.messages.create({
      model: s.settings.ai.model || 'claude-opus-5-5',
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: user }],
    } as never) as unknown as Anthropic.Beta.BetaMessage;
    if (response.stop_reason === 'refusal') return { ok: false, error: 'A IA recusou este pedido.' };
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) return { ok: false, error: 'A IA não retornou texto.' };
    return { ok: true, value: text };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

export function markUsage(d: GameState) {
  const today = dayKey();
  if (d.settings.ai.usedDay !== today) { d.settings.ai.usedDay = today; d.settings.ai.usedToday = 0; }
  d.settings.ai.usedToday += 1;
}

export async function aiChat(s: GameState, question: string): Promise<AiResult<string>> {
  const history = s.chat.slice(-6).map((m) => `${m.from === 'jogador' ? 'Jogador' : 'SISTEMA'}: ${m.text}`).join('\n');
  return ask(s, `${BASE_SYSTEM}\n${STYLE_PROMPT[s.settings.gmStyle]}`, `CONTEXTO DO JOGADOR (dados reais):\n${aiContext(s)}\n\nCONVERSA RECENTE:\n${history}\n\nPERGUNTA: ${question}`, 2000);
}

export async function aiCampaign(s: GameState, goal: string): Promise<AiResult<CampaignTemplate>> {
  const prompt = `Crie uma campanha de RPG para o objetivo real: "${goal}".
Responda APENAS com JSON válido, sem texto fora dele, no formato:
{"title":string,"summary":string,"boss":{"name":string,"epithet":string,"theme":"codigo"|"forca"|"caos"|"ouro"|"sombra"|"espelho"|"tempo","lore":string},
"dailies":[{"title":string,"description":string,"type":"rapida","difficulty":1-5,"attrs":{"<atributo>":1-3}}],
"phases":[{"name":string,"missions":[{"title":string,"description":string,"type":"principal"|"secundaria"|"dominio"|"epica"|"lendaria","difficulty":1-5,"recurrence":"unica"|"semanal","attrs":{"<atributo>":1-3},"steps":[string],"days":number}]}]}
Atributos válidos: forca, resistencia, condicionamento, inteligencia, conhecimento, disciplina, concentracao, consistencia, organizacao, comunicacao, autocuidado, financas (máx. 3 por missão).
Use 3 fases, 1 a 3 missões por fase, etapas pequenas e concretas, prazos realistas. Não inclua XP (o sistema calcula).`;
  const r = await ask(s, `${BASE_SYSTEM}\nVocê gera campanhas em JSON estrito.\nCONTEXTO:\n${aiContext(s)}`, prompt, 4000);
  if (!r.ok) return r;
  const json = r.value.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { ok: false, error: 'A IA não retornou JSON.' };
  try {
    const v = validateAiCampaign(JSON.parse(json), goal);
    return v.ok ? { ok: true, value: v.tpl } : { ok: false, error: v.error };
  } catch {
    return { ok: false, error: 'JSON da IA inválido.' };
  }
}
