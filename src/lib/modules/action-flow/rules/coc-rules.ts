import type { FlowStep } from '../types';
import { cloneData, getNumberFromData } from './common-rules';

export type CocSuccessLevel =
  | 'critical'
  | 'extreme'
  | 'hard'
  | 'regular'
  | 'failure'
  | 'fumble';

export type CocSuccessThreshold = 'critical' | 'oneFifth' | 'half' | 'regular' | 'none';

export function resolveCocSuccessThresholds(target: number) {
  return {
    regular: target,
    half: Math.floor(target / 2),
    oneFifth: Math.floor(target / 5)
  };
}

export function resolveCocSuccessLevel(roll: number, target: number): CocSuccessLevel {
  if (roll === 1) {
    return 'critical';
  }

  if (roll >= 96 && roll > target) {
    return 'fumble';
  }

  if (roll <= Math.floor(target / 5)) {
    return 'extreme';
  }

  if (roll <= Math.floor(target / 2)) {
    return 'hard';
  }

  return roll <= target ? 'regular' : 'failure';
}

export function resolveCocSuccessThreshold(roll: number, target: number): CocSuccessThreshold {
  if (roll === 1) {
    return 'critical';
  }

  if (resolveCocSuccessLevel(roll, target) === 'fumble' || roll > target) {
    return 'none';
  }

  const thresholds = resolveCocSuccessThresholds(target);

  if (roll <= thresholds.oneFifth) {
    return 'oneFifth';
  }

  if (roll <= thresholds.half) {
    return 'half';
  }

  return 'regular';
}

export const CocRules = {
  compareRollUnder(
    targetKey: string,
    rollKey = 'roll',
    resultKey = 'successLevel'
  ): FlowStep {
    return {
      id: `compare:${rollKey}:under:${targetKey}`,
      label: 'Calculate success level',
      allowManualOverride: true,
      run: (state) => {
        const roll = getNumberFromData(state.data, rollKey);
        const target = getNumberFromData(state.data, targetKey);
        const override = state.overrides?.[resultKey];
        const successLevel =
          typeof override === 'string'
            ? (override as CocSuccessLevel)
            : resolveCocSuccessLevel(roll, target);
        const thresholds = resolveCocSuccessThresholds(target);

        return {
          ...state,
          data: cloneData(state.data, {
            [resultKey]: successLevel,
            successThreshold: resolveCocSuccessThreshold(roll, target),
            regularTarget: thresholds.regular,
            hardTarget: thresholds.half,
            extremeTarget: thresholds.oneFifth
          })
        };
      }
    };
  }
};
