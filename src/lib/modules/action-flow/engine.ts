import type { FlowDefinition, FlowObserver, FlowState, RunFlowOptions } from './types';
import { appendEvent, createId } from './utils';

function emit(observer: FlowObserver | undefined, state: FlowState, eventData: ReturnType<typeof appendEvent>) {
  observer?.(eventData.event, eventData.state);
}

export async function runFlow(definition: FlowDefinition, options: RunFlowOptions) {
  let state: FlowState = {
    flowId: createId(definition.id),
    systemId: definition.systemId,
    status: 'running',
    context: options.context,
    data: options.initialData ?? {},
    rolls: [],
    commands: [],
    events: [],
    overrides: options.overrides
  };

  let eventData = appendEvent(state, 'FLOW_STARTED', { message: definition.label });
  state = eventData.state;
  emit(options.observer, state, eventData);

  try {
    for (const step of definition.steps) {
      eventData = appendEvent(state, 'STEP_STARTED', {
        stepId: step.id,
        message: step.label
      });
      state = eventData.state;
      emit(options.observer, state, eventData);

      state = definition.strategy.beforeStep?.(state, step) ?? state;
      state = await step.run(state);
      state = definition.strategy.afterStep?.(state, step) ?? state;

      if (state.status === 'halted') {
        eventData = appendEvent(state, 'FLOW_HALTED', {
          stepId: step.id,
          message: state.halt?.prompt,
          payload: state.halt
        });
        state = eventData.state;
        emit(options.observer, state, eventData);
        return state;
      }

      eventData = appendEvent(state, 'STEP_COMPLETED', {
        stepId: step.id,
        message: step.label
      });
      state = eventData.state;
      emit(options.observer, state, eventData);
    }

    state = { ...state, status: 'completed' };
    eventData = appendEvent(state, 'FLOW_COMPLETED', { message: definition.label });
    state = eventData.state;
    emit(options.observer, state, eventData);
    return state;
  } catch (error) {
    state = {
      ...state,
      status: 'failed',
      data: {
        ...state.data,
        error: error instanceof Error ? error.message : 'Unknown flow error'
      }
    };
    eventData = appendEvent(state, 'FLOW_FAILED', {
      message: error instanceof Error ? error.message : 'Unknown flow error'
    });
    state = eventData.state;
    emit(options.observer, state, eventData);
    return state;
  }
}

export function resumeFlow(state: FlowState, patch: Partial<Pick<FlowState, 'data' | 'overrides'>>) {
  return {
    ...state,
    status: 'running' as const,
    halt: undefined,
    data: {
      ...state.data,
      ...patch.data
    },
    overrides: {
      ...state.overrides,
      ...patch.overrides
    }
  };
}
