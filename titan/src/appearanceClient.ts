import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './data/supabase';
import {
  buildAppearanceRequest, extractJsonText, validateImages,
  type AppearanceImage, type AppearanceProfile, type PhotoKind,
} from '../supabase/functions/_shared/appearance';
import { parseAppearanceResult, type AppearanceResult } from './domain/appearance';

const KEY_STORAGE = 'titan-anthropic-key';

/** Chave da API guardada SOMENTE neste aparelho (localStorage). Nunca vai para o banco nem para o backup. */
export const apiKeyStore = {
  get(): string | null { try { return localStorage.getItem(KEY_STORAGE); } catch { return null; } },
  set(k: string) { localStorage.setItem(KEY_STORAGE, k.trim()); },
  clear() { try { localStorage.removeItem(KEY_STORAGE); } catch { /* sem armazenamento */ } },
};

export function looksLikeApiKey(k: string) { return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim()); }

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function toAppearanceImage(kind: PhotoKind, jpeg: Blob): Promise<AppearanceImage> {
  return { kind, mediaType: 'image/jpeg', base64: await blobToBase64(jpeg) };
}

export type AnalyzeOutcome = { ok: true; result: AppearanceResult; model: string; removed: number } | { ok: false; error: string };

function finish(raw: unknown, model: string): AnalyzeOutcome {
  const p = parseAppearanceResult(raw);
  return p.ok ? { ok: true, result: p.value, model, removed: p.removed } : p;
}

/** Chamada direta do aparelho à API da Anthropic com a chave do próprio usuário. */
export async function analyzeWithKey(apiKey: string, images: AppearanceImage[], profile: AppearanceProfile, deps: { client?: Anthropic } = {}): Promise<AnalyzeOutcome> {
  const invalid = validateImages(images);
  if (invalid) return { ok: false, error: invalid };
  const client = deps.client ?? new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const params = buildAppearanceRequest(images, profile) as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
    const message = await client.beta.messages.stream(params).finalMessage();
    const { text, error } = extractJsonText(message);
    if (error) return { ok: false, error };
    return finish(text, message.model);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'Chave da API inválida ou revogada.' };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'A chave não tem permissão para este modelo.' };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: 'Limite de uso da API atingido. Tente mais tarde.' };
    if (e instanceof Anthropic.BadRequestError) return { ok: false, error: `Pedido recusado pela API: ${e.message}` };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Erro da API (${e.status ?? 'rede'}). Tente novamente.` };
    return { ok: false, error: 'Sem conexão com o serviço de IA.' };
  }
}

/** Chamada via Edge Function do Supabase (chave fica no servidor). */
export async function analyzeWithCloud(images: AppearanceImage[], profile: AppearanceProfile): Promise<AnalyzeOutcome> {
  if (!supabase) return { ok: false, error: 'Nuvem não configurada.' };
  const invalid = validateImages(images);
  if (invalid) return { ok: false, error: invalid };
  const { data, error } = await supabase.functions.invoke('analyze-appearance', { body: { images, profile } });
  if (error) {
    let msg = 'A função de análise não respondeu. Ela foi publicada no Supabase (veja o README)?';
    try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch { /* corpo não-JSON */ }
    return { ok: false, error: msg };
  }
  return finish((data as { result: unknown }).result, (data as { model?: string }).model ?? 'desconhecido');
}
