import { useState } from 'react';
import { useProfile } from '../data/AppContext';
import { ARTICLES, CONFLICTS, MODULE_LABEL, SOURCES, TRAINING_SYSTEMS, type KModule } from '../domain/knowledge';
import {
  ACSM_HYPERTROPHY, BAECHLE_TABLE, LEVEL_LABEL, RATAMESS_VOLUME, STRENGTH_MANIFESTATIONS, estimate1RM, loadForReps, trainingLevel,
} from '../domain/science';
import { Card, Field, NumberInput, Tabs, fmt } from '../ui/components';

type Tab = KModule | 'calc' | 'sistemas' | 'fontes';

function Calculator() {
  const [load, setLoad] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [rir, setRir] = useState<number | null>(0);
  const rm = load && reps ? estimate1RM(load, reps, rir ?? 0) : null;
  return (
    <Card title="Calculadora de 1RM estimado e cargas">
      <p className="hint">Use uma série boa e recente. A estimativa vem da tabela de Baechle e vale até 15 repetições (somando o RIR). Não é preciso testar 1RM: trabalhe por zona de repetições.</p>
      <div className="grid two">
        <Field label="Carga (kg)"><NumberInput aria-label="Carga da série" value={load} min={0} max={1000} onChange={setLoad} /></Field>
        <Field label="Repetições feitas"><NumberInput aria-label="Repetições feitas" value={reps} min={1} max={30} onChange={setReps} /></Field>
        <Field label="RIR (sobrariam quantas?)"><NumberInput aria-label="RIR da série" value={rir} min={0} max={5} onChange={setRir} /></Field>
      </div>
      {load && reps ? (rm ? (
        <>
          <p>1RM estimado: <strong data-testid="e1rm">{fmt(rm)} kg</strong></p>
          <div className="scroll-x"><table className="t">
            <thead><tr><th>Repetições máximas</th><th>%1RM</th><th>Carga aproximada</th></tr></thead>
            <tbody>{[6, 8, 10, 12, 15].map((r) => <tr key={r}><td>{r}</td><td>{BAECHLE_TABLE.find(([, n]) => n === r)?.[0] ?? '—'}%</td><td>{fmt(loadForReps(rm, r))} kg</td></tr>)}</tbody>
          </table></div>
          <p className="hint">Leg press 45°: a força efetiva é ≈ 0,7× o peso das anilhas. Crossover com polia móvel: ≈ metade da placa. Não compare cargas entre máquinas diferentes.</p>
        </>
      ) : <p className="hint">Acima de 15 repetições (com RIR) a tabela não estima com segurança.</p>) : null}
    </Card>
  );
}

export function Library() {
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>('treino');
  const level = trainingLevel(profile?.training.experienceMonths);
  const articles = ARTICLES.filter((a) => a.module === tab);
  return (
    <div className="stack">
      <div>
        <h1>Biblioteca</h1>
        <p className="muted">O que o Titan aprendeu dos materiais de musculação, pele e cabelo, com a fonte de cada ponto.</p>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { value: 'treino', label: 'Treino' }, { value: 'calc', label: 'Calculadora' }, { value: 'sistemas', label: 'Sistemas' },
        { value: 'nutricao', label: 'Saúde' }, { value: 'pele', label: 'Pele' }, { value: 'cabelo', label: 'Cabelo' }, { value: 'fontes', label: 'Fontes' },
      ]} />

      {tab === 'treino' && (
        <Card title={`Seu nível: ${LEVEL_LABEL[level]}`}>
          <p className="hint">Pelo tempo de treino informado ({profile?.training.experienceMonths ?? '—'} meses).</p>
          <ul className="list">
            <li>ACSM (hipertrofia): {ACSM_HYPERTROPHY[level].reps} reps · {ACSM_HYPERTROPHY[level].sets} séries · {ACSM_HYPERTROPHY[level].pct} 1RM · descanso {ACSM_HYPERTROPHY[level].rest} · {ACSM_HYPERTROPHY[level].freq}</li>
            <li>Ratamess: {RATAMESS_VOLUME[level].setsPerGroup} séries e {RATAMESS_VOLUME[level].exercisesPerGroup} exercício(s) por grupo na sessão</li>
            <li>Mínimo semanal para hipertrofia: ≥10 séries por grupo (o Titan garante isso nos músculos prioritários quando o tempo permite)</li>
          </ul>
        </Card>
      )}

      {tab === 'calc' && (
        <>
          <Calculator />
          <Card title="Manifestações da força (Uchida)">
            <div className="scroll-x"><table className="t">
              <thead><tr><th>Tipo</th><th>Reps</th><th>%1RM</th><th>Séries</th><th>Pausa</th></tr></thead>
              <tbody>{STRENGTH_MANIFESTATIONS.map((m) => <tr key={m.key}><td>{m.name}</td><td>{m.reps}</td><td>{m.pct}</td><td>{m.sets}</td><td>{m.rest}</td></tr>)}</tbody>
            </table></div>
          </Card>
        </>
      )}

      {tab === 'sistemas' && (
        <Card title="Sistemas de treinamento">
          <p className="hint">Opcionais. O plano do Titan usa séries múltiplas e o sistema prioritário (braços primeiro). Técnicas marcadas como "avançado" só fazem sentido com mais de 1 ano de treino, por poucas semanas e em poucos exercícios: elas aumentam a fadiga e o risco.{level !== 'advanced' ? ' Pelo seu tempo de treino, ainda não são indicadas.' : ''}</p>
          <ul className="list">
            {TRAINING_SYSTEMS.map((t) => (
              <li key={t.name}>
                <strong>{t.name}</strong> {t.advancedOnly && <span className="tag warn">avançado</span>}
                <br /><small>{t.how}</small>
                <br /><small className="muted">Objetivo: {t.goal} · Nível: {t.level} · Semanas: {t.weeks}</small>
              </li>
            ))}
          </ul>
          <p className="hint">Fonte: {SOURCES.estrut}.</p>
        </Card>
      )}

      {(['treino', 'nutricao', 'pele', 'cabelo'] as Tab[]).includes(tab) && articles.map((a) => (
        <Card key={a.id} title={a.title}>
          <ul>{a.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="hint">Fonte: {a.sources.map((s) => SOURCES[s]).join(' · ')} · {MODULE_LABEL[a.module]}</p>
        </Card>
      ))}

      {tab === 'fontes' && (
        <>
          <Card title="Onde as fontes discordam">
            {CONFLICTS.map((c) => (
              <div key={c.topic} className="stack" style={{ marginBottom: 12 }}>
                <strong>{c.topic}</strong>
                <small>• {SOURCES[c.a.source]}: {c.a.text}</small>
                <small>• {SOURCES[c.b.source]}: {c.b.text}</small>
                <small><strong>Como o Titan resolve:</strong> {c.titan}</small>
              </div>
            ))}
          </Card>
          <Card title="Materiais estudados">
            <ul>{Object.values(SOURCES).map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="hint">Os materiais são educativos e não substituem um profissional de educação física, nutricionista, dermatologista ou médico.</p>
          </Card>
        </>
      )}
    </div>
  );
}
