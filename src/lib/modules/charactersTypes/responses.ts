import type { CharacterCard } from './character-card';

export type CharacterSheetsResponse = {
  userId: string;
  characterSheets: CharacterCard[];
  nextCursor: string | null;
};

export type CharacterSheetResponse = {
  characterSheet?: CharacterCard;
  message?: string;
};

export type CharacterMutationResponse = {
  characterSheet?: CharacterCard;
  message?: string;
};

export type CharacterErrorResponse = {
  message?: string;
};
