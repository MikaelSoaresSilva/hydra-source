import { useProfile } from '../data/AppContext';
import { Segmented } from '../ui/components';

export type Protocol = 'jkk' | 'jkk4';

/**
 * Alterna entre o Protocolo JKK de 5 dias e a versão de 4 dias. Cada um guarda a própria semana
 * e histórico: ao voltar, ele continua de onde parou.
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
          const msg = p === 'jkk'
            ? 'Mudar para o JKK de 5 dias (seg, ter, qua, sex, sáb)? O de 4 dias fica guardado na semana em que está.'
            : 'Mudar para o JKK de 4 dias (seg, ter, qui, sex)? O de 5 dias fica guardado na semana em que está.';
          if (!confirm(msg)) return;
          await save({ preferences: { ...profile.preferences, trainingProtocol: p } });
          onSwitched?.(p);
        }}
        options={[
          { value: 'jkk4', label: '4 dias', sub: 'seg · ter · qui · sex' },
          { value: 'jkk', label: '5 dias', sub: 'seg · ter · qua · sex · sáb' },
        ]}
      />
      <p className="hint" style={{ margin: 0 }}>Os dois têm os mesmos exercícios do Protocolo JKK. Cada um guarda sua semana e seu histórico: trocar não perde nada.</p>
    </div>
  );
}
