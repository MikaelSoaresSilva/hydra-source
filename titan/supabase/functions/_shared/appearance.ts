// Módulo SEM dependências, compartilhado entre o app (Vite) e a Edge Function (Deno).
// Define o prompt, o esquema JSON da resposta e a montagem da requisição à API do Claude.

export const APPEARANCE_MODEL = 'claude-opus-5-5';
/** Beta exigido pelo parâmetro `fallbacks: "default"` (reexecuta no modelo recomendado se houver recusa). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
export const MAX_IMAGES = 3;
/** Limite por imagem já reduzida (base64). As fotos são re-codificadas em JPEG ≤1600 px antes do envio. */
export const MAX_IMAGE_BASE64_CHARS = 3_000_000;

export type PhotoKind = 'face_front' | 'face_profile' | 'hair';
export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  face_front: 'Rosto de frente',
  face_profile: 'Rosto de perfil',
  hair: 'Cabelo (topo/laterais)',
};

export interface AppearanceImage { kind: PhotoKind; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }

/** Dados de perfil enviados junto com as fotos — só o necessário, nada de nome/e-mail. */
export interface AppearanceProfile {
  age?: number | null;
  sex?: 'male' | 'female' | null;
  skinType?: string;
  skinConcerns?: string[];
  skinSensitivities?: string;
  curlType?: string;
  hairLength?: string;
  scalp?: string;
  hairGoals?: string[];
  beardGoal?: string;
  browsGoal?: string;
  currentProducts?: string[];
  userGoal?: string;
}

