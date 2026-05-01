import type { DiceRollEntry, FlowHalt, FlowStep } from '../types';
import { appendCommand, randomInt, readNumber } from '../utils';

export function cloneData(
  data: Record<string, unknown>,
  patch: Record<string, unknown>
) {
  return {
    ...data,
    ...patch
  };
}

export function getNumberFromData(data: Record<string, unknown>, key: string) {
  const value = data[key];
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function parseNotation(notation: string) {
  const match = notation.trim().match(/^(\d*)d(\d+)$/i);

  if (!match) {
    throw new Error(`Unsupported dice notation "${notation}".`);
  }

  return {
    count: match[1] ? Number(match[1]) : 1,
    sides: Number(match[2])
  };
}

function rollNotation(
  state: Parameters<FlowStep['run']>[0],
  notation: string
): DiceRollEntry {
  const parsed = parseNotation(notation);
  const dice = Array.from({ length: parsed.count }, () => ({
    sides: parsed.sides,
    value: randomInt(state, 1, parsed.sides)
  }));

  return {
    notation,
    dice,
    total: dice.reduce((sum, die) => sum + die.value, 0)
  };
}

export const CommonRules = {
  fetchFromCharacter(id: string, paths: string[], targetKey = id): FlowStep {
    return {
      id: `fetch:${id}`,
      label: `Fetch ${id}`,
      run: (state) => ({
        ...state,
        data: cloneData(state.data, {
          [targetKey]: readNumber(state.context.character, paths)
        })
      })
    };
  },

  requestDiceRoll(notation: string, targetKey = 'roll'): FlowStep {
    return {
      id: `roll:${targetKey}`,
      label: `Roll ${notation}`,
      allowManualOverride: true,
      run: (state) => {
        const override = state.overrides?.[targetKey];
        const roll =
          typeof override === 'number'
            ? {
                notation,
                total: override,
                dice: [{ sides: parseNotation(notation).sides, value: override }]
              }
            : rollNotation(state, notation);

        return {
          ...state,
          data: cloneData(state.data, {
            [targetKey]: roll.total
          }),
          rolls: [...state.rolls, roll]
        };
      }
    };
  },

  haltForManualInput(id: string, halt: FlowHalt): FlowStep {
    return {
      id: `halt:${id}`,
      label: halt.prompt,
      run: (state) => ({
        ...state,
        status: 'halted',
        halt
      })
    };
  },

  recordCommand(type: string, label: string, payloadKey?: string): FlowStep {
    return {
      id: `command:${type}`,
      label,
      run: (state) =>
        appendCommand(state, {
          type,
          label,
          payload: payloadKey ? state.data[payloadKey] : state.data
        })
    };
  }
};
