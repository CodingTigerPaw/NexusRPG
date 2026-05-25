import { describe, expect, it } from 'vitest';

import type { CharacterCard } from '$lib/modules/characters';
import { resolveCharacterSheet } from './renderer';

function findFieldValue(sheet: NonNullable<ReturnType<typeof resolveCharacterSheet>>, label: string) {
  return findField(sheet, label)?.value;
}

function findField(sheet: NonNullable<ReturnType<typeof resolveCharacterSheet>>, label: string) {
  for (const section of sheet.sections) {
    for (const group of section.groups) {
      const field = group.fields.find((entry) => entry.label === label);

      if (field) {
        return field;
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

  it('uses live session resource values for Vampire resources before derived fallbacks', () => {
    const character = {
      userId: 'user-1',
      characterId: 'character-1',
      name: 'Vampire',
      rpgSystem: 'Vampire: The Masquerade',
      backstory: {
        system: 'Vampire: The Masquerade'
      },
      characteristics: {
        Stamina: 4,
        Opanowanie: 4,
        Determinacja: 4,
        health: 2,
        willpower: 3,
        hunger: 4
      },
      skills: {
        Virtues: {
          Conscience: 2,
          'Self-Control': 3
        }
      }
    } satisfies CharacterCard;

    const sheet = resolveCharacterSheet(character);

    expect(sheet).not.toBeNull();
    expect(findFieldValue(sheet!, 'Punkty życia')).toBe('2');
    expect(findFieldValue(sheet!, 'Siła woli')).toBe('3');
    expect(findFieldValue(sheet!, 'Głód')).toBe('4');
    expect(findField(sheet!, 'Punkty życia')?.maxValue).toBe('7');
    expect(findField(sheet!, 'Siła woli')?.maxValue).toBe('8');
  });

  it('falls back to derived Vampire values when live session resource values are absent', () => {
    const character = {
      userId: 'user-1',
      characterId: 'character-1',
      name: 'Vampire',
      rpgSystem: 'Vampire: The Masquerade',
      backstory: {
        system: 'Vampire: The Masquerade'
      },
      characteristics: {
        Stamina: 2,
        Opanowanie: 2,
        Determinacja: 3
      },
      skills: {}
    } satisfies CharacterCard;

    const sheet = resolveCharacterSheet(character);

    expect(sheet).not.toBeNull();
    expect(findFieldValue(sheet!, 'Punkty życia')).toBe('5');
    expect(findFieldValue(sheet!, 'Siła woli')).toBe('5');
  });

  it('uses live session resource values for Call of Cthulhu hit points, luck and sanity', () => {
    const character = {
      userId: 'user-1',
      characterId: 'character-1',
      name: 'Investigator',
      rpgSystem: 'Call of Cthulhu 5e',
      backstory: {
        system: 'Call of Cthulhu 5e'
      },
      characteristics: {
        CON: 55,
        SIZ: 65,
        POW: 60,
        hitPoints: 4,
        sanity: 31
      },
      skills: {
        Luck: 22
      }
    } satisfies CharacterCard;

    const sheet = resolveCharacterSheet(character);

    expect(sheet).not.toBeNull();
    expect(findFieldValue(sheet!, 'Hit Points')).toBe('4');
    expect(findFieldValue(sheet!, 'Luck')).toBe('22%');
    expect(findFieldValue(sheet!, 'Sanity')).toBe('31%');
  });
});
