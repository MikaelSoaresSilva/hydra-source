// Testes do backend com fetch simulado (não chama APIs reais). Rodar: node --experimental-strip-types test/handler.test.ts
import { handle } from "../supabase/functions/ascend/handler.ts";
import assert from "node:assert/strict";

const calls: { url: string; init?: any }[] = [];
const fake = async (url: string, init?: any): Promise<Response> => {
  calls.push({ url, init });
  if (url.includes("anthropic.com")) {
    const b = JSON.parse(init.body);
    assert.equal(b.messages[0].role, "user");
    assert.ok(b.system.includes("ASCEND AI"));
    assert.ok(init.headers["x-api-key"] === "sk-ant-test");
    return new Response(JSON.stringify({ content: [{ type: "text", text: "Resposta baseada na pele 62/100" }] }), { status: 200 });
  }
  if (url.includes("chat/completions")) return new Response(JSON.stringify({ choices: [{ message: { content: "ok openai" } }] }));
  if (url.includes("images/edits")) {
    assert.ok(init.body instanceof FormData);
    assert.ok(String(init.body.get("prompt")).includes("Preserve exatamente a identidade"));
    return new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }));
  }
  if (url.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: "u-1" }));
  if (url.includes("/rest/v1/analyses")) return new Response(null, { status: 204 });
  if (url.includes("/auth/v1/admin/users/u-1")) return new Response("{}", { status: 200 });
  return new Response("{}", { status: 404 });
};

const base = "https://x.supabase.co/functions/v1/ascend";
const env = { ASCEND_APP_TOKEN: "tok", ANTHROPIC_API_KEY: "sk-ant-test", OPENAI_API_KEY: "sk-oa", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srv" };
const req = (p: string, body?: any, headers: Record<string, string> = { "x-ascend-token": "tok" }) =>
  new Request(base + p, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

let r = await handle(req("/health", undefined, {}), env, fake);
assert.equal(r.status, 401, "sem token deve negar");

r = await handle(req("/health"), env, fake);
let j: any = await r.json();
assert.equal(j.chat, true); assert.equal(j.image, true); assert.equal(j.provider, "anthropic");

r = await handle(req("/chat", { question: "Como melhorar a pele?", reports: [{ overall: 70 }], history: [{ role: "assistant", text: "oi" }, { role: "user", text: "a" }] }), env, fake);
j = await r.json();
assert.equal(r.status, 200, JSON.stringify(j)); assert.ok(j.answer.includes("62/100"));

r = await handle(req("/chat", { question: "x" }), { ...env, AI_PROVIDER: "openai" }, fake);
assert.equal((await r.json()).answer, "ok openai");

r = await handle(req("/chat", { question: "" }), env, fake);
assert.equal(r.status, 400);

r = await handle(req("/simulate", { imageBase64: btoa("fakejpeg"), instruction: "Barba curta" }), env, fake);
j = await r.json();
assert.equal(j.imageBase64, "aGVsbG8=");

r = await handle(req("/simulate", { imageBase64: btoa("x"), instruction: "Barba" }), { ASCEND_APP_TOKEN: "tok" }, fake);
assert.equal(r.status, 400); assert.ok((await r.json()).error.includes("OPENAI_API_KEY"));

r = await handle(req("/delete-account", {}, { "x-ascend-token": "tok", authorization: "Bearer userjwt" }), env, fake);
assert.equal(r.status, 200);
assert.ok(calls.some(c => c.url.includes("/auth/v1/admin/users/u-1") && c.init.method === "DELETE"));

r = await handle(req("/nada", {}), env, fake);
assert.equal(r.status, 404);
console.log("backend: todos os testes passaram (" + calls.length + " chamadas simuladas)");