export const APPEARANCE_SYSTEM = `Você é o módulo de orientação estética do app TITAN (português do Brasil).
Recebe 1 a 3 fotos de um usuário adulto e dados de perfil que ele próprio informou, e devolve sugestões práticas para melhorar a aparência: corte de cabelo, cuidados com pele, barba e sobrancelhas, massagem facial e hábitos.

Regras obrigatórias:
- Você NÃO é médico. Não faça diagnósticos (acne grau X, dermatite, melasma, alopecia etc.). Descreva apenas o que é visível em linguagem cosmética ("pontos avermelhados na bochecha", "brilho na zona T") e indique quando procurar dermatologista.
- Encaminhe a profissional se houver: lesão que muda de tamanho/cor, borda irregular ou assimétrica, ferida que não cicatriza, acne inflamada extensa/nódulos/cistos, falhas no cabelo ou na barba, descamação intensa.
- Não recomende medicamentos, ácidos de uso médico, isotretinoína, antibióticos, minoxidil, finasterida, hormônios, esteroides ou qualquer procedimento invasivo.
- Não cite marcas, preços, lojas, links nem disponibilidade. Fale em categorias e ingredientes ("gel de limpeza para pele oleosa", "niacinamida", "protetor FPS 30+ toque seco").
- Nunca prometa fechar poros, eliminar flacidez, mudar o formato do rosto ou resultados permanentes de massagem.
- Não dê nota de beleza nem compare com padrões. Seja respeitoso e direto.
- Ativos novos: um de cada vez, com teste de contato; nunca sugira combinar ativos desconhecidos.
- Se a foto estiver ruim (escura, desfocada, com filtro, muito longe, rosto coberto), diga isso em photo_quality e reduza a confiança.
- Formato do rosto e tipo de cabelo são ESTIMATIVAS por foto 2D; informe a confiança honestamente ("baixa" se a pose ou o ângulo atrapalham).
- Se a imagem não mostrar um rosto/cabelo humano adulto, marque usable=false e não faça sugestões baseadas nela.

Base de conhecimento do app (use como referência e cite quando aplicar):
- Formatos de rosto: oval, redondo, quadrado, triangular, retangular. Quadrado: linhas duras, testa maior, queixo marcado → corte assimétrico, pontas desiguais puxadas para a testa suaviza. Graduado: ideal para oval, inadequado para quadrado (revisão a cada 2 meses). Desfiado: recomendado para redondo; evitar em rosto oval com cabelo fino (revisão a cada 2 meses). Camadas: recomendado para triangular; contraindicado para cabelo crespo (aparar pontas a cada 3 meses).
- Técnicas: repicar (define cachos de ondulados, dá leveza a lisos finos); desfiar (tira volume de cacheados/crespos; com tesoura dura 2–3 meses, com navalha ~45 dias, curtos ~1 mês; desfiado sutil para soltar); evitar navalha em cabelo crespo ou desvitalizado/poroso; picotar (lisos grossos); perfilar (lisos/ondulados).
- Degradê/fade: baixo, médio, alto, skin, drop, taper, burst, box. Para crespos, low fade é muito indicado. Corte militar exige manutenção a cada ~15 dias. Pentes de máquina: nº1 = 3 mm, cada número ≈ +3 mm; abaixo do pente 4 o couro cabeludo aparece (protetor/boné no sol). Nunca passar máquina com cabelo molhado.
- Cabelo: tipos 1a–4c; pH de xampu entre 4,2 e 5,8; evitar xampu 2 em 1; couro oleoso: água morna/fria (não quente), sem massagem excessiva no couro, lavar na frequência necessária sem exagerar (efeito rebote); não prender cabelo molhado; secador a ≥20 cm; elásticos frouxos; lavar bonés.
- Pele (DATASUS e Almanaque da pele): limpar 2×/dia sem exagero (efeito rebote na oleosa); esfoliar no máx. 1×/semana; tônico opcional; hidratar (pele oleosa também precisa) com textura gel, gel-creme ou sérum; protetor diário o ano todo, 1 colher de chá (≈ 2 dedos) para rosto e pescoço, reaplicar a cada 2 h de exposição; FPS 30–50 alto, >50 muito alto; PPD/PA para UVA; nunca espremer cravos/espinhas; acne grave ou que deixa marcas → dermatologista; ≥2 L de água/dia, sono regular, não fumar. Estrias podem surgir com ganho rápido de massa: hidratar a pele.
- Massagem facial: evidência científica limitada; pode reduzir inchaço matinal de forma TEMPORÁRIA e é relaxante; não muda estrutura, poros nem flacidez de forma duradoura; não fazer sobre espinhas inflamadas, feridas ou pele irritada; mãos limpas, pressão leve, com hidratante.

Responda somente no esquema JSON fornecido, em português do Brasil.`;

const str = { type: 'string' } as const;
const strArr = { type: 'array', items: str } as const;
const confidence = { type: 'string', enum: ['baixa', 'media', 'alta'] } as const;

/** Esquema da resposta (structured outputs: todo objeto com additionalProperties=false e campos obrigatórios). */
export const APPEARANCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['photo_quality', 'face_shape', 'hair', 'haircuts', 'skin', 'beard_brows', 'facial_massage', 'habits', 'see_professional', 'limitations'],
  properties: {
    photo_quality: {
      type: 'object', additionalProperties: false, required: ['usable', 'issues'],
      properties: { usable: { type: 'boolean' }, issues: strArr },
    },
    face_shape: {
      type: 'object', additionalProperties: false, required: ['estimate', 'confidence', 'reasoning'],
      properties: {
        estimate: { type: 'string', enum: ['oval', 'redondo', 'quadrado', 'triangular', 'retangular', 'indefinido'] },
        confidence, reasoning: str,
      },
    },
    hair: {
      type: 'object', additionalProperties: false, required: ['type_estimate', 'confidence', 'observations'],
      properties: { type_estimate: str, confidence, observations: strArr },
    },
    haircuts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'why', 'ask_barber', 'maintenance', 'avoid_if'],
        properties: { name: str, why: str, ask_barber: str, maintenance: str, avoid_if: str },
      },
    },
    skin: {
      type: 'object', additionalProperties: false, required: ['observations', 'routine', 'ingredients'],
      properties: {
        observations: strArr,
        routine: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['when', 'step', 'why'],
            properties: { when: { type: 'string', enum: ['manha', 'noite', 'semanal'] }, step: str, why: str },
          },
        },
        ingredients: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['name', 'purpose', 'caution'],
            properties: { name: str, purpose: str, caution: str },
          },
        },
      },
    },
    beard_brows: strArr,
    facial_massage: {
      type: 'object', additionalProperties: false, required: ['suitable_now', 'steps', 'evidence_note'],
      properties: { suitable_now: { type: 'boolean' }, steps: strArr, evidence_note: str },
    },
    habits: strArr,
    see_professional: strArr,
    limitations: strArr,
  },
} as const;

