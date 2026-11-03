// Ponto de entrada Supabase Edge Function (Deno).
import { handle } from "./handler.ts";

Deno.serve((req: Request) => handle(req, Deno.env.toObject()));
