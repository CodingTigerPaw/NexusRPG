import type { FlowStep } from './types';
import { Rules } from './rules';

export type VtmDicePoolSource = 'attribute' | 'skill' | 'hunger';

export class VtmDicePoolBuilder {
  private sources: Record<VtmDicePoolSource, string[]> = {
    attribute: [],
    skill: [],
    hunger: []
  };
  private modifierKey = 'modifier';

  source(source: VtmDicePoolSource, ...paths: string[]) {
    this.sources[source].push(...paths);
    return this;
  }

  addModifierKey(key: string) {
    this.modifierKey = key;
    return this;
  }

  buildSteps(): FlowStep[] {
    return [
      Rules.buildVtmPool({
        attributePaths: this.sources.attribute,
        skillPaths: this.sources.skill,
        hungerPaths: this.sources.hunger,
        modifierKey: this.modifierKey
      }),
      Rules.rollVtmPool(),
      Rules.evaluateVtmRoll()
    ];
  }
}