/** Valida o pedido (usado no cliente e na Edge Function). Retorna mensagem de erro ou null. */
export function validateImages(images: AppearanceImage[]): string | null {
  if (!Array.isArray(images) || images.length < 1) return 'Envie pelo menos 1 foto.';
  if (images.length > MAX_IMAGES) return `Envie no máximo ${MAX_IMAGES} fotos.`;
  for (const im of images) {
    if (!(im.kind in PHOTO_KIND_LABEL)) return 'Tipo de foto inválido.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(im.mediaType)) return 'Formato de imagem não suportado.';
    if (typeof im.base64 !== 'string' || !im.base64.length || im.base64.length > MAX_IMAGE_BASE64_CHARS) return 'Imagem vazia ou grande demais.';
  }
  return null;
}

/** Remove campos vazios e limita textos livres do perfil. */
export function cleanProfile(p: AppearanceProfile): AppearanceProfile {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p ?? {})) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) { if (v.length) out[k] = v.slice(0, 20).map((x) => String(x).slice(0, 120)); continue; }
    out[k] = typeof v === 'string' ? v.slice(0, 400) : v;
  }
  return out as AppearanceProfile;
}

/**
 * Corpo da requisição para `client.beta.messages.stream/create`.
 * - pensamento adaptativo, esforço médio (explícito)
 * - saída estruturada pelo esquema acima
 * - fallbacks "default": se o modelo recusar, a API reexecuta no modelo de reserva recomendado
 */
export function buildAppearanceRequest(images: AppearanceImage[], profile: AppearanceProfile) {
  const content: Array<Record<string, unknown>> = [];
  images.forEach((im, i) => {
    content.push({ type: 'text', text: `Foto ${i + 1}: ${PHOTO_KIND_LABEL[im.kind]}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.base64 } });
  });
  content.push({
    type: 'text',
    text: `Perfil informado pelo usuário (JSON):\n${JSON.stringify(cleanProfile(profile))}\n\nAnalise as fotos e devolva as sugestões no esquema. Priorize o que é mais simples de aplicar e o que tem melhor custo-benefício; no máximo 4 cortes.`,
  });
  return {
    model: APPEARANCE_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default' as const,
    thinking: { type: 'adaptive' as const },
    output_config: { effort: 'medium' as const, format: { type: 'json_schema' as const, schema: APPEARANCE_SCHEMA as unknown as Record<string, unknown> } },
    system: APPEARANCE_SYSTEM,
    messages: [{ role: 'user' as const, content }],
  };
}

/** Extrai o texto JSON de uma resposta da API (ignora blocos de pensamento/fallback). */
export function extractJsonText(message: { content: Array<{ type: string; text?: string }>; stop_reason?: string | null }): { text: string | null; error: string | null } {
  if (message.stop_reason === 'refusal') return { text: null, error: 'O modelo recusou analisar estas fotos. Tente outra foto (rosto visível, sem filtros) ou use o questionário.' };
  if (message.stop_reason === 'max_tokens') return { text: null, error: 'A resposta foi cortada antes do fim. Tente novamente.' };
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  return text ? { text, error: null } : { text: null, error: 'Resposta vazia do modelo.' };
}
