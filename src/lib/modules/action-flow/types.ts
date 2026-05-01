import type { CharacterCard } from '$lib/modules/charactersTypes';

export type FlowStatus = 'idle' | 'running' | 'halted' | 'completed' | 'failed';

export type FlowEventType =
  | 'FLOW_STARTED'
  | 'STEP_STARTED'
  | 'STEP_COMPLETED'
  | 'FLOW_HALTED'
  | 'FLOW_COMPLETED'
  | 'FLOW_FAILED'
  | 'COMMAND_RECORDED';

export type FlowEvent = {
  type: FlowEventType;
  flowId: string;
  stepId?: string;
  message?: string;
  payload?: unknown;
  createdAt: string;
};

export type FlowCommand = {
  commandId: string;
  type: string;
  label: string;
  payload?: unknown;
  undo?: FlowCommand;
  createdAt: string;
};

export type DiceRollEntry = {
  notation: string;
  total: number;
  dice: Array<{
    sides: number;
    value: number;
    kind?: string;
  }>;
};

export type FlowHalt = {
  reason: string;
  prompt: string;
  options?: Array<{
    id: string;
    label: string;
    payload?: unknown;
  }>;
};

export type FlowContext = {
  sessionId?: string;
  actorUserId?: string;
  character?: CharacterCard;
  gmUserId?: string;
  now?: () => Date;
  random?: () => number;
};

export type FlowState = {
  flowId: string;
  systemId: string;
  status: FlowStatus;
  context: FlowContext;
  data: Record<string, unknown>;
  rolls: DiceRollEntry[];
  commands: FlowCommand[];
  events: FlowEvent[];
  halt?: FlowHalt;
  overrides?: Record<string, unknown>;
};

export type FlowStep = {
  id: string;
  label: string;
  run: (state: FlowState) => FlowState | Promise<FlowState>;
  allowManualOverride?: boolean;
};

export type FlowStrategy = {
  id: string;
  label: string;
  beforeStep?: (state: FlowState, step: FlowStep) => FlowState;
  afterStep?: (state: FlowState, step: FlowStep) => FlowState;
};

export type FlowDefinition = {
  id: string;
  label: string;
  systemId: string;
  strategy: FlowStrategy;
  steps: FlowStep[];
};

export type FlowObserver = (event: FlowEvent, state: FlowState) => void;

export type RunFlowOptions = {
  context: FlowContext;
  initialData?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  observer?: FlowObserver;
};
