import { useProfile } from '../data/AppContext';
import type { JkkProtocol } from '../domain/types';
import { Segmented } from '../ui/components';

export type Protocol = JkkProtocol;

export const PROTOCOL_LABEL: Record<Protocol, { label: string; days: string }> = {
  jkk3: { label: '3 dias', days: 'seg · qua · sex' },
  jkk4: { label: '4 dias', days: 'seg · ter · qui · sex' },
  jkk: { label: '5 dias', days: 'seg · ter · qua · sex · sáb' },
};

/**
 * Alterna entre as versões do Protocolo JKK (3, 4 ou 5 dias). Cada uma guarda a própria semana
 * e histórico: ao voltar, ela continua de onde parou. As cargas de cada exercício valem para todas.
 */
export function ProtocolSwitch({ onSwitched }: { onSwitched?: (p: Protocol) => void }) {
  const { profile, save } = useProfile();
  if (!profile) return null;
  const current: Protocol = profile.preferences.trainingProtocol ?? 'jkk4';
  return (
    <div className="stack">
      <Segmented<Protocol>
        label="Escolher treino"
        value={current}
        onChange={async (p) => {
          if (p === current) return;
          if (!confirm(`Mudar para o treino de ${PROTOCOL_LABEL[p].label} (${PROTOCOL_LABEL[p].days})? O de ${PROTOCOL_LABEL[current].label} fica guardado na semana em que está.`)) return;
          await save({ preferences: { ...profile.preferences, trainingProtocol: p } });
          onSwitched?.(p);
        }}
        options={(['jkk3', 'jkk4', 'jkk'] as Protocol[]).map((p) => ({ value: p, label: PROTOCOL_LABEL[p].label, sub: PROTOCOL_LABEL[p].days }))}
      />
      <p className="hint" style={{ margin: 0 }}>Escolha conforme a semana: os três usam os exercícios do Protocolo JKK e as suas cargas valem em todos. Cada um guarda a própria semana e histórico.</p>
    </div>
  );
}
