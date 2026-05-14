import type { CharacterCard } from '$lib/modules/characters';
import type { CharacterNote } from '../notes';

export type CharacterSheetValueFormat =
  | 'text'
  | 'number'
  | 'percentage'
  | 'list'
  | 'longText'
  | 'namedDescriptions'
  | 'ratingDots';

export type CharacterSheetFieldDefinition = {
  label: string;
  path?: string;
  derivedStat?: string;
  fallback?: string;
  format?: CharacterSheetValueFormat;
};

export type CharacterSheetDerivedStatDefinition = {
  id: string;
  label: string;
  calculator: string;
  fallback?: string;
  format?: CharacterSheetValueFormat;
};

export type CharacterSheetGroupDefinition = {
  id: string;
  title: string;
  categoryTitle?: string;
  description?: string;
  columns?: 1 | 2 | 3;
  fields: readonly CharacterSheetFieldDefinition[];
};

export type CharacterSheetSectionDefinition = {
  id: string;
  title: string;
  description?: string;
  groups: readonly CharacterSheetGroupDefinition[];
};

export type CharacterSheetDefinition = {
  id: string;
  systemName: string;
  matches(character: CharacterCard): boolean;
  derivedStats?: readonly CharacterSheetDerivedStatDefinition[];
  sections: readonly CharacterSheetSectionDefinition[];
};

export type ResolvedCharacterSheetField = CharacterSheetFieldDefinition & {
  value: string;
};

export type ResolvedCharacterSheetGroup = Omit<CharacterSheetGroupDefinition, 'fields'> & {
  fields: ResolvedCharacterSheetField[];
};

export type ResolvedCharacterSheetSection = Omit<CharacterSheetSectionDefinition, 'groups'> & {
  groups: ResolvedCharacterSheetGroup[];
};

export type ResolvedCharacterSheet = Omit<CharacterSheetDefinition, 'matches' | 'sections'> & {
  characterName: string;
  avatarUrl?: string | null;
  notes: CharacterNote[];
  derivedStats: ResolvedCharacterSheetField[];
  sections: ResolvedCharacterSheetSection[];
};
