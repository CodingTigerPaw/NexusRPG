import type {
  CharacterCreationStrategy,
  CoCDraft,
  VtmClan,
  VtmDerivedStats,
  VtmDraft,
} from "../types";
import { vtmClans } from "../data";
import { clampRatings, cleanDisciplinePowers } from "./shared";
import { emptyVtmDraft } from "../defaultDrafts/defaultVtmDraft";

function cloneVtmDraft(source: VtmDraft): VtmDraft {
  const emptyDraft = emptyVtmDraft();

  return {
    ...source,
    attributes: { ...emptyDraft.attributes, ...source.attributes },
    abilities: { ...emptyDraft.abilities, ...source.abilities },
    disciplines: { ...source.disciplines },
    disciplinePowers: (
      source.disciplinePowers ?? emptyDraft.disciplinePowers
    ).map((power) => ({
      discipline: power.discipline ?? "",
      name: power.name ?? "",
      description: power.description ?? "",
    })),
    backgrounds: { ...source.backgrounds },
    virtues: { ...source.virtues },
  };
}

export function calculateVtmDerivedStats(draft: VtmDraft): VtmDerivedStats {
  const humanity = draft.virtues.Conscience + draft.virtues["Self-Control"];
  const willpower = draft.attributes.Opanowanie + draft.attributes.Determinacja;
  const generation = Number(draft.generation);
  const bloodPoolTable: Record<number, number> = {
    13: 10,
    12: 11,
    11: 12,
    10: 13,
    9: 14,
    8: 15,
  };

  return {
    humanity,
    willpower,
    bloodPool: bloodPoolTable[generation] ?? 10,
  };
}

export function getClanTemplate(clan: VtmClan) {
  return vtmClans.find((entry) => entry.key === clan) ?? vtmClans[0];
}

export const vtmStrategy: CharacterCreationStrategy<VtmDraft> = {
  system: "vtm",
  label: "Wampir: Maskarada",
  shortDescription: "Wampir z klanem, atrybutami, zdolnościami i cnotami.",
  createEmptyDraft: emptyVtmDraft,
  cloneDraft: cloneVtmDraft,
  getStepLabels: () => [
    "Tożsamość",
    "Atrybuty",
    "Zdolności",
    "Dziedzictwo",
    "Podsumowanie",
  ],
  buildPayload(draft) {
    const clan = getClanTemplate(draft.clan);
    const attributes = clampRatings(draft.attributes);
    const abilities = clampRatings(draft.abilities);
    const backgrounds = clampRatings(draft.backgrounds);
    const virtues = clampRatings(draft.virtues);

    return {
      name: draft.name.trim(),
      rpgSystem: "Vampire: The Masquerade",
      occupation: `${draft.clan} - ${draft.concept || ""}`,
      age: draft.age ? Number(draft.age) : undefined,
      characteristics: {
        ...attributes,
        generation: draft.generation,
        hunger: Math.max(0, Math.min(5, Number(draft.hunger) || 0)),
      },
      skills: {
        ...abilities,
        Disciplines: draft.disciplines,
        DisciplinePowers: cleanDisciplinePowers(draft.disciplinePowers),
        Backgrounds: backgrounds,
        Virtues: virtues,
      },
      backstory: {
        system: "Vampire: The Masquerade",
        clan: draft.clan,
        nature: draft.nature,
        demeanor: draft.demeanor,
        sire: draft.sire,
        concept: draft.concept,
        residence: draft.residence,
        birthplace: draft.birthplace,
        personalDescription: draft.personalDescription,
        ideology: draft.ideology,
        clanDisciplines: clan.disciplines,
      },
      inventory: [],
      notes: draft.notes,
    };
  },
};

export function isVtmDraft(draft: CoCDraft | VtmDraft): draft is VtmDraft {
  return draft.system === "vtm";
}
