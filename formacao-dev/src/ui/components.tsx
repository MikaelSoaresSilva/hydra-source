import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Browser } from '@capacitor/browser';
import { isNative, update } from '../engine/store';
import { addStudy } from '../engine/state';
import type { Resource } from '../data/types';

export const go = (path: string) => { location.hash = path; };

export async function openUrl(url: string) {
  if (isNative()) await Browser.open({ url });
  else window.open(url, '_blank', 'noopener');
}

export function Header({ title, back, sub }: { title: string; back?: boolean | string; sub?: string }) {
  return (
    <header class="topbar">
      {back && <button class="icon-btn" aria-label="Voltar" onClick={() => (typeof back === 'string' ? go(back) : history.back())}>←</button>}
      <div class="topbar-text"><h1>{title}</h1>{sub && <p class="muted small">{sub}</p>}</div>
    </header>
  );
}

export function Card({ children, class: cls = '', onClick }: { children: ComponentChildren; class?: string; onClick?: () => void }) {
  return <div class={'card ' + cls + (onClick ? ' clickable' : '')} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>{children}</div>;
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return <div class="bar"><div class="bar-fill" style={{ width: Math.max(0, Math.min(100, value)) + '%', background: color }} /></div>;
}

export function Ring({ value, size = 84, label, color = 'var(--accent)' }: { value: number; size?: number; label?: string; color?: string }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(value)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" stroke-width="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width="8" stroke-linecap="round"
        stroke-dasharray={c} stroke-dashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="ring-text" font-size={size / 4.6}>{Math.round(value)}%</text>
      {label && <text x="50%" y="74%" text-anchor="middle" class="ring-label" font-size={size / 9}>{label}</text>}
    </svg>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return <pre class="code" data-lang={lang ?? 'js'}><code>{code}</code></pre>;
}

const KIND_LABEL: Record<Resource['kind'], string> = { playlist: '▶ Playlist', video: '▶ Vídeo', curso: '🎓 Curso', site: '🌐 Site', doc: '📘 Documentação', exercicios: '✍️ Exercícios', simulador: '🧪 Prática interativa', projeto: '🛠 Projetos', vagas: '💼 Vagas' };

export function ResourceCard({ r, compact }: { r: Resource; compact?: boolean }) {
  return (
    <div class="resource">
      <div class="resource-head">
        <span class="tag">{KIND_LABEL[r.kind]}</span>
        <span class={'tag lvl-' + r.level}>{r.level}</span>
        <span class="tag">{r.lang === 'pt' ? '🇧🇷 PT-BR' : r.lang === 'en' ? '🇺🇸 Inglês' : 'Espanhol'}</span>
        {r.minutes && <span class="tag">{r.minutes} min</span>}
      </div>
      <strong>{r.title}</strong>
      {r.author && <div class="muted small">{r.author}</div>}
      {!compact && <p class="small">{r.desc}</p>}
      <p class="small guide">👉 {r.guide}</p>
      <button class="btn btn-sm" onClick={() => openUrl(r.url)}>Abrir {r.kind === 'video' || r.kind === 'playlist' ? 'no YouTube' : 'site'} ↗</button>
    </div>
  );
}

/** Conta o tempo de estudo enquanto a tela está visível (salvo a cada 30 s). */
export function useStudyTimer(active = true) {
  const acc = useRef(0);
  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') acc.current += 5;
      if (acc.current >= 30) { const s = acc.current; acc.current = 0; update((st) => { st.studyLog = addStudy(st.studyLog, s); }); }
    }, 5000);
    return () => {
      clearInterval(tick);
      if (acc.current > 0) { const s = acc.current; acc.current = 0; update((st) => { st.studyLog = addStudy(st.studyLog, s); }); }
    };
  }, [active]);
}

export function Empty({ children }: { children: ComponentChildren }) { return <p class="muted center pad">{children}</p>; }

export function fmtDate(d: Date) { return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); }
