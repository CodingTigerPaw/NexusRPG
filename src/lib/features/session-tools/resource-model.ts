import type { CharacterCard, CharacterUpdatePayload } from '$lib/modules/characters';
import {
  calculateCocHitPoints,
  calculateCocLuck,
  calculateCocSanity,
  calculateVtmHealth,
  calculateVtmV5Willpower
} from '$lib/modules/charactersModule/character-sheet/mechanics';
import type {
  SessionToolboxResource,
  SessionToolboxResourceId
} from './types';

type ResourcePath =
  | 'characteristics.health'
  | 'characteristics.willpower'
  | 'characteristics.hunger'
  | 'characteristics.hitPoints'
  | 'skills.Luck'
  | 'characteristics.sanity';

type ResourceDefinition = {
  id: SessionToolboxResourceId;
  label: string;
  path: ResourcePath;
  max: (character: CharacterCard) => number;
  fallback: (character: CharacterCard) => number;
  tone: SessionToolboxResource['tone'];
};

const vtmResources: ResourceDefinition[] = [
  {
    id: 'health',
    label: 'Życie',
    path: 'characteristics.health',
    max: calculateVtmHealth,
    fallback: calculateVtmHealth,
    tone: 'health'
  },
  {
    id: 'willpower',
    label: 'Siła woli',
    path: 'characteristics.willpower',
    max: calculateVtmV5Willpower,
    fallback: calculateVtmV5Willpower,
    tone: 'willpower'
  },
  {
    id: 'hunger',
    label: 'Głód',
    path: 'characteristics.hunger',
    max: () => 5,
    fallback: () => 0,
    tone: 'hunger'
  }
];

const cocResources: ResourceDefinition[] = [
  {
    id: 'hitPoints',
    label: 'Życie',
    path: 'characteristics.hitPoints',
    max: calculateCocHitPoints,
    fallback: calculateCocHitPoints,
    tone: 'health'
  },
  {
    id: 'luck',
    label: 'Szczęście',
    path: 'skills.Luck',
    max: () => 99,
    fallback: calculateCocLuck,
    tone: 'luck'
  },
  {
    id: 'sanity',
    label: 'Poczytalność',
    path: 'characteristics.sanity',
    max: () => 99,
    fallback: calculateCocSanity,
    tone: 'sanity'
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNumber(source: unknown, path: ResourcePath) {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, source);
  const numericValue = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeSystemId(character: CharacterCard) {
  return `${character.rpgSystem ?? character.backstory?.system ?? ''}`.toLowerCase();
}

function resourceDefinitionsForCharacter(character: CharacterCard) {
  const systemId = normalizeSystemId(character);

  if (/vampire|wampir|vtm|maskarada/.test(systemId)) {
    return vtmResources;
  }

  if (/cthulhu|coc/.test(systemId)) {
    return cocResources;
  }

  return [];
}

function clampResourceValue(value: number, max: number) {
  return Math.max(0, Math.min(Math.trunc(value), Math.max(0, Math.trunc(max))));
}

export function buildSessionToolboxResources(character: CharacterCard): SessionToolboxResource[] {
  return resourceDefinitionsForCharacter(character).map((definition) => {
    const max = Math.max(1, Math.trunc(definition.max(character)));
    const storedValue = readNumber(character, definition.path);
    // Zasoby sesyjne mają własną wartość bieżącą, ale startują z kalkulatora, żeby stare karty działały bez migracji danych.
    const value = clampResourceValue(storedValue ?? definition.fallback(character), max);

    return {
      id: definition.id,
      label: definition.label,
      value,
      max,
      min: 0,
      tone: definition.tone
    };
  });
}

export function buildSessionToolboxResourcePayload(
  character: CharacterCard,
  resourceId: SessionToolboxResourceId,
  value: number
): CharacterUpdatePayload {
  const definition = resourceDefinitionsForCharacter(character).find(
    (resource) => resource.id === resourceId
  );

  if (!definition) {
    throw new Error('Ten zasób nie jest obsługiwany dla wybranego systemu.');
  }

  const max = Math.max(1, Math.trunc(definition.max(character)));
  const nextValue = clampResourceValue(value, max);

  if (definition.path.startsWith('skills.')) {
    const skillKey = definition.path.replace('skills.', '');

    return {
      skills: {
        ...(character.skills ?? {}),
        [skillKey]: nextValue
      }
    };
  }

  const characteristicKey = definition.path.replace('characteristics.', '');

  return {
    characteristics: {
      ...(character.characteristics ?? {}),
      [characteristicKey]: nextValue
    }
  };
}
