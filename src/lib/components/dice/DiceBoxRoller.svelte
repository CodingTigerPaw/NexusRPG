<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import DiceBox from '@3d-dice/dice-box-threejs';
  import { OrthographicCamera, TextureLoader } from 'three';
  import type { Object3D, Texture } from 'three';
  import { Button } from '$lib/components/ui/button';
  import { createAnimationSeed, withSeededMathRandom } from '$lib/features/dice/seeded-random';

  import {
    createDiceRollFromDice,
    DEFAULT_DICE_NOTATION,
    DEFAULT_EMISSIVE_INTENSITY,
    DICEBOX_HEIGHT_PX,
    parseDiceNotation,
    REPAINT_INTERVAL_MS,
    TEXTURE_BASE_PATH,
    randomDieValue,
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
    showQuickNotations?: boolean;
    replayRoll?: DiceRollResult | null;
    surfaceHeightPx?: number;
    surfaceWidthPx?: number;
    controlsPlacement?: 'top' | 'bottom';
    fillAvailableSpace?: boolean;
    overlayMode?: boolean;
    transparentBackground?: boolean;
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
    showQuickNotations = true,
    replayRoll = null,
    surfaceHeightPx = DICEBOX_HEIGHT_PX,
    surfaceWidthPx = 720,
    controlsPlacement = 'top',
    fillAvailableSpace = false,
    overlayMode = false,
    transparentBackground = false,
    onMessage,
    onRollPrepared,
    onRollComplete,
    onReplayComplete
  }: Props = $props();

  const diceBoxElementId = `dice-box-${Math.random().toString(16).slice(2)}`;
  const quickNotations = ['1d20', '1d100', '2d10', '3d6', '4d6', '1d10'];
  const textureLoader = new TextureLoader();
  const textureCache = new Map<string, Texture>();
  const diceBoxFlexGapPx = 16;
  const diceCameraHorizontalScale = 1.15;
  const diceCameraTopScale = 1.2;
  const diceCameraBottomScale = 1.65;
  const diceBoxPhysicsConfig = {
    strength: 0.55,
    framerate: 1 / 120,
    iterationLimit: 20000,
    gravity_multiplier: 400,
    enableShadows: false,
    antialias: true
  };

 

  let diceBox: DiceBox | null = null;
  let notationInput = $state(DEFAULT_DICE_NOTATION);
  let isInitializing = $state(true);
  let isRolling = $state(false);
  let isWaitingForStyledDice = $state(false);
  let localMessage = $state('');
  let lastReplayedRollId = $state('');
  let containerElement = $state<HTMLElement | null>(null);
  let controlsElement = $state<HTMLElement | null>(null);
  let messageElement = $state<HTMLElement | null>(null);
  let measuredSurfaceHeightPx = $state(DICEBOX_HEIGHT_PX);
  let measuredSurfaceWidthPx = $state(720);

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

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      measureAvailableSurface();
    });

    if (containerElement) {
      resizeObserver.observe(containerElement);
    }

    if (controlsElement) {
      resizeObserver.observe(controlsElement);
    }

    if (messageElement) {
      resizeObserver.observe(messageElement);
    }

    measureAvailableSurface();
    void initializeDiceBox();

    return () => {
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    measuredSurfaceHeightPx = surfaceHeightPx;
    measuredSurfaceWidthPx = surfaceWidthPx;
    measureAvailableSurface();
  });

  $effect(() => {
    localMessage;
    isInitializing;
    measureAvailableSurface();
  });

  $effect(() => {
    if (!diceBox) {
      return;
    }

    resizeDiceBoxSurface();
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

  function measureAvailableSurface() {
    if (!fillAvailableSpace || !containerElement) {
      measuredSurfaceHeightPx = surfaceHeightPx;
      measuredSurfaceWidthPx = surfaceWidthPx;
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    const controlsHeight = controlsElement?.getBoundingClientRect().height ?? 0;
    const messageHeight = messageElement?.getBoundingClientRect().height ?? 0;
    const visibleBlockCount = 1 + (controlsHeight > 0 ? 1 : 0) + (messageHeight > 0 ? 1 : 0);
    const reservedGap = Math.max(0, visibleBlockCount - 1) * diceBoxFlexGapPx;

    measuredSurfaceWidthPx = Math.max(320, Math.floor(containerRect.width));
    if (overlayMode) {
      // Overlay ma być dokładnie rozmiarem widocznego viewportu mapy. Kontrolki
      // są pozycjonowane nad canvasem, więc nie pomniejszają sceny kości.
      measuredSurfaceHeightPx = Math.max(180, Math.floor(containerRect.height));
      return;
    }

    // W docku canvas musi ustąpić miejsca kontrolkom, żeby nie tworzyć
    // drugiego scrollowanego obszaru.
    measuredSurfaceHeightPx = Math.max(
      180,
      Math.floor(containerRect.height - controlsHeight - messageHeight - reservedGap)
    );
  }

  function resizeDiceBoxSurface() {
    const box = diceBox;
    const renderer = box?.renderer as
      | ({ domElement?: HTMLElement; setSize?: (width: number, height: number, updateStyle?: boolean) => void })
      | undefined;
    const resizableBox = box as
      | (DiceBox & { setDimensions?: (dimensions: { x: number; y: number }) => void })
      | null;

    if (!box || !renderer?.domElement) {
      return;
    }

    // DiceBox trzyma osobny model rozmiaru świata fizycznego. Samo skalowanie
    // CSS canvasu rozciągałoby obraz, więc synchronizujemy renderer i world box.
    resizableBox?.setDimensions?.({
      x: measuredSurfaceWidthPx,
      y: measuredSurfaceHeightPx
    });
    renderer.setSize?.(measuredSurfaceWidthPx, measuredSurfaceHeightPx, true);
    renderer.domElement.style.width = `${measuredSurfaceWidthPx}px`;
    renderer.domElement.style.height = `${measuredSurfaceHeightPx}px`;
    configureTransparentRenderer(renderer);
    configureOrthographicCamera(box);
  }

  function configureTransparentRenderer(
    renderer:
      | {
          domElement?: HTMLElement;
          setClearColor?: (color: number, alpha?: number) => void;
        }
      | undefined
  ) {
    if (!transparentBackground || !renderer?.domElement) {
      return;
    }

    renderer.setClearColor?.(0x000000, 0);
    renderer.domElement.style.background = 'transparent';
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
        ...diceBoxPhysicsConfig
      });

      console.info('[DiceBox] physics config', {
        ...diceBoxPhysicsConfig,
        viewport: {
          width: measuredSurfaceWidthPx,
          height: measuredSurfaceHeightPx
        }
      });

      diceBox = box;
      await box.initialize();
      configureTransparentRenderer(box.renderer as Parameters<typeof configureTransparentRenderer>[0]);

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
    const height = box.renderer.domElement.clientHeight || measuredSurfaceHeightPx;
    const camera = new OrthographicCamera(
      -width * diceCameraHorizontalScale,
      width * diceCameraHorizontalScale,
      height * diceCameraTopScale,
      -height * diceCameraBottomScale,
      0.1,
      10000
    );
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
    let initialRepaintInterval: number | undefined;
    isRolling = true;
    setMessage('');

    try {
      const { parsed } = parseDiceNotation(notation);
      const rollPlan = buildDiceBoxRollPlan(parsed);
      const preparedStylePlan = await prepareStylePlan(rollPlan.stylePlan);
      const hasCustomStyles = preparedStylePlan.length > 0;
      const applyStyles = () => {
        const stylesApplied = applyStylePlan(box, preparedStylePlan);

        if (stylesApplied && isWaitingForStyledDice) {
          isWaitingForStyledDice = false;
        }

        return stylesApplied;
      };

      console.info('[DiceBox] roll physics params', {
        notation,
        standardNotation: rollPlan.standardNotation,
        animationSeed,
        physicalValues: rollPlan.physicalValues,
        stylePlan: rollPlan.stylePlan,
        physics: diceBoxPhysicsConfig,
        viewport: {
          width: measuredSurfaceWidthPx,
          height: measuredSurfaceHeightPx
        }
      });

      isWaitingForStyledDice = hasCustomStyles;
      initialRepaintInterval = window.setInterval(() => {
        if (applyStyles() && initialRepaintInterval !== undefined) {
          window.clearInterval(initialRepaintInterval);
          initialRepaintInterval = undefined;
        }
      }, 16);
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

      console.info('[DiceBox] roll physical result', {
        notation,
        standardNotation: rollPlan.standardNotation,
        animationSeed,
        extractedValues: values,
        logicalDice: dice
      });

      return {
        dice,
        standardNotation: rollPlan.standardNotation
      };
    } finally {
      if (repaintInterval !== undefined) {
        window.clearInterval(repaintInterval);
      }

      if (initialRepaintInterval !== undefined) {
        window.clearInterval(initialRepaintInterval);
      }

      isWaitingForStyledDice = false;
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
    if (stylePlan.length === 0) {
      return true;
    }

    const diceList = box.diceList as DiceNode[] | undefined;

    if (!diceList) {
      return false;
    }

    let appliedEntries = 0;

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
      appliedEntries += 1;
    }

    return appliedEntries === stylePlan.length;
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

<div
  bind:this={containerElement}
  class={[
    'h-full min-h-0',
    overlayMode ? 'pointer-events-none relative' : 'flex flex-col gap-4'
  ]}
>
  <form
    bind:this={controlsElement}
    class={[
      'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center',
      controlsPlacement === 'bottom' ? 'order-2' : 'order-1',
      overlayMode
        ? 'pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2'
        : ''
    ]}
    onsubmit={(event) => {
      event.preventDefault();
      rollDice();
    }}
  >
    <div class="hidden">
      <!-- <Label for={`${diceBoxElementId}-notation`}>Notacja</Label>
      <Input
        id={`${diceBoxElementId}-notation`}
        bind:value={notationInput}
        disabled={disabled || isInitializing || isRolling}
        placeholder="np. 2d10#2aa3ff + 1d20@marble"
      /> -->
    </div>

    {#if showQuickNotations}
      <div class="flex flex-wrap justify-center gap-2">
        {#each quickNotations as notation}
          <Button
            type="button"
            size="sm"
            variant={notationInput === notation ? 'default' : 'outline'}
            disabled={disabled || isInitializing || isRolling}
            onclick={() => pickNotation(notation)}
          >
            {notation}
          </Button>
        {/each}
      </div>
    {/if}

    <Button
      type="submit"
      size="default"
      class={overlayMode ? 'px-5 shadow-lg' : ''}
      disabled={disabled || isInitializing || isRolling}
    >
      {isRolling ? 'Rzut...' : 'Rzuć kośćmi'}
    </Button>
  </form>

  <div
    class={[
      'overflow-hidden',
      controlsPlacement === 'bottom' ? 'order-1' : 'order-2',
      overlayMode ? 'pointer-events-none absolute inset-0' : 'flex justify-center'
    ]}
  >
    <div
      id={diceBoxElementId}
      class={[
        'h-full w-full overflow-hidden transition-opacity duration-75',
        transparentBackground ? 'bg-transparent' : 'rounded-md border bg-neutral-950',
        isWaitingForStyledDice ? "opacity-0" : "opacity-100"
      ]}
      style={`height: ${measuredSurfaceHeightPx}px; width: ${measuredSurfaceWidthPx}px; max-width: 100%;`}
    ></div>
  </div>

  {#if isInitializing}
    <p
      bind:this={messageElement}
      class={[
        'text-sm text-muted-foreground',
        controlsPlacement === 'bottom' ? 'order-3' : 'order-3'
      ]}
    >
      Uruchamianie fizycznego DiceBox...
    </p>
  {:else if localMessage}
    <p
      bind:this={messageElement}
      class={[
        'text-sm text-muted-foreground',
        controlsPlacement === 'bottom' ? 'order-3' : 'order-3'
      ]}
    >
      {localMessage}
    </p>
  {/if}
</div>
