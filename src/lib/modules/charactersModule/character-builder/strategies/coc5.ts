import type {
  CharacterCreationStrategy,
  CoCDerivedStats,
  CoCDraft,
  InvestigatorCharacteristics,
  OccupationKey,
  VtmDraft,
} from "../types";
import { occupationTemplates } from "../data";
import { rollDice } from "./shared";
import { emptyCoCDraft } from "../defaultDrafts/defaultCoCDraft";

function cloneCoCDraft(source: CoCDraft): CoCDraft {
  return {
    ...source,
    characteristics: { ...source.characteristics },
    personalInterestSkills: [...source.personalInterestSkills],
  };
}

export function generateClassicCharacteristics(): InvestigatorCharacteristics {
  return {
    STR: rollDice(3, 6) * 5,
    CON: rollDice(3, 6) * 5,
    POW: rollDice(3, 6) * 5,
    DEX: rollDice(3, 6) * 5,
    APP: rollDice(3, 6) * 5,
    SIZ: (rollDice(2, 6) + 6) * 5,
    INT: (rollDice(2, 6) + 6) * 5,
    EDU: (rollDice(3, 6) + 3) * 5,
  };
}

export function calculateCoCDerivedStats(
  characteristics: InvestigatorCharacteristics,
): CoCDerivedStats {
  const rawStr = Math.floor(characteristics.STR / 5);
  const rawSiz = Math.floor(characteristics.SIZ / 5);
  const combined = rawStr + rawSiz;
  let damageBonus = "0";

  if (combined <= 12) {
    damageBonus = "-1D6";
  } else if (combined <= 16) {
    damageBonus = "-1D4";
  } else if (combined <= 24) {
    damageBonus = "0";
  } else if (combined <= 32) {
    damageBonus = "+1D4";
  } else {
    damageBonus = "+1D6";
  }

  return {
    idea: characteristics.INT,
    know: characteristics.EDU,
    luck: characteristics.POW,
    sanity: characteristics.POW,
    magicPoints: Math.floor(characteristics.POW / 5),
    hitPoints: Math.floor((characteristics.CON + characteristics.SIZ) / 10),
    damageBonus,
  };
}

export function getOccupationTemplate(key: OccupationKey) {
  return (
    occupationTemplates.find((template) => template.key === key) ??
    occupationTemplates[0]
  );
}
// dane o skilach są pobierane z pliku data

function buildCoCSkillPackage(draft: CoCDraft) {
  const occupationTemplate = getOccupationTemplate(draft.occupationKey);
  const skills: Record<string, number> = {};
  const occupationValues = [70, 60, 60, 50, 50, 50, 40, 40];

  occupationTemplate.occupationSkills.forEach((skill, index) => {
    skills[skill] = occupationValues[index] ?? 40;
  });

  draft.personalInterestSkills.forEach((skill) => {
    skills[skill] = Math.max(skills[skill] ?? 0, 20) + 20;
  });

  skills.Idea = draft.characteristics.INT;
  skills.Know = draft.characteristics.EDU;
  skills.Luck = draft.characteristics.POW;

  return skills;
}

//? czy tu da sie coś uprościć/wyodrebnić ?
export const cocStrategy: CharacterCreationStrategy<CoCDraft> = {
  system: "coc5",
  label: "Zew Cthulhu 5e",
  shortDescription:
    "Klasyczny investigator z profesją i cechami opartymi o rzuty.",
  createEmptyDraft: emptyCoCDraft,
  cloneDraft: cloneCoCDraft,
  getStepLabels: () => [
    "Tożsamość",
    "Cechy",
    "Umiejętności",
    "Tło",
    "Podsumowanie",
  ],
  randomize(draft) {
    const nextDraft = cloneCoCDraft(draft);
    nextDraft.characteristics = generateClassicCharacteristics();
    return nextDraft;
  },
  buildPayload(draft) {
    return {
      name: draft.name.trim(),
      rpgSystem: "Call of Cthulhu 5e",
      occupation: getOccupationTemplate(draft.occupationKey).label,
      age: draft.age ? Number(draft.age) : undefined,
      characteristics: draft.characteristics,
      skills: buildCoCSkillPackage(draft),
      backstory: {
        system: "Call of Cthulhu 5e",
        personalDescription: draft.personalDescription,
        ideology: draft.ideology,
        residence: draft.residence,
        birthplace: draft.birthplace,
      },
      inventory: [],
      notes: draft.notes,
    };
  },
};

export function isCoCDraft(draft: CoCDraft | VtmDraft): draft is CoCDraft {
  return draft.system === "coc5";
}
