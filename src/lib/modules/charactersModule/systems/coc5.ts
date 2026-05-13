import { createCthulhuSkillCheck } from "$lib/modules/action-flow/systems/call-of-cthulhu";
import { callOfCthulhuSheetDefinition } from "../character-sheet/call-of-cthulhu";
import {
  calculateCocDamageBonus,
  calculateCocHitPoints,
  calculateCocIdea,
  calculateCocKnow,
  calculateCocLuck,
  calculateCocMagicPoints,
  calculateCocSanity,
} from "../character-sheet/mechanics";
import { cocStrategy } from "../character-builder/strategies/coc5";
import type { CharacterCard } from "$lib/modules/charactersModule/charactersTypes";
import type {
  CharacterActionDefinition,
  CharacterSystemDefinition,
} from "./types";

function hasNumericCharacterValue(character: CharacterCard, key: string) {
  const value = character.skills?.[key] ?? character.characteristics?.[key];
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue);
}

const skillCheck: CharacterActionDefinition = {
  id: "coc.skill-check",
  label: "Test umiejętności",
  systemId: "coc5",
  inputs: [
    {
      kind: "skill-select",
      id: "skill",
      label: "Umiejętność albo cecha",
      source: "skills-and-characteristics",
    },
  ],
  createFlow(input) {
    return createCthulhuSkillCheck(input.skill ?? "");
  },
  createDiceNotation(input, character) {
    return input.skill && hasNumericCharacterValue(character, input.skill)
      ? "1d100"
      : null;
  },
  resolveMechanics(input, roll, state) {
    return {
      systemId: state.systemId,
      flowId: state.flowId,
      checkName: input.skill ?? "Test umiejętności",
      target:
        typeof state.data.target === "number" ? state.data.target : undefined,
      roll: roll.total,
      successLevel:
        typeof state.data.successLevel === "string"
          ? state.data.successLevel
          : undefined,
      status: state.status,
      haltReason: state.halt?.reason,
    };
  },
};

export const coc5SystemDefinition: CharacterSystemDefinition = {
  id: "coc5",
  label: "Zew Cthulhu 5e",
  shortDescription:
    "Klasyczny investigator z profesją i cechami opartymi o rzuty.",
  rpgSystem: "Call of Cthulhu 5e",
  builder: cocStrategy,
  sheet: callOfCthulhuSheetDefinition,
  mechanics: {
    calculators: {
      cocIdea: calculateCocIdea,
      cocKnow: calculateCocKnow,
      cocLuck: calculateCocLuck,
      cocSanity: calculateCocSanity,
      cocMagicPoints: calculateCocMagicPoints,
      cocHitPoints: calculateCocHitPoints,
      cocDamageBonus: calculateCocDamageBonus,
    },
  },
  actions: {
    checks: [skillCheck],
  },
};
