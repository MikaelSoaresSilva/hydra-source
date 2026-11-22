// GET /api/ics?d=<rotina codificada> → arquivo de calendário (.ics) com alertas.
// Não guarda nada: a rotina vem no próprio link e volta como arquivo.
import type { Config } from "@netlify/functions"
import { cleanSchedule } from "../../lib/shared.mjs"

const BY = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"]
const esc = (s: string) => s.replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, " ")

export default async (req: Request) => {
  const d = new URL(req.url).searchParams.get("d") ?? ""
  let list: any[] = []
  try { list = cleanSchedule(JSON.parse(Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))) } catch { }
  if (!list.length) return new Response("Rotina inválida", { status: 400 })
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "")
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  const events = list.filter((s) => s.enabled).map((s) => {
    const days = [1, 2, 3, 4, 5, 6, 7].filter((x) => s.daysMask & (1 << (x - 1))).map((x) => BY[x]).join(",")
    const [hh, mm] = s.time.split(":")
    return ["BEGIN:VEVENT", `UID:aurea-${s.id}@aurea-treino.netlify.app`, `DTSTAMP:${stamp}`, `DTSTART:${ymd}T${hh}${mm}00`,
      "DURATION:PT10M", `RRULE:FREQ=WEEKLY;BYDAY=${days}`, `SUMMARY:${esc("Áurea: " + s.label)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(s.label)}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n")
  })
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aurea//Rotina//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Áurea — Rotina", ...events, "END:VCALENDAR"].join("\r\n")
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="aurea-rotina.ics"', "Cache-Control": "no-store" }
  })
}

export const config: Config = { path: "/api/ics", method: "GET" }
