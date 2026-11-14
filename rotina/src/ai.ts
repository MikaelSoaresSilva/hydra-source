// IA opcional (Claude): só é usada se você ativar e colocar a SUA chave da API, e só quando o
// interpretador local não entende o pedido. O Claude devolve operações; o app valida cada uma e
// o montador do dia decide os horários — a IA nunca consegue criar conflito nem apagar dados sozinha.
import type Anthropic from '@anthropic-ai/sdk';
import { uid } from './domain/defaults';
import type { Op, Scope } from './domain/ops';
import { addDays, hm, parseHM } from './domain/time';
import type { Activity, Priority, State } from './domain/types';

export const AI_MODEL = 'claude-opus-5-5';
const KEY_STORAGE = 'titan-rotina-anthropic-key';

/** Chave guardada SOMENTE neste aparelho. Não vai para o backup. */
export const apiKeyStore = {
  get(): string | null { try { return localStorage.getItem(KEY_STORAGE); } catch { return null; } },
  set(k: string) { localStorage.setItem(KEY_STORAGE, k.trim()); },
  clear() { try { localStorage.removeItem(KEY_STORAGE); } catch { /* sem armazenamento */ } },
};
export const looksLikeApiKey = (k: string) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim());

const nul = (t: string) => ({ type: [t, 'null'] });
export const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ops', 'summary'],
  properties: {
    summary: { type: 'string', description: 'Resumo curto em português do que será mudado.' },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'activityId', 'time', 'minutes', 'scope', 'title', 'categoryId', 'priority'],
        properties: {
          type: { type: 'string', enum: ['setWake', 'setBed', 'move', 'skip', 'duration', 'add', 'remove', 'pause', 'resume'] },
          activityId: nul('string'),
          time: { ...nul('string'), description: 'HH:MM (24 h)' },
          minutes: nul('integer'),
          scope: { type: 'string', enum: ['today', 'tomorrow', 'weekdays', 'weekends', 'everyday'] },
          title: nul('string'),
          categoryId: nul('string'),
          priority: nul('integer'),
        },
      },
    },
  },
} as const;

export interface AiOp { type: string; activityId: string | null; time: string | null; minutes: number | null; scope: string; title: string | null; categoryId: string | null; priority: number | null }

/** Contexto enviado: SÓ a rotina (nomes, horários, durações). Nada de histórico, nome ou e-mail. */
export function aiContext(state: State, today: string): string {
  const acts = state.activities.map((a) => ({
    id: a.id, titulo: a.title, categoria: a.categoryId, duracao_min: a.duration, fixo: a.fixed, prioridade: a.priority, dias: a.days, pausado: a.paused,
    horario: a.anchor.type === 'time' ? hm(a.anchor.at) : a.anchor.type === 'wake' ? `${a.anchor.offset} min após acordar` : `${a.anchor.offset} min antes de dormir`,
  }));
  return JSON.stringify({
    hoje: today,
    sono: { dias_de_semana: { acordar: hm(state.sleep.weekday.wake), dormir: hm(state.sleep.weekday.bed) }, fim_de_semana: { acordar: hm(state.sleep.weekend.wake), dormir: hm(state.sleep.weekend.bed) }, meta: '8 a 9 h' },
    categorias: state.categories.map((c) => ({ id: c.id, nome: c.name })),
    atividades: acts,
  });
}

const SYSTEM = `Você ajusta a rotina diária de um app de organização pessoal. Leia o pedido do usuário (português) e devolva operações no esquema.
Regras:
- Use somente ids de atividades que existem no contexto. Para algo novo, use type "add" com title, minutes, categoryId (um id de categoria existente), time (se o usuário disse um horário) e priority 1–3.
- scope: "today"/"tomorrow" quando o pedido é só para aquele dia; "weekdays", "weekends" ou "everyday" quando é permanente. Na dúvida sobre algo pontual ("hoje", "agora"), use "today".
- setWake/setBed: time obrigatório. Ao mudar o acordar, o app mantém o mesmo tempo de sono sozinho. Preserve 8–9 h de sono.
- skip = não fazer só naquele dia; remove = tirar da rotina para sempre (só se o usuário pedir claramente); pause/resume = pausar/retomar.
- Não decida os horários de todas as atividades: o app reencaixa sozinho, sem conflitos. Gere só as operações necessárias.
- Se o pedido não tiver relação com a rotina, devolva ops vazio e explique no summary.`;

