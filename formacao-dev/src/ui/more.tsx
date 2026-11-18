import { useEffect, useMemo, useState } from 'preact/hooks';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Clipboard } from '@capacitor/clipboard';
import { AREAS, LIBRARY, PROJECTS } from '../data';
import { RESOURCES } from '../data/resources';
import { GLOSSARY } from '../data/glossary';
import { MARKET, CHECKLIST, NEXT_90_DAYS, HONESTY } from '../data/career';
import type { AreaId, Resource } from '../data/types';
import { update, useAppState, isNative, getState, replaceState, flush } from '../engine/store';
import { migrate, initialState, defaultStart, DEFAULT_SLOTS, parseYmd, ymd } from '../engine/state';
import { readiness } from '../engine/progress';
import { syncReminders, testNotification, getStatus, openExactAlarmSettings, requestPermission, type NotifStatus } from '../engine/notifications';
import { Header, Card, Bar, go, ResourceCard, openUrl, Empty } from './components';

export function More() {
  const items: [string, string, string][] = [
    ['/progresso', '📈', 'Progresso e mapa das áreas'], ['/projetos', '🛠', 'Projetos do portfólio'], ['/recursos', '🎬', 'Vídeos, cursos e sites'],
    ['/carreira', '💼', 'Carreira e mercado de trabalho'], ['/biblioteca', '📚', 'Biblioteca de conceitos'], ['/glossario', '🔤', 'Glossário (termos técnicos)'],
    ['/aulas', '🧾', 'Todas as aulas por área'], ['/labs', '🧪', 'Laboratórios'], ['/ajustes', '⚙️', 'Lembretes, backup e ajustes'],
  ];
  return <div><Header title="Mais" />{items.map(([p, i, t]) => <Card onClick={() => go(p)}><span class="menu-item">{i} {t}</span></Card>)}</div>;
}

export function Resources() {
  const [area, setArea] = useState<AreaId | ''>('');
  const [kind, setKind] = useState<Resource['kind'] | ''>('');
  const [q, setQ] = useState('');
  const [pt, setPt] = useState(false);
  const list = RESOURCES.filter((r) => (!area || r.area === area) && (!kind || r.kind === kind) && (!pt || r.lang === 'pt') && (!q || (r.title + r.desc + (r.author ?? '')).toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <Header title="Vídeos, cursos e sites" back sub={`${RESOURCES.length} materiais verificados · prioridade para português`} />
      <div class="filters">
        <input class="text-input" placeholder="Buscar…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <select value={area} onChange={(e) => setArea((e.target as HTMLSelectElement).value as AreaId)}><option value="">Todas as áreas</option>{AREAS.map((a) => <option value={a.id}>{a.icon} {a.name}</option>)}</select>
        <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as Resource['kind'])}><option value="">Todos os tipos</option><option value="video">Vídeos</option><option value="playlist">Playlists</option><option value="curso">Cursos</option><option value="simulador">Prática interativa</option><option value="exercicios">Exercícios</option><option value="doc">Documentação</option><option value="vagas">Vagas</option><option value="projeto">Projetos</option><option value="site">Sites</option></select>
        <label class="small"><input type="checkbox" checked={pt} onChange={(e) => setPt((e.target as HTMLInputElement).checked)} /> Só em português</label>
      </div>
      <p class="tiny muted pad-x">Links verificados automaticamente em 18/11/2026. Se algum sair do ar, o app continua funcionando normalmente.</p>
      {list.length ? list.map((r) => <ResourceCard r={r} />) : <Empty>Nenhum material com esses filtros.</Empty>}
    </div>
  );
}

export function Projects() {
  const st = useAppState();
  return (
    <div>
      <Header title="Projetos do portfólio" back sub="Do simples ao projeto final — prioridade para Backend" />
      {[1, 2, 3, 4, 5].map((lv) => (
        <section><h2 class="section-title">Nível {lv}{lv === 5 ? ' — Projeto final e avançado' : ''}</h2>
          {PROJECTS.filter((p) => p.level === lv).map((p) => {
            const ps = st.projects[p.id];
            const done = (ps?.steps.filter(Boolean).length ?? 0) + (ps?.acceptance.filter(Boolean).length ?? 0);
            const total = p.steps.length + p.acceptance.length;
            const area = AREAS.find((a) => a.id === p.area);
            return <Card class={p.final ? 'accent-card' : ''} onClick={() => go('/projeto/' + p.id)}>
              <div class="row between"><span class="tag">{area?.icon} {area?.name}</span>{ps?.done && <span class="tag ok">✓ concluído</span>}</div>
              <strong>{p.title}</strong><p class="small">{p.summary}</p><Bar value={(100 * done) / total} />
            </Card>;
          })}
        </section>
      ))}
    </div>
  );
}

