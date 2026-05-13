import type { CharacterCard } from "$lib/modules/charactersModule/charactersTypes";

export type CharacterOption = {
  id: string;
  label: string;
  value: number;
};

export function normalizeSystemText(system: string | undefined) {
  return (system ?? "").toLowerCase();
}

export function matchesCocSystem(system: string | undefined) {
  return /cthulhu|coc|zew/.test(normalizeSystemText(system));
}

export function matchesVtmSystem(system: string | undefined) {
  return /vampire|wampir|vtm|maskarada/.test(normalizeSystemText(system));
}

export function readCharacterNumber(
  character: CharacterCard | null | undefined,
  paths: string[],
) {
  if (!character) {
    return 0;
  }

  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, character);
    const numericValue = typeof value === "number" ? value : Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return 0;
}

export function buildNumericOptions(
  source: Record<string, unknown> | undefined,
) {
  return Object.entries(source ?? {})
    .map(([key, value]) => ({
      id: key,
      label: key,
      value: typeof value === "number" ? value : Number(value),
    }))
    .filter((option) => Number.isFinite(option.value))
    .sort((left, right) => left.label.localeCompare(right.label, "pl"));
}

export function readVtmHunger(character: CharacterCard | null | undefined) {
  return Math.max(
    0,
    readCharacterNumber(character, [
      "characteristics.hunger",
      "characteristics.Głód",
      "skills.Hunger",
    ]),
  );
}

export function buildVtmNotation(pool: number, hunger: number) {
  if (pool <= 0) {
    return null;
  }

  const clampedHunger = Math.min(hunger, pool);
  const standardDice = Math.max(0, pool - clampedHunger);
  const terms = [
    standardDice > 0 ? `${standardDice}d10#2aa3ff` : "",
    clampedHunger > 0 ? `${clampedHunger}d10#c1121f` : "",
  ].filter(Boolean);

  return terms.join(" + ");
}
