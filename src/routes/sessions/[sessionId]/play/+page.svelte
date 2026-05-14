<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import { Dialog } from 'bits-ui';
  import { Settings } from 'lucide-svelte';
  import CharacterSheetSectionView from '$lib/components/character-sheet/CharacterSheetSectionView.svelte';
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
  import { Spinner } from '$lib/components/ui/spinner';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    buildCharacterUpdatePayload,
    CharacterEditForm,
    createCharacterEditDraft,
    type CharacterEditDraft
  } from '$lib/features/character-edit';
  import SessionTableCanvas from '$lib/features/session-stage/components/SessionTableCanvas.svelte';
  import type { SessionTableParticipant } from '$lib/features/session-stage/components/SessionTableCanvas.svelte';
  import {
    buildSessionToolboxResourcePayload,
    buildSessionToolboxResources,
    GmOnlyLiveSessionToolbox,
    type SessionToolboxCharacterSummary,
    type SessionToolboxResourceChange
  } from '$lib/features/session-tools';
  import {
    createSessionAssetUploadUrl,
    deleteSessionAsset,
    getSessionAssets,
    getSessionMaps,
    moveSessionMapToken,
    SessionMapPanel,
    uploadMapAssetToS3,
    type MapDimensions,
    type MapPosition,
    type SessionAsset,
    type SessionMap,
    type SessionMapToken
  } from '$lib/features/maps';
  import { runFlow } from '$lib/modules/action-flow/engine';
  import {
    evaluateVtmDice,
    markVtmDiceKinds
  } from '$lib/modules/action-flow/rules/vtm-rules';
  import { getCurrentUser } from '$lib/modules/AuthModule/user';
  import { hasRole } from '$lib/modules/AuthModule/roles';
  import { vtmDisciplineCatalog } from '$lib/modules/charactersModule/character-builder';
  import {
    vtmAbilityGroups,
    vtmAttributeGroups
  } from '$lib/modules/charactersModule/character-builder/data';
  import {
    buildActionCheckOptions,
    buildVtmAbilityOptions,
    buildVtmAttributeOptions,
    readCharacterNumber,
    readVtmHunger
  } from '$lib/features/action-flow/ui-adapters/check-options';
  import { buildVtmNotation } from '$lib/modules/charactersModule/systems/action-values';
  import {
    deleteSessionParticipantCharacterAvatar,
    getUserCharacters,
    updateCharacter,
    updateSessionParticipantCharacter,
    uploadSessionParticipantCharacterAvatar,
    type CharacterAvatarUploadPayload,
    type CharacterCard,
    type CharacterUpdatePayload
  } from '$lib/modules/characters';
  import {
    serializeCharacterNotes,
    type CharacterNote
  } from '$lib/modules/charactersModule/notes';
  import {
    formatDiceMechanics,
    formatDiceRollTotal,
    type DiceRollResult
  } from '$lib/modules/dice-roller';
  import { resolveCharacterSheet } from '$lib/modules/charactersModule/character-sheet';
  import type { ResolvedCharacterSheetSection } from '$lib/modules/charactersModule/character-sheet/types';
  import {
    getCharacterSystemDefinitionByRpgSystem,
    getCharacterSystemDefinitionForCharacter,
    type CharacterActionInputDefinition,
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
  import { getUsers } from '$lib/modules/users/users';
  import type { AppUser } from '$lib/modules/users/userType';

  type SessionCharacterEntry = {
    participant: RpgSessionParticipant;
    playerName: string;
    character: CharacterCard | null;
  };

  type SessionStageMode = 'table' | 'map';
  type SessionStageTransitionDirection = 'left' | 'right';

  const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
  const maxAvatarBytes = 2 * 1024 * 1024;

  let session = $state<RpgSession | null>(null);
  let entries = $state<SessionCharacterEntry[]>([]);
  let tableEntries = $state<SessionCharacterEntry[]>([]);
  let activeCharacterId = $state('');
  let isLoading = $state(true);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let isSavingNotes = $state(false);
  let isDeleting = $state(false);
  let errorMessage = $state('');
  let editorMessage = $state('');
  let liveMessage = $state('');
  let liveStatus = $state<CharacterSheetLiveStatus>('disabled');
  let liveSocketActive = $state(false);
  let lastLiveEventAt = $state('');
  let stageMode = $state<SessionStageMode>('table');
  let stageTransitionDirection = $state<SessionStageTransitionDirection>('left');
  let isTableBackgroundOpen = $state(false);
  let tableBackgroundAssets = $state<SessionAsset[]>([]);
  let selectedTableBackgroundAsset = $state<SessionAsset | null>(null);
  let selectedTableBackgroundFile = $state<File | null>(null);
  let tableBackgroundName = $state('');
  let isLoadingTableBackgrounds = $state(false);
  let isUploadingTableBackground = $state(false);
  let deletingTableBackgroundAssetIds = $state<string[]>([]);
  let loadedTableBackgroundSessionId = $state('');
  let tableBackgroundMessage = $state('');
  let tableBackgroundLoadRequestId = 0;
  let userId = $state('');
  let currentUserName = $state('Gracz');
  let editDraft = $state<CharacterEditDraft | null>(null);
  let isUploadingAvatar = $state(false);
  let isDeletingAvatar = $state(false);
  let avatarMessage = $state('');
  let isAdminUser = $state(false);
  let newDiscipline = $state('');
  let newDisciplinePowerName = $state('');
  let newDisciplinePowerDescription = $state('');
  let isAddingDiscipline = $state(false);
  let isRemovingDiscipline = $state(false);
  let diceMessage = $state('');
  let diceRolls = $state<DiceRollResult[]>([]);
  let diceRollReplay = $state<DiceRollResult | null>(null);
  let activeCharacterOverlaySectionId = $state('');
  // Mapa ma własny stan sesji, bo jej cykl życia nie powinien zależeć od wyboru aktywnej karty postaci.
  let sessionMap = $state<SessionMap | null>(null);
  let localMapTokenPositions = $state<Record<string, MapPosition>>({});
  let remoteMapTokenPositions = $state<Record<string, MapPosition>>({});
  let selectedActionId = $state('');
  let shouldAutoSelectAction = $state(true);
  let actionInputValues = $state<CharacterActionInputValues>({});
  let focusedRollInputId = $state('');
  let hideRollFromPlayers = $state(false);
  let isRollSettingsOpen = $state(false);
  let isRollLogOpen = $state(false);
  let savingToolboxResourceKey = $state('');
  let gmManualRoll = $state(false);
  let gmManualCheckName = $state('Rzut przeciwnika');
  let gmManualAttributeName = $state('Siła');
  let gmManualAttributeValue = $state('3');
  let gmManualAbilityName = $state('Bijatyka');
  let gmManualAbilityValue = $state('2');
  let gmManualHungerValue = $state('0');
  let liveSocket: CharacterSheetLiveSocket | null = null;
  let sessionMapDiscoveryTimer: ReturnType<typeof setInterval> | null = null;
  let isDiscoveringSessionMap = false;
  const preparedDiceRolls = new Map<string, DiceRollResult>();
  const sentDiceRollIds = new Set<string>();
  const activeMapMoveIds = new Map<string, string>();
  const sentMapMoveIds = new Set<string>();
  const lastMapDragPreviewAt = new Map<string, number>();
  const mapDragPreviewIntervalMs = 50;
  const genericRollNotations = ['1d20', '1d100', '2d10', '3d6', '4d6', '1d10'];
  const tableBackgroundLabelPrefix = '__table_background__:';
  let genericRollNotation = $state('1d20');
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
  const activeCharacterOverlaySection = $derived(
    activeSheet?.sections.find((section) => section.id === activeCharacterOverlaySectionId) ?? null
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
  const activeNotationPreset = $derived(
    gmManualRoll
      ? canManageSession
        ? gmManualNotation
        : genericRollNotation
      : activeAction
        ? actionNotationPreset
        : genericRollNotation
  );
  const actionBlocksRoll = $derived(
    gmManualRoll
      ? Boolean(canManageSession && sessionSystemDefinition?.id === 'vtm' && !gmManualNotation)
      : Boolean(activeAction && !actionNotationPreset)
  );
  const lastDiceRoll = $derived(diceRolls[0] ?? null);
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
  const activeEntryNotesCanBeEdited = $derived(
    Boolean(
      activeEntry?.character &&
        (activeEntryCanBeEdited || activeEntry.participant.userId === userId)
    )
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
  const mapTokenOwnerOptions = $derived(
    entries
      .map((entry) => ({
        userId: entry.participant.userId,
        label: entry.character
          ? `${entry.playerName} · ${entry.character.name}`
          : entry.playerName,
        characterId: entry.character?.characterId ?? entry.participant.characterId ?? null
      }))
      .filter((option, index, options) =>
        options.findIndex((entry) => entry.userId === option.userId) === index
      )
  );
  const tableBackgroundLabel = $derived(
    selectedTableBackgroundAsset
      ? tableBackgroundAssetLabel(selectedTableBackgroundAsset)
      : 'Tło stołu'
  );
  const selectedTableBackgroundUrl = $derived(
    selectedTableBackgroundAsset && isTableBackgroundAsset(selectedTableBackgroundAsset)
      ? selectedTableBackgroundAsset.url
      : null
  );
  const selectedTableBackgroundAlt = $derived(
    selectedTableBackgroundAsset?.label ??
      selectedTableBackgroundAsset?.fileName?.replace(/\.[^.]+$/, '') ??
      'Tło stołu'
  );
  const tableParticipants = $derived<SessionTableParticipant[]>(
    tableEntries.map((entry) => ({
      participantId: `${entry.participant.userId}:${entry.participant.characterId}`,
      label: entry.character?.name ?? entry.playerName,
      subtitle: entry.character ? entry.playerName : 'Postać niedostępna',
      avatarUrl: entry.character?.avatarUrl ?? null,
      isActive: entry.character?.characterId === activeEntry?.character?.characterId
    }))
  );
  const toolboxCharacters = $derived<SessionToolboxCharacterSummary[]>(
    entries.flatMap((entry) =>
      entry.character
        ? [
            {
              characterId: entry.character.characterId,
              userId: entry.participant.userId,
              characterName: entry.character.name,
              playerName: entry.playerName,
              systemId: entry.character.rpgSystem ?? session?.rpgSystem,
              resources: buildSessionToolboxResources(entry.character),
              canEdit: canEditToolboxCharacter(entry)
            }
          ]
        : []
    )
  );

  $effect(() => {
    if (
      gmManualRoll ||
      selectedActionId ||
      !shouldAutoSelectAction ||
      !activeSystemDefinition?.actions.checks.length
    ) {
      return;
    }

    selectedActionId = activeSystemDefinition.actions.checks[0].id;
    shouldAutoSelectAction = false;
    actionInputValues = {};
  });

  $effect(() => {
    if (!session?.sessionId || loadedTableBackgroundSessionId === session.sessionId) {
      return;
    }

    loadedTableBackgroundSessionId = session.sessionId;
    void loadTableBackgroundAssets();
  });

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
      const loadedTableEntries = ownerAccess
        ? loadedEntries
        : await loadSessionCharacters(loadedSession, null, false);
      const loadedMap = await loadFirstSessionMap(loadedSession.sessionId);
      const firstVisibleEntry = loadedEntries.find((entry) => entry.character) ?? loadedEntries[0] ?? null;

      session = loadedSession;
      entries = loadedEntries;
      tableEntries = loadedTableEntries.length ? loadedTableEntries : loadedEntries;
      activeCharacterId = firstVisibleEntry?.character?.characterId ?? '';

      if (loadedMap) {
        setActiveSessionMap(loadedMap);
      } else {
        startSessionMapDiscovery(loadedSession.sessionId);
      }

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
    stopSessionMapDiscovery();
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

  function setStageMode(nextStageMode: SessionStageMode) {
    if (stageMode === nextStageMode) {
      return;
    }

    stageTransitionDirection = nextStageMode === 'map' ? 'left' : 'right';
    stageMode = nextStageMode;
  }

  function addTokenToSessionMap(token: SessionMapToken) {
    if (!sessionMap) {
      return;
    }

    sessionMap = {
      ...sessionMap,
      tokens: [...sessionMap.tokens.filter((entry) => entry.tokenId !== token.tokenId), token],
      updatedAt: token.updatedAt ?? sessionMap.updatedAt,
      version: readNextSessionMapVersion(token.version)
    };
  }

  function setActiveSessionMap(map: SessionMap | null) {
    sessionMap = map;
    localMapTokenPositions = {};
    remoteMapTokenPositions = {};
    updateMapSubscription(map);

    if (map) {
      stopSessionMapDiscovery();
    } else if (session) {
      startSessionMapDiscovery(session.sessionId);
    }
  }

  function clearActiveSessionMap(mapId: string) {
    if (!sessionMap || sessionMap.mapId !== mapId) {
      return;
    }

    setActiveSessionMap(null);
  }

  async function loadFirstSessionMap(targetSessionId: string) {
    const response = await getSessionMaps(targetSessionId, { limit: 1 });
    return response.maps[0] ?? null;
  }

  function startSessionMapDiscovery(targetSessionId: string) {
    if (sessionMapDiscoveryTimer) {
      return;
    }

    // Backend publikuje zdarzenia do subskrybentów mapy, więc klient bez mapId
    // musi okresowo sprawdzić listę map, żeby dołączyć do właściwego kanału live.
    sessionMapDiscoveryTimer = setInterval(() => {
      void discoverSessionMap(targetSessionId);
    }, 5000);
  }

  function stopSessionMapDiscovery() {
    if (!sessionMapDiscoveryTimer) {
      return;
    }

    clearInterval(sessionMapDiscoveryTimer);
    sessionMapDiscoveryTimer = null;
  }

  async function discoverSessionMap(targetSessionId: string) {
    if (sessionMap || isDiscoveringSessionMap) {
      return;
    }

    isDiscoveringSessionMap = true;

    try {
      const discoveredMap = await loadFirstSessionMap(targetSessionId);

      if (discoveredMap) {
        setActiveSessionMap(discoveredMap);
      }
    } catch {
      // Ciche retry ogranicza szum w UI, bo brak mapy w trakcie sesji jest normalnym stanem.
    } finally {
      isDiscoveringSessionMap = false;
    }
  }

  function updateTokenInSessionMap(tokenId: string, patch: Partial<SessionMapToken>) {
    if (!sessionMap) {
      return;
    }

    sessionMap = {
      ...sessionMap,
      tokens: sessionMap.tokens.map((token) =>
        token.tokenId === tokenId ? { ...token, ...patch } : token
      ),
      updatedAt: patch.updatedAt ?? sessionMap.updatedAt,
      version: readNextSessionMapVersion(patch.version)
    };
  }

  function removeTokenFromSessionMap(tokenId: string) {
    if (!sessionMap) {
      return;
    }

    sessionMap = {
      ...sessionMap,
      tokens: sessionMap.tokens.filter((entry) => entry.tokenId !== tokenId),
      version: readNextSessionMapVersion()
    };
    localMapTokenPositions = updateMapTokenPositionState(localMapTokenPositions, tokenId, null);
    remoteMapTokenPositions = updateMapTokenPositionState(remoteMapTokenPositions, tokenId, null);
  }

  function readNextSessionMapVersion(nextVersion?: number) {
    if (!sessionMap?.version && nextVersion === undefined) {
      return sessionMap?.version;
    }

    if (nextVersion !== undefined) {
      return Math.max(sessionMap?.version ?? nextVersion, nextVersion);
    }

    // Tokeny są częścią agregatu battlemapy, więc lokalna zmiana tokena
    // musi przesunąć wersję mapy używaną później przez optimistic locking layoutu.
    return (sessionMap?.version ?? 0) + 1;
  }

  function updateMapTokenPositionState(
    source: Record<string, MapPosition>,
    tokenId: string,
    position: MapPosition | null
  ) {
    const nextPositions = { ...source };

    if (position) {
      nextPositions[tokenId] = position;
    } else {
      delete nextPositions[tokenId];
    }

    return nextPositions;
  }

  function getMapTokenMoveId(tokenId: string) {
    const existingMoveId = activeMapMoveIds.get(tokenId);

    if (existingMoveId) {
      return existingMoveId;
    }

    const nextMoveId = globalThis.crypto?.randomUUID?.() ?? `move-${tokenId}-${Date.now()}`;
    activeMapMoveIds.set(tokenId, nextMoveId);
    return nextMoveId;
  }

  function handleMapTokenDragPreview(token: SessionMapToken, position: MapPosition) {
    if (!sessionMap) {
      return;
    }

    const clientMoveId = getMapTokenMoveId(token.tokenId);
    localMapTokenPositions = updateMapTokenPositionState(
      localMapTokenPositions,
      token.tokenId,
      position
    );

    const now = Date.now();
    const lastSentAt = lastMapDragPreviewAt.get(token.tokenId) ?? 0;

    if (now - lastSentAt < mapDragPreviewIntervalMs) {
      return;
    }

    // WebSocket przenosi tylko transient preview; finalny zapis pozycji nadal idzie przez HTTP.
    const sent =
      liveSocket?.sendMapTokenDragPreview({
        sessionId: sessionMap.sessionId,
        mapId: sessionMap.mapId,
        tokenId: token.tokenId,
        position,
        clientMoveId
      }) ?? false;

    if (sent) {
      sentMapMoveIds.add(clientMoveId);
      lastMapDragPreviewAt.set(token.tokenId, now);
    }
  }

  async function handleMapTokenDrop(token: SessionMapToken, position: MapPosition) {
    if (!sessionMap) {
      return;
    }

    const clientMoveId = getMapTokenMoveId(token.tokenId);
    const previousPosition = token.position;

    localMapTokenPositions = updateMapTokenPositionState(
      localMapTokenPositions,
      token.tokenId,
      position
    );
    updateTokenInSessionMap(token.tokenId, { position });

    try {
      const movedToken = await moveSessionMapToken(sessionMap.sessionId, sessionMap.mapId, token.tokenId, {
        position,
        rotation: token.rotation,
        version: token.version,
        clientMoveId
      });

      updateTokenInSessionMap(token.tokenId, movedToken);
    } catch (error) {
      updateTokenInSessionMap(token.tokenId, { position: previousPosition });
      liveMessage = error instanceof Error ? error.message : 'Nie udało się zapisać pozycji tokena.';
    } finally {
      localMapTokenPositions = updateMapTokenPositionState(
        localMapTokenPositions,
        token.tokenId,
        null
      );
      activeMapMoveIds.delete(token.tokenId);
      lastMapDragPreviewAt.delete(token.tokenId);
    }
  }

  const mapTokenRenderPositions = $derived({
    ...remoteMapTokenPositions,
    ...localMapTokenPositions
  });

  function selectAction(actionId: string) {
    selectedActionId = actionId;
    shouldAutoSelectAction = false;
    actionInputValues = {};
    focusedRollInputId = '';
  }

  function updateActionInput(inputId: string, value: string) {
    actionInputValues = {
      ...actionInputValues,
      [inputId]: value
    };
  }

  function optionsForRollInput(input: CharacterActionInputDefinition) {
    if (input.source === 'skills-and-characteristics') {
      return buildActionCheckOptions(activeEntry?.character, session?.rpgSystem);
    }

    if (input.source === 'vtm-attributes') {
      return buildVtmAttributeOptions(activeEntry?.character, session?.rpgSystem);
    }

    return buildVtmAbilityOptions(activeEntry?.character, session?.rpgSystem);
  }

  function valueForRollInput(inputId: string) {
    return actionInputValues[inputId] ?? '';
  }

  function selectedOptionForRollInput(input: CharacterActionInputDefinition) {
    const value = valueForRollInput(input.id);
    return (
      optionsForRollInput(input).find(
        (option) => option.id === value || option.label.toLowerCase() === value.toLowerCase()
      ) ?? null
    );
  }

  function displayValueForRollInput(input: CharacterActionInputDefinition) {
    return selectedOptionForRollInput(input)?.label ?? valueForRollInput(input.id);
  }

  function ratingValueForRollInput(input: CharacterActionInputDefinition) {
    return isVtmRollRatingInput(input) ? selectedOptionForRollInput(input)?.value : null;
  }

  function filteredOptionsForRollInput(input: CharacterActionInputDefinition) {
    const query = displayValueForRollInput(input).trim().toLowerCase();
    const options = optionsForRollInput(input);

    if (!query) {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.id.toLowerCase().includes(query)
    );
  }

  function selectRollInputOption(inputId: string, value: string) {
    updateActionInput(inputId, value);
    focusedRollInputId = '';
  }

  function normalizeRollInputValue(input: CharacterActionInputDefinition) {
    const selectedOption = selectedOptionForRollInput(input);

    if (selectedOption && selectedOption.id !== valueForRollInput(input.id)) {
      updateActionInput(input.id, selectedOption.id);
    }
  }

  function isVtmRollRatingInput(input: CharacterActionInputDefinition) {
    return input.source === 'vtm-attributes' || input.source === 'vtm-abilities';
  }

  function rollRatingDots(value: number) {
    const rating = Math.max(0, Math.min(5, Math.trunc(value)));
    return Array.from({ length: 5 }, (_, index) => index < rating);
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
    const characterLabel = roll.subjectLabel ?? roll.characterName;

    if (roll.actorLabel === 'GM' && roll.subjectLabel && roll.subjectLabel !== checkName) {
      return `GM -> ${roll.subjectLabel}: ${checkName}`;
    }

    if (roll.actorLabel === 'GM') {
      return `GM: ${checkName}`;
    }

    return `${characterLabel ?? roll.actorLabel ?? roll.userName}: ${checkName}`;
  }

  function resolveRollAvatarEntry(roll: DiceRollResult) {
    if (roll.rollContext === 'npc' || roll.rollContext === 'generic') {
      return null;
    }

    return (
      entries.find((entry) => entry.character?.characterId === roll.characterId) ??
      entries.find((entry) => entry.character?.name === roll.subjectLabel) ??
      entries.find((entry) => entry.character?.name === roll.characterName) ??
      entries.find((entry) => entry.participant.userId === roll.userId) ??
      null
    );
  }

  function rollAvatarLabel(roll: DiceRollResult) {
    const entry = resolveRollAvatarEntry(roll);
    return entry?.character?.name ?? roll.subjectLabel ?? roll.characterName ?? roll.userName;
  }

  function rollAvatarInitial(roll: DiceRollResult) {
    return rollAvatarLabel(roll).slice(0, 1).toUpperCase();
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
    updateMapSubscription();
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
    updateMapSubscription();
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

  function updateMapSubscription(map = sessionMap) {
    liveSocket?.subscribeSessionMap(
      map
        ? {
            sessionId: map.sessionId,
            mapId: map.mapId
          }
        : null
    );
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
      characterId: gmManualRoll ? null : (activeEntry?.character?.characterId ?? null),
      characterName: gmManualRoll ? null : (activeEntry?.character?.name ?? null),
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
    if (handleMapLiveEvent(event)) {
      return;
    }

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
      entries = removeCharacterFromEntryList(entries, characterSheet.characterId);
      tableEntries = removeCharacterFromEntryList(tableEntries, characterSheet.characterId);
      cancelEditing();
      liveMessage = 'Karta postaci została usunięta.';
      return;
    }

    const refreshedCharacter = await refreshCharacterFromApi(characterSheet);
    const nextCharacter = refreshedCharacter ?? characterSheet;

    entries = updateCharacterEntryList(entries, nextCharacter);
    tableEntries = updateCharacterEntryList(tableEntries, nextCharacter);
    liveMessage = `Odebrano aktualizację karty o ${lastLiveEventAt}.`;
  }

  function handleMapLiveEvent(event: CharacterSheetLiveEvent) {
    if (!event.type?.startsWith('sessionMap.')) {
      return false;
    }

    if (event.type === 'sessionMap.created' && event.map) {
      setActiveSessionMap(event.map);
      lastLiveEventAt = new Date().toLocaleTimeString('pl-PL');
      liveMessage = `Odebrano mapę sesji o ${lastLiveEventAt}.`;
      return true;
    }

    if (!sessionMap || event.mapId !== sessionMap.mapId) {
      return true;
    }

    lastLiveEventAt = new Date().toLocaleTimeString('pl-PL');

    if (event.type === 'sessionMap.updated' && event.map) {
      sessionMap = {
        ...event.map,
        tokens: event.map.tokens?.length ? event.map.tokens : sessionMap.tokens
      };
      liveMessage = `Mapa została zaktualizowana o ${lastLiveEventAt}.`;
      return true;
    }

    if (event.type === 'sessionMap.deleted') {
      setActiveSessionMap(null);
      liveMessage = 'Mapa sesji została usunięta.';
      return true;
    }

    if (event.type === 'sessionMap.tokenCreated' && event.token) {
      addTokenToSessionMap(event.token);
      liveMessage = `Dodano token na mapie o ${lastLiveEventAt}.`;
      return true;
    }

    if (event.type === 'sessionMap.tokenUpdated' && event.token) {
      addTokenToSessionMap(event.token);
      localMapTokenPositions = updateMapTokenPositionState(
        localMapTokenPositions,
        event.token.tokenId,
        null
      );
      remoteMapTokenPositions = updateMapTokenPositionState(
        remoteMapTokenPositions,
        event.token.tokenId,
        null
      );
      return true;
    }

    if (event.type === 'sessionMap.tokenDragging' && event.tokenId && event.position) {
      // Preview trzymamy poza modelem mapy, bo backend nie powinien utrwalać każdej klatki draga.
      if (event.clientMoveId && sentMapMoveIds.has(event.clientMoveId)) {
        return true;
      }

      remoteMapTokenPositions = updateMapTokenPositionState(
        remoteMapTokenPositions,
        event.tokenId,
        event.position
      );
      return true;
    }

    if (event.type === 'sessionMap.tokenMoved' && event.tokenId && event.position) {
      if (event.clientMoveId) {
        sentMapMoveIds.delete(event.clientMoveId);
      }

      updateTokenInSessionMap(event.tokenId, {
        position: event.position,
        rotation: event.rotation,
        version: event.version
      });
      localMapTokenPositions = updateMapTokenPositionState(
        localMapTokenPositions,
        event.tokenId,
        null
      );
      remoteMapTokenPositions = updateMapTokenPositionState(
        remoteMapTokenPositions,
        event.tokenId,
        null
      );
      return true;
    }

    if (event.type === 'sessionMap.tokenDeleted' && event.tokenId) {
      removeTokenFromSessionMap(event.tokenId);
      liveMessage = `Usunięto token z mapy o ${lastLiveEventAt}.`;
      return true;
    }

    return true;
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
      characterId:
        typeof payload.characterId === 'string' && payload.characterId.trim()
          ? payload.characterId.trim()
          : null,
      characterName:
        typeof payload.characterName === 'string' && payload.characterName.trim()
          ? payload.characterName.trim()
          : null,
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

  function isTableBackgroundAsset(asset: SessionAsset | null | undefined) {
    return Boolean(asset?.label?.startsWith(tableBackgroundLabelPrefix));
  }

  function tableBackgroundAssetLabel(asset: SessionAsset) {
    const label = asset.label?.startsWith(tableBackgroundLabelPrefix)
      ? asset.label.slice(tableBackgroundLabelPrefix.length)
      : asset.label;

    return label?.trim() || asset.fileName?.replace(/\.[^.]+$/, '').trim() || 'Tło stołu';
  }

  function readImageDimensions(file: File) {
    return new Promise<MapDimensions>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.addEventListener('load', () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight
        });
      });
      image.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Nie udało się odczytać wymiarów obrazu.'));
      });
      image.src = objectUrl;
    });
  }

  function handleTableBackgroundFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    selectedTableBackgroundFile = file;
    tableBackgroundMessage = '';

    if (file && !tableBackgroundName.trim()) {
      tableBackgroundName = file.name.replace(/\.[^.]+$/, '').trim();
    }
  }

  async function loadTableBackgroundAssets() {
    if (!session) {
      return;
    }

    const requestId = ++tableBackgroundLoadRequestId;
    isLoadingTableBackgrounds = true;
    tableBackgroundMessage = '';

    try {
      const response = await getSessionAssets(session.sessionId, { kind: 'map' });
      const tableAssets = response.assets.filter(isTableBackgroundAsset);

      if (requestId !== tableBackgroundLoadRequestId) {
        return;
      }

      tableBackgroundAssets = tableAssets;
      if (
        !selectedTableBackgroundAsset ||
        !isTableBackgroundAsset(selectedTableBackgroundAsset) ||
        !tableAssets.some((asset) => asset.assetId === selectedTableBackgroundAsset?.assetId)
      ) {
        selectedTableBackgroundAsset = tableAssets[0] ?? null;
      }
    } catch (error) {
      if (requestId === tableBackgroundLoadRequestId) {
        tableBackgroundMessage =
          error instanceof Error ? error.message : 'Nie udało się pobrać teł stołu.';
      }
    } finally {
      if (requestId === tableBackgroundLoadRequestId) {
        isLoadingTableBackgrounds = false;
      }
    }
  }

  async function uploadTableBackground() {
    if (!session || !selectedTableBackgroundFile || isUploadingTableBackground) {
      return;
    }

    isUploadingTableBackground = true;
    tableBackgroundMessage = '';

    try {
      const file = selectedTableBackgroundFile;
      const dimensions = await readImageDimensions(file);
      const label = tableBackgroundName.trim() || file.name.replace(/\.[^.]+$/, '').trim();
      const uploadTarget = await createSessionAssetUploadUrl(session.sessionId, {
        kind: 'map',
        // Backend ma obecnie tylko `kind: map`, więc prefiks w etykiecie odróżnia
        // tła stołu od battle map bez mieszania tych bibliotek w UI.
        label: `${tableBackgroundLabelPrefix}${label}`,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dimensions
      });

      await uploadMapAssetToS3(uploadTarget.uploadUrl, file, uploadTarget.headers);

      const asset: SessionAsset = {
        sessionId: session.sessionId,
        assetId: uploadTarget.assetId,
        kind: 'map',
        url: uploadTarget.assetUrl,
        fileName: file.name,
        mimeType: file.type,
        dimensions,
        sizeBytes: file.size,
        label: `${tableBackgroundLabelPrefix}${label}`,
        ...uploadTarget.asset
      };

      tableBackgroundAssets = [
        asset,
        ...tableBackgroundAssets.filter((entry) => entry.assetId !== asset.assetId)
      ];
      selectedTableBackgroundAsset = asset;
      selectedTableBackgroundFile = null;
      tableBackgroundName = '';
      tableBackgroundMessage = 'Tło stołu zostało dodane i wybrane.';
    } catch (error) {
      tableBackgroundMessage =
        error instanceof Error ? error.message : 'Nie udało się dodać tła stołu.';
    } finally {
      isUploadingTableBackground = false;
    }
  }

  async function deleteTableBackgroundAsset(asset: SessionAsset) {
    if (!session || deletingTableBackgroundAssetIds.includes(asset.assetId)) {
      return;
    }

    deletingTableBackgroundAssetIds = [...deletingTableBackgroundAssetIds, asset.assetId];
    tableBackgroundMessage = '';

    try {
      await deleteSessionAsset(session.sessionId, asset.assetId);
      tableBackgroundAssets = tableBackgroundAssets.filter((entry) => entry.assetId !== asset.assetId);

      if (selectedTableBackgroundAsset?.assetId === asset.assetId) {
        selectedTableBackgroundAsset = tableBackgroundAssets[0] ?? null;
      }

      tableBackgroundMessage = `Usunięto tło "${tableBackgroundAssetLabel(asset)}".`;
    } catch (error) {
      tableBackgroundMessage =
        error instanceof Error ? error.message : 'Nie udało się usunąć tła stołu.';
    } finally {
      deletingTableBackgroundAssetIds = deletingTableBackgroundAssetIds.filter(
        (entry) => entry !== asset.assetId
      );
    }
  }

  function selectCharacter(characterId: string) {
    const nextEntry =
      entries.find((entry) => entry.character?.characterId === characterId) ?? entries[0] ?? null;
    activeCharacterId = characterId;
    selectedActionId = '';
    shouldAutoSelectAction = true;
    actionInputValues = {};
    activeCharacterOverlaySectionId = '';
    cancelEditing();
    updateLiveSubscription(getLiveSubscription(nextEntry));
  }

  function openCharacterOverlay(section: ResolvedCharacterSheetSection) {
    activeCharacterOverlaySectionId =
      activeCharacterOverlaySectionId === section.id ? '' : section.id;
  }

  function closeCharacterOverlay() {
    activeCharacterOverlaySectionId = '';
  }

  function handleCharacterOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && activeCharacterOverlaySectionId) {
      closeCharacterOverlay();
    }
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

    editDraft = createCharacterEditDraft(activeEntry.character);
    avatarMessage = '';
    editorMessage = '';
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
    isSaving = false;
    isUploadingAvatar = false;
    isDeletingAvatar = false;
    avatarMessage = '';
    editorMessage = '';
    editDraft = null;
  }

  function isAllowedAvatarType(contentType: string): contentType is CharacterAvatarUploadPayload['contentType'] {
    return allowedAvatarTypes.includes(contentType as CharacterAvatarUploadPayload['contentType']);
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Nie udało się odczytać pliku avatara.'));
      });
      reader.addEventListener('error', () => reject(new Error('Nie udało się odczytać pliku avatara.')));
      reader.readAsDataURL(file);
    });
  }

  async function handleSessionAvatarFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    avatarMessage = '';

    if (!file || !session || !activeEntry?.character || !canManageSession) {
      return;
    }

    if (!activeEntryCanBeEdited) {
      avatarMessage = 'Ta karta musi występować w `participants`, aby GM mógł zmienić avatar.';
      input.value = '';
      return;
    }

    if (!isAllowedAvatarType(file.type)) {
      avatarMessage = 'Obsługiwane formaty avatara to JPEG, PNG albo WebP.';
      input.value = '';
      return;
    }

    if (file.size > maxAvatarBytes) {
      avatarMessage = 'Awatar może mieć maksymalnie 2 MB.';
      input.value = '';
      return;
    }

    isUploadingAvatar = true;

    try {
      const updatedCharacter = await uploadSessionParticipantCharacterAvatar(
        session.sessionId,
        activeEntry.participant.userId,
        activeEntry.character.characterId,
        {
          fileName: file.name,
          contentType: file.type,
          imageBase64: await readFileAsDataUrl(file)
        }
      );

      replaceActiveCharacter(updatedCharacter);
      avatarMessage = 'Awatar został zapisany.';
    } catch (error) {
      avatarMessage = error instanceof Error ? error.message : 'Nie udało się wgrać awatara.';
    } finally {
      isUploadingAvatar = false;
      input.value = '';
    }
  }

  async function deleteActiveCharacterAvatar() {
    if (!session || !activeEntry?.character?.avatarUrl || !canManageSession || isDeletingAvatar) {
      return;
    }

    if (!activeEntryCanBeEdited) {
      avatarMessage = 'Ta karta musi występować w `participants`, aby GM mógł usunąć avatar.';
      return;
    }

    isDeletingAvatar = true;
    avatarMessage = '';

    try {
      const updatedCharacter = await deleteSessionParticipantCharacterAvatar(
        session.sessionId,
        activeEntry.participant.userId,
        activeEntry.character.characterId
      );
      replaceActiveCharacter(updatedCharacter);
      avatarMessage = 'Awatar został usunięty.';
    } catch (error) {
      avatarMessage = error instanceof Error ? error.message : 'Nie udało się usunąć awatara.';
    } finally {
      isDeletingAvatar = false;
    }
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
    entries = updateCharacterEntryList(entries, updatedCharacter);
    tableEntries = updateCharacterEntryList(tableEntries, updatedCharacter);
    activeCharacterId = updatedCharacter.characterId;
  }

  function updateCharacterEntryList(
    currentEntries: SessionCharacterEntry[],
    updatedCharacter: CharacterCard
  ) {
    return currentEntries.map((entry) =>
      entry.character?.characterId === updatedCharacter.characterId ||
      entry.participant.characterId === updatedCharacter.characterId
        ? { ...entry, character: updatedCharacter }
        : entry
    );
  }

  function isBackendParticipantEntry(entry: SessionCharacterEntry) {
    return backendParticipants.some(
      (participant) =>
        participant.userId === entry.participant.userId &&
        participant.characterId === entry.participant.characterId
    );
  }

  function canEditToolboxCharacter(entry: SessionCharacterEntry) {
    if (!entry.character) {
      return false;
    }

    if (canManageSession) {
      return isBackendParticipantEntry(entry);
    }

    return entry.participant.userId === userId;
  }

  async function updateToolboxResource(change: SessionToolboxResourceChange) {
    if (!session || savingToolboxResourceKey) {
      return;
    }

    const entry = entries.find((candidate) => candidate.character?.characterId === change.characterId);

    if (!entry?.character || !canEditToolboxCharacter(entry)) {
      return;
    }

    const payload = buildSessionToolboxResourcePayload(
      entry.character,
      change.resourceId,
      change.value
    );

    savingToolboxResourceKey = `${change.characterId}:${change.resourceId}`;
    editorMessage = '';

    try {
      const updatedCharacter =
        canManageSession && isBackendParticipantEntry(entry)
          ? await updateSessionParticipantCharacter(
              session.sessionId,
              entry.participant.userId,
              entry.character.characterId,
              payload
            )
          : await updateCharacter(entry.character.characterId, payload);

      replaceActiveCharacter(updatedCharacter);
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się zaktualizować zasobu postaci.';
    } finally {
      savingToolboxResourceKey = '';
    }
  }

  function removeCharacterFromEntryList(
    currentEntries: SessionCharacterEntry[],
    characterId: string
  ) {
    return currentEntries.map((entry) =>
      entry.character?.characterId === characterId || entry.participant.characterId === characterId
        ? { ...entry, character: null }
        : entry
    );
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

  async function saveCharacterChanges() {
    if (!activeEntry?.character || !session || !canManageSession) {
      return;
    }

    let payload: CharacterUpdatePayload;

    try {
      if (!editDraft) {
        throw new Error('Brakuje danych formularza edycji.');
      }

      payload = buildCharacterUpdatePayload(editDraft, {
        isVampireSystem: isActiveVampireSystem
      });
    } catch (error) {
      editorMessage = error instanceof Error ? error.message : 'Formularz zawiera nieprawidłowe dane.';
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

      replaceActiveCharacter(updatedCharacter);
      isEditing = false;
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się zapisać zmian w karcie postaci.';
    } finally {
      isSaving = false;
    }
  }

  async function saveCharacterNotes(notes: CharacterNote[]) {
    if (!activeEntry?.character || !session || !activeEntryNotesCanBeEdited || isSavingNotes) {
      return;
    }

    isSavingNotes = true;
    editorMessage = '';

    const payload: CharacterUpdatePayload = {
      notes: serializeCharacterNotes(notes)
    };

    try {
      const updatedCharacter =
        activeEntryCanBeEdited && canManageSession
          ? await updateSessionParticipantCharacter(
              session.sessionId,
              activeEntry.participant.userId,
              activeEntry.character.characterId,
              payload
            )
          : await updateCharacter(activeEntry.character.characterId, payload);

      replaceActiveCharacter(updatedCharacter);
      editorMessage = 'Notatki zostały zapisane.';
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się zapisać notatek postaci.';
    } finally {
      isSavingNotes = false;
    }
  }

  async function deleteCurrentSession() {
    if (!session || isDeleting || !isOwner) {
      return;
    }

    if (sessionHasAssignedPlayers(session)) {
      alert(
        `Nie można usunąć sesji "${formatRpgSessionName(session)}", ponieważ ma przypisanych graczy. Najpierw usuń uczestników z detali sesji, aby nie zostawić postaci z odwołaniem do nieistniejącej sesji.`
      );
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

  function sessionHasAssignedPlayers(targetSession: RpgSession) {
    const playerIds = targetSession.playerUserIds.filter(
      (playerUserId) => playerUserId !== targetSession.ownerUserId
    );

    // Blokujemy po obu źródłach, bo starsze sesje mogą mieć tylko playerUserIds,
    // a nowsze przypisania postaci siedzą w participants.
    return playerIds.length > 0 || (targetSession.participants?.length ?? 0) > 0;
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

  async function loadSessionCharacters(
    session: RpgSession,
    visibleUserId: string | null,
    canReadAllPlayers = !visibleUserId
  ) {
    const participants = await loadSessionParticipants(session, visibleUserId);

    if (participants.length === 0) {
      return [];
    }

    const playerNames = await loadPlayerNames(session, participants, canReadAllPlayers);

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

<svelte:window onkeydown={handleCharacterOverlayKeydown} />

<main class="h-[calc(100svh-var(--app-navigation-height,0px))] overflow-hidden bg-background">
  <section class="h-full min-h-0 w-full">
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

      <section class="relative left-1/2 h-full min-h-0 w-screen -translate-x-1/2 overflow-hidden border-y border-border/80 bg-card/95 shadow-sm">
        <div class="h-full min-h-0 overflow-hidden bg-background/20">
          <div
            class={[
              'stage-track h-full min-h-0 w-[200vw] grid grid-cols-2',
              stageMode === 'map' ? 'stage-track-map' : 'stage-track-table'
            ]}
          >
            <div class="h-full min-h-0 w-screen overflow-hidden">
              <SessionTableCanvas
                participants={tableParticipants}
                backgroundUrl={selectedTableBackgroundUrl}
                backgroundLabel={selectedTableBackgroundAlt}
              />
            </div>
            <div class="h-full min-h-0 w-screen overflow-hidden">
              <SessionMapPanel
                sessionId={session.sessionId}
                map={sessionMap}
                canManageMap={canManageSession}
                canDeleteMapTokens={isOwner}
                canAssignMapTokenOwners={isOwner}
                currentUserId={userId}
                ownerOptions={mapTokenOwnerOptions}
                fitContainer
                {liveStatus}
                tokenPositions={mapTokenRenderPositions}
                onMapCreated={setActiveSessionMap}
                onMapUpdated={setActiveSessionMap}
                onMapDeleted={clearActiveSessionMap}
                onMapTokenCreated={addTokenToSessionMap}
                onMapTokenUpdated={addTokenToSessionMap}
                onMapTokenDeleted={removeTokenFromSessionMap}
                onMapTokenDragPreview={handleMapTokenDragPreview}
                onMapTokenDrop={handleMapTokenDrop}
              />
            </div>
          </div>
        </div>

        <div class="pointer-events-auto absolute right-3 top-3 z-50 flex max-w-[8.5rem] flex-col gap-2 rounded-md border bg-card/90 p-2 shadow-lg backdrop-blur sm:max-w-none sm:flex-row">
          <div class="grid grid-cols-2 gap-1 rounded-md border bg-background/50 p-1">
            <button
              type="button"
              class={[
                'rounded px-2 py-1 text-xs transition-colors',
                stageMode === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              ]}
              onclick={() => setStageMode('table')}
              aria-pressed={stageMode === 'table'}
            >
              Stół
            </button>
            <button
              type="button"
              class={[
                'rounded px-2 py-1 text-xs transition-colors',
                stageMode === 'map'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              ]}
              onclick={() => setStageMode('map')}
              aria-pressed={stageMode === 'map'}
            >
              Mapa
            </button>
          </div>
          {#if stageMode === 'table' && canManageSession}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onclick={() => (isTableBackgroundOpen = true)}
            >
              Tło stołu
            </Button>
          {/if}
          <Button type="button" size="sm" variant="outline" onclick={openSessionDetails}>
            Szczegóły
          </Button>
          <Button type="button" size="sm" variant="outline" onclick={openSessionsList}>
            Sesje
          </Button>
          {#if isOwner}
            <Button
              type="button"
              size="sm"
              variant="outline"
              class="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={isDeleting}
              onclick={deleteCurrentSession}
            >
              {isDeleting ? '...' : 'Usuń'}
            </Button>
          {/if}
        </div>

        {#if activeCharacterOverlaySection}
          <div
            class="ui-fade-in fixed inset-0 z-[55]"
            role="presentation"
            onclick={closeCharacterOverlay}
          ></div>
        {/if}

        {#if entries.length > 0}
          <div class="pointer-events-none absolute left-3 top-3 z-[60] w-[min(56rem,calc(100vw-10rem))]">
            <Card class="pointer-events-auto border-border/80 bg-card/90 shadow-lg backdrop-blur">
              <CardContent class="space-y-2 p-2">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                      {activeEntry?.character?.name ?? 'Postać'}
                    </p>
                    {#if canManageSession && activeEntry}
                      <p class="truncate text-xs text-muted-foreground">{activeEntry.playerName}</p>
                    {/if}
                  </div>

                  {#if canManageSession && activeEntry?.character && activeSheet}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isEditing || !activeEntryCanBeEdited}
                      onclick={startEditingCharacter}
                    >
                      Edytuj
                    </Button>
                  {/if}
                </div>

                {#if canManageSession}
                  <div class="flex gap-1 overflow-x-auto pb-1">
                    {#each entries as entry}
                      <button
                        class={[
                          'shrink-0 rounded-md border px-2 py-1 text-left text-xs transition-colors',
                          entry.character?.characterId === activeEntry?.character?.characterId
                            ? 'border-primary/60 bg-primary/10 text-foreground'
                            : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-muted'
                        ]}
                        type="button"
                        disabled={!entry.character}
                        onclick={() => selectCharacter(entry.character?.characterId ?? '')}
                      >
                        <span class="block max-w-32 truncate font-medium">
                          {entry.character?.name ?? 'Postać niedostępna'}
                        </span>
                      </button>
                    {/each}
                  </div>
                {/if}

                {#if editorMessage && !isEditing}
                  <div class="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive-foreground">
                    {editorMessage}
                  </div>
                {/if}

                {#if canManageSession && activeEntry?.character && !activeEntryCanBeEdited}
                  <div class="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive-foreground">
                    Karta nie ma wpisu `userId + characterId` w `participants`, więc backend nie pozwoli GM na edycję.
                  </div>
                {/if}

                {#if activeEntry?.character && activeSheet}
                  <div class="relative">
                    <div class="flex gap-1 overflow-x-auto pb-1">
                      {#each activeSheet.sections as section (section.id)}
                        <button
                          type="button"
                          class={[
                            'shrink-0 rounded-md border px-2 py-1 text-xs transition-colors',
                            section.id === activeCharacterOverlaySection?.id
                              ? 'border-primary/60 bg-primary/10 text-foreground'
                              : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-muted'
                          ]}
                          onclick={(event) => {
                            event.stopPropagation();
                            openCharacterOverlay(section);
                          }}
                          aria-expanded={section.id === activeCharacterOverlaySection?.id}
                        >
                          {section.title}
                        </button>
                      {/each}
                    </div>

                    {#if activeCharacterOverlaySection}
                      <div
                        class="ui-popover-in pointer-events-auto absolute left-0 right-0 top-full z-[70] pt-2 sm:w-[min(58rem,calc(100vw-3rem))]"
                      >
                        <div class="ml-8 h-3 w-3 rotate-45 border-l border-t bg-card"></div>
                        <div
                          class="-mt-1 flex max-h-[min(34rem,calc(100vh-10rem))] flex-col overflow-hidden rounded-md border bg-card shadow-xl ring-1 ring-border/60"
                          role="region"
                          aria-labelledby="character-popover-title"
                        >
                          <div class="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p class="text-sm text-muted-foreground">{activeSheet.characterName}</p>
                              <h2 id="character-popover-title" class="text-lg font-semibold tracking-normal">
                                {activeCharacterOverlaySection.title}
                              </h2>
                              {#if activeCharacterOverlaySection.description}
                                <p class="mt-1 text-sm text-muted-foreground">
                                  {activeCharacterOverlaySection.description}
                                </p>
                              {/if}
                            </div>

                            <Button type="button" variant="outline" onclick={closeCharacterOverlay}>
                              Zamknij
                            </Button>
                          </div>

                          <div class="overflow-y-auto px-4 py-4">
                            <CharacterSheetSectionView
                              sheet={activeSheet}
                              section={activeCharacterOverlaySection}
                              canEditNotes={activeEntryNotesCanBeEdited}
                              {isSavingNotes}
                              onNotesChange={saveCharacterNotes}
                            />
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                {:else if activeEntry?.character}
                  <div class="rounded-md border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
                    Brak data-driven definicji karty dla systemu {activeEntry.character.rpgSystem ?? session.rpgSystem}.
                  </div>
                {:else}
                  <div class="rounded-md border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
                    Backend zwrócił uczestnika, ale nie udało się pobrać jego karty postaci.
                  </div>
                {/if}
              </CardContent>
            </Card>
          </div>
        {/if}

        <div class="pointer-events-none absolute bottom-3 left-3 right-3 z-50 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div class="pointer-events-auto w-full max-w-2xl">
            {#if !isRollSettingsOpen}
              <div class="rounded-md border bg-card/90 p-2 shadow-lg backdrop-blur">
                <div class="flex flex-wrap items-center gap-2">
                  {#if !gmManualRoll && activeAction}
                    <div class="flex min-w-0 flex-1 flex-wrap gap-2">
                      {#each activeAction.inputs as input (input.id)}
                        <div class="relative min-w-[9rem] flex-1">
                          <Label for={`roll-dock-input-${input.id}`} class="sr-only">{input.label}</Label>
                          <input
                            id={`roll-dock-input-${input.id}`}
                            class={[
                              'h-9 w-full rounded-md border border-input bg-background/90 px-2 py-1 text-xs shadow-sm',
                              ratingValueForRollInput(input) !== null ? 'pr-20' : ''
                            ]}
                            autocomplete="off"
                            placeholder={input.label}
                            aria-label={input.label}
                            value={displayValueForRollInput(input)}
                            onfocus={() => (focusedRollInputId = input.id)}
                            oninput={(event) => updateActionInput(input.id, event.currentTarget.value)}
                            onblur={() => {
                              setTimeout(() => {
                                normalizeRollInputValue(input);
                                if (focusedRollInputId === input.id) {
                                  focusedRollInputId = '';
                                }
                              }, 120);
                            }}
                          />

                          {#if ratingValueForRollInput(input) !== null}
                            <span
                              class="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded bg-background/80 px-1"
                              aria-label={`Wartość ${ratingValueForRollInput(input)}`}
                            >
                              {#each rollRatingDots(ratingValueForRollInput(input) ?? 0) as filled}
                                <span
                                  class={`h-2 w-2 rounded-full border ${
                                    filled ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                                  }`}
                                ></span>
                              {/each}
                            </span>
                          {/if}

                          {#if focusedRollInputId === input.id}
                            <div
                              class="ui-slide-up-in absolute bottom-full left-0 right-0 z-[70] mb-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-xs shadow-lg"
                            >
                              {#if filteredOptionsForRollInput(input).length > 0}
                                {#each filteredOptionsForRollInput(input) as option (option.id)}
                                  <button
                                    type="button"
                                    class="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
                                    onpointerdown={(event) => {
                                      event.preventDefault();
                                      selectRollInputOption(input.id, option.id);
                                    }}
                                  >
                                    <span class="truncate">{option.label}</span>
                                    {#if isVtmRollRatingInput(input)}
                                      <span
                                        class="flex shrink-0 items-center gap-1"
                                        aria-label={`Wartość ${option.value}`}
                                      >
                                        {#each rollRatingDots(option.value) as filled}
                                          <span
                                            class={`h-2 w-2 rounded-full border ${
                                              filled ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                                            }`}
                                          ></span>
                                        {/each}
                                      </span>
                                    {:else}
                                      <span class="shrink-0 text-xs text-muted-foreground">{option.value}</span>
                                    {/if}
                                  </button>
                                {/each}
                              {:else}
                                <p class="px-2 py-1.5 text-muted-foreground">Brak pasujących pozycji.</p>
                              {/if}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {:else if !gmManualRoll || !canManageSession}
                    <div class="flex min-w-0 flex-1 flex-wrap gap-2">
                      {#each genericRollNotations as notation}
                        <Button
                          type="button"
                          size="sm"
                          variant={genericRollNotation === notation ? 'default' : 'outline'}
                          class="h-9"
                          onclick={() => (genericRollNotation = notation)}
                        >
                          {notation}
                        </Button>
                      {/each}
                    </div>
                  {:else if gmManualRoll && canManageSession}
                    <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      Pula {gmManualPool}, głód {gmManualHunger}
                    </p>
                  {/if}

                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Ustawienia rzutu"
                    title="Ustawienia rzutu"
                    onclick={() => (isRollSettingsOpen = !isRollSettingsOpen)}
                  >
                    <Settings class="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            {/if}

            {#if isRollSettingsOpen}
              <div
                class="ui-fade-in fixed inset-0 z-40"
                role="presentation"
                onclick={() => (isRollSettingsOpen = false)}
              ></div>
              <div class="ui-slide-up-in relative z-50 mt-2 max-h-[min(32rem,calc(100vh-9rem))] overflow-y-auto rounded-md border bg-card/95 p-3 shadow-xl ring-1 ring-border/60 backdrop-blur">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <p class="text-sm font-medium">Konfiguracja rzutu</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onclick={() => (isRollSettingsOpen = false)}
                  >
                    Zamknij
                  </Button>
                </div>

                <div class="space-y-4">
                  {#if !canManageSession}
                    <div class="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant={!gmManualRoll ? 'default' : 'outline'}
                        onclick={() => {
                          gmManualRoll = false;
                          isRollSettingsOpen = false;
                        }}
                      >
                        Atrybut + umiejętność
                      </Button>
                      <Button
                        type="button"
                        variant={gmManualRoll ? 'default' : 'outline'}
                        onclick={() => {
                          gmManualRoll = true;
                          isRollSettingsOpen = false;
                        }}
                      >
                        Rzut bez systemu
                      </Button>
                    </div>
                  {:else}
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
                          Rzut zostanie wykonany i zapisany tylko w lokalnym logu GM.
                        </span>
                      </span>
                    </label>
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <div class="pointer-events-auto w-full max-w-xl lg:max-w-md">
            <button
              type="button"
              class="w-full rounded-md border bg-card/90 px-3 py-2 text-left shadow-lg backdrop-blur transition-colors hover:bg-muted"
              onclick={() => (isRollLogOpen = !isRollLogOpen)}
              aria-expanded={isRollLogOpen}
            >
              <span class="flex items-center justify-between gap-3">
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium">
                    {lastDiceRoll ? formatRollLogTitle(lastDiceRoll) : 'Log rzutów'}
                  </span>
                  <span class="mt-1 block truncate text-xs text-muted-foreground">
                    {lastDiceRoll
                      ? `${formatDiceMechanics(lastDiceRoll) || lastDiceRoll.notation} · ${new Date(lastDiceRoll.createdAt).toLocaleTimeString('pl-PL')}`
                      : 'Brak rzutów w tej sesji'}
                  </span>
                </span>
                <span class="shrink-0 rounded-md border bg-background/60 px-2 py-1 text-xs">
                  {diceRolls.length}
                </span>
              </span>
            </button>

            {#if isRollLogOpen}
              <div class="ui-slide-up-in mt-2 max-h-[min(32rem,calc(100vh-9rem))] overflow-y-auto rounded-md border bg-card/95 p-3 shadow-xl ring-1 ring-border/60 backdrop-blur">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <p class="text-sm font-medium">Log rzutów ({diceRolls.length})</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onclick={() => (isRollLogOpen = false)}
                  >
                    Zamknij
                  </Button>
                </div>

                {#if diceRolls.length === 0}
                  <p class="text-sm text-muted-foreground">Brak rzutów w tej sesji.</p>
                {:else}
                  <div class="space-y-2">
                    {#each diceRolls as roll (roll.rollId)}
                      <div class="rounded-md border bg-background/40 px-3 py-2 text-sm">
                        <div class="flex gap-3">
                          <div
                            class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground"
                            title={rollAvatarLabel(roll)}
                            aria-label={`Avatar: ${rollAvatarLabel(roll)}`}
                          >
                            {#if resolveRollAvatarEntry(roll)?.character?.avatarUrl}
                              <img
                                class="h-full w-full object-cover"
                                src={resolveRollAvatarEntry(roll)?.character?.avatarUrl ?? ''}
                                alt={`Avatar postaci ${rollAvatarLabel(roll)}`}
                              />
                            {:else}
                              {rollAvatarInitial(roll)}
                            {/if}
                          </div>

                          <div class="min-w-0 flex-1">
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
                                  <p class="text-lg font-semibold">{formatDiceRollTotal(roll)}</p>
                                {/if}
                                <p class="text-xs text-muted-foreground">
                                  {new Date(roll.createdAt).toLocaleTimeString('pl-PL')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="pointer-events-none absolute inset-0 z-20">
          <DiceBoxRoller
            sessionId={session.sessionId}
            {userId}
            userName={currentUserName}
            disabled={!session || actionBlocksRoll}
            notationPreset={activeNotationPreset}
            showQuickNotations={false}
            replayRoll={diceRollReplay}
            surfaceHeightPx={260}
            surfaceWidthPx={900}
            controlsPlacement="bottom"
            fillAvailableSpace
            overlayMode
            transparentBackground
            onMessage={(message) => (diceMessage = message)}
            onRollPrepared={handleDiceRollPrepared}
            onRollComplete={handleDiceRollComplete}
            onReplayComplete={handleDiceRollReplayComplete}
          />
        </div>

        <Dialog.Root open={isTableBackgroundOpen} onOpenChange={(open) => (isTableBackgroundOpen = open)}>
          <Dialog.Portal>
            <Dialog.Overlay class="ui-fade-in fixed inset-0 z-[90] bg-black/50" />
            <Dialog.Content
              class="ui-dialog-in fixed left-1/2 top-1/2 z-[100] max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg"
            >
              <div class="space-y-1">
                <Dialog.Title class="text-lg font-semibold">Tło stołu</Dialog.Title>
                <Dialog.Description class="text-sm text-muted-foreground">
                  Wgraj obraz i wybierz go jako tło widoku stołu. To nie zmienia battle mapy.
                </Dialog.Description>
              </div>

              <div class="mt-5 space-y-4">
                <div class="rounded-md border bg-background/40 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium">Zapisane tła</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        Wybrane tło będzie widoczne pod avatarami graczy.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingTableBackgrounds}
                      onclick={loadTableBackgroundAssets}
                    >
                      Odśwież
                    </Button>
                  </div>

                  {#if isLoadingTableBackgrounds}
                    <div class="mt-4 flex justify-center py-4">
                      <div class="flex items-center gap-3">
                        <Spinner size="sm" label="Ładowanie teł stołu..." />
                        <p class="text-sm text-muted-foreground">Ładowanie teł stołu...</p>
                      </div>
                    </div>
                  {:else if tableBackgroundAssets.length > 0}
                    <div class="mt-4 grid gap-2">
                      {#each tableBackgroundAssets as asset (asset.assetId)}
                        <div class="grid gap-3 rounded-md border bg-background p-2 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
                          <div class="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {#if asset.url}
                              <img class="h-full w-full object-cover" src={asset.url} alt="" />
                            {:else}
                              <span class="text-xs text-muted-foreground">Tło</span>
                            {/if}
                          </div>

                          <div class="min-w-0">
                            <p class="truncate text-sm font-medium">{tableBackgroundAssetLabel(asset)}</p>
                            <p class="mt-1 text-xs text-muted-foreground">
                              {selectedTableBackgroundAsset?.assetId === asset.assetId
                                ? 'Aktualnie wybrane'
                                : 'Dostępne tło stołu'}
                            </p>
                          </div>

                          <div class="flex flex-wrap gap-2 sm:justify-end">
                            <Button
                              type="button"
                              size="sm"
                              disabled={selectedTableBackgroundAsset?.assetId === asset.assetId}
                              onclick={() => (selectedTableBackgroundAsset = asset)}
                            >
                              Wybierz
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={deletingTableBackgroundAssetIds.includes(asset.assetId)}
                              onclick={() => deleteTableBackgroundAsset(asset)}
                            >
                              {deletingTableBackgroundAssetIds.includes(asset.assetId) ? 'Usuwanie...' : 'Usuń'}
                            </Button>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="mt-4 rounded-md border border-dashed bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
                      Nie ma jeszcze zapisanych teł stołu.
                    </div>
                  {/if}
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="table-background-name">Nazwa tła</Label>
                    <Input
                      id="table-background-name"
                      bind:value={tableBackgroundName}
                      disabled={isUploadingTableBackground}
                      placeholder="Stół w bibliotece"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="table-background-file">Plik tła</Label>
                    <Input
                      id="table-background-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={isUploadingTableBackground}
                      onchange={handleTableBackgroundFileChange}
                    />
                  </div>
                </div>

                {#if tableBackgroundMessage}
                  <p class="rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                    {tableBackgroundMessage}
                  </p>
                {/if}

                <div class="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isUploadingTableBackground}
                    onclick={() => (isTableBackgroundOpen = false)}
                  >
                    Zamknij
                  </Button>
                  <Button
                    type="button"
                    disabled={!selectedTableBackgroundFile || isUploadingTableBackground}
                    onclick={uploadTableBackground}
                  >
                    {isUploadingTableBackground ? 'Dodawanie...' : 'Dodaj i wybierz'}
                  </Button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>

      <GmOnlyLiveSessionToolbox
        {canManageSession}
        characters={toolboxCharacters}
        savingResourceKey={savingToolboxResourceKey}
        onResourceChange={updateToolboxResource}
      />

    {/if}

    {#if isLoading}
      <div class="flex justify-center py-8">
        <div class="flex items-center gap-3">
          <Spinner size="sm" label="Ładowanie live sesji..." />
          <p class="text-sm text-muted-foreground">Ładowanie live sesji...</p>
        </div>
      </div>
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
      {:else if isEditing}
        <div
          class="ui-fade-in fixed inset-0 z-[80] bg-background/75 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
        >
        <div
          class={canManageSession
            ? 'ui-slide-up-in mx-auto grid h-full min-h-0 w-full max-w-7xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]'
            : 'ui-slide-up-in mx-auto h-full min-h-0 w-full max-w-5xl'}
        >
          {#if canManageSession}
            <Card class="max-h-full overflow-y-auto border-border/80 bg-card/95">
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

          <div class="min-h-0 overflow-y-auto">
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

                    <div class="rounded-md border bg-background/40 p-4">
                      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex items-center gap-4">
                          <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xl font-semibold text-muted-foreground">
                            {#if activeEntry.character.avatarUrl}
                              <img
                                class="h-full w-full object-cover"
                                src={activeEntry.character.avatarUrl}
                                alt={`Avatar postaci ${activeEntry.character.name}`}
                              />
                            {:else}
                              {activeEntry.character.name.slice(0, 1).toUpperCase()}
                            {/if}
                          </div>

                          <div>
                            <p class="text-sm font-medium">Avatar postaci</p>
                            <p class="mt-1 text-sm text-muted-foreground">
                              JPEG, PNG albo WebP. Maksymalnie 2 MB.
                            </p>
                            {#if avatarMessage}
                              <p class="mt-2 text-sm text-muted-foreground">{avatarMessage}</p>
                            {/if}
                          </div>
                        </div>

                        <div class="flex flex-col gap-2 sm:items-end">
                          <Label for="session-character-avatar" class="sr-only">Plik avatara</Label>
                          <Input
                            id="session-character-avatar"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={isSaving || isUploadingAvatar || isDeletingAvatar}
                            onchange={handleSessionAvatarFileChange}
                          />

                          {#if activeEntry.character.avatarUrl}
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isSaving || isUploadingAvatar || isDeletingAvatar}
                              onclick={deleteActiveCharacterAvatar}
                            >
                              {isDeletingAvatar ? 'Usuwanie...' : 'Usuń avatar'}
                            </Button>
                          {/if}
                        </div>
                      </div>
                    </div>

                    {#if activeEntryCanBeEdited && isActiveVampireSystem}
                      <div class="rounded-md border bg-background/40 p-4">
                        <div>
                          <p class="text-sm font-medium">Dyscypliny</p>
                          <p class="mt-1 text-sm text-muted-foreground">
                            Dopisz moc dyscypliny do aktywnej karty postaci w tej sesji.
                          </p>
                        </div>

                        {#if activeRemovableDisciplineKeys.length || activeDisciplinePowers.length}
                          <div class="mt-4 rounded-md border bg-background/40 p-4">
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

                        <div class="mt-4 grid gap-4 md:grid-cols-[0.8fr_0.9fr_1.3fr]">
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

                        <div class="mt-4 flex justify-end">
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
                      </div>
                    {/if}

                    {#if editDraft}
                      <CharacterEditForm
                        draft={editDraft}
                        disabled={isSaving}
                        isVampireSystem={isActiveVampireSystem}
                        onDraftChange={(nextDraft) => (editDraft = nextDraft)}
                      />
                    {/if}

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
        </div>
      {/if}
    {/if}
  </section>
</main>

<style>
  :global(.stage-track) {
    transform: translate3d(0, 0, 0);
    transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  :global(.stage-track-map) {
    transform: translate3d(-100vw, 0, 0);
  }

  :global(.stage-track-table) {
    transform: translate3d(0, 0, 0);
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.stage-track) {
      transition: none;
    }
  }
</style>
