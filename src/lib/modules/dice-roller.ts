const notationRegex =
  /^(\d*)d(\d+)(?:(#([0-9a-fA-F]{6}))|@([a-zA-Z0-9._-]+))?(?:!([\d,\s]+))?$/;

export type DiceRollTerm = {
  count: number;
  sides: number;
  color?: string;
  texture?: string;
  deterministic?: number[];
};

export type DiceRollDieResult = {
  sides: number;
  value: number;
  kind?: 'standard' | 'hunger' | string;
  color?: string;
  texture?: string;
  parts?: string[];
};

export type DiceRollMechanicsResult = {
  systemId: string;
  flowId?: string;
  checkName: string;
  target?: number;
  hardTarget?: number;
  extremeTarget?: number;
  roll?: number;
  successLevel?: string;
  successThreshold?: string;
  successes?: number;
  criticalPairs?: number;
  messyCritical?: boolean;
  bestialFailure?: boolean;
  pool?: number;
  hunger?: number;
  status?: string;
  haltReason?: string;
};

export type DiceRollResult = {
  rollId: string;
  sessionId: string;
  userId: string;
  userName: string;
  notation: string;
  standardNotation: string;
  animationSeed?: string;
  total: number;
  dice: DiceRollDieResult[];
  mechanics?: DiceRollMechanicsResult;
  hidden?: boolean;
  actorLabel?: string;
  subjectLabel?: string | null;
  targetName?: string;
  characterId?: string | null;
  characterName?: string | null;
  rollContext?: 'playerCharacter' | 'npc' | 'generic';
  visibility?: 'public' | 'gmOnly';
  createdAt: string;
};

export type CreateDiceRollOptions = {
  sessionId: string;
  userId: string;
  userName: string;
  notation: string;
  animationSeed?: string;
};

export type CreateDiceRollFromDiceOptions = CreateDiceRollOptions & {
  standardNotation: string;
  dice: DiceRollDieResult[];
};

export type DiceStylePlanEntry = {
  diceIndex: number;
  color?: string;
  texture?: string;
};

export const DEFAULT_DICE_NOTATION = '1d20';
export const DICEBOX_HEIGHT_PX = 420;
export const REPAINT_INTERVAL_MS = 120;
export const TEXTURE_BASE_PATH = '/assets/textures/';
export const DEFAULT_EMISSIVE_INTENSITY = 0.35;

function parseTerms(input: string) {
  return input
    .split('+')
    .map((term) => term.trim())
    .filter(Boolean);
}

function parseDeterministic(value?: string) {
  if (!value) {
    return undefined;
  }

  return value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter(Number.isFinite);
}

function validateTerm(
  term: string,
  count: number,
  sides: number,
  color?: string,
  texture?: string,
  deterministic?: number[]
) {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`W "${term}" liczba kości musi być w zakresie 1..100.`);
  }

  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
    throw new Error(`W "${term}" liczba ścian musi być w zakresie 2..1000.`);
  }

  if (color && texture) {
    throw new Error(`Nie można podać koloru i tekstury w "${term}".`);
  }

  if (!deterministic) {
    return;
  }

  if (deterministic.length !== count) {
    throw new Error(`Deterministyczne wartości w "${term}" muszą mieć ${count} element(y).`);
  }

  for (const value of deterministic) {
    if (value < 1 || value > sides) {
      throw new Error(`W "${term}" wartość musi być w zakresie 1..${sides}.`);
    }
  }
}

function parseSingleTerm(term: string): DiceRollTerm {
  const match = term.match(notationRegex);

  if (!match) {
    throw new Error(`Niepoprawny fragment notacji: "${term}". Użyj np. 2d10 + 1d20.`);
  }

  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const color = match[4] ? `#${match[4]}` : undefined;
  const texture = match[5];
  const deterministic = parseDeterministic(match[6]);

  validateTerm(term, count, sides, color, texture, deterministic);
  return { count, sides, color, texture, deterministic };
}

function buildStandardNotation(parsed: DiceRollTerm[]) {
  const baseNotation = parsed.map((term) => `${term.count}d${term.sides}`).join('+');
  const hasDeterministic = parsed.some((term) => term.deterministic?.length);

  if (!hasDeterministic) {
    return baseNotation;
  }

  for (const term of parsed) {
    if ((term.deterministic?.length ?? 0) !== term.count) {
      throw new Error(
        'Jeśli używasz deterministycznych wyników, podaj je dla każdego członu rzutu.'
      );
    }
  }

  return `${baseNotation}@${parsed.flatMap((term) => term.deterministic ?? []).join(',')}`;
}

export function parseDiceNotation(input: string) {
  if (!input.trim()) {
    throw new Error('Podaj notację, np. 2d10 + 1d20.');
  }

  const parsed = parseTerms(input).map(parseSingleTerm);

  return {
    parsed,
    standardNotation: buildStandardNotation(parsed)
  };
}

export function randomDieValue(sides: number) {
  if (globalThis.crypto?.getRandomValues) {
    const maxUint32 = 0xffffffff;
    const acceptedRange = Math.floor((maxUint32 + 1) / sides) * sides;
    const buffer = new Uint32Array(1);

    do {
      globalThis.crypto.getRandomValues(buffer);
    } while (buffer[0] >= acceptedRange);

    return (buffer[0] % sides) + 1;
  }

  return Math.floor(Math.random() * sides) + 1;
}

