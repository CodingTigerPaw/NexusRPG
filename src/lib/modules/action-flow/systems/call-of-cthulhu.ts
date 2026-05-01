import { Rules } from '../rules';
import { rollUnderStrategy } from '../strategies';
import type { FlowDefinition } from '../types';

export function createCthulhuSkillCheck(skillName: string): FlowDefinition {
  return {
    id: `coc-skill-check-${skillName}`,
    label: `Zew Cthulhu: ${skillName}`,
    systemId: 'coc5',
    strategy: rollUnderStrategy,
    steps: [
      Rules.fetchFromCharacter(skillName, [`skills.${skillName}`, `characteristics.${skillName}`], 'target'),
      Rules.requestDiceRoll('1d100', 'roll'),
      Rules.compareRollUnder('target', 'roll', 'successLevel'),
      Rules.haltForManualInput('spend-luck', {
        reason: 'WAITING_FOR_LUCK_EXPENDITURE',
        prompt: 'Czy MG pozwala wydać Punkty Szczęścia?',
        options: [
          { id: 'skip', label: 'Nie wydawaj' },
          { id: 'spend', label: 'Wydaj szczęście' }
        ]
      }),
      Rules.recordCommand('COC_SKILL_CHECK_RESOLVED', `Rozliczono test ${skillName}`, 'successLevel')
    ]
  };
}

export const CthulhuSpotHiddenCheck = createCthulhuSkillCheck('Spot Hidden');