export function ProjectView({ id }: { id: string }) {
  const st = useAppState();
  const p = PROJECTS.find((x) => x.id === id);
  if (!p) return <div><Header title="Projeto" back /></div>;
  const ps = st.projects[id] ?? { steps: [], acceptance: [], done: false };
  const set = (fn: (x: typeof ps) => void) => update((s) => { const cur = s.projects[id] ?? { steps: [], acceptance: [], done: false }; fn(cur); s.projects[id] = cur; });
  return (
    <div>
      <Header title={p.title} back />
      <Card class="hero"><p>{p.summary}</p><p class="small"><strong>Tecnologias:</strong> {p.tech.join(', ')}</p>{p.portfolioPitch && <p class="small">💼 <strong>Por que impressiona:</strong> {p.portfolioPitch}</p>}</Card>
      <h3 class="section-title">Requisitos</h3><ul class="practice-list">{p.requirements.map((r) => <li>{r}</li>)}</ul>
      <h3 class="section-title">Passo a passo</h3>
      {p.steps.map((s, i) => <label class="check-row"><input type="checkbox" checked={!!ps.steps[i]} onChange={() => set((x) => { x.steps[i] = !x.steps[i]; })} /> <span>{s}</span></label>)}
      {p.structure && <><h3 class="section-title">Estrutura de pastas</h3><pre class="code"><code>{p.structure}</code></pre></>}
      <h3 class="section-title">Critérios de aceite (confira antes de entregar)</h3>
      {p.acceptance.map((s, i) => <label class="check-row"><input type="checkbox" checked={!!ps.acceptance[i]} onChange={() => set((x) => { x.acceptance[i] = !x.acceptance[i]; })} /> <span>{s}</span></label>)}
      {p.tests && <><h3 class="section-title">Testes sugeridos</h3><ul class="practice-list">{p.tests.map((t) => <li>{t}</li>)}</ul></>}
      {p.improvements && <><h3 class="section-title">Melhorias (para ir além)</h3><ul class="practice-list">{p.improvements.map((t) => <li>{t}</li>)}</ul></>}
      <h3 class="section-title">Link do repositório / deploy</h3>
      <input class="text-input" placeholder="https://github.com/seu-usuario/projeto" value={ps.url ?? ''} onInput={(e) => set((x) => { x.url = (e.target as HTMLInputElement).value; })} />
      <button class={'btn big ' + (ps.done ? 'btn-ghost' : 'btn-primary')} onClick={() => set((x) => { x.done = !x.done; })}>{ps.done ? '↺ Marcar como não concluído' : '✓ Marcar projeto como concluído'}</button>
    </div>
  );
}

export function Library() {
  return <div><Header title="Biblioteca de conceitos" back sub="Resumos rápidos de temas avançados" />
    {LIBRARY.map((l) => <details class="card lib"><summary><strong>{l.title}</strong> <span class="tag">{l.level}</span><div class="small muted">{l.summary}</div></summary><p class="small">{l.full}</p>{l.docs.map((d) => <button class="link-btn" onClick={() => openUrl(d.url)}>{d.label} ↗</button>)}</details>)}
  </div>;
}

export function Glossary() {
  const [q, setQ] = useState('');
  const list = GLOSSARY.filter(([t, d]) => !q || (t + d).toLowerCase().includes(q.toLowerCase()));
  return <div><Header title="Glossário" back sub={`${GLOSSARY.length} termos técnicos em linguagem simples`} />
    <div class="pad-x"><input class="text-input" placeholder="Buscar termo…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></div>
    {list.map(([t, d]) => <div class="gloss"><strong>{t}</strong><p class="small">{d}</p></div>)}
  </div>;
}

