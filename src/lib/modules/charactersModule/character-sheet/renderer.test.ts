import { describe, expect, it } from 'vitest';

import type { CharacterCard } from '$lib/modules/characters';
import { resolveCharacterSheet } from './renderer';

function findFieldValue(sheet: NonNullable<ReturnType<typeof resolveCharacterSheet>>, label: string) {
  for (const section of sheet.sections) {
    for (const group of section.groups) {
      const field = group.fields.find((entry) => entry.label === label);

      if (field) {
        return field.value;
      }
    }
  }

  return undefined;
}

describe('resolveCharacterSheet', () => {
  it('formats Call of Cthulhu roll values as percentages without changing non-percent stats', () => {
    const character = {
      userId: 'user-1',
      characterId: 'character-1',
      name: 'Investigator',
      backstory: {
        system: 'Call of Cthulhu 5e'
      },
      characteristics: {
        STR: 50,
        CON: 55,
        POW: 60,
        SIZ: 65,
        INT: 70,
        EDU: 80,
        sanity: 42
      },
      skills: {
        Accounting: 35,
        Luck: 37
      }
    } satisfies CharacterCard;

    const sheet = resolveCharacterSheet(character);

    expect(sheet).not.toBeNull();
    expect(findFieldValue(sheet!, 'STR')).toBe('50%');
    expect(findFieldValue(sheet!, 'Accounting')).toBe('35%');
    expect(findFieldValue(sheet!, 'Luck')).toBe('37%');
    expect(findFieldValue(sheet!, 'Hit Points')).toBe('12');
    expect(findFieldValue(sheet!, 'APP')).toBe('0%');
  });
});
