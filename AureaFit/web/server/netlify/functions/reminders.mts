// Roda a cada minuto (UTC). Para cada aparelho, calcula a hora local no fuso
// informado e envia os lembretes que estão no horário.
import type { Config } from "@netlify/functions"
import { getStore } from "@netlify/blobs"
import { configureWebPush } from "../../lib/keys.mjs"
import { dueItems, reminderText } from "../../lib/shared.mjs"

export default async () => {
  const store = getStore("aurea-push")
  const { blobs } = await store.list()
  if (!blobs.length) return
  const webpush = await configureWebPush()
  let sent = 0
  for (const { key } of blobs) {
    const rec: any = await store.get(key, { type: "json" })
    if (!rec?.subscription || !Array.isArray(rec.schedule)) continue
    const due = dueItems(rec)
    if (!due.length) continue
    let gone = false
    for (const item of due) {
      const [title, body] = reminderText(item.type, item.label)
      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify({ title, body, tag: item.id }), { TTL: 600, urgency: "high" })
        sent++
      } catch (e: any) {
        // 404/410 = a pessoa desinstalou o app ou revogou a permissão
        if (e?.statusCode === 404 || e?.statusCode === 410) { gone = true; break }
        console.log("Falha no envio", e?.statusCode, e?.body)
      }
      rec.sent = { ...(rec.sent || {}), [item.id]: item.date }
    }
    if (gone) await store.delete(key)
    else await store.setJSON(key, rec)
  }
  if (sent) console.log(`Lembretes enviados: ${sent}`)
}

export const config: Config = { schedule: "* * * * *" }
