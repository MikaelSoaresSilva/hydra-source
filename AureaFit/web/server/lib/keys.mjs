// Chaves VAPID geradas e guardadas no próprio Netlify (Blobs): a chave privada
// nunca sai do servidor e não precisa ser copiada para lugar nenhum.
import { getStore } from "@netlify/blobs"
import webpush from "web-push"

export async function getVapidKeys() {
  const store = getStore("aurea-config")
  let keys = await store.get("vapid", { type: "json" })
  if (!keys?.publicKey || !keys?.privateKey) {
    keys = webpush.generateVAPIDKeys()
    await store.setJSON("vapid", keys)
  }
  return keys
}

export async function configureWebPush() {
  const k = await getVapidKeys()
  webpush.setVapidDetails("https://aurea-treino.netlify.app", k.publicKey, k.privateKey)
  return webpush
}
