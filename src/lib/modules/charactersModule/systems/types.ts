import type {
  CharacterCreationStrategy,
  CharacterDraft,
  GameSystemId,
} from "../character-builder/types";
import type { CharacterSheetCalculator } from "../character-sheet/mechanics";
import type { CharacterSheetDefinition } from "../character-sheet/types";
import type { CharacterCard } from "$lib/modules/charactersTypes";
import type {
  DiceRollMechanicsResult,
  DiceRollResult,
} from "$lib/modules/dice-roller";
import type { FlowDefinition, FlowState } from "$lib/modules/action-flow/types";

export type CharacterSystemMechanics = {
  calculators: Record<string, CharacterSheetCalculator>;
};

export type CharacterActionInputValues = Record<string, string>;

export type CharacterActionInputDefinition =
  | {
      kind: "skill-select";
      id: string;
      label: string;
      source: "skills-and-characteristics";
    }
  | {
      kind: "attribute-select";
      id: string;
      label: string;
      source: "vtm-attributes";
    }
  | {
      kind: "ability-select";
      id: string;
      label: string;
      source: "vtm-abilities";
    };

export type CharacterActionDefinition = {
  id: string;
  label: string;
  systemId: GameSystemId;
  inputs: CharacterActionInputDefinition[];
  createFlow: (input: CharacterActionInputValues) => FlowDefinition;
  createDiceNotation: (
    input: CharacterActionInputValues,
    character: CharacterCard,
  ) => string | null;
  decorateRoll?: (roll: DiceRollResult, state: FlowState) => DiceRollResult;
  resolveMechanics: (
    input: CharacterActionInputValues,
    roll: DiceRollResult,
    state: FlowState,
  ) => DiceRollMechanicsResult;
};

export type CharacterSystemActionRegistry = {
  checks: CharacterActionDefinition[];
};

export type CharacterSystemDefinition<
  TDraft extends CharacterDraft = CharacterDraft,
> = {
  id: GameSystemId;
  label: string;
  shortDescription: string;
  rpgSystem: string;
  builder: CharacterCreationStrategy<TDraft>;
  sheet: CharacterSheetDefinition;
  mechanics: CharacterSystemMechanics;
  actions: CharacterSystemActionRegistry;
};

export type CharacterSystemSummary = {
  id: GameSystemId;
  label: string;
  shortDescription: string;
};
