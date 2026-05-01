import type { CharacterCard } from '$lib/modules/characters';

export type CharacterSheetCalculator = (character: CharacterCard) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(source: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, source);
}

function readNumber(character: CharacterCard, paths: string[]) {
  for (const path of paths) {
    const value = readPath(character, path);
    const numericValue = typeof value === 'number' ? value : Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return 0;
}

export function calculateVtmLegacyHumanity(character: CharacterCard) {
  return (
    readNumber(character, ['skills.Virtues.Conscience']) +
    readNumber(character, ['skills.Virtues.Self-Control'])
  );
}

export function calculateVtmLegacyWillpower(character: CharacterCard) {
  return readNumber(character, ['skills.Virtues.Courage']);
}

export function calculateVtmV5Willpower(character: CharacterCard) {
  return (
    readNumber(character, ['characteristics.Opanowanie', 'characteristics.Composure']) +
    readNumber(character, ['characteristics.Determinacja', 'characteristics.Resolve'])
  );
}

export function calculateVtmHealth(character: CharacterCard) {
  return (
    readNumber(character, [
      'characteristics.Kondycja',
      'characteristics.Wytrzymałość',
      'characteristics.Stamina'
    ]) + 3
  );
}

export function calculateVtmLegacyBloodPool(character: CharacterCard) {
  const generation = readNumber(character, [
    'characteristics.generation',
    'skills.Backgrounds.Generation'
  ]);

  const bloodPoolTable: Record<number, number> = {
    13: 10,
    12: 11,
    11: 12,
    10: 13,
    9: 14,
    8: 15
  };

  return bloodPoolTable[generation] ?? 10;
}

export function calculateVtmBloodPotency(character: CharacterCard) {
  const explicitBloodPotency = readNumber(character, [
    'characteristics.bloodPotency',
    'characteristics.Blood Potency',
    'backstory.bloodPotency',
    'skills.Blood Potency'
  ]);

  return explicitBloodPotency || undefined;
}

export function calculateCocIdea(character: CharacterCard) {
  return readNumber(character, ['skills.Idea', 'characteristics.INT']);
}

export function calculateCocKnow(character: CharacterCard) {
  return readNumber(character, ['skills.Know', 'characteristics.EDU']);
}

export function calculateCocLuck(character: CharacterCard) {
  return readNumber(character, ['skills.Luck', 'characteristics.POW']);
}

export function calculateCocSanity(character: CharacterCard) {
  return readNumber(character, ['characteristics.sanity', 'characteristics.Sanity', 'characteristics.POW']);
}

export function calculateCocMagicPoints(character: CharacterCard) {
  return Math.floor(readNumber(character, ['characteristics.POW']) / 5);
}

export function calculateCocHitPoints(character: CharacterCard) {
  const constitution = readNumber(character, ['characteristics.CON']);
  const size = readNumber(character, ['characteristics.SIZ']);

  return Math.floor((constitution + size) / 10);
}

export function calculateCocDamageBonus(character: CharacterCard) {
  const rawStrength = Math.floor(readNumber(character, ['characteristics.STR']) / 5);
  const rawSize = Math.floor(readNumber(character, ['characteristics.SIZ']) / 5);
  const combined = rawStrength + rawSize;

  if (combined <= 12) {
    return '-1D6';
  }

  if (combined <= 16) {
    return '-1D4';
  }

  if (combined <= 24) {
    return '0';
  }

  if (combined <= 32) {
    return '+1D4';
  }

  return '+1D6';
}
