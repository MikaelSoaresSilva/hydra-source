// Edge Function: recebe fotos já reduzidas (sem EXIF) + perfil mínimo, chama a API do Claude
// com a chave guardada como segredo do projeto (ANTHROPIC_API_KEY) e devolve o JSON de sugestões.
// Deploy: supabase secrets set ANTHROPIC_API_KEY=... && supabase functions deploy analyze-appearance
// As fotos NÃO são gravadas aqui; só trafegam para a Anthropic nesta chamada.
import Anthropic from 'npm:@anthropic-ai/sdk@0.134.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildAppearanceRequest, extractJsonText, validateImages, type AppearanceImage, type AppearanceProfile } from '../_shared/appearance.ts';

const DAILY_LIMIT = 10;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Integração de IA não configurada no servidor.' }, 503);

  // Identifica o usuário pelo JWT da sessão (o gateway já exige um token válido).
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'Não autenticado' }, 401);

  // Limite simples de custo: análises por IA salvas nas últimas 24 h (RLS: só as do próprio usuário).
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await sb.from('appearance_analyses').select('id', { count: 'exact', head: true }).eq('source', 'ai').gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Limite de ${DAILY_LIMIT} análises por dia atingido.` }, 429);

  let body: { images: AppearanceImage[]; profile: AppearanceProfile };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const invalid = validateImages(body.images);
  if (invalid) return json({ error: invalid }, 400);

  const client = new Anthropic({ apiKey });
  try {
    // deno-lint-ignore no-explicit-any
    const message = await client.beta.messages.stream(buildAppearanceRequest(body.images, body.profile ?? {}) as any).finalMessage();
    const { text, error } = extractJsonText(message as never);
    if (error) return json({ error }, 422);
    return json({ model: message.model, result: JSON.parse(text!) });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic', e.status, e.message);
      return json({ error: e.status === 429 ? 'Serviço de IA ocupado, tente em instantes.' : 'Falha ao consultar o serviço de IA.' }, 502);
    }
    console.error(e);
    return json({ error: 'Erro interno' }, 500);
  }
});
