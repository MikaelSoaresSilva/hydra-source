// Criador de personagem: ajustes manuais + foto como referência de cores (amostragem por toque).
// Limitação honesta: reconstruir um rosto 3D fiel a partir de foto exige modelos de visão
// computacional pesados/servidor. Aqui a foto serve de referência visual e de cores reais
// (pele, cabelo, olhos) que você captura tocando na imagem; o resto é ajustado nos controles.
import { useRef, useState } from 'react';
import type { Appearance, Character } from '../core/types';
import { Showcase } from '../three/Stage';
import { CLASSES } from '../data/attributes';

const SKINS = ['#f6d7c3', '#eac0a0', '#d9a07a', '#c68e6a', '#a8714f', '#8a5a3c', '#6b4329', '#4a2e1c'];
const HAIRS = ['#0d0b0a', '#2b1d14', '#4a3020', '#7a5230', '#b88a50', '#d9c08a', '#8a8f99', '#e8e8e8', '#7a2a2a', '#2a3a8a'];

export function Creator({ character, onChange, quality }: { character: Character; onChange: (a: Appearance) => void; quality: 'alto' | 'medio' | 'baixo' }) {
  const ap = character.appearance;
  const set = (p: Partial<Appearance>) => onChange({ ...ap, ...p });
  const [pick, setPick] = useState<'skin' | 'hair' | 'eyes' | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cls = CLASSES.find((c) => c.id === character.classId) ?? CLASSES[0];
  const [anim, setAnim] = useState<'idle' | 'walk' | 'run' | 'victory' | 'pose'>('pose');

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert('Foto muito grande (máximo 15 MB).'); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Reduz para no máximo 480px e salva somente no aparelho (JPEG comprimido)
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      set({ photo: c.toDataURL('image/jpeg', 0.82) });
      URL.revokeObjectURL(url);
      setPick('skin');
    };
    img.src = url;
  };

  const sample = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!pick) return;
    const img = e.currentTarget;
    const r = img.getBoundingClientRect();
    const c = canvas.current!;
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const x = Math.round(((e.clientX - r.left) / r.width) * c.width);
    const y = Math.round(((e.clientY - r.top) / r.height) * c.height);
    const d = ctx.getImageData(Math.max(0, x - 3), Math.max(0, y - 3), 7, 7).data;
    let R = 0, G = 0, B = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    const hex = '#' + [R / n, G / n, B / n].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    set({ [pick]: hex } as Partial<Appearance>);
    setPick(pick === 'skin' ? 'hair' : pick === 'hair' ? 'eyes' : null);
  };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Showcase character={character} classColor={cls.color} scene="santuario" anim={anim} rankGlow={0} quality={quality} height={360} cameraZ={3.4} />
        <div className="stage-ui">
          {(['pose', 'idle', 'walk', 'run', 'victory'] as const).map((a) => (
            <button key={a} className={`chip ${anim === a ? 'sel' : ''}`} onClick={() => setAnim(a)}>{{ pose: 'Pose', idle: 'Repouso', walk: 'Caminhar', run: 'Correr', victory: 'Vitória' }[a]}</button>
          ))}
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>Arraste para girar 360°, use pinça/roda do mouse para aproximar.</p>

      <div className="panel" style={{ marginTop: 10 }}>
        <div className="panel-title"><span>Foto de referência (opcional)</span></div>
        <p className="small muted">A foto fica <b>somente neste aparelho</b> (nunca é enviada à nuvem). Toque nela para capturar as cores reais da pele, do cabelo e dos olhos.</p>
        <div className="row gap wrap">
          <label className="btn small">
            {ap.photo ? 'Trocar foto' : 'Escolher foto'}
            <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          {ap.photo && <button className="btn small danger" onClick={() => set({ photo: undefined })}>Remover foto</button>}
        </div>
        {ap.photo && (
          <div style={{ marginTop: 10 }}>
            <div className="row gap wrap" style={{ marginBottom: 6 }}>
              {(['skin', 'hair', 'eyes'] as const).map((k) => (
                <button key={k} className={`chip ${pick === k ? 'sel' : ''}`} onClick={() => setPick(k)}>
                  <i style={{ width: 12, height: 12, borderRadius: 3, background: ap[k], display: 'inline-block' }} /> Capturar {k === 'skin' ? 'pele' : k === 'hair' ? 'cabelo' : 'olhos'}
                </button>
              ))}
            </div>
            {pick && <p className="small" style={{ color: 'var(--blue)' }}>Toque na foto sobre: {pick === 'skin' ? 'a bochecha/testa' : pick === 'hair' ? 'o cabelo' : 'a íris do olho'}</p>}
            <img src={ap.photo} alt="Referência" onClick={sample} style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, cursor: pick ? 'crosshair' : 'default', border: '1px solid var(--line)' }} />
            <canvas ref={canvas} hidden />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title"><span>Aparência</span></div>
        <label className="field">Tom de pele
          <div className="row gap wrap">{SKINS.map((c) => <button key={c} aria-label={c} onClick={() => set({ skin: c })} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: ap.skin === c ? '2px solid #fff' : '1px solid #333' }} />)}<input type="color" value={ap.skin} onChange={(e) => set({ skin: e.target.value })} /></div>
        </label>
        <label className="field">Cor do cabelo / barba
          <div className="row gap wrap">{HAIRS.map((c) => <button key={c} aria-label={c} onClick={() => set({ hair: c })} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: ap.hair === c ? '2px solid #fff' : '1px solid #333' }} />)}<input type="color" value={ap.hair} onChange={(e) => set({ hair: e.target.value })} /></div>
        </label>
        <label className="field">Estilo de cabelo
          <select value={ap.hairStyle} onChange={(e) => set({ hairStyle: e.target.value as Appearance['hairStyle'] })}>
            <option value="curto">Curto</option><option value="espetado">Espetado</option><option value="longo">Longo</option><option value="raspado">Raspado</option><option value="cacheado">Cacheado</option><option value="coque">Coque</option>
          </select>
        </label>
        <div className="row gap">
          <label className="field grow">Barba
            <select value={ap.beard} onChange={(e) => set({ beard: e.target.value as Appearance['beard'] })}>
              <option value="nenhuma">Nenhuma</option><option value="rala">Rala</option><option value="cheia">Cheia</option><option value="cavanhaque">Cavanhaque</option>
            </select>
          </label>
          <label className="field">Olhos <input type="color" value={ap.eyes} onChange={(e) => set({ eyes: e.target.value })} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={ap.mustache} onChange={(e) => set({ mustache: e.target.checked })} /> Bigode</label>
        <Range label="Sobrancelhas" v={ap.brows} min={0} max={1} on={(v) => set({ brows: v })} />
        <Range label="Altura" v={ap.height} min={0.85} max={1.15} on={(v) => set({ height: v })} />
        <Range label="Largura do corpo" v={ap.build} min={0.8} max={1.3} on={(v) => set({ build: v })} />
        <Range label="Musculatura" v={ap.muscle} min={0} max={1} on={(v) => set({ muscle: v })} />
        <Range label="Tamanho da cabeça" v={ap.headSize} min={0.9} max={1.12} on={(v) => set({ headSize: v })} />
      </div>
    </div>
  );
}

function Range({ label, v, min, max, on }: { label: string; v: number; min: number; max: number; on: (v: number) => void }) {
  return (
    <label className="field">{label} <input type="range" min={min} max={max} step={0.01} value={v} onChange={(e) => on(Number(e.target.value))} /></label>
  );
}
