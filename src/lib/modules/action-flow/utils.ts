import type { FlowCommand, FlowEvent, FlowEventType, FlowState } from './types';

export function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso(state?: Pick<FlowState, 'context'>) {
  return (state?.context.now?.() ?? new Date()).toISOString();
}

export function appendEvent(
  state: FlowState,
  type: FlowEventType,
  payload: Omit<FlowEvent, 'type' | 'flowId' | 'createdAt'> = {}
) {
  const event: FlowEvent = {
    type,
    flowId: state.flowId,
    createdAt: nowIso(state),
    ...payload
  };

  return {
    state: {
      ...state,
      events: [...state.events, event]
    },
    event
  };
}

export function appendCommand(state: FlowState, command: Omit<FlowCommand, 'commandId' | 'createdAt'>) {
  return {
    ...state,
    commands: [
      ...state.commands,
      {
        commandId: createId('command'),
        createdAt: nowIso(state),
        ...command
      }
    ]
  };
}

export function readPath(source: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function readNumber(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readPath(source, path);
    const numberValue = typeof value === 'number' ? value : Number(value);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return 0;
}

export function randomInt(state: FlowState, min: number, max: number) {
  const random = state.context.random ?? Math.random;
  return Math.floor(random() * (max - min + 1)) + min;
}
