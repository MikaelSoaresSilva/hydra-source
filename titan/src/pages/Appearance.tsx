import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import {
  BEARD_BROWS, CUT_RULES, FACE_LABEL, FACE_QUESTIONS, FACIAL_MASSAGE, appearanceProfileFrom, classifyFace, cutSuggestions,
  type AppearanceResult, type CutSuggestion, type FaceAnswers, type FaceShape,
} from '../domain/appearance';
import { formatBR } from '../domain/dates';
import type { AppearanceRow } from '../domain/types';
import { PHOTO_KIND_LABEL, type PhotoKind } from '../../supabase/functions/_shared/appearance';
import { analyzeWithCloud, analyzeWithKey, apiKeyStore, looksLikeApiKey, toAppearanceImage } from '../appearanceClient';
import { sanitizeImage } from '../services';
import { Card, Empty, ErrorBox, Field, Loading, Tabs, useToast } from '../ui/components';

type Tab = 'foto' | 'questionario' | 'historico';
const KINDS: PhotoKind[] = ['face_front', 'face_profile', 'hair'];
const CONF_LABEL = { baixa: 'baixa', media: 'média', alta: 'alta' } as const;
const WHEN_LABEL = { manha: 'Manhã', noite: 'Noite', semanal: 'Semanal' } as const;

function Cuts({ cuts }: { cuts: CutSuggestion[] }) {
  return (
    <ul className="list">
      {cuts.map((c) => (
        <li key={c.name}>
          <strong>{c.name}</strong>
          <p className="hint" style={{ margin: '4px 0' }}>{c.why}</p>
          {c.askBarber !== '—' && <p style={{ margin: '4px 0' }}><small><strong>Como pedir ao barbeiro:</strong> {c.askBarber}</small></p>}
          {c.maintenance !== '—' && <small className="muted">Manutenção: {c.maintenance}</small>}
          <br /><small className="muted">Fonte: {c.source}</small>
        </li>
      ))}
    </ul>
  );
}

function MassageCard() {
  return (
    <Card title="Massagem facial (1–3 min)">
      <p className="hint">{FACIAL_MASSAGE.evidence}</p>
      <ol>{FACIAL_MASSAGE.steps.map((s) => <li key={s}><small>{s}</small></li>)}</ol>
      <p><strong>Evite:</strong></p>
      <ul>{FACIAL_MASSAGE.avoid.map((s) => <li key={s}><small>{s}</small></li>)}</ul>
    </Card>
  );
}

