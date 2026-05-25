import { describe, expect, it } from 'vitest';
import type { CharacterCard } from '$lib/modules/characters';
import {
  buildSessionToolboxResourcePayload,
  buildSessionToolboxResources
} from './resource-model';

function vampireCharacter(overrides: Partial<CharacterCard> = {}): CharacterCard {
  return {
    userId: 'gm',
    characterId: 'vtm-1',
    name: 'Nadia',
    rpgSystem: 'Vampire: The Masquerade',
    characteristics: {
      Stamina: 2,
      Opanowanie: 2,
      Determinacja: 3,
      hunger: 1,
      health: 4,
      willpower: 3
    },
    skills: {},
    backstory: {
      system: 'Vampire: The Masquerade'
    },
    ...overrides
  };
}

function cocCharacter(overrides: Partial<CharacterCard> = {}): CharacterCard {
  return {
    userId: 'player',
    characterId: 'coc-1',
    name: 'Evelyn',
    rpgSystem: 'Call of Cthulhu 5e',
    characteristics: {
      CON: 55,
      SIZ: 65,
      POW: 60,
      sanity: 42,
      hitPoints: 8
    },
    skills: {
      Luck: 37
    },
    backstory: {
      system: 'Call of Cthulhu 5e'
    },
    ...overrides
  };
}

describe('session toolbox resource model', () => {
  it('buduje szybkie zasoby dla Wampira z wartości bieżących zapisanych na karcie', () => {
    expect(buildSessionToolboxResources(vampireCharacter())).toEqual([
      {
        id: 'health',
        label: 'Życie',
        value: 4,
        max: 5,
        min: 0,
        tone: 'health'
      },
      {
        id: 'willpower',
        label: 'Siła woli',
        value: 3,
        max: 5,
        min: 0,
        tone: 'willpower'
      },
      {
        id: 'hunger',
        label: 'Głód',
        value: 1,
        max: 5,
        min: 0,
        tone: 'hunger'
      }
    ]);
  });

  it('dla starych kart Wampira startuje zasoby z kalkulatorów zamiast wymagać migracji danych', () => {
    const resources = buildSessionToolboxResources(
      vampireCharacter({
        characteristics: {
          Stamina: 1,
          Opanowanie: 3,
          Determinacja: 2
        }
      })
    );

    expect(resources.find((resource) => resource.id === 'health')?.value).toBe(4);
    expect(resources.find((resource) => resource.id === 'willpower')?.value).toBe(5);
    expect(resources.find((resource) => resource.id === 'hunger')?.value).toBe(0);
  });

  it('buduje szybkie zasoby dla Call of Cthulhu z życia, szczęścia i poczytalności', () => {
    expect(buildSessionToolboxResources(cocCharacter())).toEqual([
      {
        id: 'hitPoints',
        label: 'Życie',
        value: 8,
        max: 12,
        min: 0,
        tone: 'health'
      },
      {
        id: 'luck',
        label: 'Szczęście',
        value: 37,
        max: 99,
        min: 0,
        tone: 'luck'
      },
      {
        id: 'sanity',
        label: 'Poczytalność',
        value: 42,
        max: 99,
        min: 0,
        tone: 'sanity'
      }
    ]);
  });

  it('tworzy payload aktualizacji zasobu bez nadpisywania pozostałych cech postaci', () => {
    expect(buildSessionToolboxResourcePayload(vampireCharacter(), 'hunger', 4)).toEqual({
      characteristics: {
        Stamina: 2,
        Opanowanie: 2,
        Determinacja: 3,
        hunger: 4,
        health: 4,
        willpower: 3
      }
    });
  });

  it('clampuje wartości do zakresu zasobu przed wysłaniem payloadu do backendu', () => {
    expect(buildSessionToolboxResourcePayload(vampireCharacter(), 'hunger', 99)).toEqual({
      characteristics: expect.objectContaining({
        hunger: 5
      })
    });
  });

  it('dla Call of Cthulhu aktualizuje szczęście w umiejętnościach, a nie w cechach', () => {
    expect(buildSessionToolboxResourcePayload(cocCharacter(), 'luck', 44)).toEqual({
      skills: {
        Luck: 44
      }
    });
  });
});
