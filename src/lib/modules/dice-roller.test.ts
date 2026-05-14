import { describe, expect, it } from 'vitest';
import { buildStylePlan, parseDiceNotation } from './dice-roller';

describe('parseDiceNotation', () => {
  it('normalizuje wieloczłonową notację rzutu', () => {
    const result = parseDiceNotation('2d10 + d6');

    expect(result.standardNotation).toBe('2d10+1d6');
    expect(result.parsed).toEqual([
      { count: 2, sides: 10, color: undefined, texture: undefined, deterministic: undefined },
      { count: 1, sides: 6, color: undefined, texture: undefined, deterministic: undefined }
    ]);
  });

  it('obsługuje style kości bez mieszania koloru i tekstury', () => {
    const result = parseDiceNotation('1d10#ff0033 + 2d6@marble');

    expect(buildStylePlan(result.parsed)).toEqual([
      { diceIndex: 0, color: '#ff0033', texture: undefined },
      { diceIndex: 1, color: undefined, texture: 'marble' },
      { diceIndex: 2, color: undefined, texture: 'marble' }
    ]);
  });

  it('odrzuca niepoprawną liczbę ścian', () => {
    expect(() => parseDiceNotation('1d1')).toThrow('liczba ścian musi być w zakresie 2..1000');
  });
});
