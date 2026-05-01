export const vtmDisciplineCatalog = [
  "Animalizm",
  "dominacja",
  "magia krwi",
  "nadwraźliwość",
  "potencja",
  "odporność",
  "prezencja",
  "przyspieszenie",
] as const;

export type VtmDisciplineCatalogEntry = (typeof vtmDisciplineCatalog)[number];
