import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const beep = vi.fn(() => true);
vi.mock('../ui/sound', () => ({ playRestBeep: () => beep(), unlockAudio: vi.fn(), keepScreenOn: vi.fn(async () => null) }));

describe('cronômetro de descanso', () => {
  beforeEach(() => { vi.useFakeTimers(); beep.mockClear(); Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true }); });
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
