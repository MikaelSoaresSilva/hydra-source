// Backend do Ascend Face AI — lógica pura (testável em Node e Deno).
// Rotas: GET /health · POST /chat · POST /simulate · POST /delete-account
// As chaves de IA ficam SOMENTE nas variáveis de ambiente do servidor.

export type Env = Record<string, string | undefined>;
type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ascend-token, authorization",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
}

const SYSTEM = `Você é o ASCEND AI, consultor de apresentação pessoal e grooming masculino dentro de um app de análise facial.
Regras:
- Responda em português do Brasil, de forma direta, prática e gentil.
- Baseie-se SOMENTE nos relatórios fornecidos (números medidos por visão computacional). Cite os valores relevantes.
- Trate as notas como estimativas visuais com limitações, nunca como verdade sobre o valor ou a beleza da pessoa.
- Priorize o que é modificável (pele, cabelo, barba, sobrancelhas, sono, composição corporal, fotos).
- Nunca recomende cirurgias, hormônios, medicamentos, "mewing" agressivo, aparelhos ou intervenções arriscadas. Para questões médicas, odontológicas ou dermatológicas persistentes, sugira um profissional.
- Não incentive obsessão por notas ou comparações com outras pessoas. Se a pessoa parecer muito angustiada com a aparência, acolha e sugira apoio profissional.
- Se a pergunta não puder ser respondida com os dados, diga isso.`;

export async function chatAnswer(env: Env, body: any, f: FetchFn): Promise<string> {
  const question = String(body?.question ?? "").slice(0, 2000);
  if (!question) throw new Error("Pergunta vazia");
  const reports = JSON.stringify(body?.reports ?? []).slice(0, 60000);
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const userContent = `Relatórios do usuário (mais recente primeiro):\n${reports}\n\nPergunta: ${question}`;
  const provider = (env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : "openai")).toLowerCase();

  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada no servidor");
    const messages = [
      ...history.map((h: any) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text ?? "") })),
      { role: "user", content: userContent },
    ];
    // A API exige alternância e começar por "user".
    const fixed: any[] = [];
    for (const m of messages) {
      if (fixed.length === 0 && m.role !== "user") continue;
      if (fixed.length && fixed[fixed.length - 1].role === m.role) fixed[fixed.length - 1].content += "\n" + m.content;
      else fixed.push(m);
    }
    const r = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5", max_tokens: 1200, system: SYSTEM, messages: fixed }),
    });
    const d: any = await r.json();
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${d?.error?.message ?? "erro"}`);
    return (d.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
  }

  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no servidor");
  const r = await f("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        ...history.map((h: any) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text ?? "") })),
        { role: "user", content: userContent },
      ],
    }),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${d?.error?.message ?? "erro"}`);
  return String(d.choices?.[0]?.message?.content ?? "").trim();
}

export async function simulate(env: Env, body: any, f: FetchFn): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error("Simulador requer OPENAI_API_KEY (modelo de edição de imagem) no servidor");
  const b64 = String(body?.imageBase64 ?? "");
  const instruction = String(body?.instruction ?? "").slice(0, 300);
  if (!b64 || !instruction) throw new Error("Imagem e estilo são obrigatórios");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bytes.length > 8_000_000) throw new Error("Imagem muito grande");
  const prompt = `Edite esta foto real da mesma pessoa aplicando APENAS: ${instruction}. ` +
    "Preserve exatamente a identidade, o formato do rosto, olhos, nariz, boca, tom de pele, expressão, iluminação, roupa e fundo. " +
    "Não embeleze, não afine o rosto, não altere nada além do que foi pedido. Resultado fotorrealista.";
  const form = new FormData();
  form.append("model", env.IMAGE_MODEL ?? "gpt-image-1");
  form.append("prompt", prompt);
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), "face.jpg");
  form.append("size", "1024x1536");
  const r = await f("https://api.openai.com/v1/images/edits", {
    method: "POST", headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form,
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(`OpenAI Images ${r.status}: ${d?.error?.message ?? "erro"}`);
  const out = d?.data?.[0]?.b64_json;
  if (!out) throw new Error("O modelo não retornou imagem");
  return out;
}

export async function deleteAccount(env: Env, authHeader: string | null, f: FetchFn): Promise<void> {
  const url = env.SUPABASE_URL, service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Exclusão de conta não configurada no servidor");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Sessão do usuário ausente");
  const u = await f(`${url}/auth/v1/user`, { headers: { apikey: service, authorization: authHeader } });
  const user: any = await u.json();
  if (!u.ok || !user?.id) throw new Error("Sessão inválida");
  await f(`${url}/rest/v1/analyses?user_id=eq.${user.id}`, { method: "DELETE", headers: { apikey: service, authorization: `Bearer ${service}` } });
  const del = await f(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: { apikey: service, authorization: `Bearer ${service}` } });
  if (!del.ok) throw new Error(`Falha ao excluir usuário (${del.status})`);
}

export async function handle(req: Request, env: Env, f: FetchFn = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const token = req.headers.get("x-ascend-token") ?? "";
  if (!env.ASCEND_APP_TOKEN || token !== env.ASCEND_APP_TOKEN) return json({ error: "Token do app inválido" }, 401);
  try {
    if (path.endsWith("/health")) {
      return json({
        ok: true,
        chat: Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY),
        image: Boolean(env.OPENAI_API_KEY),
        provider: (env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : env.OPENAI_API_KEY ? "openai" : "nenhum")),
      });
    }
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
    if (path.endsWith("/chat")) return json({ answer: await chatAnswer(env, await req.json(), f) });
    if (path.endsWith("/simulate")) return json({ imageBase64: await simulate(env, await req.json(), f) });
    if (path.endsWith("/delete-account")) { await deleteAccount(env, req.headers.get("authorization"), f); return json({ ok: true }); }
    return json({ error: "Rota não encontrada" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
