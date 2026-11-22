// POST /api/push   — ativa ou atualiza os lembretes deste aparelho
// DELETE /api/push — desativa
import type { Config } from "@netlify/functions"
import { getStore } from "@netlify/blobs"
import { configureWebPush, getVapidKeys } from "../../lib/keys.mjs"
import { cleanSchedule, validTimeZone } from "../../lib/shared.mjs"

const ID = /^[a-z0-9]{12,40}$/

export default async (req: Request) => {
  if (req.method === "GET") return Response.json({ publicKey: (await getVapidKeys()).publicKey })
  const store = getStore("aurea-push")
  let body: any
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }
  const id = String(body?.id ?? "")
  if (!ID.test(id)) return Response.json({ error: "id inválido" }, { status: 400 })

  if (req.method === "DELETE") {
    await store.delete(id)
    return Response.json({ ok: true })
  }

  const sub = body?.subscription
  const endpoint = String(sub?.endpoint ?? "")
  if (!endpoint.startsWith("https://") || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return Response.json({ error: "assinatura inválida" }, { status: 400 })
  }
  const tz = validTimeZone(body?.tz) ? body.tz : "America/Sao_Paulo"
  const old: any = await store.get(id, { type: "json" })
  const record = {
    subscription: { endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } },
    schedule: cleanSchedule(body?.schedule),
    tz,
    sent: old?.sent ?? {},
    updatedAt: Date.now()
  }
  await store.setJSON(id, record)
  if (body?.test === true) {
    // Notificação de teste imediata, para a usuária confirmar que funciona.
    const webpush = await configureWebPush()
    try {
      await webpush.sendNotification(record.subscription, JSON.stringify({ title: "Lembretes ativados ✨", body: "É assim que o Áurea vai lembrar você das refeições, treinos e hidratação.", tag: "teste" }), { TTL: 300 })
    } catch (e: any) {
      return Response.json({ error: "falha no envio", status: e?.statusCode }, { status: 502 })
    }
  }
  return Response.json({ ok: true, reminders: record.schedule.length })
}

export const config: Config = { path: "/api/push", method: ["GET", "POST", "DELETE"] }