function createRollId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDiceRoll({
  sessionId,
  userId,
  userName,
  notation,
  animationSeed
}: CreateDiceRollOptions): DiceRollResult {
  const { parsed, standardNotation } = parseDiceNotation(notation);
  const dice = parsed.flatMap((term) =>
    Array.from({ length: term.count }, (_, index) => ({
      sides: term.sides,
      value: term.deterministic?.[index] ?? randomDieValue(term.sides),
      color: term.color,
      texture: term.texture
    }))
  );

  return {
    rollId: createRollId(),
    sessionId,
    userId,
    userName,
    notation: notation.trim(),
    standardNotation,
    animationSeed,
    total: dice.reduce((sum, die) => sum + die.value, 0),
    dice,
    createdAt: new Date().toISOString()
  };
}

export function createDiceRollFromDice({
  sessionId,
  userId,
  userName,
  notation,
  standardNotation,
  dice,
  animationSeed
}: CreateDiceRollFromDiceOptions): DiceRollResult {
  return {
    rollId: createRollId(),
    sessionId,
    userId,
    userName,
    notation: notation.trim(),
    standardNotation,
    animationSeed,
    total: dice.reduce((sum, die) => sum + die.value, 0),
    dice,
    createdAt: new Date().toISOString()
  };
}

export function buildDiceFromValues(parsed: DiceRollTerm[], values: number[]) {
  let valueIndex = 0;

  return parsed.flatMap((term) =>
    Array.from({ length: term.count }, (_, index) => {
      const rawValue = values[valueIndex++];
      const normalizedValue =
        Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= term.sides
          ? Math.trunc(rawValue)
          : term.deterministic?.[index] ?? randomDieValue(term.sides);

      return {
        sides: term.sides,
        value: normalizedValue,
        color: term.color,
        texture: term.texture
      };
    })
  );
}

export function buildStylePlan(parsed: DiceRollTerm[]) {
  const stylePlan: DiceStylePlanEntry[] = [];
  let diceIndex = 0;

  for (const term of parsed) {
    for (let index = 0; index < term.count; index += 1) {
      if (term.color || term.texture) {
        stylePlan.push({
          diceIndex,
          color: term.color,
          texture: term.texture
        });
      }

      diceIndex += 1;
    }
  }

  return stylePlan;
}

export function formatDiceValues(roll: DiceRollResult) {
  return roll.dice
    .map((die) => {
      const parts = die.parts?.length ? ` (${die.parts.join(', ')})` : '';
      return `d${die.sides}: ${die.value}${parts}`;
    })
    .join(', ');
}

const successLabels: Record<string, string> = {
  critical: 'Krytyczny sukces',
  extreme: 'Ekstremalny sukces',
  hard: 'Trudny sukces',
  regular: 'Sukces',
  failure: 'Porażka',
  fumble: 'Fumble'
};

const cocThresholdLabels: Record<string, string> = {
  critical: 'krytyk',
  oneFifth: '1/5',
  half: '1/2',
  regular: 'zwykły',
  none: 'brak'
};

function formatSuccessCount(value: number) {
  if (value === 1) {
    return '1 sukces';
  }

  if (value > 1 && value < 5) {
    return `${value} sukcesy`;
  }

  return `${value} sukcesów`;
}

function formatPercentage(value: number) {
  return `${Math.trunc(value)}%`;
}

export function formatDiceRollTotal(roll: DiceRollResult) {
  return roll.mechanics?.systemId === 'coc5' ? formatPercentage(roll.total) : String(roll.total);
}

export function formatDiceMechanics(roll: DiceRollResult) {
  if (!roll.mechanics) {
    return '';
  }

  if (roll.mechanics.systemId === 'vtm') {
    const successes = formatSuccessCount(roll.mechanics.successes ?? 0);
    const flags = [
      roll.mechanics.messyCritical ? 'Brutalny sukces' : '',
      roll.mechanics.bestialFailure ? 'Bestialska porażka' : ''
    ].filter(Boolean);
    const details = [
      typeof roll.mechanics.pool === 'number' ? `pula ${roll.mechanics.pool}` : '',
      typeof roll.mechanics.hunger === 'number' ? `głód ${roll.mechanics.hunger}` : '',
      ...flags
    ].filter(Boolean);

    return [successes, ...details].join(' · ');
  }

  if (roll.mechanics.systemId === 'coc5') {
    const level = roll.mechanics.successLevel
      ? successLabels[roll.mechanics.successLevel] ?? roll.mechanics.successLevel
      : roll.mechanics.status;
    const threshold = roll.mechanics.successThreshold
      ? (cocThresholdLabels[roll.mechanics.successThreshold] ?? roll.mechanics.successThreshold)
      : '';
    const details = [
      threshold && threshold !== 'brak' && threshold !== 'zwykły' ? `przebicie ${threshold}` : '',
      typeof roll.mechanics.roll === 'number' ? `rzut ${formatPercentage(roll.mechanics.roll)}` : '',
      typeof roll.mechanics.target === 'number'
        ? `próg ${formatPercentage(roll.mechanics.target)}`
        : ''
    ].filter(Boolean);

    return [level ?? 'wynik nierozstrzygnięty', ...details].join(' · ');
  }

  const level = roll.mechanics.successLevel
    ? successLabels[roll.mechanics.successLevel] ?? roll.mechanics.successLevel
    : roll.mechanics.status;
  const target =
    typeof roll.mechanics.target === 'number' ? ` / próg ${roll.mechanics.target}` : '';

  return `${level ?? 'wynik nierozstrzygnięty'}${target}`;
}