export function Career() {
  const st = useAppState();
  const r = readiness(st);
  return (
    <div>
      <Header title="Carreira" back sub="Mercado, portfólio, vagas e entrevistas" />
      <Card class="hero">
        <div class="tag accent">Sua preparação hoje</div>
        <h2>{r.level}</h2>
        <p class="small">{r.text}</p>
        <Bar value={r.overview.percent} />
        <p class="tiny muted">Formação {r.overview.percent}% · Projeto final {r.finalDone ? 'concluído ✓' : 'pendente'} · Checklist {r.checklistDone}/{CHECKLIST.length}</p>
      </Card>
      <h3 class="section-title">Competências essenciais para vagas júnior backend</h3>
      {r.coreScores.map((c) => <div class="skill-row"><div class="row between small"><span>{c.name}</span><span class="muted">{c.score === null ? 'não praticada' : Math.round(c.score * 100) + '%'}</span></div><Bar value={(c.score ?? 0) * 100} color={c.score === null ? 'var(--line)' : c.score >= 0.75 ? 'var(--good)' : 'var(--warn)'} /></div>)}
      <h3 class="section-title">⚖️ Avaliação honesta</h3>
      <Card><p class="small pre">{HONESTY}</p></Card>
      <h3 class="section-title">✅ Checklist para candidaturas</h3>
      {CHECKLIST.map((c) => <label class="check-row"><input type="checkbox" checked={!!st.checklist[c.id]} onChange={() => update((s) => { s.checklist[c.id] = !s.checklist[c.id]; })} /> <span>{c.text}</span></label>)}
      <h3 class="section-title">🏢 Como funciona o mercado</h3>
      {MARKET.map((m) => <details class="card"><summary><strong>{m.title}</strong></summary><p class="small">{m.body}</p></details>)}
      <h3 class="section-title">📖 Aulas de carreira</h3>
      {['l-portfolio', 'l-career', 'l-interview', 'l-english'].map((id) => <Card onClick={() => go('/aula/' + id)}><strong>{({ 'l-portfolio': 'Portfólio e apresentação técnica', 'l-career': 'Mercado, currículo, GitHub e vagas', 'l-interview': 'Entrevistas técnicas de backend', 'l-english': 'Inglês técnico essencial' } as Record<string, string>)[id]}</strong></Card>)}
      <h3 class="section-title">🔎 Onde procurar vagas</h3>
      {RESOURCES.filter((x) => x.kind === 'vagas').map((x) => <ResourceCard r={x} compact />)}
      <h3 class="section-title">🚀 Depois dos 3 meses: plano de continuidade</h3>
      {NEXT_90_DAYS.map((n) => <Card><strong>{n.period}: {n.focus}</strong><ul class="practice-list">{n.items.map((i) => <li>{i}</li>)}</ul></Card>)}
    </div>
  );
}

