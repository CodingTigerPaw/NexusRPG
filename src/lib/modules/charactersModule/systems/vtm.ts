import { createVampireAttributeSkillCheck } from "$lib/modules/action-flow/systems/vampire-masquerade";
import {
  evaluateVtmDice,
  markVtmDiceKinds,
} from "$lib/modules/action-flow/rules/vtm-rules";
import { vampireMasqueradeSheetDefinition } from "../character-sheet/vampire-masquerade";
import {
  calculateVtmBloodPotency,
  calculateVtmHealth,
  calculateVtmLegacyBloodPool,
  calculateVtmLegacyHumanity,
  calculateVtmLegacyWillpower,
  calculateVtmV5Willpower,
} from "../character-sheet/mechanics";
import { vtmStrategy } from "../character-builder/strategies/vtm";
import type { CharacterCard } from "$lib/modules/charactersTypes";
import {
  vtmAbilityGroups,
  vtmAttributeGroups,
} from "../character-builder/data";
import {
  buildVtmNotation,
  readCharacterNumber,
  readVtmHunger,
} from "./action-values";
import type {
  CharacterActionDefinition,
  CharacterActionInputValues,
  CharacterSystemDefinition,
} from "./types";

function calculateVtmPool(
  character: CharacterCard,
  input: CharacterActionInputValues,
) {
  const attribute = input.attribute ?? "";
  const ability = input.ability ?? "";

  if (!attribute || !ability) {
    return 0;
  }

  return (
    readCharacterNumber(character, [
      `characteristics.${attribute}`,
      `characteristics.Attributes.${attribute}`,
    ]) +
    readCharacterNumber(character, [
      `skills.${ability}`,
      `skills.Abilities.${ability}`,
    ])
  );
}

function isKnownVtmAttribute(value: string | undefined) {
  return Boolean(
    value &&
    Object.values(vtmAttributeGroups)
      .flat()
      .includes(value as never),
  );
}

function isKnownVtmAbility(value: string | undefined) {
  return Boolean(
    value &&
    Object.values(vtmAbilityGroups)
      .flat()
      .includes(value as never),
  );
}

function readVtmRollResult(data: Record<string, unknown>) {
  const result = data.vtmResult;

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {};
  }

  return result as {
    successes?: number;
    criticalPairs?: number;
    messyCritical?: boolean;
    bestialFailure?: boolean;
  };
}

const attributeSkillCheck: CharacterActionDefinition = {
  id: "vtm.attribute-skill-check",
  label: "Test atrybut + umiejętność",
  systemId: "vtm",
  inputs: [
    {
      kind: "attribute-select",
      id: "attribute",
      label: "Atrybut",
      source: "vtm-attributes",
    },
    {
      kind: "ability-select",
      id: "ability",
      label: "Umiejętność",
      source: "vtm-abilities",
    },
  ],
  createFlow(input) {
    return createVampireAttributeSkillCheck(
      input.attribute ?? "",
      input.ability ?? "",
    );
  },
  createDiceNotation(input, character) {
    if (
      !isKnownVtmAttribute(input.attribute) ||
      !isKnownVtmAbility(input.ability)
    ) {
      return null;
    }

    return buildVtmNotation(
      calculateVtmPool(character, input),
      readVtmHunger(character),
    );
  },
  decorateRoll(roll, state) {
    const pool =
      typeof state.data.pool === "number" ? state.data.pool : roll.dice.length;
    const hunger = Math.min(
      typeof state.data.hunger === "number" ? state.data.hunger : 0,
      pool,
    );

    return {
      ...roll,
      dice: markVtmDiceKinds(roll.dice, pool, hunger),
    };
  },
  resolveMechanics(input, roll, state) {
    const result = readVtmRollResult(state.data);
    const pool =
      typeof state.data.pool === "number" ? state.data.pool : roll.dice.length;
    const hunger = Math.min(
      typeof state.data.hunger === "number" ? state.data.hunger : 0,
      pool,
    );
    const fallbackResult = evaluateVtmDice(
      markVtmDiceKinds(roll.dice, pool, hunger),
    );

    return {
      systemId: state.systemId,
      flowId: state.flowId,
      checkName: `${input.attribute ?? "Atrybut"} + ${input.ability ?? "Umiejętność"}`,
      successes: result.successes ?? fallbackResult.successes,
      criticalPairs: result.criticalPairs ?? fallbackResult.criticalPairs,
      messyCritical: result.messyCritical ?? fallbackResult.messyCritical,
      bestialFailure: result.bestialFailure ?? fallbackResult.bestialFailure,
      pool,
      hunger,
      status: state.status,
      haltReason: state.halt?.reason,
    };
  },
};

export const vtmSystemDefinition: CharacterSystemDefinition = {
  id: "vtm",
  label: "Wampir: Maskarada",
  shortDescription: "Wampir z klanem, atrybutami, zdolnościami i cnotami.",
  rpgSystem: "Vampire: The Masquerade",
  builder: vtmStrategy,
  sheet: vampireMasqueradeSheetDefinition,
  mechanics: {
    calculators: {
      vtmLegacyHumanity: calculateVtmLegacyHumanity,
      vtmLegacyWillpower: calculateVtmLegacyWillpower,
      vtmV5Willpower: calculateVtmV5Willpower,
      vtmHealth: calculateVtmHealth,
      vtmLegacyBloodPool: calculateVtmLegacyBloodPool,
      vtmBloodPotency: calculateVtmBloodPotency,
    },
  },
  actions: {
    checks: [attributeSkillCheck],
  },
};
