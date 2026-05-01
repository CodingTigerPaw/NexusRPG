<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import { Accordion } from 'bits-ui';
  import DataDrivenCharacterSheet from '$lib/components/character-sheet/DataDrivenCharacterSheet.svelte';
  import DiceBoxRoller from '$lib/components/dice/DiceBoxRoller.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import CharacterActionPanel from '$lib/features/action-flow/components/CharacterActionPanel.svelte';
  import { runFlow } from '$lib/modules/action-flow';
  import {
    evaluateVtmDice,
    markVtmDiceKinds
  } from '$lib/modules/action-flow/rules/vtm-rules';
  import { getCurrentUser, hasRole } from '$lib/modules/auth';
  import { vtmDisciplineCatalog } from '$lib/modules/charactersModule/character-builder';
  import {
    vtmAbilityGroups,
    vtmAttributeGroups
  } from '$lib/modules/charactersModule/character-builder/data';
  import { readCharacterNumber, readVtmHunger } from '$lib/features/action-flow/ui-adapters/check-options';
  import { buildVtmNotation } from '$lib/modules/charactersModule/systems/action-values';
  import {
    getUserCharacters,
    updateSessionParticipantCharacter,
    type CharacterCard,
    type CharacterUpdatePayload
  } from '$lib/modules/characters';
  import {
    formatDiceMechanics,
    type DiceRollResult
  } from '$lib/modules/dice-roller';
  import { resolveCharacterSheet } from '$lib/modules/charactersModule/character-sheet';
  import {
    getCharacterSystemDefinitionByRpgSystem,
    getCharacterSystemDefinitionForCharacter,
    type CharacterActionInputValues
  } from '$lib/modules/charactersModule/systems';
  import {
    CharacterSheetLiveSocket,
    type BackendDiceRollPayload,
    type CharacterSheetLiveEvent,
    type CharacterSheetLiveStatus,
    type CharacterSheetSubscription
  } from '$lib/modules/live-session';
  import {
    deleteRpgSession,
    formatRpgSessionName,
    getRpgSession,
    type RpgSession,
    type RpgSessionParticipant
  } from '$lib/modules/rpg-sessions';
  import { appRoles } from '$lib/modules/navigation';
  import { requireAuth } from '$lib/modules/rbac';
  import { getUsers, type AppUser } from '$lib/modules/users';

  type SessionCharacterEntry = {
    participant: RpgSessionParticipant;
    playerName: string;
    character: CharacterCard | null;
  };

  let session = $state<RpgSession | null>(null);
  let entries = $state<SessionCharacterEntry[]>([]);
  let activeCharacterId = $state('');
  let isLoading = $state(true);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let isDeleting = $state(false);
  let errorMessage = $state('');
  let editorMessage = $state('');
  let liveMessage = $state('');
  let liveStatus = $state<CharacterSheetLiveStatus>('disabled');
  let liveSocketActive = $state(false);
  let lastLiveEventAt = $state('');
  let userId = $state('');
  let currentUserName = $state('Gracz');
  let editName = $state('');
  let editOccupation = $state('');
  let editAge = $state('');
  let editHunger = $state('');
  let editNotes = $state('');
  let editCharacteristics = $state('');
  let editSkills = $state('');
  let editBackstory = $state('');
  let editInventory = $state('');
  let isAdminUser = $state(false);
  let newDiscipline = $state('');
  let newDisciplinePowerName = $state('');
  let newDisciplinePowerDescription = $state('');
  let isAddingDiscipline = $state(false);
  let isRemovingDiscipline = $state(false);
  let diceMessage = $state('');
  let diceRolls = $state<DiceRollResult[]>([]);
  let diceRollReplay = $state<DiceRollResult | null>(null);
  let selectedActionId = $state('');
  let actionInputValues = $state<CharacterActionInputValues>({});
  let hideRollFromPlayers = $state(false);
  let gmManualRoll = $state(false);
  let gmManualCheckName = $state('Rzut przeciwnika');
  let gmManualAttributeName = $state('Siła');
  let gmManualAttributeValue = $state('3');
  let gmManualAbilityName = $state('Bijatyka');
  let gmManualAbilityValue = $state('2');
  let gmManualHungerValue = $state('0');
  let liveSocket: CharacterSheetLiveSocket | null = null;
  const preparedDiceRolls = new Map<string, DiceRollResult>();
  const sentDiceRollIds = new Set<string>();
  const gmManualAttributeOptions = Object.values(vtmAttributeGroups).flat();
  const gmManualAbilityOptions = Object.values(vtmAbilityGroups).flat();

  const sessionId = $derived(page.params.sessionId);
  const backendParticipants = $derived(session?.participants ?? []);
  const isOwner = $derived(Boolean(session && session.ownerUserId === userId));
  const canManageSession = $derived(Boolean(isOwner || isAdminUser));
  const isAssignedPlayer = $derived(
    Boolean(
      session &&
        (session.playerUserIds.includes(userId) ||
          backendParticipants.some((participant) => participant.userId === userId))
    )
  );
  const activeEntry = $derived(
    entries.find((entry) => entry.character?.characterId === activeCharacterId) ?? entries[0] ?? null
  );
  const activeSheet = $derived(
    activeEntry?.character ? resolveCharacterSheet(activeEntry.character) : null
  );
  const activeSystemDefinition = $derived(
    activeEntry?.character
      ? getCharacterSystemDefinitionForCharacter(activeEntry.character)
      : getCharacterSystemDefinitionByRpgSystem(session?.rpgSystem)
  );
  const sessionSystemDefinition = $derived(getCharacterSystemDefinitionByRpgSystem(session?.rpgSystem));
  const activeAction = $derived(
    activeSystemDefinition?.actions.checks.find((action) => action.id === selectedActionId) ?? null
  );
  const actionNotationPreset = $derived(
    activeAction && activeEntry?.character
      ? activeAction.createDiceNotation(actionInputValues, activeEntry.character)
      : null
  );
  const gmManualPool = $derived(
    Math.max(0, readManualRating(gmManualAttributeValue) + readManualRating(gmManualAbilityValue))
  );
  const gmManualHunger = $derived(
    Math.min(readManualRating(gmManualHungerValue), gmManualPool)
  );
  const gmManualNotation = $derived(
    canManageSession && gmManualRoll && sessionSystemDefinition?.id === 'vtm'
      ? buildVtmNotation(gmManualPool, gmManualHunger)
      : null
  );
  const activeNotationPreset = $derived(gmManualRoll ? gmManualNotation : actionNotationPreset);
  const actionBlocksRoll = $derived(
    gmManualRoll
      ? Boolean(canManageSession && sessionSystemDefinition?.id === 'vtm' && !gmManualNotation)
      : Boolean(activeAction && !actionNotationPreset)
  );
  const isActiveVampireSystem = $derived(activeSystemDefinition?.id === 'vtm');
  const activeEntryIsBackendParticipant = $derived(
    Boolean(
      activeEntry &&
        backendParticipants.some(
          (participant) =>
            participant.userId === activeEntry.participant.userId &&
            participant.characterId === activeEntry.participant.characterId
        )
    )
  );
  const activeEntryCanBeEdited = $derived(
    Boolean(canManageSession && activeEntry?.character && activeEntryIsBackendParticipant)
  );
  const activeLiveSubscription = $derived<CharacterSheetSubscription | null>(
    activeEntry?.character && activeEntry.participant.userId === userId
      ? {
          userId: activeEntry.participant.userId,
          characterId: activeEntry.character.characterId
        }
      : null
  );
  const activeDisciplinePowers = $derived(readDisciplinePowers(activeEntry?.character?.skills));
  const activeRemovableDisciplineKeys = $derived(getRemovableDisciplineKeys(activeEntry?.character?.skills));

  onMount(async () => {
    const allowed = await requireAuth();

    if (!allowed) {
      return;
    }

    const currentUser = getCurrentUser();
    userId = currentUser?.userId ?? '';
    isAdminUser = hasRole(appRoles.admin);
    currentUserName = currentUser?.username ?? currentUser?.email ?? currentUser?.userId ?? 'Gracz';

    try {
      if (!sessionId) {
        errorMessage = 'Brakuje identyfikatora sesji RPG.';
        return;
      }

      const loadedSession = await getRpgSession(sessionId);

      const hasSessionAccess =
        isAdminUser ||
        loadedSession.ownerUserId === userId ||
        loadedSession.playerUserIds.includes(userId) ||
        (loadedSession.participants ?? []).some((participant) => participant.userId === userId);

      if (!hasSessionAccess) {
        errorMessage = 'Ta sesja nie jest przypisana do aktualnie zalogowanego użytkownika.';
        return;
      }

      const ownerAccess = loadedSession.ownerUserId === userId || isAdminUser;
      const visibleUserId = ownerAccess ? null : userId;
      const loadedEntries = await loadSessionCharacters(loadedSession, visibleUserId);
      const firstVisibleEntry = loadedEntries.find((entry) => entry.character) ?? loadedEntries[0] ?? null;

      session = loadedSession;
      entries = loadedEntries;
      activeCharacterId = firstVisibleEntry?.character?.characterId ?? '';
      connectLiveSession();
      updateLiveSubscription(getLiveSubscription(firstVisibleEntry));
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się przygotować widoku sesji.';
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    disconnectLiveSession();
  });

  function formatUserName(user: AppUser) {
    return user.username ?? user.email ?? user.userId;
  }

  function openSessionDetails() {
    disconnectLiveSession();

    if (session) {
      goto(`/sessions/${session.sessionId}`);
    }
  }

  function selectAction(actionId: string) {
    selectedActionId = actionId;
    actionInputValues = {};
  }

  function updateActionInput(inputId: string, value: string) {
    actionInputValues = {
      ...actionInputValues,
      [inputId]: value
    };
  }

  function readManualRating(value: string) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.max(0, Math.min(5, Math.trunc(numericValue))) : 0;
  }

  function formatGmManualCheckName() {
    const customName = gmManualCheckName.trim();

    if (customName) {
      return customName;
    }

    return `${gmManualAttributeName || 'Atrybut'} + ${gmManualAbilityName || 'Zdolność'}`;
  }

  function hasCompleteActionInput() {
    return Boolean(
      activeAction && activeAction.inputs.every((input) => Boolean(actionInputValues[input.id]))
    );
  }

  function openSessionsList() {
    disconnectLiveSession();
    goto('/sessions');
  }

  function formatLiveStatus(status: CharacterSheetLiveStatus) {
    const labels: Record<CharacterSheetLiveStatus, string> = {
      disabled: 'Live wyłączone',
      connecting: 'Łączenie live...',
      connected: 'Live połączone',
      closed: 'Live rozłączone',
      error: 'Błąd live'
    };

    return labels[status];
  }

  function shouldShowRollTotal(roll: DiceRollResult) {
    return roll.mechanics?.systemId !== 'vtm';
  }

  function resolveRollPresentation(roll: DiceRollResult) {
    const targetName = roll.mechanics?.checkName ?? roll.notation;

    if (canManageSession && gmManualRoll) {
      return {
        actorLabel: 'GM',
        subjectLabel: gmManualCheckName.trim() || targetName,
        targetName,
        rollContext: 'npc' as const
      };
    }

    if (canManageSession && activeEntry?.character) {
      return {
        actorLabel: 'GM',
        subjectLabel: activeEntry.character.name,
        targetName,
        rollContext: 'playerCharacter' as const
      };
    }

    return {
      actorLabel: currentUserName,
      subjectLabel: activeEntry?.character?.name ?? null,
      targetName,
      rollContext: activeEntry?.character ? ('playerCharacter' as const) : ('generic' as const)
    };
  }

  function formatRollLogTitle(roll: DiceRollResult) {
    const checkName = roll.targetName ?? roll.mechanics?.checkName ?? roll.notation;

    if (roll.actorLabel === 'GM' && roll.subjectLabel) {
      return `GM rzuca za ${roll.subjectLabel}: ${checkName}`;
    }

    if (roll.actorLabel === 'GM') {
      return `GM rzuca: ${checkName}`;
    }

    return `${roll.actorLabel ?? roll.userName} rzuca ${checkName}`;
  }

  function connectLiveSession() {
    liveSocket?.close();
    liveSocketActive = true;
    liveSocket = new CharacterSheetLiveSocket({
      onStatusChange: (status) => {
        liveStatus = status;
        liveSocketActive = status !== 'closed' && status !== 'disabled';

        if (status === 'connected' && activeLiveSubscription) {
          liveMessage = '';
        }
      },
      onEvent: handleLiveEvent,
      onError: (message) => {
        liveMessage = message;
      }
    });
    liveSocket.connect();
  }

  function disconnectLiveSession() {
    liveSocket?.close();
    liveSocket = null;
    liveSocketActive = false;
    liveMessage = 'Połączenie live zostało rozłączone ręcznie.';
  }

  function reconnectLiveSession() {
    if (!session) {
      return;
    }

    liveMessage = '';
    connectLiveSession();
    updateLiveSubscription();
  }

  function getLiveSubscription(entry: SessionCharacterEntry | null) {
    if (!entry?.character || entry.participant.userId !== userId) {
      return null;
    }

    return {
      userId: entry.participant.userId,
      characterId: entry.character.characterId
    };
  }

  function updateLiveSubscription(subscription = activeLiveSubscription) {
    liveSocket?.subscribe(subscription);

    if (liveStatus === 'disabled') {
      return;
    }

    if (!activeEntry?.character && !subscription) {
      liveMessage = '';
      return;
    }

    if (!subscription) {
      liveMessage =
        liveStatus === 'connected'
          ? 'Połączenie live jest aktywne, ale backend pozwala subskrybować tylko własne karty postaci.'
          : 'Subskrypcja live będzie dostępna po nawiązaniu połączenia.';
      return;
    }

    liveMessage =
      liveStatus === 'connected'
        ? ''
      : 'Subskrypcja aktywnej karty zostanie wysłana po nawiązaniu połączenia live.';
  }

  function addDiceRoll(roll: DiceRollResult) {
    if (diceRolls.some((entry) => entry.rollId === roll.rollId)) {
      return;
    }

    diceRolls = [roll, ...diceRolls].slice(0, 20);
  }

  async function handleDiceRollPrepared(roll: DiceRollResult) {
    const shouldHideRoll = Boolean(canManageSession && hideRollFromPlayers);
    const actionResolvedRoll = await resolveActionFlowForRoll(roll);
    const presentation = resolveRollPresentation(actionResolvedRoll);
    const resolvedRoll = {
      ...actionResolvedRoll,
      hidden: shouldHideRoll,
      visibility: shouldHideRoll ? ('gmOnly' as const) : ('public' as const),
      ...presentation
    };
    preparedDiceRolls.set(roll.rollId, resolvedRoll);

    const sent =
      liveSocket?.sendDiceRoll(resolvedRoll, {
        characterId: gmManualRoll ? null : (activeEntry?.character?.characterId ?? null),
        characterName: gmManualRoll ? null : (activeEntry?.character?.name ?? null)
      }) ?? false;

    if (sent) {
      sentDiceRollIds.add(roll.rollId);
    }

    diceMessage = shouldHideRoll
      ? sent
        ? 'Ukryty rzut GM trwa. Backend wyśle go tylko do GM.'
        : 'Ukryty rzut GM trwa lokalnie. Wynik pojawi się tylko w Twoim logu.'
      : sent
        ? 'Rzut trwa. Wynik pojawi się w logu po zakończeniu animacji.'
        : 'Rzut trwa lokalnie. Wynik pojawi się w logu po zakończeniu animacji.';
  }

  async function handleDiceRollComplete(roll: DiceRollResult) {
    const resolvedRoll = preparedDiceRolls.get(roll.rollId) ?? (await resolveActionFlowForRoll(roll));
    preparedDiceRolls.delete(roll.rollId);
    addDiceRoll(resolvedRoll);

    const sent = sentDiceRollIds.has(roll.rollId);
    sentDiceRollIds.delete(roll.rollId);

    diceMessage = resolvedRoll.hidden
      ? sent
        ? 'Ukryty rzut GM został wykonany fizycznie i wysłany do backendu jako gmOnly.'
        : 'Ukryty rzut GM został wykonany fizycznie lokalnie.'
      : sent
        ? 'Rzut wykonany fizycznie i wysłany do kanału live.'
        : 'Rzut wykonany fizycznie lokalnie. Połącz live, aby wysyłać rzuty do sesji.';
  }

  function handleDiceRollReplayComplete(roll: DiceRollResult) {
    addDiceRoll(roll);

    if (diceRollReplay?.rollId === roll.rollId) {
      diceRollReplay = null;
    }

    lastLiveEventAt = new Date().toLocaleTimeString('pl-PL');
    diceMessage = `Zakończono rzut kośćmi od ${roll.userName}.`;
  }

  async function resolveActionFlowForRoll(roll: DiceRollResult): Promise<DiceRollResult> {
    if (canManageSession && gmManualRoll && sessionSystemDefinition?.id === 'vtm') {
      const pool = gmManualPool;
      const hunger = gmManualHunger;
      const dice = markVtmDiceKinds(roll.dice, pool, hunger);
      const result = evaluateVtmDice(dice);

      return {
        ...roll,
        dice,
        mechanics: {
          systemId: 'vtm',
          checkName: formatGmManualCheckName(),
          successes: result.successes,
          criticalPairs: result.criticalPairs,
          messyCritical: result.messyCritical,
          bestialFailure: result.bestialFailure,
          pool,
          hunger,
          status: 'completed'
        }
      };
    }

    if (!activeEntry?.character || !activeAction || !hasCompleteActionInput()) {
      return roll;
    }

    const flowState = await runFlow(activeAction.createFlow(actionInputValues), {
      context: {
        character: activeEntry.character,
        sessionId: session?.sessionId,
        actorUserId: userId
      },
      overrides: {
        roll: roll.total,
        diceValues: roll.dice.map((die) => die.value)
      }
    });
    const decoratedRoll = activeAction.decorateRoll?.(roll, flowState) ?? roll;

    return {
      ...decoratedRoll,
      mechanics: activeAction.resolveMechanics(actionInputValues, decoratedRoll, flowState)
    };
  }

  async function handleLiveEvent(event: CharacterSheetLiveEvent) {
    if (event.type === 'diceRoll.created' && event.diceRoll) {
      const diceRoll = normalizeLiveDiceRoll(event.diceRoll);

      if (!diceRoll) {
        diceMessage = 'Odebrano rzut kośćmi, ale payload miał nieobsługiwany format.';
        return;
      }

      if (diceRoll.userId === userId) {
        return;
      }

      const alreadyVisible = diceRolls.some((entry) => entry.rollId === diceRoll.rollId);

      if (!alreadyVisible) {
        diceRollReplay = diceRoll;
      }

      lastLiveEventAt = new Date().toLocaleTimeString('pl-PL');
      diceMessage = `Odtwarzanie rzutu kośćmi od ${diceRoll.userName}.`;
      return;
    }

    const characterSheet = event.characterSheet;

    if (!characterSheet?.characterId) {
      if (event.message) {
        liveMessage = event.message;
      }
      return;
    }

    lastLiveEventAt = new Date().toLocaleTimeString('pl-PL');

    if (event.type === 'characterSheet.deleted') {
      entries = entries.map((entry) =>
        entry.character?.characterId === characterSheet.characterId ? { ...entry, character: null } : entry
      );
      cancelEditing();
      liveMessage = 'Karta postaci została usunięta.';
      return;
    }

    const refreshedCharacter = await refreshCharacterFromApi(characterSheet);
    const nextCharacter = refreshedCharacter ?? characterSheet;

    entries = entries.map((entry) =>
      entry.character?.characterId === characterSheet.characterId
        ? { ...entry, character: { ...entry.character, ...nextCharacter } }
        : entry
    );
    liveMessage = `Odebrano aktualizację karty o ${lastLiveEventAt}.`;
  }

  function normalizeLiveDiceRoll(payload: BackendDiceRollPayload): DiceRollResult | null {
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : session?.sessionId;
    const userId = typeof payload.userId === 'string' ? payload.userId : '';
    const notation =
      typeof payload.notation === 'string'
        ? payload.notation
        : typeof payload.expression === 'string'
          ? payload.expression
          : typeof payload.label === 'string'
            ? payload.label
            : 'rzut';

    if (!sessionId) {
      return null;
    }

    const dice = normalizeLiveDice(payload);

    if (dice.length === 0) {
      return null;
    }

    const total =
      typeof payload.total === 'number'
        ? payload.total
        : typeof payload.result?.total === 'number'
          ? payload.result.total
          : dice.reduce((sum, die) => sum + die.value, 0);

    return {
      rollId:
        (typeof payload.clientRollId === 'string' && payload.clientRollId) ||
        (typeof payload.rollId === 'string' && payload.rollId) ||
        `${sessionId}-${Date.now()}`,
      sessionId,
      userId,
      userName: resolveDiceRollUserName(payload, userId),
      notation,
      standardNotation: typeof payload.standardNotation === 'string' ? payload.standardNotation : notation,
      animationSeed:
        typeof payload.animationSeed === 'string' && payload.animationSeed
          ? payload.animationSeed
          : undefined,
      total,
      dice,
      mechanics: payload.mechanics ?? payload.result?.mechanics ?? undefined,
      hidden: payload.visibility === 'gmOnly' || payload.hidden === true,
      actorLabel:
        typeof payload.actorLabel === 'string' && payload.actorLabel.trim()
          ? payload.actorLabel.trim()
          : undefined,
      subjectLabel:
        typeof payload.subjectLabel === 'string' && payload.subjectLabel.trim()
          ? payload.subjectLabel.trim()
          : typeof payload.characterName === 'string' && payload.characterName.trim()
          ? payload.characterName.trim()
            : null,
      targetName:
        typeof payload.targetName === 'string' && payload.targetName.trim()
          ? payload.targetName.trim()
          : typeof payload.label === 'string' && payload.label.trim()
            ? payload.label.trim()
            : undefined,
      rollContext:
        payload.rollContext === 'playerCharacter' ||
        payload.rollContext === 'npc' ||
        payload.rollContext === 'generic'
          ? payload.rollContext
          : undefined,
      visibility:
        payload.visibility === 'gmOnly' || payload.visibility === 'public'
          ? payload.visibility
          : undefined,
      createdAt:
        typeof payload.createdAt === 'string' && payload.createdAt
          ? payload.createdAt
          : new Date().toISOString()
    };
  }

  function normalizeLiveDice(payload: BackendDiceRollPayload): DiceRollResult['dice'] {
    if (Array.isArray(payload.dice) && payload.dice.length > 0) {
      return payload.dice
        .filter((die) => Number.isFinite(die.sides) && Number.isFinite(die.value))
        .map((die) => ({
          sides: Number(die.sides),
          value: Number(die.value),
          kind: typeof die.kind === 'string' ? die.kind : undefined,
          color: die.color,
          texture: die.texture,
          parts: die.parts
        }));
    }

    if (!Array.isArray(payload.rolls)) {
      return [];
    }

    const dice: DiceRollResult['dice'] = [];

    for (const roll of payload.rolls) {
      const sides = parseDieSides(roll.die);
      const value = typeof roll.value === 'number' ? roll.value : Number.NaN;

      if (!sides || !Number.isFinite(value)) {
        continue;
      }

      dice.push({
        sides,
        value,
        kind: typeof roll.kind === 'string' ? roll.kind : undefined,
        parts: roll.parts
      });
    }

    return dice;
  }

  function parseDieSides(die: string | undefined) {
    if (!die) {
      return null;
    }

    const match = die.match(/^d(\d+)$/i);
    return match ? Number(match[1]) : null;
  }

  function resolveDiceRollUserName(payload: BackendDiceRollPayload, rollUserId: string) {
    if (typeof payload.characterName === 'string' && payload.characterName.trim()) {
      return payload.characterName.trim();
    }

    if (rollUserId === userId) {
      return currentUserName;
    }

    return entries.find((entry) => entry.participant.userId === rollUserId)?.playerName ?? rollUserId;
  }

  async function refreshCharacterFromApi(characterSheet: CharacterSheetLiveEvent['characterSheet']) {
    if (!session || !characterSheet?.characterId) {
      return null;
    }

    const entry = entries.find((entry) => entry.character?.characterId === characterSheet.characterId);
    const ownerUserId = characterSheet.userId ?? entry?.participant.userId;

    if (!ownerUserId) {
      return null;
    }

    try {
      const response = await getUserCharacters(ownerUserId, {
        limit: 100,
        rpgSystem: session.rpgSystem
      });

      return (
        response.characterSheets.find(
          (character) => character.characterId === characterSheet.characterId
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  function formatJson(value: unknown) {
    return JSON.stringify(value ?? {}, null, 2);
  }

  function selectCharacter(characterId: string) {
    const nextEntry =
      entries.find((entry) => entry.character?.characterId === characterId) ?? entries[0] ?? null;
    activeCharacterId = characterId;
    selectedActionId = '';
    actionInputValues = {};
    cancelEditing();
    updateLiveSubscription(getLiveSubscription(nextEntry));
  }

  function startEditingCharacter() {
    if (!activeEntry?.character) {
      return;
    }

    if (!canManageSession) {
      editorMessage = 'Tylko GM będący właścicielem sesji albo admin może edytować karty postaci w sesji.';
      return;
    }

    if (!activeEntryCanBeEdited) {
      editorMessage =
        'Ta karta ma `sessionId` tej sesji, ale nie występuje w `participants`. Backend nie pozwoli GM na jej edycję, dopóki sesja nie będzie zawierała pary `{ userId, characterId }` w `participants`.';
      return;
    }

    const character = activeEntry.character;
    editName = character.name;
    editOccupation = character.occupation ?? '';
    editAge = character.age === undefined || character.age === null ? '' : String(character.age);
    editHunger =
      (getCharacterSystemDefinitionForCharacter(character) ??
        getCharacterSystemDefinitionByRpgSystem(session?.rpgSystem))?.id === 'vtm'
      ? String(readVtmHunger(character))
      : '';
    editNotes = character.notes ?? '';
    editCharacteristics = formatJson(character.characteristics);
    editSkills = formatJson(character.skills);
    editBackstory = formatJson(character.backstory);
    editInventory = JSON.stringify(character.inventory ?? [], null, 2);
    editorMessage = '';
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
    isSaving = false;
    editorMessage = '';
  }

  function readDisciplinePowers(skills: Record<string, unknown> | undefined) {
    const powers = skills?.DisciplinePowers;

    if (!Array.isArray(powers)) {
      return [];
    }

    return powers
      .map((power) => {
        if (!power || typeof power !== 'object' || Array.isArray(power)) {
          return null;
        }

        const record = power as Record<string, unknown>;

        return {
          discipline: typeof record.discipline === 'string' ? record.discipline : '',
          name: typeof record.name === 'string' ? record.name : '',
          description: typeof record.description === 'string' ? record.description : ''
        };
      })
      .filter((power): power is { discipline: string; name: string; description: string } =>
        Boolean(power)
      );
  }

  function getRemovableDisciplineKeys(skills: Record<string, unknown> | undefined) {
    const disciplineNames = new Set(vtmDisciplineCatalog.map((name) => name.toLowerCase()));

    return Object.keys(skills ?? {}).filter(
      (key) => key !== 'DisciplinePowers' && disciplineNames.has(key.toLowerCase())
    );
  }

  function replaceActiveCharacter(updatedCharacter: CharacterCard) {
    entries = entries.map((entry) =>
      entry.character?.characterId === updatedCharacter.characterId
        ? { ...entry, character: updatedCharacter }
        : entry
    );
    activeCharacterId = updatedCharacter.characterId;
  }

  function clearNewDisciplineForm() {
    newDiscipline = '';
    newDisciplinePowerName = '';
    newDisciplinePowerDescription = '';
  }

  async function addDisciplinePowerToActiveCharacter() {
    if (!activeEntry?.character || !session || !canManageSession) {
      return;
    }

    if (!activeEntryCanBeEdited) {
      editorMessage =
        'Ta karta musi występować w `participants`, aby można było dodać dyscyplinę w sesji.';
      return;
    }

    const discipline = newDiscipline.trim();
    const name = newDisciplinePowerName.trim();
    const description = newDisciplinePowerDescription.trim();

    if (!discipline) {
      editorMessage = 'Wybierz albo wpisz dyscyplinę.';
      return;
    }

    if (!name && !description) {
      editorMessage = 'Podaj nazwę mocy albo opis.';
      return;
    }

    const character = activeEntry.character;
    const skills = { ...(character.skills ?? {}) };
    const disciplinePowers = readDisciplinePowers(character.skills);

    const payload: CharacterUpdatePayload = {
      skills: {
        ...skills,
        DisciplinePowers: [...disciplinePowers, { discipline, name, description }]
      }
    };

    isAddingDiscipline = true;
    editorMessage = '';

    try {
      const updatedCharacter = await updateSessionParticipantCharacter(
        session.sessionId,
        activeEntry.participant.userId,
        character.characterId,
        payload
      );

      replaceActiveCharacter(updatedCharacter);
      clearNewDisciplineForm();
      editorMessage = 'Dyscyplina została dodana do karty gracza.';
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się dodać dyscypliny do karty gracza.';
    } finally {
      isAddingDiscipline = false;
    }
  }

  async function removeDisciplinePowerFromActiveCharacter(index: number) {
    if (!activeEntry?.character || !session || !canManageSession || isRemovingDiscipline) {
      return;
    }

    if (!activeEntryCanBeEdited) {
      editorMessage =
        'Ta karta musi występować w `participants`, aby można było usunąć dyscyplinę w sesji.';
      return;
    }

    const character = activeEntry.character;
    const currentPowers = readDisciplinePowers(character.skills);
    const nextPowers = currentPowers.filter((_, powerIndex) => powerIndex !== index);

    isRemovingDiscipline = true;
    editorMessage = '';

    try {
      const updatedCharacter = await updateSessionParticipantCharacter(
        session.sessionId,
        activeEntry.participant.userId,
        character.characterId,
        {
          skills: {
            ...(character.skills ?? {}),
            DisciplinePowers: nextPowers
          }
        }
      );

      replaceActiveCharacter(updatedCharacter);
      editorMessage = 'Moc dyscypliny została usunięta z karty gracza.';
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się usunąć mocy dyscypliny.';
    } finally {
      isRemovingDiscipline = false;
    }
  }

  async function removeDisciplineSkillFromActiveCharacter(key: string) {
    if (!activeEntry?.character || !session || !canManageSession || isRemovingDiscipline) {
      return;
    }

    if (!activeEntryCanBeEdited) {
      editorMessage =
        'Ta karta musi występować w `participants`, aby można było usunąć dyscyplinę w sesji.';
      return;
    }

    isRemovingDiscipline = true;
    editorMessage = '';

    try {
      const updatedCharacter = await updateSessionParticipantCharacter(
        session.sessionId,
        activeEntry.participant.userId,
        activeEntry.character.characterId,
        { removeSkills: [key] }
      );

      replaceActiveCharacter(updatedCharacter);
      editorMessage = `Dyscyplina "${key}" została usunięta z karty gracza.`;
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się usunąć dyscypliny z karty gracza.';
    } finally {
      isRemovingDiscipline = false;
    }
  }

  function parseJsonField(value: string, label: string) {
    try {
      return value.trim() ? JSON.parse(value) : {};
    } catch {
      throw new Error(`Pole "${label}" musi zawierać poprawny JSON.`);
    }
  }

  function parseRecordField(value: string, label: string) {
    const parsed = parseJsonField(value, label);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Pole "${label}" musi być obiektem JSON.`);
    }

    return parsed as Record<string, unknown>;
  }

  function inputValueToString(value: unknown) {
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  }

  async function saveCharacterChanges() {
    if (!activeEntry?.character || !session || !canManageSession) {
      return;
    }

    const name = inputValueToString(editName).trim();
    if (!name) {
      editorMessage = 'Nazwa postaci jest wymagana.';
      return;
    }

    let payload: CharacterUpdatePayload;

    try {
      const characteristics = parseRecordField(editCharacteristics, 'Cechy');
      const ageText = inputValueToString(editAge).trim();

      if (isActiveVampireSystem) {
        const hungerText = inputValueToString(editHunger).trim();
        const hunger = hungerText ? Number(hungerText) : 0;

        if (!Number.isFinite(hunger) || hunger < 0 || hunger > 5) {
          throw new Error('Głód musi być liczbą w zakresie 0..5.');
        }

        characteristics.hunger = Math.trunc(hunger);
      }

      payload = {
        name,
        occupation: inputValueToString(editOccupation).trim() || null,
        age: ageText ? Number(ageText) : null,
        notes: inputValueToString(editNotes).trim() || null,
        characteristics,
        skills: parseRecordField(editSkills, 'Umiejętności'),
        backstory: parseRecordField(editBackstory, 'Historia'),
        inventory: parseJsonField(editInventory, 'Ekwipunek')
      };
    } catch (error) {
      editorMessage = error instanceof Error ? error.message : 'Formularz zawiera nieprawidłowe dane.';
      return;
    }

    if (
      payload.age !== undefined &&
      payload.age !== null &&
      (!Number.isFinite(payload.age) || payload.age < 0)
    ) {
      editorMessage = 'Wiek musi być liczbą większą lub równą 0.';
      return;
    }

    isSaving = true;
    editorMessage = '';

    try {
      if (!activeEntryCanBeEdited) {
        throw new Error(
          'Ta karta ma `sessionId` tej sesji, ale nie występuje w `participants`. Backend nie pozwoli GM na jej edycję, dopóki sesja nie będzie zawierała pary `{ userId, characterId }` w `participants`.'
        );
      }

      const updatedCharacter = await updateSessionParticipantCharacter(
        session.sessionId,
        activeEntry.participant.userId,
        activeEntry.character.characterId,
        payload
      );

      entries = entries.map((entry) =>
        entry.character?.characterId === updatedCharacter.characterId
          ? { ...entry, character: updatedCharacter }
          : entry
      );
      activeCharacterId = updatedCharacter.characterId;
      isEditing = false;
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się zapisać zmian w karcie postaci.';
    } finally {
      isSaving = false;
    }
  }

  async function deleteCurrentSession() {
    if (!session || isDeleting || !isOwner) {
      return;
    }

    const confirmed = confirm(
      `Usunąć sesję "${formatRpgSessionName(session)}"? Tej operacji nie można cofnąć.`
    );

    if (!confirmed) {
      return;
    }

    isDeleting = true;
    errorMessage = '';

    try {
      disconnectLiveSession();
      await deleteRpgSession(session.sessionId);
      goto('/sessions');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Nie udało się usunąć sesji RPG.';
      connectLiveSession();
      updateLiveSubscription();
    } finally {
      isDeleting = false;
    }
  }

  async function loadPlayerNames(
    session: RpgSession,
    participants: RpgSessionParticipant[],
    canReadAllPlayers: boolean
  ) {
    if (!canReadAllPlayers) {
      return Object.fromEntries(
        participants.map((participant) => [
          participant.userId,
          participant.userId === userId ? currentUserName : 'Gracz'
        ])
      );
    }

    const wantedUserIds = new Set([
      ...session.playerUserIds,
      ...participants.map((participant) => participant.userId)
    ]);

    if (wantedUserIds.size === 0) {
      return {};
    }

    const usersById: Record<string, string> = {};
    let cursor: string | null = null;

    do {
      const response = await getUsers({ limit: 100, cursor });
      response.users.forEach((user) => {
        if (wantedUserIds.has(user.userId)) {
          usersById[user.userId] = formatUserName(user);
        }
      });
      cursor = response.nextCursor;
    } while (cursor && Object.keys(usersById).length < wantedUserIds.size);

    return usersById;
  }

  async function loadSessionCharacters(session: RpgSession, visibleUserId: string | null) {
    const participants = await loadSessionParticipants(session, visibleUserId);

    if (participants.length === 0) {
      return [];
    }

    const playerNames = await loadPlayerNames(session, participants, !visibleUserId);

    return Promise.all(
      participants.map(async (participant) => {
        try {
          const response = await getUserCharacters(participant.userId, {
            limit: 100,
            rpgSystem: session.rpgSystem
          });
          const character =
            response.characterSheets.find((entry) => entry.characterId === participant.characterId) ??
            null;

          return {
            participant,
            playerName: playerNames[participant.userId] ?? 'Gracz niedostępny',
            character
          };
        } catch {
          return {
            participant,
            playerName: playerNames[participant.userId] ?? 'Gracz niedostępny',
            character: null
          };
        }
      })
    );
  }

  async function loadSessionParticipants(session: RpgSession, visibleUserId: string | null) {
    const participants = session.participants ?? [];

    if (participants.length > 0) {
      return visibleUserId
        ? participants.filter((participant) => participant.userId === visibleUserId)
        : participants;
    }

    if (session.playerUserIds.length === 0) {
      return [];
    }

    const playerUserIds = visibleUserId
      ? session.playerUserIds.filter((playerUserId) => playerUserId === visibleUserId)
      : session.playerUserIds;

    const entries = await Promise.all(
      playerUserIds.map(async (playerUserId) => {
        try {
          const response = await getUserCharacters(playerUserId, {
            limit: 100,
            rpgSystem: session.rpgSystem
          });

          return response.characterSheets
            .filter((character) => character.sessionId === session.sessionId)
            .map((character) => ({
              userId: playerUserId,
              characterId: character.characterId
            }));
        } catch {
          return [];
        }
      })
    );

    return entries.flat();
  }
</script>

<svelte:head>
  <title>{session ? formatRpgSessionName(session) : 'Prowadzenie sesji'} | Call of Cthulhu RPG</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-7xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm text-muted-foreground">{canManageSession ? 'Prowadzenie sesji' : 'Sesja RPG'}</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal">
          {session ? formatRpgSessionName(session) : 'Wczytywanie...'}
        </h1>
        {#if session}
          <p class="mt-2 text-sm text-muted-foreground">{session.rpgSystem}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        {#if session}
          <Button type="button" variant="outline" onclick={openSessionDetails}>
            Szczegóły
          </Button>
        {/if}
        <Button type="button" variant="outline" onclick={openSessionsList}>Sesje</Button>
        {#if session && isOwner}
          <Button
            type="button"
            variant="outline"
            class="border-destructive/50 text-destructive hover:bg-destructive/10"
            disabled={isDeleting}
            onclick={deleteCurrentSession}
          >
            {isDeleting ? 'Usuwanie...' : 'Usuń sesję'}
          </Button>
        {/if}
      </div>
    </div>

    {#if session}
    <!-- karta info o sesion live nie usuwać -->


      <!-- <Card class="border-border/80 bg-card/95">
        <CardContent class="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-medium">{formatLiveStatus(liveStatus)}</p>
            {#if liveMessage}
              <p class="mt-1 text-muted-foreground">{liveMessage}</p>
              {#if lastLiveEventAt}
                <p class="mt-1 text-xs text-muted-foreground">
                  Ostatni event live: {lastLiveEventAt}
                </p>
              {/if}
            {:else if activeLiveSubscription}
              <p class="mt-1 text-muted-foreground">Subskrypcja aktywnej karty jest gotowa.</p>
              {#if lastLiveEventAt}
                <p class="mt-1 text-xs text-muted-foreground">
                  Ostatni event live: {lastLiveEventAt}
                </p>
              {/if}
            {:else}
              <p class="mt-1 text-muted-foreground">
                {canManageSession
                  ? 'GM widzi karty graczy przez HTTP. Live eventy są subskrybowane przez właściciela karty.'
                  : 'Widok używa HTTP jako źródła prawdy i subskrybuje live eventy Twojej karty.'}
              </p>
            {/if}
          </div>

          {#if liveSocketActive}
            <Button type="button" variant="outline" onclick={disconnectLiveSession}>
              {liveStatus === 'connecting' ? 'Przerwij łączenie' : 'Rozłącz live'}
            </Button>
          {:else}
            <Button type="button" variant="outline" onclick={reconnectLiveSession}>
              Połącz live
            </Button>
          {/if}
        </CardContent>
      </Card> -->

      <Card class="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Rzuty kośćmi</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          {#if canManageSession}
            <label class="flex items-start gap-3 rounded-md border bg-background/40 px-3 py-2 text-sm">
              <input
                class="mt-1"
                type="checkbox"
                bind:checked={gmManualRoll}
                disabled={sessionSystemDefinition?.id !== 'vtm'}
              />
              <span>
                <span class="block font-medium">Rzut GM bez karty postaci</span>
                <span class="mt-1 block text-xs text-muted-foreground">
                  Użyj ręcznych wartości dla przeciwnika albo NPC. Dostępne dla sesji Wampira.
                </span>
              </span>
            </label>
          {/if}

          {#if canManageSession && gmManualRoll && sessionSystemDefinition?.id === 'vtm'}
            <div class="rounded-md border bg-background/40 p-4">
              <div class="grid gap-3 md:grid-cols-6">
                <div class="space-y-2 md:col-span-6">
                  <Label for="gm-manual-check-name">Nazwa rzutu</Label>
                  <Input
                    id="gm-manual-check-name"
                    bind:value={gmManualCheckName}
                    placeholder={`${gmManualAttributeName} + ${gmManualAbilityName}`}
                  />
                </div>
                <div class="space-y-2 md:col-span-2">
                  <Label for="gm-manual-attribute-name">Atrybut</Label>
                  <select
                    id="gm-manual-attribute-name"
                    class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    bind:value={gmManualAttributeName}
                  >
                    {#each gmManualAttributeOptions as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                </div>
                <div class="space-y-2">
                  <Label for="gm-manual-attribute-value">Poziom</Label>
                  <Input
                    id="gm-manual-attribute-value"
                    type="number"
                    min="0"
                    max="5"
                    bind:value={gmManualAttributeValue}
                  />
                </div>
                <div class="space-y-2 md:col-span-2">
                  <Label for="gm-manual-ability-name">Zdolność</Label>
                  <select
                    id="gm-manual-ability-name"
                    class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    bind:value={gmManualAbilityName}
                  >
                    {#each gmManualAbilityOptions as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                </div>
                <div class="space-y-2">
                  <Label for="gm-manual-ability-value">Poziom</Label>
                  <Input
                    id="gm-manual-ability-value"
                    type="number"
                    min="0"
                    max="5"
                    bind:value={gmManualAbilityValue}
                  />
                </div>
                <div class="space-y-2">
                  <Label for="gm-manual-hunger">Głód</Label>
                  <Input
                    id="gm-manual-hunger"
                    type="number"
                    min="0"
                    max="5"
                    bind:value={gmManualHungerValue}
                  />
                </div>
                <div class="flex items-end text-sm text-muted-foreground md:col-span-5">
                  {gmManualAttributeName} {readManualRating(gmManualAttributeValue)} +
                  {gmManualAbilityName} {readManualRating(gmManualAbilityValue)} = pula {gmManualPool}
                  kości. Głód: {gmManualHunger}.
                </div>
              </div>
            </div>
          {:else}
            <CharacterActionPanel
              character={activeEntry?.character}
              fallbackRpgSystem={session.rpgSystem}
              {selectedActionId}
              inputValues={actionInputValues}
              onActionChange={selectAction}
              onInputChange={updateActionInput}
            />
          {/if}

          {#if canManageSession}
            <label class="flex items-start gap-3 rounded-md border bg-background/40 px-3 py-2 text-sm">
              <input
                class="mt-1"
                type="checkbox"
                bind:checked={hideRollFromPlayers}
              />
              <span>
                <span class="block font-medium">Ukryj rzut przed graczami</span>
                <span class="mt-1 block text-xs text-muted-foreground">
                  Rzut zostanie wykonany i zapisany tylko w lokalnym logu GM. Nie trafi do WebSocket live.
                </span>
              </span>
            </label>
          {/if}
          <div class="flex justify-center">
            <DiceBoxRoller
            sessionId={session.sessionId}
            {userId}
            userName={currentUserName}
            disabled={!session || actionBlocksRoll}
            notationPreset={activeNotationPreset}
            replayRoll={diceRollReplay}
            onMessage={(message) => (diceMessage = message)}
            onRollPrepared={handleDiceRollPrepared}
            onRollComplete={handleDiceRollComplete}
            onReplayComplete={handleDiceRollReplayComplete}
          />
          </div>
         

          <Accordion.Root type="single" value="dice-log">
            <Accordion.Item value="dice-log" class="overflow-hidden rounded-md border bg-background/40">
              <Accordion.Header>
                <Accordion.Trigger
                  class="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50"
                >
                  <span class="font-medium">Log rzutów ({diceRolls.length})</span>
                  <span
                    class="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                  >
                    v
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content class="border-t p-3">
                {#if diceRolls.length === 0}
                  <p class="text-sm text-muted-foreground">Brak rzutów w tej sesji.</p>
                {:else}
                  <div class="max-h-96 space-y-2 overflow-y-auto pr-2">
                    {#each diceRolls as roll (roll.rollId)}
                      <div class="rounded-md border bg-background/40 px-3 py-2 text-sm">
                        <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p class="font-medium">
                              {formatRollLogTitle(roll)}
                              {#if roll.hidden}
                                <span class="ml-2 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                  ukryty
                                </span>
                              {/if}
                            </p>
                            {#if formatDiceMechanics(roll)}
                              <p class="mt-1 font-medium text-primary">{formatDiceMechanics(roll)}</p>
                            {/if}
                          </div>
                          <div class="text-left sm:text-right">
                            {#if shouldShowRollTotal(roll)}
                              <p class="text-lg font-semibold">{roll.total}</p>
                            {/if}
                            <p class="text-xs text-muted-foreground">
                              {new Date(roll.createdAt).toLocaleTimeString('pl-PL')}
                            </p>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </CardContent>
      </Card>
    {/if}

    {#if isLoading}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Pobieranie kart postaci uczestników...</p>
        </CardContent>
      </Card>
    {:else if errorMessage}
      <Card class="border-destructive/40 bg-destructive/10">
        <CardContent class="p-6">
          <p class="text-sm text-destructive-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    {:else if session}
      {#if entries.length === 0}
        <Card class="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Brak postaci w sesji</CardTitle>
            <CardDescription>
              Ta sesja nie ma jeszcze uczestników z przypisanymi kartami postaci.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onclick={openSessionDetails}>
              Wróć do szczegółów
            </Button>
          </CardContent>
        </Card>
      {:else}
        <div class={canManageSession ? 'grid gap-6 lg:grid-cols-[20rem_1fr]' : 'space-y-6'}>
          {#if canManageSession}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Uczestnicy</CardTitle>
                <CardDescription>
                  Wybierz postać, której kartę chcesz podejrzeć.
                </CardDescription>
              </CardHeader>

              <CardContent class="space-y-2">
                {#each entries as entry}
                  <button
                    class={[
                      'w-full rounded-md border px-3 py-3 text-left text-sm transition-colors',
                      entry.character?.characterId === activeEntry?.character?.characterId
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border/80 bg-background/40 hover:bg-muted'
                    ]}
                    type="button"
                    disabled={!entry.character}
                    onclick={() => selectCharacter(entry.character?.characterId ?? '')}
                  >
                    <span class="block font-medium">{entry.playerName}</span>
                    <span class="mt-1 block text-muted-foreground">
                      {entry.character?.name ?? 'Postać niedostępna'}
                    </span>
                  </button>
                {/each}
              </CardContent>
            </Card>
          {/if}

          <div class="space-y-6">
            {#if activeEntry?.character && activeSheet}
              {#if editorMessage && !isEditing}
                <div class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                  {editorMessage}
                </div>
              {/if}

              {#if canManageSession}
                <div class="flex justify-end">
                  <Button
                    type="button"
                    disabled={isEditing || !activeEntryCanBeEdited}
                    onclick={startEditingCharacter}
                  >
                    Edytuj kartę
                  </Button>
                </div>
              {/if}

              {#if canManageSession && !activeEntryCanBeEdited}
                <div class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                  Ta karta jest przypisana przez `sessionId`, ale nie ma jej w `participants`
                  sesji. Nowy endpoint edycji GM wymaga wpisu `userId + characterId` w
                  `participants`.
                </div>
              {/if}

              {#if canManageSession && activeEntryCanBeEdited && isActiveVampireSystem}
                <Card class="border-border/80 bg-card/95">
                  <CardHeader>
                    <CardTitle>Dodaj dyscyplinę graczowi</CardTitle>
                    <CardDescription>
                      Dopisz moc dyscypliny do aktywnej karty postaci w tej sesji.
                    </CardDescription>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    {#if activeRemovableDisciplineKeys.length || activeDisciplinePowers.length}
                      <div class="rounded-md border bg-background/40 p-4">
                        <p class="text-sm font-medium">Aktualne dyscypliny</p>

                        {#if activeRemovableDisciplineKeys.length}
                          <div class="mt-3 flex flex-wrap gap-2">
                            {#each activeRemovableDisciplineKeys as key}
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isAddingDiscipline || isRemovingDiscipline}
                                onclick={() => removeDisciplineSkillFromActiveCharacter(key)}
                              >
                                Usuń {key}
                              </Button>
                            {/each}
                          </div>
                        {/if}

                        {#if activeDisciplinePowers.length}
                          <div class="mt-3 space-y-2">
                            {#each activeDisciplinePowers as power, index}
                              <div class="flex flex-col gap-2 rounded-md border bg-background/40 px-3 py-2 text-sm sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p class="font-medium">
                                    {power.discipline || 'Dyscyplina'}{power.name ? `: ${power.name}` : ''}
                                  </p>
                                  {#if power.description}
                                    <p class="mt-1 text-muted-foreground">{power.description}</p>
                                  {/if}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isAddingDiscipline || isRemovingDiscipline}
                                  onclick={() => removeDisciplinePowerFromActiveCharacter(index)}
                                >
                                  Usuń
                                </Button>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}

                    <div class="grid gap-4 md:grid-cols-[0.8fr_0.9fr_1.3fr]">
                      <div class="space-y-2">
                        <Label for="session-discipline">Dyscyplina</Label>
                        <Input
                          id="session-discipline"
                          list="session-vtm-discipline-options"
                          bind:value={newDiscipline}
                          disabled={isAddingDiscipline || isRemovingDiscipline}
                          placeholder="Animalizm"
                        />
                      </div>

                      <div class="space-y-2">
                        <Label for="session-discipline-power-name">Nazwa mocy</Label>
                        <Input
                          id="session-discipline-power-name"
                          bind:value={newDisciplinePowerName}
                          disabled={isAddingDiscipline || isRemovingDiscipline}
                          placeholder="np. Szepty bestii"
                        />
                      </div>

                      <div class="space-y-2">
                        <Label for="session-discipline-power-description">Opis</Label>
                        <Textarea
                          id="session-discipline-power-description"
                          bind:value={newDisciplinePowerDescription}
                          disabled={isAddingDiscipline || isRemovingDiscipline}
                          placeholder="Efekt, koszt, pula rzutu albo ograniczenia użycia."
                        />
                      </div>
                    </div>

                    <div class="flex justify-end">
                      <Button
                        type="button"
                        disabled={isAddingDiscipline || isRemovingDiscipline}
                        onclick={addDisciplinePowerToActiveCharacter}
                      >
                        {isAddingDiscipline ? 'Dodawanie...' : 'Dodaj dyscyplinę'}
                      </Button>
                    </div>

                    <datalist id="session-vtm-discipline-options">
                      {#each vtmDisciplineCatalog as option}
                        <option value={option}></option>
                      {/each}
                    </datalist>
                  </CardContent>
                </Card>
              {/if}

              {#if isEditing}
                <Card class="border-border/80 bg-card/95">
                  <CardHeader>
                    <CardTitle>Edycja karty</CardTitle>
                    <CardDescription>
                      Zmiany zostaną zapisane na karcie gracza przypisanej do tej sesji.
                    </CardDescription>
                  </CardHeader>

                  <CardContent class="space-y-5">
                    {#if editorMessage}
                      <div class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                        {editorMessage}
                      </div>
                    {/if}

                    <div class="grid gap-4 md:grid-cols-3">
                      <div class="space-y-2 md:col-span-2">
                        <Label for="character-name">Nazwa postaci</Label>
                        <Input id="character-name" bind:value={editName} disabled={isSaving} />
                      </div>

                      <div class="space-y-2">
                        <Label for="character-age">Wiek</Label>
                        <Input
                          id="character-age"
                          type="number"
                          min="0"
                          bind:value={editAge}
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <div class="space-y-2">
                      <Label for="character-occupation">Profesja / rola</Label>
                      <Input
                        id="character-occupation"
                        bind:value={editOccupation}
                        disabled={isSaving}
                      />
                    </div>

                    {#if activeEntry?.character && isActiveVampireSystem}
                      <div class="space-y-2">
                        <Label for="character-hunger">Głód</Label>
                        <Input
                          id="character-hunger"
                          type="number"
                          min="0"
                          max="5"
                          bind:value={editHunger}
                          disabled={isSaving}
                        />
                      </div>
                    {/if}

                    <div class="space-y-2">
                      <Label for="character-notes">Notatki</Label>
                      <Textarea id="character-notes" bind:value={editNotes} disabled={isSaving} />
                    </div>

                    <div class="grid gap-4 lg:grid-cols-2">
                      <div class="space-y-2">
                        <Label for="character-characteristics">Cechy JSON</Label>
                        <Textarea
                          id="character-characteristics"
                          class="min-h-56 font-mono text-xs"
                          bind:value={editCharacteristics}
                          disabled={isSaving}
                        />
                      </div>

                      <div class="space-y-2">
                        <Label for="character-skills">Umiejętności JSON</Label>
                        <Textarea
                          id="character-skills"
                          class="min-h-56 font-mono text-xs"
                          bind:value={editSkills}
                          disabled={isSaving}
                        />
                      </div>

                      <div class="space-y-2">
                        <Label for="character-backstory">Historia JSON</Label>
                        <Textarea
                          id="character-backstory"
                          class="min-h-56 font-mono text-xs"
                          bind:value={editBackstory}
                          disabled={isSaving}
                        />
                      </div>

                      <div class="space-y-2">
                        <Label for="character-inventory">Ekwipunek JSON</Label>
                        <Textarea
                          id="character-inventory"
                          class="min-h-56 font-mono text-xs"
                          bind:value={editInventory}
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <div class="flex justify-end gap-2">
                      <Button type="button" variant="ghost" disabled={isSaving} onclick={cancelEditing}>
                        Anuluj
                      </Button>
                      <Button type="button" disabled={isSaving} onclick={saveCharacterChanges}>
                        {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              {:else}
                <DataDrivenCharacterSheet sheet={activeSheet} />
              {/if}
            {:else if activeEntry?.character}
              <Card class="border-border/80 bg-card/95">
                <CardHeader>
                  <CardTitle>{activeEntry.character.name}</CardTitle>
                  <CardDescription>
                    Brak data-driven definicji karty dla systemu {activeEntry.character.rpgSystem ?? session.rpgSystem}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre class="overflow-auto rounded-md border bg-background/40 p-4 text-xs">{JSON.stringify(activeEntry.character, null, 2)}</pre>
                </CardContent>
              </Card>
            {:else}
              <Card class="border-border/80 bg-card/95">
                <CardHeader>
                  <CardTitle>Postać niedostępna</CardTitle>
                  <CardDescription>
                    Backend zwrócił uczestnika, ale nie udało się pobrać jego karty postaci.
                  </CardDescription>
                </CardHeader>
              </Card>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </section>
</main>