const WEEKDAY = ['', 'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function Settings() {
  const st = useAppState();
  const [status, setStatus] = useState<NotifStatus | null>(null);
  const [msg, setMsg] = useState('');
  const [importText, setImportText] = useState('');
  const refresh = async () => setStatus(await getStatus());
  useEffect(() => { refresh(); }, []);
  const apply = async () => { await flush(); const s = getState(); const r = await syncReminders(s.reminders.slots, s.reminders.enabled); setMsg(r.message); refresh(); };

  const exportBackup = async () => {
    const json = JSON.stringify({ app: 'formacao-dev', exportedAt: new Date().toISOString(), state: getState() }, null, 1);
    const name = 'backup-formacao-dev-' + ymd(new Date()) + '.json';
    try {
      if (isNative()) {
        const f = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'Backup da Formação Dev', text: 'Backup do meu progresso', files: [f.uri], dialogTitle: 'Salvar backup' });
        setMsg('Backup gerado. Salve no Google Drive, e-mail ou WhatsApp.');
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
        setMsg('Arquivo de backup baixado.');
      }
    } catch (e: any) { setMsg('Não foi possível compartilhar (' + (e?.message ?? e) + '). Use "Copiar backup".'); }
  };
  const copyBackup = async () => { const json = JSON.stringify({ app: 'formacao-dev', state: getState() }); if (isNative()) await Clipboard.write({ string: json }); else await navigator.clipboard.writeText(json); setMsg('Backup copiado. Cole num lugar seguro (nota, e-mail).'); };
  const doImport = async (text: string) => {
    try {
      const obj = JSON.parse(text);
      const next = migrate(obj.state ?? obj);
      if (!confirm('Substituir o progresso atual pelo backup? Esta ação não pode ser desfeita.')) return;
      await replaceState(next); setMsg('Backup restaurado com sucesso!'); setImportText(''); apply();
    } catch { setMsg('Backup inválido: confira se colou o texto completo.'); }
  };

  return (
    <div>
      <Header title="Ajustes" back />
      <h3 class="section-title">🔔 Lembretes de estudo</h3>
      <Card>
        <label class="check-row"><input type="checkbox" checked={st.reminders.enabled} onChange={() => update((s) => { s.reminders.enabled = !s.reminders.enabled; })} /> <strong>Lembretes ativados</strong></label>
        {st.reminders.slots.map((sl, i) => (
          <div class="slot">
            <label class="check-row"><input type="checkbox" checked={sl.enabled} disabled={!st.reminders.enabled} onChange={() => update((s) => { s.reminders.slots[i].enabled = !s.reminders.slots[i].enabled; })} /> <span><strong>{WEEKDAY[sl.weekday]}</strong> — {sl.id % 2 ? 'início dos estudos' : 'continuidade'}</span></label>
            <div class="row gap center-v">
              <input type="time" value={String(sl.hour).padStart(2, '0') + ':' + String(sl.minute).padStart(2, '0')} onChange={(e) => { const [h, m] = (e.target as HTMLInputElement).value.split(':').map(Number); if (!isNaN(h)) update((s) => { s.reminders.slots[i].hour = h; s.reminders.slots[i].minute = m; }); }} />
            </div>
            <textarea class="text-input" rows={2} value={sl.body} onInput={(e) => update((s) => { s.reminders.slots[i].body = (e.target as HTMLTextAreaElement).value; })} />
          </div>
        ))}
        <div class="row gap wrap">
          <button class="btn btn-primary" onClick={apply}>Salvar e agendar</button>
          <button class="btn btn-ghost" onClick={async () => setMsg(await testNotification())}>Testar (5 s)</button>
          <button class="btn btn-ghost btn-sm" onClick={() => update((s) => { s.reminders = { enabled: true, slots: DEFAULT_SLOTS.map((x) => ({ ...x })) }; })}>Restaurar padrão</button>
        </div>
        {msg && <p class="callout">{msg}</p>}
      </Card>
      <Card>
        <strong>Diagnóstico das notificações</strong>
        {status ? (
          <div class="small">
            {!status.native && <p class="warn-text">Você está no navegador: os lembretes com app fechado só funcionam no APK instalado no Android.</p>}
            <div>Permissão de notificações: <strong>{status.permission === 'granted' ? '✅ permitida' : '⚠️ ' + status.permission}</strong> {status.permission !== 'granted' && <button class="btn btn-sm" onClick={async () => { await requestPermission(); refresh(); }}>Pedir permissão</button>}</div>
            {status.native && <div>Alarmes exatos (horário preciso): <strong>{status.exact === 'granted' ? '✅ permitidos' : '⚠️ ' + status.exact}</strong> {status.exact !== 'granted' && <button class="btn btn-sm" onClick={async () => { await openExactAlarmSettings(); refresh(); }}>Abrir ajuste</button>}</div>}
            {status.native && <div>Lembretes agendados no aparelho: <strong>{status.pending.filter((p) => p.id !== 1999).length}</strong></div>}
            {status.pending.map((p) => <div class="tiny muted">#{p.id} {p.title} {JSON.stringify((p.schedule as any)?.on ?? '')}</div>)}
            <p class="tiny muted">Dica: em alguns celulares (Xiaomi, Samsung, Motorola…), desative a "otimização de bateria" para este app em Configurações → Apps → Formação Dev → Bateria → Sem restrições. Assim o Android não bloqueia os avisos.</p>
          </div>
        ) : <p class="small muted">Verificando…</p>}
        <button class="btn btn-ghost btn-sm" onClick={refresh}>Atualizar diagnóstico</button>
      </Card>

      <h3 class="section-title">📅 Calendário</h3>
      <Card>
        <label class="small">Sábado em que a formação começou/vai começar:</label>
        <input type="date" value={st.startDate} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) update((s) => { s.startDate = parseYmd(v).getDay() === 6 ? v : defaultStart(parseYmd(v)); }); }} />
        <p class="tiny muted">Se escolher um dia que não é sábado, o app usa o sábado mais próximo. Mudar a data não apaga seu progresso.</p>
      </Card>

      <h3 class="section-title">🎨 Aparência</h3>
      <Card><div class="row gap">{(['auto', 'dark', 'light'] as const).map((t) => <button class={'btn btn-sm ' + (st.theme === t ? 'btn-primary' : 'btn-ghost')} onClick={() => update((s) => { s.theme = t; })}>{({ auto: 'Automático', dark: 'Escuro', light: 'Claro' })[t]}</button>)}</div>
        <label class="small">Seu nome (opcional): <input class="text-input" value={st.name} onInput={(e) => update((s) => { s.name = (e.target as HTMLInputElement).value.slice(0, 30); })} /></label></Card>

      <h3 class="section-title">💾 Backup do progresso</h3>
      <Card>
        <p class="small">Seu progresso fica salvo só neste aparelho. Faça backup antes de trocar de celular ou reinstalar o app.</p>
        <div class="row gap wrap"><button class="btn btn-primary" onClick={exportBackup}>Exportar backup</button><button class="btn btn-ghost" onClick={copyBackup}>Copiar backup</button></div>
        <p class="small">Restaurar: escolha o arquivo ou cole o texto do backup.</p>
        <input type="file" accept=".json,application/json,text/plain" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) doImport(await f.text()); }} />
        <textarea class="text-input" rows={2} placeholder="…ou cole aqui o texto do backup" value={importText} onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)} />
        {importText && <button class="btn btn-ghost" onClick={() => doImport(importText)}>Restaurar do texto colado</button>}
      </Card>

      <h3 class="section-title">ℹ️ Sobre</h3>
      <Card class="small">
        <p><strong>Formação Dev v1.0.0</strong> — evolução do "Backend Mastery AI v0.2.0". Todo o conteúdo anterior (46 aulas, 501 exercícios, 9 projetos) foi preservado e ampliado.</p>
        <p>Funciona offline (exceto vídeos e sites externos). JavaScript, Python e SQL rodam no próprio aparelho.</p>
        <button class="btn btn-ghost btn-sm" onClick={() => { if (confirm('Apagar TODO o progresso? Faça um backup antes. Esta ação não pode ser desfeita.')) { replaceState({ ...initialState(), onboarded: true }); } }}>Apagar progresso</button>
      </Card>
    </div>
  );
}

