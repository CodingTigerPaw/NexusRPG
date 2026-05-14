import { describe, expect, it } from 'vitest';
import { buildStylePlan, formatDiceMechanics, formatDiceRollTotal, parseDiceNotation } from './dice-roller';

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

describe('formatDiceMechanics', () => {
  it('prezentuje rzut i próg Zewu Cthulhu jako procenty', () => {
    const roll = {
      rollId: 'roll-1',
      sessionId: 'session-1',
      userId: 'user-1',
      userName: 'Investigator',
      notation: '1d100',
      standardNotation: '1d100',
      total: 42,
      dice: [{ sides: 100, value: 42 }],
      mechanics: {
        systemId: 'coc5',
        checkName: 'Accounting',
        roll: 42,
        target: 55,
        hardTarget: 27,
        extremeTarget: 11,
        successThreshold: 'regular',
        successLevel: 'regular'
      },
      createdAt: '2026-05-14T18:00:00.000Z'
    };

    expect(formatDiceMechanics(roll)).toBe('Sukces · rzut 42% · próg 55%');
    expect(formatDiceRollTotal(roll)).toBe('42%');
  });

  it('dopowiada próg 1/2 albo 1/5 tylko wtedy, gdy został faktycznie przebity', () => {
    const baseRoll = {
      rollId: 'roll-1',
      sessionId: 'session-1',
      userId: 'user-1',
      userName: 'Investigator',
      notation: '1d100',
      standardNotation: '1d100',
      total: 27,
      dice: [{ sides: 100, value: 27 }],
      mechanics: {
        systemId: 'coc5',
        checkName: 'Accounting',
        roll: 27,
        target: 55,
        hardTarget: 27,
        extremeTarget: 11,
        successThreshold: 'half',
        successLevel: 'hard'
      },
      createdAt: '2026-05-14T18:00:00.000Z'
    };

    expect(formatDiceMechanics(baseRoll)).toBe('Trudny sukces · przebicie 1/2 · rzut 27% · próg 55%');
    expect(formatDiceMechanics({
      ...baseRoll,
      total: 11,
      dice: [{ sides: 100, value: 11 }],
      mechanics: {
        ...baseRoll.mechanics,
        roll: 11,
        successThreshold: 'oneFifth',
        successLevel: 'extreme'
      }
    })).toBe('Ekstremalny sukces · przebicie 1/5 · rzut 11% · próg 55%');
  });
});
