import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const beep = vi.fn(() => true);
const schedule = vi.fn(async (_at: number) => {});
const cancel = vi.fn(async () => {});
vi.mock('../ui/sound', () => ({
  playRestBeep: () => beep(), unlockAudio: vi.fn(), keepScreenOn: vi.fn(async () => null),
  scheduleRestAlert: (at: number) => schedule(at), cancelRestAlert: () => cancel(), ensureRestAlerts: vi.fn(async () => true),
}));
const setVisibility = (v: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });

describe('cronômetro de descanso', () => {
  beforeEach(() => { vi.useFakeTimers(); beep.mockClear(); schedule.mockClear(); cancel.mockClear(); setVisibility('visible'); Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true }); });
  afterEach(() => vi.useRealTimers());

  it('toca o bipe e vibra exatamente quando o descanso acaba (uma vez)', async () => {
    const { RestTimer } = await import('./Workout');
    render(<RestTimer endsAt={Date.now() + 90_000} onClear={() => {}} sound />);
    expect(screen.getByRole('timer').textContent).toMatch(/Descanso 1:30/);
    act(() => { vi.advanceTimersByTime(89_000); });
    expect(beep).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(beep).toHaveBeenCalledTimes(1);
    expect(navigator.vibrate).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(beep).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('timer').textContent).toMatch(/Descanso concluído/);
  });

  it('com o som desligado só vibra', async () => {
    const { RestTimer } = await import('./Workout');
    render(<RestTimer endsAt={Date.now() + 5_000} onClear={() => {}} sound={false} />);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(beep).not.toHaveBeenCalled();
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it('pular o descanso cancela o bipe', async () => {
    const { RestTimer } = await import('./Workout');
    const { rerender } = render(<RestTimer endsAt={Date.now() + 5_000} onClear={() => {}} sound />);
    rerender(<RestTimer endsAt={null} onClear={() => {}} sound />);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(beep).not.toHaveBeenCalled();
  });
});

describe('cronômetro em segundo plano', () => {
  beforeEach(() => { vi.useFakeTimers(); beep.mockClear(); schedule.mockClear(); cancel.mockClear(); setVisibility('visible'); Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true }); });
  afterEach(() => vi.useRealTimers());

  it('agenda o aviso do sistema para o fim exato do descanso', async () => {
    const { RestTimer } = await import('./Workout');
    const endsAt = Date.now() + 60_000;
    render(<RestTimer endsAt={endsAt} onClear={() => {}} sound />);
    expect(schedule).toHaveBeenCalledWith(endsAt);
  });
  it('com o app aberto: cancela o aviso do sistema 1,5 s antes e o próprio app toca (sem tocar dobrado)', async () => {
    const { RestTimer } = await import('./Workout');
    render(<RestTimer endsAt={Date.now() + 60_000} onClear={() => {}} sound />);
    act(() => { vi.advanceTimersByTime(58_400); });
    expect(cancel).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(cancel).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1_400); });
    expect(beep).toHaveBeenCalledTimes(1);
  });
  it('com a tela bloqueada/outro app: mantém o aviso do sistema e o app não toca por cima', async () => {
    const { RestTimer } = await import('./Workout');
    render(<RestTimer endsAt={Date.now() + 30_000} onClear={() => {}} sound />);
    setVisibility('hidden');
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(cancel).not.toHaveBeenCalled();
    expect(beep).not.toHaveBeenCalled();
  });
  it('som desligado: não agenda aviso no sistema', async () => {
    const { RestTimer } = await import('./Workout');
    render(<RestTimer endsAt={Date.now() + 30_000} onClear={() => {}} sound={false} />);
    expect(schedule).not.toHaveBeenCalled();
  });
});
