import { browser } from '$app/environment';
import { cloneDraftBySystem, getCharacterCreationStrategy } from '../systems';
import type {
  CharacterDraft,
  CharacterDraftSummary,
  GameSystemId,
  SavedCharacterDraft
} from './types';

const draftStoragePrefix = 'coc_character_builder';

function draftsStorageKey(userId: string) {
  return `${draftStoragePrefix}:${userId}`;
}

function parseDraftCollection(rawValue: string | null) {
  if (!rawValue) {
    return [] as SavedCharacterDraft[];
  }

  try {
    const parsed = JSON.parse(rawValue) as SavedCharacterDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SavedCharacterDraft[];
  }
}

function readStoredDrafts(userId: string) {
  if (!browser) {
    return [] as SavedCharacterDraft[];
  }

  try {
    return parseDraftCollection(localStorage.getItem(draftsStorageKey(userId)));
  } catch {
    return [] as SavedCharacterDraft[];
  }
}

function writeStoredDrafts(userId: string, drafts: SavedCharacterDraft[]) {
  if (!browser) {
    return;
  }

  try {
    localStorage.setItem(draftsStorageKey(userId), JSON.stringify(drafts));
  } catch {
    throw new Error('Nie udało się zapisać szkicu postaci w localStorage.');
  }
}

function createDraftId() {
  if (browser && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}`;
}

export function listCharacterDrafts(userId: string) {
  return readStoredDrafts(userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((entry) => ({
      id: entry.id,
      system: entry.system,
      name: entry.draft.name || 'Szkic bez nazwy',
      updatedAt: entry.updatedAt
    })) satisfies CharacterDraftSummary[];
}

export function loadCharacterDraftById(userId: string, draftId: string) {
  const entry = readStoredDrafts(userId).find((draft) => draft.id === draftId);
  return entry ?? null;
}

export function loadCharacterDraft<TSystem extends GameSystemId>(
  userId: string,
  system: TSystem,
  draftId?: string | null
) {
  const strategy = getCharacterCreationStrategy(system);

  if (!browser || !draftId) {
    return strategy.createEmptyDraft();
  }

  const entry = loadCharacterDraftById(userId, draftId);

  if (!entry || entry.system !== system) {
    return strategy.createEmptyDraft();
  }

  return cloneDraftBySystem(system, entry.draft) as ReturnType<typeof strategy.createEmptyDraft>;
}

export function saveCharacterDraft(userId: string, draft: CharacterDraft, draftId?: string | null) {
  const drafts = readStoredDrafts(userId);
  const id = draftId || createDraftId();
  const nextEntry: SavedCharacterDraft = {
    id,
    userId,
    system: draft.system,
    updatedAt: new Date().toISOString(),
    draft
  };

  const nextDrafts = drafts.filter((entry) => entry.id !== id);
  nextDrafts.push(nextEntry);
  writeStoredDrafts(userId, nextDrafts);

  return id;
}

export function deleteCharacterDraft(userId: string, draftId: string) {
  const nextDrafts = readStoredDrafts(userId).filter((entry) => entry.id !== draftId);
  writeStoredDrafts(userId, nextDrafts);
}

export function clearCharacterDraft(userId: string, draftId?: string | null) {
  if (!draftId) {
    return;
  }

  deleteCharacterDraft(userId, draftId);
}

export function hasCharacterDrafts(userId: string) {
  return listCharacterDrafts(userId).length > 0;
}
