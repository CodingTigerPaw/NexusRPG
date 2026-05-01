import type { DiceRollEntry, FlowStep } from '../types';
import { randomInt, readNumber } from '../utils';
import { cloneData, getNumberFromData } from './common-rules';

const VTM_HUNGER_DIE_COLOR = '#c1121f';

type VtmPoolConfig = {
  attributePaths: string[];
  skillPaths: string[];
  hungerPaths?: string[];
  modifierKey?: string;
  targetKey?: string;
};

function clampHunger(hunger: number, pool: number) {
  return Math.max(0, Math.min(hunger, pool));
}

function isHungerColor(color: string | undefined) {
  return color?.toLowerCase() === VTM_HUNGER_DIE_COLOR;
}

export type VtmEvaluatedDie = {
  sides: number;
  value: number;
  kind?: 'standard' | 'hunger' | string;
  color?: string;
  texture?: string;
  parts?: string[];
};

export function markVtmDiceKinds<T extends VtmEvaluatedDie>(
  dice: T[],
  pool: number,
  hunger: number
): T[] {
  const clampedHunger = clampHunger(hunger, pool);
  const standardDice = Math.max(0, pool - clampedHunger);

  return dice.map((die, index) => ({
    ...die,
    kind:
      die.kind ??
      (isHungerColor(die.color) || index >= standardDice ? 'hunger' : 'standard')
  }));
}

export function evaluateVtmDice(dice: VtmEvaluatedDie[]) {
  const successes = dice.filter((die) => die.value >= 6).length;
  const tens = dice.filter((die) => die.value === 10);
  const criticalPairs = Math.floor(tens.length / 2);
  const messyCritical = criticalPairs > 0 && tens.some((die) => die.kind === 'hunger');
  const bestialFailure =
    successes === 0 && dice.some((die) => die.kind === 'hunger' && die.value === 1);

  return {
    successes: successes + criticalPairs * 2,
    criticalPairs,
    messyCritical,
    bestialFailure
  };
}

function resolveVtmPool(state: Parameters<FlowStep['run']>[0], config: VtmPoolConfig) {
  const attribute = readNumber(state.context.character, config.attributePaths);
  const skill = readNumber(state.context.character, config.skillPaths);
  const hunger = readNumber(state.context.character, config.hungerPaths ?? []);
  const modifier = getNumberFromData(state.data, config.modifierKey ?? 'modifier');
  const pool = Math.max(1, attribute + skill + modifier);
  const clampedHunger = clampHunger(hunger, pool);

  return {
    pool,
    hunger: clampedHunger,
    standardDice: Math.max(0, pool - clampedHunger)
  };
}

export const VtmRules = {
  buildVtmPool(config: VtmPoolConfig): FlowStep {
    return {
      id: 'vtm:build-pool',
      label: 'Build Vampire dice pool',
      allowManualOverride: true,
      run: (state) => {
        const poolData = resolveVtmPool(state, config);

        return {
          ...state,
          data: cloneData(state.data, {
            [config.targetKey ?? 'pool']: poolData.pool,
            hunger: poolData.hunger,
            standardDice: poolData.standardDice
          })
        };
      }
    };
  },

  rollVtmPool(
    poolKey = 'pool',
    hungerKey = 'hunger',
    targetKey = 'vtmRoll'
  ): FlowStep {
    return {
      id: 'vtm:roll-pool',
      label: 'Roll Vampire dice pool',
      allowManualOverride: true,
      run: (state) => {
        const pool = getNumberFromData(state.data, poolKey);
        const hunger = Math.min(getNumberFromData(state.data, hungerKey), pool);
        const overrideValues = Array.isArray(state.overrides?.diceValues)
          ? state.overrides.diceValues.map((value) => Number(value))
          : [];
        const standardDice = Math.max(0, pool - hunger);
        const dice = markVtmDiceKinds(Array.from({ length: pool }, (_, index) => ({
          sides: 10,
          value: Number.isFinite(overrideValues[index])
            ? overrideValues[index]
            : randomInt(state, 1, 10),
          kind: index >= standardDice ? 'hunger' : 'standard'
        })), pool, hunger);
        const roll: DiceRollEntry = {
          notation: `${pool}d10`,
          dice,
          total: dice.reduce((sum, die) => sum + die.value, 0)
        };

        return {
          ...state,
          data: cloneData(state.data, {
            [targetKey]: dice
          }),
          rolls: [...state.rolls, roll]
        };
      }
    };
  },

  evaluateVtmRoll(sourceKey = 'vtmRoll', resultKey = 'vtmResult'): FlowStep {
    return {
      id: 'vtm:evaluate-roll',
      label: 'Evaluate Vampire roll',
      run: (state) => {
        const dice = Array.isArray(state.data[sourceKey])
          ? (state.data[sourceKey] as DiceRollEntry['dice'])
          : [];
        const result = evaluateVtmDice(dice);

        return {
          ...state,
          data: cloneData(state.data, {
            [resultKey]: result
          })
        };
      }
    };
  }
};
