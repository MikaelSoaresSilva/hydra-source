import { useEffect, useState } from 'react';
import { useGame } from '../store/game';
import { finishOnboarding } from '../core/engine';
import { CLASSES } from '../data/attributes';
import { Creator } from './Creator';
import { sfx, startMusic } from '../services/audio';

const BOOT = [
  '[SISTEMA INICIADO]',
  '[IDENTIDADE DO JOGADOR: NÃO REGISTRADA]',
  '[ANALISANDO COMPATIBILIDADE...]',
  '[COMPATIBILIDADE CONFIRMADA]',
  '[INICIANDO PROCESSO DE DESPERTAR...]',
  '[PREPARE-SE PARA CRIAR SUA PRÓPRIA LENDA.]',
];

const GOAL_SUGGESTIONS = ['Quero desenvolver meu físico', 'Quero aprender programação backend', 'Quero melhorar minha aparência', 'Quero economizar dinheiro', 'Quero ter mais disciplina'];

export function Onboarding() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [step, setStep] = useState(0);
  const [lines, setLines] = useState(0);
  const [name, setName] = useState('');
  const [cls, setCls] = useState('guerreiro');
  const [goals, setGoals] = useState<string[]>([]);
  const [goalText, setGoalText] = useState('');

  useEffect(() => {
    if (step !== 0) return;
    if (lines < BOOT.length) {
      const t = setTimeout(() => { setLines((l) => l + 1); sfx('click'); }, lines === 0 ? 600 : 1000);
      return () => clearTimeout(t);
    }
  }, [lines, step]);

  if (step === 0) {
    return (
      <div className="boot" onClick={() => { startMusic('calmo'); if (lines >= BOOT.length) { sfx('open'); setStep(1); } else setLines(BOOT.length); }}>
        <Particles />
        <div className="boot-lines">
          {BOOT.slice(0, lines).map((l) => <div key={l}>{l}</div>)}
          {lines >= BOOT.length && <button className="btn primary" style={{ marginTop: 24 }} onClick={() => setStep(1)}>DESPERTAR</button>}
          {lines < BOOT.length && <p className="muted small" style={{ marginTop: 30 }}>toque para pular</p>}
        </div>
      </div>
    );
  }

  const next = () => { sfx('click'); setStep((x) => x + 1); };
  return (
    <div className="screen"><div className="screen-inner onb">
      <Particles />
      <div className="sys-head" style={{ margin: '8px 0 14px' }}>[ REGISTRO DO JOGADOR · {step}/4 ]</div>
      {step === 1 && (
        <div className="panel">
          <h1>Qual é o seu nome, Desperto?</h1>
          <p className="muted">Ele aparecerá no seu painel de status.</p>
          <input type="text" value={name} maxLength={24} placeholder="Seu nome" onChange={(e) => setName(e.target.value)} autoFocus aria-label="Nome" />
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}><button className="btn primary" disabled={name.trim().length < 2} onClick={next}>Confirmar</button></div>
        </div>
      )}
      {step === 2 && (
        <div className="panel">
          <h1>Escolha sua classe inicial</h1>
          <p className="muted">A classe define sua identidade visual e a primeira árvore sugerida. Você pode evoluir qualquer atributo, em qualquer classe.</p>
          <div className="class-grid">
            {CLASSES.map((c) => (
              <button key={c.id} className={`class-card ${cls === c.id ? 'sel' : ''}`} style={{ '--cc': c.color } as React.CSSProperties} onClick={() => { sfx('click'); setCls(c.id); }}>
                <b style={{ color: c.color }}>{c.name}</b>
                <p className="small muted" style={{ margin: '4px 0 0' }}>{c.desc}</p>
              </button>
            ))}
          </div>
          <div className="row between" style={{ marginTop: 14 }}><button className="btn ghost" onClick={() => setStep(1)}>Voltar</button><button className="btn primary" onClick={() => { act((d) => { d.character.classId = cls; d.character.name = name.trim(); }); next(); }}>Confirmar</button></div>
        </div>
      )}
      {step === 3 && (
        <>
          <h1>Crie seu personagem</h1>
          <p className="muted">Ajuste para parecer com você. Pode mudar depois em Herói → Aparência.</p>
          <Creator character={{ ...s.character, classId: cls }} onChange={(a) => act((d) => { d.character.appearance = a; })} quality={s.settings.graphics} />
          <div className="row between"><button className="btn ghost" onClick={() => setStep(2)}>Voltar</button><button className="btn primary" onClick={next}>Continuar</button></div>
        </>
      )}
      {step === 4 && (
        <div className="panel">
          <h1>Quais são seus objetivos?</h1>
          <p className="muted">Escreva com suas palavras. O SISTEMA transforma cada objetivo em uma campanha com fases, missões e um chefe.</p>
          <div className="row gap">
            <input type="text" value={goalText} placeholder='Ex.: "Quero aprender inglês"' onChange={(e) => setGoalText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && goalText.trim().length > 2) { setGoals([...goals, goalText.trim()]); setGoalText(''); } }} />
            <button className="btn" disabled={goalText.trim().length < 3} onClick={() => { setGoals([...goals, goalText.trim()]); setGoalText(''); }}>+</button>
          </div>
          <div className="row wrap gap" style={{ marginTop: 10 }}>
            {GOAL_SUGGESTIONS.filter((g) => !goals.includes(g)).map((g) => <button key={g} className="chip" onClick={() => setGoals([...goals, g])}>+ {g}</button>)}
          </div>
          {goals.length > 0 && <ul style={{ paddingLeft: 18 }}>{goals.map((g) => <li key={g}>{g} <button className="chip" onClick={() => setGoals(goals.filter((x) => x !== g))}>remover</button></li>)}</ul>}
          <p className="small muted">Pode pular e criar depois. Recomendação: comece com 1 ou 2 objetivos.</p>
          <div className="row between" style={{ marginTop: 14 }}><button className="btn ghost" onClick={() => setStep(3)}>Voltar</button>
            <button className="btn primary" onClick={() => { sfx('levelup'); act((d, ev) => finishOnboarding(d, ev, name, cls, goals)); }}>INICIAR JORNADA</button>
          </div>
        </div>
      )}
    </div></div>
  );
}

export function Particles() {
  const [dots] = useState(() => Array.from({ length: 36 }).map(() => ({ l: Math.random() * 100, d: 6 + Math.random() * 10, s: 1 + Math.random() * 2.5, delay: -Math.random() * 12 })));
  return (
    <div className="particles" aria-hidden>
      {dots.map((p, i) => <i key={i} style={{ position: 'absolute', left: `${p.l}%`, bottom: -10, width: p.s, height: p.s, borderRadius: '50%', background: i % 3 ? '#4cc9ff' : '#8b6cff', boxShadow: '0 0 8px currentColor', color: i % 3 ? '#4cc9ff' : '#8b6cff', animation: `floatUp ${p.d}s linear ${p.delay}s infinite`, opacity: 0.7 }} />)}
      <style>{'@keyframes floatUp { from { transform: translateY(0); opacity: 0 } 10% { opacity: .8 } to { transform: translateY(-110vh); opacity: 0 } }'}</style>
    </div>
  );
}