/** Converte e valida o que o Claude devolveu. Operações inválidas são descartadas. */
export function fromAi(ops: AiOp[], state: State, today: string): { ops: Op[]; dropped: number } {
  const out: Op[] = [];
  let dropped = 0;
  const exists = (id: string | null) => !!id && state.activities.some((a) => a.id === id);
  for (const o of ops) {
    const date = o.scope === 'tomorrow' ? addDays(today, 1) : today;
    const scope: Scope = o.scope === 'today' || o.scope === 'tomorrow' ? { kind: 'date', date } : { kind: 'always', dayType: o.scope === 'weekends' ? 'weekend' : o.scope === 'everyday' ? 'both' : 'weekday' };
    const t = o.time ? parseHM(o.time) : null;
    const mins = o.minutes && o.minutes > 0 && o.minutes <= 16 * 60 ? Math.round(o.minutes) : null;
    switch (o.type) {
      case 'setWake': if (t !== null) { out.push({ type: 'setWake', at: t, scope, keepSleep: true }); continue; } break;
      case 'setBed': if (t !== null) { out.push({ type: 'setBed', at: t, scope }); continue; } break;
      case 'move': if (exists(o.activityId) && t !== null) { out.push({ type: 'move', id: o.activityId!, at: t, scope }); continue; } break;
      case 'skip': if (exists(o.activityId)) { out.push({ type: 'skip', id: o.activityId!, date }); continue; } break;
      case 'duration': if (exists(o.activityId) && mins) { out.push({ type: 'duration', id: o.activityId!, minutes: mins, scope }); continue; } break;
      case 'remove': if (exists(o.activityId)) { out.push({ type: 'remove', id: o.activityId! }); continue; } break;
      case 'pause': case 'resume': if (exists(o.activityId)) { out.push({ type: 'pause', id: o.activityId!, paused: o.type === 'pause' }); continue; } break;
      case 'add': {
        const title = o.title?.trim().slice(0, 60);
        if (!title) break;
        const cat = state.categories.some((c) => c.id === o.categoryId) ? o.categoryId! : 'life';
        const activity: Activity = {
          id: uid(), title, categoryId: cat, description: 'Criado pela IA a partir do seu pedido.', duration: mins ?? 30,
          anchor: { type: 'time', at: t ?? 15 * 60 }, fixed: t !== null, priority: ([1, 2, 3].includes(o.priority ?? 0) ? o.priority : 2) as Priority,
          days: scope.kind === 'always' && scope.dayType === 'weekend' ? [0, 6] : scope.kind === 'always' && scope.dayType === 'weekday' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6],
          paused: false, notify: true, kind: 'normal',
        };
        out.push({ type: 'add', activity, scope });
        continue;
      }
    }
    dropped++;
  }
  return { ops: out, dropped };
}

export type AiOutcome = { ok: true; ops: Op[]; summary: string; dropped: number } | { ok: false; error: string };

export async function askClaude(apiKey: string, text: string, state: State, today: string, deps: { client?: Anthropic } = {}): Promise<AiOutcome> {
  // SDK carregado só quando a IA é usada (o app abre mais rápido).
  const { default: Sdk } = await import('@anthropic-ai/sdk');
  const client = deps.client ?? new Sdk({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const message = await client.messages.stream({
      model: AI_MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SCHEMA as unknown as Record<string, unknown> } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Rotina atual (JSON):\n${aiContext(state, today)}\n\nPedido do usuário: ${text}` }],
    } as unknown as Anthropic.Messages.MessageStreamParams).finalMessage();
    if (message.stop_reason === 'refusal') return { ok: false, error: 'O modelo recusou o pedido.' };
    if (message.stop_reason === 'max_tokens') return { ok: false, error: 'A resposta foi cortada. Tente um pedido mais curto.' };
    const raw = message.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    const data = JSON.parse(raw) as { ops: AiOp[]; summary: string };
    const { ops, dropped } = fromAi(data.ops ?? [], state, today);
    return { ok: true, ops, summary: data.summary ?? '', dropped };
  } catch (e) {
    if (e instanceof Sdk.AuthenticationError) return { ok: false, error: 'Chave da API inválida ou revogada.' };
    if (e instanceof Sdk.PermissionDeniedError) return { ok: false, error: 'A chave não tem permissão para este modelo.' };
    if (e instanceof Sdk.RateLimitError) return { ok: false, error: 'Limite de uso da API atingido. Tente mais tarde.' };
    if (e instanceof Sdk.APIError) return { ok: false, error: `Erro da API (${e.status ?? 'rede'}). Tente novamente.` };
    if (e instanceof SyntaxError) return { ok: false, error: 'A IA respondeu num formato inesperado. Tente de novo.' };
    return { ok: false, error: 'Sem conexão com o serviço de IA.' };
  }
}