export function Onboarding() {
  const st = useAppState();
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState('');
  const start = useMemo(() => parseYmd(st.startDate), [st.startDate]);
  return (
    <div class="onboarding">
      {step === 0 && (
        <div class="ob-step">
          <div class="ob-logo">👩‍💻👨‍💻</div>
          <h1>Formação Dev</h1>
          <p>Do zero absoluto a um portfólio de iniciante em <strong>12 semanas</strong>, estudando <strong>3 h no sábado e 3 h no domingo</strong>.</p>
          <ul class="practice-list">
            <li>Conheça todas as áreas: frontend, backend, mobile, desktop, IA, dados, jogos, nuvem e segurança</li>
            <li>Aprofunde-se em <strong>Backend</strong> (Node.js, TypeScript, PostgreSQL)</li>
            <li>Professor virtual: exercícios com correção, dicas e explicação dos erros</li>
            <li>JavaScript, Python e SQL rodando no celular</li>
            <li>Vídeos e cursos gratuitos em português, verificados</li>
          </ul>
          <button class="btn btn-primary big" onClick={() => setStep(1)}>Começar</button>
        </div>
      )}
      {step === 1 && (
        <div class="ob-step">
          <h2>Como posso te chamar?</h2>
          <input class="text-input" placeholder="Seu nome (opcional)" value={st.name} onInput={(e) => update((s) => { s.name = (e.target as HTMLInputElement).value.slice(0, 30); })} />
          <h2>Quando você começa?</h2>
          <p class="small">A formação começa num sábado. Sugestão: {start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.</p>
          <input type="date" value={st.startDate} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) update((s) => { s.startDate = parseYmd(v).getDay() === 6 ? v : defaultStart(parseYmd(v)); }); }} />
          <button class="btn btn-primary big" onClick={() => setStep(2)}>Continuar</button>
        </div>
      )}
      {step === 2 && (
        <div class="ob-step">
          <h2>🔔 Lembretes</h2>
          <p>Vamos avisar você <strong>todo sábado e domingo</strong>:</p>
          <ul class="practice-list"><li><strong>13h30</strong> — "Hora de estudar! Mais um passo para desenvolver suas habilidades e construir seu futuro na programação."</li><li><strong>15h15</strong> — "Continue firme! Pratique o que aprendeu e avance mais uma etapa da sua formação."</li></ul>
          <p class="small muted">Funciona com o app fechado. Você pode mudar horários e textos ou desativar em Ajustes.</p>
          <button class="btn btn-primary big" onClick={async () => { await flush(); const s = getState(); const r = await syncReminders(s.reminders.slots, s.reminders.enabled); setMsg(r.message); setStep(3); }}>Permitir notificações</button>
          <button class="btn btn-ghost" onClick={() => { update((s) => { s.reminders.enabled = false; }); setStep(3); }}>Agora não</button>
        </div>
      )}
      {step === 3 && (
        <div class="ob-step">
          <h2>Tudo pronto! 🚀</h2>
          {msg && <p class="callout">{msg}</p>}
          <p>Na aba <strong>Hoje</strong> você sempre verá o que estudar, quanto tempo dedicar a cada atividade e o próximo objetivo.</p>
          <button class="btn btn-primary big" onClick={() => { update((s) => { s.onboarded = true; }); location.hash = '/hoje'; }}>Ir para o app</button>
        </div>
      )}
    </div>
  );
}
