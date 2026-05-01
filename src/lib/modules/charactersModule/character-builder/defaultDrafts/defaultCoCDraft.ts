import { type CoCDraft } from "../types";
export const emptyCoCDraft = (): CoCDraft => ({
  system: "coc5",
  name: "",
  age: "",
  occupationKey: "journalist",
  residence: "",
  birthplace: "",
  characteristics: {
    STR: 50,
    CON: 50,
    POW: 50,
    DEX: 50,
    APP: 50,
    SIZ: 60,
    INT: 60,
    EDU: 65,
  },
  personalInterestSkills: ["Listen", "Stealth", "Survival", "Drive Auto"],
  notes: "",
  personalDescription: "",
  ideology: "",
});