export function AiResultView({ r }: { r: AppearanceResult }) {
  return (
    <div className="stack">
      {!r.photo_quality.usable && <div className="banner" role="alert">A foto não permitiu uma boa análise: {r.photo_quality.issues.join('; ')}</div>}
      {r.photo_quality.usable && r.photo_quality.issues.length > 0 && <p className="hint">Qualidade da foto: {r.photo_quality.issues.join('; ')}</p>}
      <Card title="Formato do rosto e cabelo (estimativas)">
        <p>Rosto: <strong>{r.face_shape.estimate}</strong> <span className="tag">confiança {CONF_LABEL[r.face_shape.confidence]}</span></p>
        <p className="hint">{r.face_shape.reasoning}</p>
        <p>Cabelo: <strong>{r.hair.type_estimate}</strong> <span className="tag">confiança {CONF_LABEL[r.hair.confidence]}</span></p>
        <ul>{r.hair.observations.map((o) => <li key={o}><small>{o}</small></li>)}</ul>
      </Card>
      <Card title="Cortes sugeridos">
        <ul className="list">
          {r.haircuts.map((c) => (
            <li key={c.name}>
              <strong>{c.name}</strong>
              <p className="hint" style={{ margin: '4px 0' }}>{c.why}</p>
              <p style={{ margin: '4px 0' }}><small><strong>Como pedir ao barbeiro:</strong> {c.ask_barber}</small></p>
              <small className="muted">Manutenção: {c.maintenance} · Evite se: {c.avoid_if}</small>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Pele (cosmético, sem diagnóstico)">
        <ul>{r.skin.observations.map((o) => <li key={o}><small>{o}</small></li>)}</ul>
        {r.skin.routine.length > 0 && <>
          <p><strong>Rotina sugerida</strong></p>
          <ul className="list">{r.skin.routine.map((x, i) => <li key={i}><span className="tag">{WHEN_LABEL[x.when]}</span> {x.step}<br /><small className="muted">{x.why}</small></li>)}</ul>
        </>}
        {r.skin.ingredients.length > 0 && <>
          <p><strong>Ingredientes para procurar no rótulo</strong></p>
          <ul className="list">{r.skin.ingredients.map((x) => <li key={x.name}><strong>{x.name}</strong>: {x.purpose}<br /><small className="muted">Cuidado: {x.caution}</small></li>)}</ul>
          <p className="hint">Introduza um ativo novo por vez, com teste de contato. Cadastre o produto em <Link to="/cuidados">Cuidados</Link> para o Titan checar conflitos.</p>
        </>}
      </Card>
      <Card title="Barba e sobrancelhas"><ul>{r.beard_brows.map((o) => <li key={o}><small>{o}</small></li>)}</ul></Card>
      <Card title="Massagem facial">
        {!r.facial_massage.suitable_now && <div className="banner">Agora não é indicada (veja o motivo abaixo).</div>}
        <ol>{r.facial_massage.steps.map((s) => <li key={s}><small>{s}</small></li>)}</ol>
        <p className="hint">{r.facial_massage.evidence_note}</p>
      </Card>
      <Card title="Hábitos"><ul>{r.habits.map((o) => <li key={o}><small>{o}</small></li>)}</ul></Card>
      {r.see_professional.length > 0 && <Card title="Quando procurar um profissional" className="accent"><ul>{r.see_professional.map((o) => <li key={o}><small>{o}</small></li>)}</ul></Card>}
      <Card title="Limitações desta análise"><ul>{r.limitations.map((o) => <li key={o}><small>{o}</small></li>)}</ul>
        <p className="hint">Sugestões geradas por IA a partir de fotos 2D. Não é diagnóstico e não substitui dermatologista ou barbeiro/cabeleireiro.</p></Card>
    </div>
  );
}

function PhotoAnalysis() {
  const store = useStore();
  const { profile, save } = useProfile();
  const [blobs, setBlobs] = useState<Partial<Record<PhotoKind, Blob>>>({});
  const [urls, setUrls] = useState<Partial<Record<PhotoKind, string>>>({});
  const [goal, setGoal] = useState('');
  const [consent, setConsent] = useState(false);
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [via, setVia] = useState<'cloud' | 'key'>(store.mode === 'cloud' ? 'cloud' : 'key');
  const [keyDraft, setKeyDraft] = useState('');
  const [hasKey, setHasKey] = useState(!!apiKeyStore.get());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AppearanceResult | null>(null);
  const [removed, setRemoved] = useState(0);
  const { toast, node } = useToast();
  useEffect(() => () => { Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u)); }, [urls]);

  const enabled = !!profile?.preferences.aiAppearance;
  const sentProfile = useMemo(() => appearanceProfileFrom(profile, goal || undefined), [profile, goal]);

  async function pick(kind: PhotoKind, file?: File) {
    if (!file) return;
    setError(null);
    try {
      const b = await sanitizeImage(file, 1600);
      setBlobs((x) => ({ ...x, [kind]: b }));
      setUrls((x) => { if (x[kind]) URL.revokeObjectURL(x[kind]!); return { ...x, [kind]: URL.createObjectURL(b) }; });
      setConsent(false);
    } catch { setError('Não foi possível ler a imagem.'); }
  }

  async function send() {
    setBusy(true); setError(null); setResult(null);
    try {
      const images = await Promise.all(KINDS.filter((k) => blobs[k]).map((k) => toAppearanceImage(k, blobs[k]!)));
      const out = via === 'cloud' ? await analyzeWithCloud(images, sentProfile) : await analyzeWithKey(apiKeyStore.get() ?? '', images, sentProfile);
      if (!out.ok) { setError(out.error); return; }
      setResult(out.result); setRemoved(out.removed);
      let photo_path: string | null = null;
      if (keepPhoto && blobs.face_front) {
        photo_path = `${store.userId}/aparencia-${uuid()}.jpg`;
        await store.uploadPhoto(photo_path, blobs.face_front);
      }
      await store.upsert('appearance_analyses', {
        id: uuid(), source: 'ai', model: out.model, photo_path,
        input: { photos: KINDS.filter((k) => blobs[k]), profile: sentProfile, via }, result: out.result,
      });
      toast('Análise salva no histórico.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!enabled) {
    return (
      <Card title="Análise por foto com IA (desligada)">
        <p>Com ela ligada, você tira fotos do rosto e do cabelo, e o app envia essas fotos ao <strong>Claude</strong> (IA da Anthropic) para sugerir cortes, cuidados de pele, barba e sobrancelhas, massagem facial e hábitos.</p>
        <ul>
          <li><small>Nada é enviado sem a sua confirmação a cada análise.</small></li>
          <li><small>As fotos são reduzidas e têm os metadados (EXIF/GPS) removidos antes do envio.</small></li>
          <li><small>Não é diagnóstico médico. Você pode desligar quando quiser em Perfil.</small></li>
        </ul>
        <button className="btn primary" onClick={() => void save({ preferences: { ...profile!.preferences, aiAppearance: true } })}>Ligar análise por IA</button>
        <p className="hint">Prefere não usar IA? A aba "Questionário" dá sugestões de corte e cuidados sem enviar nada.</p>
      </Card>
    );
  }

  const count = KINDS.filter((k) => blobs[k]).length;
  const keyReady = via === 'cloud' || hasKey;
  return (
    <div className="stack">
      {node}
      <Card title="1. Fotos">
        <p className="hint">Luz natural de frente (janela), sem filtro, rosto inteiro visível, cabelo seco no estado normal. A foto original não é alterada.</p>
        <div className="photo-grid">
          {KINDS.map((k) => (
            <figure key={k}>
              {urls[k] ? <img src={urls[k]} alt={PHOTO_KIND_LABEL[k]} /> : <div className="loading" style={{ aspectRatio: '3/4' }}>sem foto</div>}
              <label className="btn sm" style={{ marginTop: 6, width: '100%' }}>
                {PHOTO_KIND_LABEL[k]}{k === 'face_front' ? ' *' : ''}
                <input type="file" accept="image/*" hidden aria-label={`Foto: ${PHOTO_KIND_LABEL[k]}`} onChange={(e) => void pick(k, e.target.files?.[0])} />
              </label>
            </figure>
          ))}
        </div>
        <Field label="O que você quer melhorar? (opcional)"><input value={goal} maxLength={300} onChange={(e) => setGoal(e.target.value)} placeholder="Ex.: corte que valorize os cachos, reduzir oleosidade" /></Field>
      </Card>

      <Card title="2. Como enviar">
        {store.mode === 'cloud' && (
          <div className="row">
            <button className={`chip ${via === 'cloud' ? 'on' : ''}`} aria-pressed={via === 'cloud'} onClick={() => setVia('cloud')}>Servidor do Titan</button>
            <button className={`chip ${via === 'key' ? 'on' : ''}`} aria-pressed={via === 'key'} onClick={() => setVia('key')}>Minha chave neste aparelho</button>
          </div>
        )}
        {via === 'cloud' ? <p className="hint">A chave da API fica no servidor (Edge Function do Supabase); o aparelho não a vê.</p> : hasKey ? (
          <p className="hint">Usando a sua chave da API da Anthropic, guardada só neste aparelho. <button className="btn ghost sm" onClick={() => { apiKeyStore.clear(); setHasKey(false); }}>Remover chave</button></p>
        ) : (
          <div className="stack">
            <p className="hint">Cole uma chave da API da Anthropic (crie em console.anthropic.com; o uso é cobrado na sua conta). Ela fica guardada só neste aparelho e não entra no backup.</p>
            <input type="password" autoComplete="off" aria-label="Chave da API" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-ant-…" />
            <button className="btn sm" disabled={!looksLikeApiKey(keyDraft)} onClick={() => { apiKeyStore.set(keyDraft); setKeyDraft(''); setHasKey(true); }}>Guardar chave</button>
          </div>
        )}
      </Card>

      <Card title="3. Confirmação">
        <p>Será enviado à <strong>Anthropic</strong> (modelo Claude):</p>
        <ul>
          <li><small>{count} foto(s): {KINDS.filter((k) => blobs[k]).map((k) => PHOTO_KIND_LABEL[k]).join(', ') || '—'} (reduzidas, sem EXIF/GPS)</small></li>
          <li><small>Dados do perfil: idade, sexo, tipo/queixas de pele, sensibilidades, curvatura e comprimento do cabelo, couro cabeludo, objetivos de cabelo/barba/sobrancelha{goal ? ' e o seu objetivo escrito acima' : ''}. Sem nome, e-mail, peso ou medidas.</small></li>
        </ul>
        <details><summary>Ver exatamente os dados de perfil enviados</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>{JSON.stringify(sentProfile, null, 2)}</pre></details>
        <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Autorizo o envio destas fotos e dados para esta análise.</label>
        <label className="check"><input type="checkbox" checked={keepPhoto} onChange={(e) => setKeepPhoto(e.target.checked)} /> Guardar a foto de frente junto com a análise (privada)</label>
        <ErrorBox error={error} />
        <button className="btn primary big" disabled={busy || !consent || !blobs.face_front || !keyReady} onClick={() => void send()}>{busy ? 'Analisando… (pode levar até 1 min)' : 'Enviar e analisar'}</button>
        {!blobs.face_front && <p className="hint">A foto do rosto de frente é obrigatória.</p>}
      </Card>

      {busy && <Loading label="Analisando as fotos…" />}
      {result && <>
        {removed > 0 && <p className="hint">{removed} item(ns) com menção a medicamento/hormônio foram removidos automaticamente.</p>}
        <AiResultView r={result} />
      </>}
    </div>
  );
}

function Questionnaire() {
  const store = useStore();
  const { profile } = useProfile();
  const [a, setA] = useState<Partial<FaceAnswers>>({});
  const [curl, setCurl] = useState(profile?.hair.curlType ?? '');
  const [fine, setFine] = useState(false);
  const { toast, node } = useToast();
  const complete = a.length && a.widest && a.jaw;
  const res = complete ? classifyFace(a as FaceAnswers) : null;
  const cuts = res ? cutSuggestions(res.shape, { curlType: curl, fineHair: fine }) : [];
  return (
    <div className="stack">
      {node}
      <Card title="Formato do rosto (autoavaliação)">
        <p className="hint">Prenda o cabelo para trás e olhe no espelho de frente. Nada é enviado: as sugestões vêm das regras do material de corte masculino.</p>
        {(Object.keys(FACE_QUESTIONS) as (keyof FaceAnswers)[]).map((k) => (
          <Field key={k} label={FACE_QUESTIONS[k].q}>
            <select aria-label={k} value={a[k] ?? ''} onChange={(e) => setA({ ...a, [k]: e.target.value || undefined })}>
              <option value="">Escolha…</option>
              {Object.entries(FACE_QUESTIONS[k].options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        ))}
        <div className="grid two">
          <Field label="Curvatura do cabelo">
            <select aria-label="Curvatura" value={curl} onChange={(e) => setCurl(e.target.value)}>
              <option value="">Não sei</option>
              {Array.from(new Set([...(profile?.hair.curlType ? [profile.hair.curlType] : []), '1a', '1b', '1c', '2a', '2b', '2c', '2C–3A', '3a', '3b', '3c', '4a', '4b', '4c'])).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <label className="check"><input type="checkbox" checked={fine} onChange={(e) => setFine(e.target.checked)} /> Fio fino</label>
        </div>
      </Card>

      {res && (
        <>
          <Card title={`Rosto ${FACE_LABEL[res.shape].toLowerCase()}`} className="accent" action={<span className="tag">confiança {CONF_LABEL[res.confidence]}</span>}>
            {res.runnerUp && <p className="hint">Ficou perto de {FACE_LABEL[res.runnerUp].toLowerCase()}: veja as duas opções ou peça a opinião do barbeiro.</p>}
            <Cuts cuts={cuts} />
            <button className="btn sm" onClick={async () => {
              await store.upsert('appearance_analyses', { id: uuid(), source: 'questionnaire', model: null, photo_path: null, input: { answers: a, curl, fine }, result: { faceShape: res.shape, confidence: res.confidence, cuts } });
              toast('Salvo no histórico.');
            }}>Salvar no histórico</button>
          </Card>
          {res.runnerUp && <Card title={`Alternativa: rosto ${FACE_LABEL[res.runnerUp].toLowerCase()}`}><Cuts cuts={cutSuggestions(res.runnerUp, { curlType: curl, fineHair: fine })} /></Card>}
        </>
      )}

      <Card title="Regras de corte e máquina"><ul>{CUT_RULES.map((r) => <li key={r}><small>{r}</small></li>)}</ul></Card>
      <Card title="Barba e sobrancelhas"><ul>{BEARD_BROWS.map((r) => <li key={r}><small>{r}</small></li>)}</ul><p className="hint">Dicas gerais de cuidado (não constam nos PDFs estudados).</p></Card>
      <MassageCard />
      <Card title="Pele e produtos">
        <p className="hint">A rotina e a checagem de ativos ficam em <Link to="/cuidados">Cuidados</Link>. Para pele oleosa: limpeza 2×/dia sem exagero, hidratante em gel ou gel-creme, protetor diário (1 colher de chá ≈ 2 dedos), esfoliação no máximo 1×/semana. Os fundamentos estão em <Link to="/biblioteca">Biblioteca → Pele</Link>.</p>
      </Card>
    </div>
  );
}

function History() {
  const store = useStore();
  const rows = useRows<AppearanceRow>('appearance_analyses', { order: { col: 'created_at', asc: false } });
  const [open, setOpen] = useState<string | null>(null);
  if (rows.loading) return <Loading />;
  if (!rows.data.length) return <Empty>Nenhuma análise salva ainda.</Empty>;
  return (
    <div className="stack">
      {rows.data.map((r) => {
        const res = r.result as Record<string, unknown>;
        const shape = r.source === 'ai' ? (res.face_shape as { estimate?: string })?.estimate : FACE_LABEL[res.faceShape as FaceShape]?.toLowerCase();
        return (
          <Card key={r.id} title={`${formatBR((r.created_at ?? '').slice(0, 10))} · ${r.source === 'ai' ? 'IA' : 'Questionário'}`} action={
            <button className="btn ghost sm" onClick={async () => {
              if (!confirm('Excluir esta análise?')) return;
              if (r.photo_path) await store.deletePhoto(r.photo_path).catch(() => {});
              await store.remove('appearance_analyses', [r.id]);
            }}>Excluir</button>}>
            <p>Rosto: {shape ?? '—'}{r.photo_path ? ' · com foto' : ''}</p>
            <button className="btn sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Fechar' : 'Ver detalhes'}</button>
            {open === r.id && (r.source === 'ai' ? <AiResultView r={r.result as unknown as AppearanceResult} /> : <Cuts cuts={(res.cuts as CutSuggestion[]) ?? []} />)}
          </Card>
        );
      })}
    </div>
  );
}

export function Appearance() {
  const [tab, setTab] = useState<Tab>('questionario');
  return (
    <div className="stack">
      <div>
        <h1>Aparência</h1>
        <p className="muted">Corte de cabelo, pele, barba, sobrancelhas e massagem facial: por questionário (sem IA) ou por foto (com IA, só se você autorizar).</p>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'questionario', label: 'Questionário' }, { value: 'foto', label: 'Foto + IA' }, { value: 'historico', label: 'Histórico' }]} />
      {tab === 'foto' && <PhotoAnalysis />}
      {tab === 'questionario' && <Questionnaire />}
      {tab === 'historico' && <History />}
    </div>
  );
}
