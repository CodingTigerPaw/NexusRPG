import { VtmDicePoolBuilder } from '../builder';
import { Rules } from '../rules';
import { dicePoolStrategy } from '../strategies';
import type { FlowDefinition } from '../types';

export function createVampireAttributeSkillCheck(attribute: string, skill: string): FlowDefinition {
  return {
    id: `vtm-check-${attribute}-${skill}`,
    label: `Wampir: ${attribute} + ${skill}`,
    systemId: 'vtm',
    strategy: dicePoolStrategy,
    steps: [
      ...new VtmDicePoolBuilder()
        .source('attribute', `characteristics.${attribute}`, `characteristics.Attributes.${attribute}`)
        .source('skill', `skills.${skill}`, `skills.Abilities.${skill}`)
        .source('hunger', 'characteristics.hunger', 'characteristics.Głód', 'skills.Hunger')
        .buildSteps(),
      Rules.haltForManualInput('gm-override', {
        reason: 'WAITING_FOR_GM_CONFIRMATION',
        prompt: 'Czy MG chce ręcznie skorygować wynik?',
        options: [
          { id: 'accept', label: 'Zaakceptuj wynik' },
          { id: 'override', label: 'Skoryguj wynik' }
        ]
      }),
      Rules.recordCommand('VTM_POOL_CHECK_RESOLVED', `Rozliczono pulę ${attribute} + ${skill}`, 'vtmResult')
    ]
  };
}
