import type { VtmDisciplinePower } from '../types';

export function rollDice(count: number, sides: number) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1).reduce(
    (sum, value) => sum + value,
    0
  );
}

export function cloneRecord<TKeys extends string, TValue>(
  source: Record<TKeys, TValue>
): Record<TKeys, TValue> {
  return { ...source };
}

export function clampRating(value: unknown, min = 0, max = 5) {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(numericValue)));
}

export function clampRatings<TKeys extends string>(ratings: Record<TKeys, number>) {
  return Object.fromEntries(
    Object.entries(ratings).map(([key, value]) => [key, clampRating(value)])
  ) as Record<TKeys, number>;
}

export function parseOptionalNumber(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : value;

  if (text === '' || text === null || text === undefined) {
    return undefined;
  }

  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

export function cleanDisciplinePowers(powers: VtmDisciplinePower[] = []) {
  return powers
    .map((power) => ({
      discipline: power.discipline.trim(),
      name: power.name.trim(),
      description: power.description.trim()
    }))
    .filter((power) => power.discipline || power.name || power.description);
}
