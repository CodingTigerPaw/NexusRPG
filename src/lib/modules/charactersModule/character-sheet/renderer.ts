import type { CharacterCard } from '$lib/modules/characters';
import {
  getCharacterSystemDefinitionBySheetId,
  getCharacterSystemDefinitionForCharacter,
  getCharacterSystemSheetDefinitions
} from '../systems';
import type {
  CharacterSheetDefinition,
  CharacterSheetDerivedStatDefinition,
  CharacterSheetFieldDefinition,
  ResolvedCharacterSheet
} from './types';
import { parseCharacterNotes } from '../notes';

const sheetDefinitions: CharacterSheetDefinition[] = getCharacterSystemSheetDefinitions();

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

function formatValue(
  value: unknown,
  field: CharacterSheetFieldDefinition | CharacterSheetDerivedStatDefinition
) {
  if (value === undefined || value === null || value === '') {
    return field.fallback ?? '';
  }

  if (Array.isArray(value)) {
    if (field.format === 'namedDescriptions') {
      const formattedEntries = value
        .map((entry) => {
          if (!isRecord(entry)) {
            return String(entry);
          }

          const discipline = typeof entry.discipline === 'string' ? entry.discipline.trim() : '';
          const name = typeof entry.name === 'string' ? entry.name.trim() : '';
          const description =
            typeof entry.description === 'string' ? entry.description.trim() : '';
          const title = [discipline, name].filter(Boolean).join(' - ');

          if (!title && !description) {
            return '';
          }

          return description ? `${title || 'Bez nazwy'}: ${description}` : title;
        })
        .filter(Boolean);

      return formattedEntries.length > 0 ? formattedEntries.join('\n\n') : (field.fallback ?? '');
    }

    return value.length > 0 ? value.join(', ') : (field.fallback ?? '');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function getCharacterSheetDefinition(character: CharacterCard) {
  return sheetDefinitions.find((definition) => definition.matches(character)) ?? null;
}

export function resolveCharacterSheet(
  character: CharacterCard,
  definition = getCharacterSheetDefinition(character)
): ResolvedCharacterSheet | null {
  if (!definition) {
    return null;
  }

  const systemDefinition =
    getCharacterSystemDefinitionForCharacter(character) ??
    getCharacterSystemDefinitionBySheetId(definition.id);

  const derivedValues = Object.fromEntries(
    (definition.derivedStats ?? []).map((derivedStat) => [
      derivedStat.id,
      systemDefinition?.mechanics.calculators[derivedStat.calculator]?.(character)
    ])
  );

  return {
    id: definition.id,
    systemName: definition.systemName,
    characterName: character.name,
    avatarUrl: character.avatarUrl ?? null,
    notes: parseCharacterNotes(character.notes),
    derivedStats: (definition.derivedStats ?? []).map((derivedStat) => ({
      ...derivedStat,
      value: formatValue(derivedValues[derivedStat.id], derivedStat)
    })),
    sections: definition.sections.map((section) => ({
      ...section,
      groups: section.groups.map((group) => ({
        ...group,
        fields: group.fields.map((field) => ({
          ...field,
          value: formatValue(
            field.derivedStat ? derivedValues[field.derivedStat] : readPath(character, field.path ?? ''),
            field
          )
        }))
      }))
    }))
  };
}

export { characterSystemDefinitions } from '../systems';
export { vampireMasqueradeSheetDefinition } from './vampire-masquerade';
export { callOfCthulhuSheetDefinition } from './call-of-cthulhu';
export type {
  CharacterSheetDefinition,
  CharacterSheetDerivedStatDefinition,
  CharacterSheetFieldDefinition,
  CharacterSheetGroupDefinition,
  CharacterSheetSectionDefinition,
  ResolvedCharacterSheet
} from './types';
