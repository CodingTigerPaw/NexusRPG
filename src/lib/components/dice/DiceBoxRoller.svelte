<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import DiceBox from '@3d-dice/dice-box-threejs';
  import { OrthographicCamera, TextureLoader } from 'three';
  import type { Object3D, Texture } from 'three';
  import { Button } from '$lib/components/ui/button';
  import { createAnimationSeed, withSeededMathRandom } from '$lib/features/dice';

  import {
    createDiceRollFromDice,
    DEFAULT_DICE_NOTATION,
    DEFAULT_EMISSIVE_INTENSITY,
    DICEBOX_HEIGHT_PX,
    parseDiceNotation,
    REPAINT_INTERVAL_MS,
    TEXTURE_BASE_PATH,
    type DiceRollDieResult,
    type DiceRollResult,
    type DiceRollTerm,
    type DiceStylePlanEntry
  } from '$lib/modules/dice-roller';

  type Props = {
    sessionId: string;
    userId: string;
    userName: string;
    disabled?: boolean;
    notationPreset?: string | null;
    replayRoll?: DiceRollResult | null;
    onMessage?: (message: string) => void;
    onRollPrepared?: (roll: DiceRollResult) => void | Promise<void>;
    onRollComplete?: (roll: DiceRollResult) => void;
    onReplayComplete?: (roll: DiceRollResult) => void;
  };

  type MaterialWithExtensions = {
    color?: { setStyle: (value: string) => void };
    emissive?: { setStyle: (value: string) => void };
    emissiveIntensity?: number;
    map?: unknown;
    bumpMap?: unknown;
    normalMap?: unknown;
    roughnessMap?: unknown;
    needsUpdate?: boolean;
    clone?: () => unknown;
  };

  type DiceNode = Object3D & { material?: unknown };
  type PreparedStylePlanEntry =
    | { diceIndex: number; kind: 'color'; color: string }
    | { diceIndex: number; kind: 'texture'; texture: Texture };
  type DiceBoxRollPlan = {
    standardNotation: string;
    physicalValues: number[];
    stylePlan: DiceStylePlanEntry[];
  };

  let {
    sessionId,
    userId,
    userName,
    disabled = false,
    notationPreset = null,
    replayRoll = null,
    onMessage,
    onRollPrepared,
    onRollComplete,
    onReplayComplete
  }: Props = $props();

  const diceBoxElementId = `dice-box-${Math.random().toString(16).slice(2)}`;
  const quickNotations = ['1d20', '1d100', '2d10', '3d6', '4d6', '1d10'];
  const textureLoader = new TextureLoader();
  const textureCache = new Map<string, Texture>();
  const diceBoxWidthPx = 720;

 

  let diceBox: DiceBox | null = null;
  let notationInput = $state(DEFAULT_DICE_NOTATION);
  let isInitializing = $state(true);
  let isRolling = $state(false);
  let localMessage = $state('');
  let lastReplayedRollId = $state('');

  $effect(() => {
    if (!replayRoll || replayRoll.rollId === lastReplayedRollId || isInitializing || isRolling) {
      return;
    }

    lastReplayedRollId = replayRoll.rollId;
    void replayDiceRoll(replayRoll);
  });

  $effect(() => {
    if (notationPreset && notationInput !== notationPreset) {
      notationInput = notationPreset;
    }
  });

  onMount(async () => {
    await initializeDiceBox();
  });

  onDestroy(() => {
    try {
      diceBox?.clear?.();
      diceBox?.dispose?.();
    } finally {
      diceBox = null;
    }
  });

  function setMessage(message: string) {
    localMessage = message;
    onMessage?.(message);
  }

  async function initializeDiceBox() {
    isInitializing = true;
    setMessage('');

    try {
      const box = new DiceBox(`#${diceBoxElementId}`, {
        assetPath: '/assets/',
        sounds: true,
        volume: 80,
        theme_texture: 'astral',
        theme_material: 'glass',
        strength: 0.55,
        framerate: 1 / 120,
        iterationLimit: 20000,
        gravity_multiplier: 400,
        enableShadows: false,
        antialias: true
      });

      diceBox = box;
      await box.initialize();

      await new Promise((resolve) => window.setTimeout(resolve, 300));
      configureOrthographicCamera(box);
      setMessage('');
    } catch (error) {
      diceBox = null;
      setMessage(
        error instanceof Error
          ? `Nie udało się uruchomić DiceBox: ${error.message}`
          : 'Nie udało się uruchomić DiceBox.'
      );
    } finally {
      isInitializing = false;
    }
  }

  function configureOrthographicCamera(box: DiceBox) {
    if (!box.camera || !box.renderer?.domElement) {
      return;
    }

    const width = box.renderer.domElement.clientWidth || 800;
    const height = box.renderer.domElement.clientHeight || DICEBOX_HEIGHT_PX;
    const camera = new OrthographicCamera(-width, width, height, -height, 0.1, 10000);
    camera.position.z = box.camera.position?.z ?? 1000;
    box.camera = camera;
  }

  function pickNotation(notation: string) {
    notationInput = notation;
    setMessage('');
  }

  async function rollDice() {
    if (!sessionId || !userId) {
      setMessage('Sesja nie jest jeszcze gotowa do rzutu kośćmi.');
      return;
    }

    if (!diceBox || diceBox.rolling || isInitializing || disabled) {
      setMessage('DiceBox nie jest jeszcze gotowy do rzutu.');
      return;
    }

    try {
      const { parsed } = parseDiceNotation(notationInput);
      const dice = buildImmediateLogicalDice(parsed);
      const replayNotation = buildReplayNotationFromDice(dice);
      const animationSeed = createAnimationSeed();
      const roll = createDiceRollFromDice({
        sessionId,
        userId,
        userName,
        notation: notationInput,
        standardNotation: replayNotation,
        animationSeed,
        dice
      });

      await onRollPrepared?.(roll);
      await executeDiceBoxRoll(replayNotation, animationSeed);
      onRollComplete?.(roll);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się wykonać rzutu.');
    }
  }

  async function replayDiceRoll(roll: DiceRollResult) {
    if (!diceBox || diceBox.rolling || isInitializing) {
      return;
    }

    try {
      setMessage(`Odtwarzanie rzutu: ${roll.userName} rzuca ${roll.notation}.`);
      await executeDiceBoxRoll(buildReplayNotation(roll), roll.animationSeed);
      onReplayComplete?.(roll);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Nie udało się odtworzyć rzutu w DiceBox: ${error.message}`
          : 'Nie udało się odtworzyć rzutu w DiceBox.'
      );
    }
  }

  async function executeDiceBoxRoll(notation: string, animationSeed?: string) {
    const box = diceBox;

    if (!box) {
      throw new Error('DiceBox nie jest jeszcze gotowy do rzutu.');
    }

    let repaintInterval: number | undefined;
    isRolling = true;
    setMessage('');

    try {
      const { parsed } = parseDiceNotation(notation);
      const rollPlan = buildDiceBoxRollPlan(parsed);
      const preparedStylePlan = await prepareStylePlan(rollPlan.stylePlan);
      const applyStyles = () => applyStylePlan(box, preparedStylePlan);

      repaintInterval = window.setInterval(applyStyles, REPAINT_INTERVAL_MS);
      const rawResult = await withSeededMathRandom(animationSeed, () => box.roll(rollPlan.standardNotation));

      applyStyles();
      requestAnimationFrame(applyStyles);
      window.setTimeout(applyStyles, REPAINT_INTERVAL_MS);

      const values = extractDiceValues(rawResult);

      if (values.length < rollPlan.physicalValues.length) {
        throw new Error('DiceBox nie zwrócił pełnego wyniku rzutu. Spróbuj ponownie.');
      }

      validatePhysicalValues(rollPlan.physicalValues, values);
      const dice = buildLogicalDiceFromPhysicalValues(parsed, values);

      return {
        dice,
        standardNotation: rollPlan.standardNotation
      };
    } finally {
      if (repaintInterval !== undefined) {
        window.clearInterval(repaintInterval);
      }

      isRolling = false;
    }
  }

  function buildReplayNotation(roll: DiceRollResult) {
    return buildReplayNotationFromDice(roll.dice);
  }

  function buildReplayNotationFromDice(dice: DiceRollDieResult[]) {
    return dice.map((die) => `1d${die.sides}${buildDieStyleSuffix(die)}!${die.value}`).join(' + ');
  }

  function buildDieStyleSuffix(die: DiceRollDieResult) {
    if (die.color) {
      return die.color;
    }

    if (die.texture) {
      return `@${die.texture}`;
    }

    return '';
  }

  function buildImmediateLogicalDice(parsed: DiceRollTerm[]) {
    const dice: DiceRollDieResult[] = [];

    for (const term of parsed) {
      for (let index = 0; index < term.count; index += 1) {
        const value = term.deterministic?.[index] ?? randomDieValue(term.sides);

        dice.push({
          sides: term.sides,
          value,
          color: term.color,
          texture: term.texture,
          parts: buildLogicalDiceParts(term.sides, value)
        });
      }
    }

    return dice;
  }

  function buildLogicalDiceParts(sides: number, value: number) {
    if (sides !== 100) {
      return undefined;
    }

    const normalized = value === 100 ? 0 : value;
    const tens = Math.floor(normalized / 10) * 10;
    const ones = normalized % 10;

    return [
      `kość percentylowa: ${tens === 0 ? '00' : String(tens)}`,
      `jedności: ${String(ones)}`
    ];
  }

  function randomDieValue(sides: number) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function buildDiceBoxRollPlan(parsed: DiceRollTerm[]): DiceBoxRollPlan {
    const notationParts: string[] = [];
    const deterministicValues: number[] = [];
    const physicalValues: number[] = [];
    const stylePlan: DiceStylePlanEntry[] = [];
    let physicalDiceIndex = 0;

    for (const term of parsed) {
      if (term.sides === 100) {
        for (let index = 0; index < term.count; index += 1) {
          notationParts.push('1d100+1d10');
          physicalValues.push(100, 10);
          appendStyleEntries(stylePlan, physicalDiceIndex, 2, term);

          if (term.deterministic) {
            deterministicValues.push(...percentileValueToDiceBoxValues(term.deterministic[index]));
          }

          physicalDiceIndex += 2;
        }

        continue;
      }

      notationParts.push(`${term.count}d${term.sides}`);
      physicalValues.push(...Array.from({ length: term.count }, () => term.sides));
      appendStyleEntries(stylePlan, physicalDiceIndex, term.count, term);

      if (term.deterministic) {
        deterministicValues.push(...term.deterministic);
      }

      physicalDiceIndex += term.count;
    }

    return {
      standardNotation:
        deterministicValues.length > 0
          ? `${notationParts.join('+')}@${deterministicValues.join(',')}`
          : notationParts.join('+'),
      physicalValues,
      stylePlan
    };
  }

  function appendStyleEntries(
    stylePlan: DiceStylePlanEntry[],
    startIndex: number,
    count: number,
    term: DiceRollTerm
  ) {
    if (!term.color && !term.texture) {
      return;
    }

    for (let offset = 0; offset < count; offset += 1) {
      stylePlan.push({
        diceIndex: startIndex + offset,
        color: term.color,
        texture: term.texture
      });
    }
  }

  function percentileValueToDiceBoxValues(value: number) {
    const normalized = value === 100 ? 0 : value;
    const percentileDieValue = Math.floor(normalized / 10) * 10;
    const onesDieValue = normalized % 10;

    return [percentileDieValue === 0 ? 100 : percentileDieValue, onesDieValue === 0 ? 10 : onesDieValue];
  }

  function buildLogicalDiceFromPhysicalValues(parsed: DiceRollTerm[], values: number[]) {
    const dice: DiceRollDieResult[] = [];
    let valueIndex = 0;

    for (const term of parsed) {
      for (let index = 0; index < term.count; index += 1) {
        if (term.sides === 100) {
          const percentileDie = values[valueIndex++];
          const onesDie = values[valueIndex++];
          const tens = percentileDie === 100 ? 0 : percentileDie;
          const ones = onesDie === 10 ? 0 : onesDie;
          const value = tens === 0 && ones === 0 ? 100 : tens + ones;

          dice.push({
            sides: 100,
            value,
            color: term.color,
            texture: term.texture,
            parts: [
              `kość percentylowa: ${tens === 0 ? '00' : String(tens)}`,
              `jedności: ${String(ones)}`
            ]
          });
          continue;
        }

        dice.push({
          sides: term.sides,
          value: values[valueIndex++],
          color: term.color,
          texture: term.texture
        });
      }
    }

    return dice;
  }

  async function prepareStylePlan(stylePlan: DiceStylePlanEntry[]) {
    const prepared: PreparedStylePlanEntry[] = [];

    for (const entry of stylePlan) {
      if (entry.color) {
        prepared.push({ diceIndex: entry.diceIndex, kind: 'color', color: entry.color });
        continue;
      }

      if (entry.texture) {
        prepared.push({
          diceIndex: entry.diceIndex,
          kind: 'texture',
          texture: await loadTexture(entry.texture)
        });
      }
    }

    return prepared;
  }

  async function loadTexture(textureName: string) {
    const cached = textureCache.get(textureName);

    if (cached) {
      return cached;
    }

    const texture = await textureLoader.loadAsync(`${TEXTURE_BASE_PATH}${textureName}.webp`);
    textureCache.set(textureName, texture);
    return texture;
  }

  function applyStylePlan(box: DiceBox, stylePlan: PreparedStylePlanEntry[]) {
    const diceList = box.diceList as DiceNode[] | undefined;

    if (!diceList) {
      return;
    }

    for (const entry of stylePlan) {
      const die = diceList[entry.diceIndex];

      if (!die) {
        continue;
      }

      processNode(die, (material) => {
        if (entry.kind === 'color') {
          configureColorMaterial(material, entry.color);
        } else {
          configureTextureMaterial(material, entry.texture);
        }
      });
    }
  }

  function processNode(rootNode: DiceNode, applyMaterial: (material: MaterialWithExtensions) => void) {
    const stack: DiceNode[] = [rootNode];

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node) {
        continue;
      }

      const material = node.material;

      if (Array.isArray(material)) {
        const cloned = material.map((entry) => cloneMaterial(entry));
        node.material = cloned;
        cloned.forEach((entry) => applyMaterial(entry as MaterialWithExtensions));
      } else if (material) {
        const cloned = cloneMaterial(material);
        node.material = cloned;
        applyMaterial(cloned as MaterialWithExtensions);
      }

      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index] as DiceNode);
      }
    }
  }

  function cloneMaterial(material: unknown) {
    if (material && typeof material === 'object' && 'clone' in material) {
      return (material as MaterialWithExtensions).clone?.() ?? material;
    }

    return material;
  }

  function configureColorMaterial(material: MaterialWithExtensions, color: string) {
    material.color?.setStyle(color);
    material.emissive?.setStyle(color);
    material.emissiveIntensity = DEFAULT_EMISSIVE_INTENSITY;
    material.needsUpdate = true;
  }

  function configureTextureMaterial(material: MaterialWithExtensions, texture: Texture) {
    if (!material.map) {
      material.map = texture;
    } else {
      material.bumpMap = texture;
      material.roughnessMap = texture;
    }

    material.normalMap = null;
    material.emissiveIntensity = 0;
    material.needsUpdate = true;
  }

  function extractDiceValues(rawResult: unknown) {
    return collectDiceValues(rawResult)
      .map((value) => Math.trunc(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  function validatePhysicalValues(physicalValues: number[], values: number[]) {
    for (let index = 0; index < physicalValues.length; index += 1) {
      const expectedDie = physicalValues[index];
      const value = values[index];
      const isValidPercentileDie =
        expectedDie === 100 && value >= 10 && value <= 100 && value % 10 === 0;
      const isValidRegularDie = expectedDie !== 100 && value >= 1 && value <= expectedDie;

      if (!Number.isFinite(value) || (!isValidPercentileDie && !isValidRegularDie)) {
        throw new Error('DiceBox zwrócił wynik niezgodny z notacją rzutu. Spróbuj ponownie.');
      }
    }
  }

  function collectDiceValues(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.flatMap(collectDiceValues);
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const candidate = value as Record<string, unknown>;

    if (Array.isArray(candidate.sets)) {
      return candidate.sets.flatMap((set) => {
        if (!set || typeof set !== 'object') {
          return [];
        }

        const rolls = (set as Record<string, unknown>).rolls;
        return Array.isArray(rolls) ? rolls.flatMap(collectDiceValues) : [];
      });
    }

    const directValue = candidate.value ?? candidate.result ?? candidate.roll ?? candidate.label;

    if (typeof directValue === 'number') {
      return [directValue];
    }

    if (typeof directValue === 'string' && /^\d+$/.test(directValue)) {
      return [Number(directValue)];
    }

    for (const key of ['rolls', 'results', 'dice', 'values']) {
      if (key in candidate) {
        return collectDiceValues(candidate[key]);
      }
    }

    return [];
  }
</script>

<div class="space-y-4">
  <form
    class="flex justify-center"
    onsubmit={(event) => {
      event.preventDefault();
      rollDice();
    }}
  >
    <div class="w-full space-y-2">
      <!-- <Label for={`${diceBoxElementId}-notation`}>Notacja</Label>
      <Input
        id={`${diceBoxElementId}-notation`}
        bind:value={notationInput}
        disabled={disabled || isInitializing || isRolling}
        placeholder="np. 2d10#2aa3ff + 1d20@marble"
      /> -->
    </div>
    <Button type="submit" disabled={disabled || isInitializing || isRolling}>
      {isRolling ? 'Rzut...' : 'Rzuć kośćmi'}
    </Button>
  </form>

  <div class="flex justify-center overflow-x-auto">
    <div
      id={diceBoxElementId}
      class="overflow-hidden rounded-md border bg-neutral-950"
      style={`height: ${DICEBOX_HEIGHT_PX}px; width: ${diceBoxWidthPx}px;`}
    ></div>
  </div>

  <div class="flex flex-wrap gap-2">
    {#each quickNotations as notation}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || isInitializing || isRolling}
        onclick={() => pickNotation(notation)}
      >
        {notation}
      </Button>
    {/each}
  </div>

  {#if isInitializing}
    <p class="text-sm text-muted-foreground">Uruchamianie fizycznego DiceBox...</p>
  {:else if localMessage}
    <p class="text-sm text-muted-foreground">{localMessage}</p>
  {/if}
</div>
