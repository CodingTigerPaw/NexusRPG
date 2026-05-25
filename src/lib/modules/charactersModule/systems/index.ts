import type { CharacterCard } from "$lib/modules/charactersModule/charactersTypes";
import type { CharacterDraft, GameSystemId } from "../character-builder/types";
import type { CharacterSheetDefinition } from "../character-sheet/types";
import { coc5SystemDefinition } from "./coc5";
import { matchesCocSystem, matchesVtmSystem } from "./action-values";
import type {
  CharacterSystemDefinition,
  CharacterSystemSummary,
} from "./types";
import { vtmSystemDefinition } from "./vtm";

export const characterSystemDefinitions: CharacterSystemDefinition[] = [
  coc5SystemDefinition,
  vtmSystemDefinition,
];

export function getCharacterSystemDefinition(systemId: GameSystemId) {
  return (
    characterSystemDefinitions.find((system) => system.id === systemId) ?? null
  );
}

export function getCharacterSystemDefinitionBySheetId(sheetId: string) {
  return (
    characterSystemDefinitions.find((system) => system.sheet.id === sheetId) ??
    null
  );
}

export function getCharacterSystemDefinitionByRpgSystem(
  rpgSystem: string | undefined,
) {
  if (!rpgSystem) {
    return null;
  }

  return (
    characterSystemDefinitions.find(
      (system) => system.rpgSystem === rpgSystem,
    ) ??
    (matchesCocSystem(rpgSystem) ? coc5SystemDefinition : null) ??
    (matchesVtmSystem(rpgSystem) ? vtmSystemDefinition : null)
  );
}

export function getCharacterSystemDefinitionForCharacter(
  character: CharacterCard,
) {
  return (
    characterSystemDefinitions.find((system) =>
      system.sheet.matches(character),
    ) ?? getCharacterSystemDefinitionByRpgSystem(character.rpgSystem)
  );
}

export function getCharacterSystemActions(character: CharacterCard) {
  return (
    getCharacterSystemDefinitionForCharacter(character)?.actions ?? {
      checks: [],
    }
  );
}

export function getCharacterSystemSheetDefinitions(): CharacterSheetDefinition[] {
  return characterSystemDefinitions.map((system) => system.sheet);
}

export function getCharacterSystemSummaries(): CharacterSystemSummary[] {
  return characterSystemDefinitions.map(({ id, label, shortDescription }) => ({
    id,
    label,
    shortDescription,
  }));
}

export function getCharacterCreationStrategy<TSystem extends GameSystemId>(
  systemId: TSystem,
) {
  const system = getCharacterSystemDefinition(systemId);

  if (!system) {
    throw new Error(`Unsupported character system: ${systemId}`);
  }

  return system.builder;
}

export function cloneDraftBySystem<TSystem extends GameSystemId>(
  systemId: TSystem,
  draft: CharacterDraft,
) {
  return getCharacterCreationStrategy(systemId).cloneDraft(draft as never);
}

export type {
  CharacterActionDefinition,
  CharacterActionInputDefinition,
  CharacterActionInputValues,
  CharacterSystemActionRegistry,
  CharacterSystemDefinition,
  CharacterSystemSummary,
} from "./types";
