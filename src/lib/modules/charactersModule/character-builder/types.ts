import type { CharacterCreatePayload } from "$lib/modules/characters";

export type GameSystemId = "coc5" | "vtm";
//TODO zorientować sie gdzie i jak są uzywane typy i czy nie da się ich uprościć bądz uzyć skądś indziej
export type BaseCharacterDraft = {
  system: GameSystemId;
  name: string;
  age: string;
  residence: string;
  birthplace: string;
  notes: string;
  personalDescription: string;
  ideology: string;
};

export type CharacteristicKey =
  | "STR"
  | "CON"
  | "POW"
  | "DEX"
  | "APP"
  | "SIZ"
  | "INT"
  | "EDU";
export type InvestigatorCharacteristics = Record<CharacteristicKey, number>;

export type OccupationKey =
  | "antiquarian"
  | "author"
  | "doctor"
  | "journalist"
  | "private_investigator"
  | "professor";

export type OccupationTemplate = {
  key: OccupationKey;
  label: string;
  description: string;
  occupationSkills: string[];
};

export type CoCDraft = BaseCharacterDraft & {
  system: "coc5";
  occupationKey: OccupationKey;
  characteristics: InvestigatorCharacteristics;
  personalInterestSkills: string[];
};

export type CoCDerivedStats = {
  idea: number;
  know: number;
  luck: number;
  sanity: number;
  magicPoints: number;
  hitPoints: number;
  damageBonus: string;
};

export type VtmClan =
  | "Brujah"
  | "Gangrel"
  | "Malkavian"
  | "Nosferatu"
  | "Toreador"
  | "Tremere"
  | "Ventrue";

export type VtmAttributeKey =
  | "Siła"
  | "Zręczność"
  | "Wytrzymałość"
  | "Charyzma"
  | "Manipulacja"
  | "Opanowanie"
  | "Inteligencja"
  | "Spryt"
  | "Determinacja";

export type VtmAbilityKey =
  | "Atletyka"
  | "Bijatyka"
  | "Rzemiosło"
  | "Prowadzenie pojazdów"
  | "Broń palna"
  | "Kradzież"
  | "Broń biała"
  | "Skradanie"
  | "Sztuka przetrwania"
  | "Rozumienie zwierząt"
  | "Etykieta"
  | "przebiegłość"
  | "Zastraszanie"
  | "Przywództwo"
  | "Występy publiczne"
  | "Perswazja"
  | "Intuicja"
  | "cwaniactwo"
  | "Wiedza akademicka"
  | "Czujność"
  | "Finanse"
  | "Śledztwo"
  | "Medycyna"
  | "Okultyzm"
  | "Polityka"
  | "Nauka"
  | "Technologia";

export type VtmVirtueKey = "Conscience" | "Self-Control" | "Courage";
export type VtmDisciplineKey = "Primary" | "Secondary" | "Tertiary";
export type VtmBackgroundKey =
  | "Allies"
  | "Contacts"
  | "Generation"
  | "Herd"
  | "Influence"
  | "Resources";

export type VtmDisciplinePower = {
  discipline: string;
  name: string;
  description: string;
};

export type VtmDraft = BaseCharacterDraft & {
  system: "vtm";
  concept: string;
  clan: VtmClan;
  sire: string;
  nature: string;
  demeanor: string;
  generation: string;
  hunger: number;
  attributes: Record<VtmAttributeKey, number>;
  abilities: Record<VtmAbilityKey, number>;
  disciplines: Record<VtmDisciplineKey, string>;
  disciplinePowers: VtmDisciplinePower[];
  backgrounds: Record<VtmBackgroundKey, number>;
  virtues: Record<VtmVirtueKey, number>;
};

export type VtmDerivedStats = {
  humanity: number;
  willpower: number;
  bloodPool: number;
};

export type CharacterDraft = CoCDraft | VtmDraft;

export type SavedCharacterDraft = {
  id: string;
  userId: string;
  system: GameSystemId;
  updatedAt: string;
  draft: CharacterDraft;
};

export type CharacterDraftSummary = {
  id: string;
  system: GameSystemId;
  name: string;
  updatedAt: string;
};

export type CharacterCreationStrategy<TDraft extends CharacterDraft> = {
  system: GameSystemId;
  label: string;
  shortDescription: string;
  createEmptyDraft(): TDraft;
  cloneDraft(draft: TDraft): TDraft;
  getStepLabels(): string[];
  buildPayload(draft: TDraft): CharacterCreatePayload;
  randomize?(draft: TDraft): TDraft;
};
