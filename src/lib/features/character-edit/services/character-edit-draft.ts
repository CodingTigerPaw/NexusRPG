import type { CharacterCard, CharacterUpdatePayload } from '$lib/modules/characters';
import { characterNotesToPlainText } from '$lib/modules/charactersModule/notes';
import { readVtmHunger } from '$lib/features/action-flow/ui-adapters/check-options';
import { getCharacterSystemDefinitionByRpgSystem } from '$lib/modules/charactersModule/systems';

export type CharacterEditRecordEntry = {
  id: string;
  key: string;
  value: string;
};

export type CharacterEditDraft = {
  name: string;
  occupation: string;
  age: string;
  hunger: string;
  notes: string;
  characteristics: Record<string, string>;
  skills: Record<string, string>;
  skillExtras: Record<string, unknown>;
  backstory: CharacterEditRecordEntry[];
  inventory: CharacterEditRecordEntry[];
};

function stringifyEditableValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function parseEditableValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const numericValue = Number(trimmed);

  if (Number.isFinite(numericValue) && trimmed === String(numericValue)) {
    return numericValue;
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  return value;
}

function createEntry(key: string, value: unknown, index: number): CharacterEditRecordEntry {
  return {
    id: `${key || 'entry'}-${index}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    key,
    value: stringifyEditableValue(value)
  };
}

function recordToDraftEntries(record: Record<string, unknown> | undefined) {
  return Object.entries(record ?? {}).map(([key, value], index) => createEntry(key, value, index));
}

function inventoryToDraftEntries(inventory: unknown) {
  if (Array.isArray(inventory)) {
    return inventory.map((value, index) => createEntry(`Pozycja ${index + 1}`, value, index));
  }

  if (inventory && typeof inventory === 'object') {
    return recordToDraftEntries(inventory as Record<string, unknown>);
  }

  return inventory === undefined || inventory === null ? [] : [createEntry('Ekwipunek', inventory, 0)];
}

function recordToStringValues(record: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(record ?? {}).map(([key, value]) => [key, stringifyEditableValue(value)])
  );
}

function splitSkillExtras(skills: Record<string, unknown> | undefined) {
  const editableSkills: Record<string, string> = {};
  const extras: Record<string, unknown> = {};

  Object.entries(skills ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      extras[key] = value;
      return;
    }

    editableSkills[key] = stringifyEditableValue(value);
  });

  return { editableSkills, extras };
}

function entriesToRecord(entries: CharacterEditRecordEntry[]) {
  return Object.fromEntries(
    entries
      .map((entry) => [entry.key.trim(), parseEditableValue(entry.value)] as const)
      .filter(([key]) => Boolean(key))
  );
}

function stringRecordToPayloadRecord(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => Boolean(key.trim()))
      .map(([key, value]) => [key, parseEditableValue(value)])
  );
}

export function createCharacterEditDraft(character: CharacterCard): CharacterEditDraft {
  const system = getCharacterSystemDefinitionByRpgSystem(character.rpgSystem);
  const { editableSkills, extras } = splitSkillExtras(character.skills);

  return {
    name: character.name,
    occupation: character.occupation ?? '',
    age: character.age === undefined || character.age === null ? '' : String(character.age),
    hunger: system?.id === 'vtm' ? String(readVtmHunger(character)) : '',
    notes: characterNotesToPlainText(character.notes),
    characteristics: recordToStringValues(character.characteristics),
    skills: editableSkills,
    skillExtras: extras,
    backstory: recordToDraftEntries(character.backstory),
    inventory: inventoryToDraftEntries(character.inventory)
  };
}

export function buildCharacterUpdatePayload(
  draft: CharacterEditDraft,
  options: { isVampireSystem: boolean }
): CharacterUpdatePayload {
  const name = draft.name.trim();
  const ageText = draft.age.trim();

  if (!name) {
    throw new Error('Nazwa postaci jest wymagana.');
  }

  const age = ageText ? Number(ageText) : null;

  if (age !== null && (!Number.isFinite(age) || age < 0)) {
    throw new Error('Wiek musi być liczbą większą lub równą 0.');
  }

  const characteristics = stringRecordToPayloadRecord(draft.characteristics);

  if (options.isVampireSystem) {
    const hungerText = draft.hunger.trim();
    const hunger = hungerText ? Number(hungerText) : 0;

    if (!Number.isFinite(hunger) || hunger < 0 || hunger > 5) {
      throw new Error('Głód musi być liczbą w zakresie 0..5.');
    }

    characteristics.hunger = Math.trunc(hunger);
  }

  return {
    name,
    occupation: draft.occupation.trim() || null,
    age: age === null ? null : Math.trunc(age),
    notes: draft.notes.trim() || null,
    characteristics,
    skills: {
      ...draft.skillExtras,
      ...stringRecordToPayloadRecord(draft.skills)
    },
    backstory: entriesToRecord(draft.backstory),
    inventory: draft.inventory
      .map((entry) => parseEditableValue(entry.value))
      .filter((value) => value !== '')
  };
}

export function createEmptyRecordEntry(label = 'Nowe pole'): CharacterEditRecordEntry {
  return createEntry(label, '', Date.now());
}
