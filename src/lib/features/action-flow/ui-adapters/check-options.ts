import type { CharacterCard } from '$lib/features/characters/types';
import { vtmAbilityGroups, vtmAttributeGroups } from '$lib/modules/charactersModule/character-builder/data';
import {
  buildNumericOptions,
  buildVtmNotation,
  matchesCocSystem,
  matchesVtmSystem,
  readCharacterNumber,
  readVtmHunger
} from '$lib/modules/charactersModule/systems/action-values';

export type ActionCheckOption = {
  id: string;
  label: string;
  value: number;
};

export function isCallOfCthulhuSystem(system: string | undefined) {
  return matchesCocSystem(system);
}

export function isVampireSystem(system: string | undefined) {
  return matchesVtmSystem(system);
}

export function buildActionCheckOptions(
  character: CharacterCard | null | undefined,
  fallbackSystem?: string
): ActionCheckOption[] {
  if (!character || !isCallOfCthulhuSystem(character.rpgSystem ?? fallbackSystem)) {
    return [];
  }

  return buildNumericOptions({
    ...(character.skills ?? {}),
    ...(character.characteristics ?? {})
  });
}

export function buildVtmAttributeOptions(
  character: CharacterCard | null | undefined,
  fallbackSystem?: string
): ActionCheckOption[] {
  if (!character || !isVampireSystem(character.rpgSystem ?? fallbackSystem)) {
    return [];
  }

  return Object.values(vtmAttributeGroups)
    .flat()
    .map((key) => ({
      id: key,
      label: key,
      value: readCharacterNumber(character, [
        `characteristics.${key}`,
        `characteristics.Attributes.${key}`
      ])
    }));
}

export function buildVtmAbilityOptions(
  character: CharacterCard | null | undefined,
  fallbackSystem?: string
): ActionCheckOption[] {
  if (!character || !isVampireSystem(character.rpgSystem ?? fallbackSystem)) {
    return [];
  }

  return Object.values(vtmAbilityGroups)
    .flat()
    .map((key) => ({
      id: key,
      label: key,
      value: readCharacterNumber(character, [`skills.${key}`, `skills.Abilities.${key}`])
    }));
}

export function calculateVtmPool(
  character: CharacterCard | null | undefined,
  attribute: string,
  ability: string
) {
  if (!attribute || !ability) {
    return 0;
  }

  return (
    readCharacterNumber(character, [
      `characteristics.${attribute}`,
      `characteristics.Attributes.${attribute}`
    ]) +
    readCharacterNumber(character, [`skills.${ability}`, `skills.Abilities.${ability}`])
  );
}

export { buildVtmNotation, readCharacterNumber, readVtmHunger };
