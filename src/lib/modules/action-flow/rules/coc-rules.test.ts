import { describe, expect, it } from 'vitest';

import {
  resolveCocSuccessLevel,
  resolveCocSuccessThreshold,
  resolveCocSuccessThresholds
} from './coc-rules';

describe('Call of Cthulhu roll thresholds', () => {
  it('wylicza progi zwykłego, trudnego i ekstremalnego sukcesu', () => {
    expect(resolveCocSuccessThresholds(55)).toEqual({
      regular: 55,
      half: 27,
      oneFifth: 11
    });
  });

  it('rozpoznaje sukces 1/2 i 1/5 dla rzutu pod próg', () => {
    expect(resolveCocSuccessLevel(27, 55)).toBe('hard');
    expect(resolveCocSuccessThreshold(27, 55)).toBe('half');

    expect(resolveCocSuccessLevel(11, 55)).toBe('extreme');
    expect(resolveCocSuccessThreshold(11, 55)).toBe('oneFifth');
  });

  it('zachowuje krytyk i porażkę poza progami przebicia', () => {
    expect(resolveCocSuccessThreshold(1, 55)).toBe('critical');
    expect(resolveCocSuccessThreshold(80, 55)).toBe('none');
  });
});
