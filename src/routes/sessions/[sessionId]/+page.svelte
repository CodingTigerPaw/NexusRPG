<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import AddSessionParticipantPanel from '$lib/features/sessions/components/AddSessionParticipantPanel.svelte';
  import SessionDetailsCard from '$lib/features/sessions/components/SessionDetailsCard.svelte';
  import SessionParticipantsList from '$lib/features/sessions/components/SessionParticipantsList.svelte';
  import {
    loadSessionParticipantViewData
  } from '$lib/features/sessions/services/session-participants';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { getCurrentUser, hasRole } from '$lib/modules/auth';
  import { getUserCharacters, type CharacterCard } from '$lib/features/characters/api';
  import { appRoles } from '$lib/modules/navigation';
  import {
    addRpgSessionPlayers,
    formatRpgSessionName,
    getRpgSession,
    removeRpgSessionPlayer,
    type RpgSession,
    type RpgSessionParticipant
  } from '$lib/features/sessions/api';
  import { requireAuth } from '$lib/modules/rbac';
  import { getUsers } from '$lib/modules/users/users';
  import { type AppUser } from '$lib/modules/users/userType';

  let session = $state<RpgSession | null>(null);
  let isLoading = $state(true);
  let errorMessage = $state('');
  let userId = $state('');
  let isAdminUser = $state(false);
  let participantCharactersByKey = $state<Record<string, CharacterCard | null>>({});
  let sessionParticipants = $state<RpgSessionParticipant[]>([]);
  let playerNamesById = $state<Record<string, string>>({});
  let users = $state<AppUser[]>([]);
  let usersNextCursor = $state<string | null>(null);
  let selectedPlayerUserId = $state('');
  let selectedCharacterId = $state('');
  let characterOptionsByPlayer = $state<Record<string, CharacterCard[]>>({});
  let isLoadingUsers = $state(false);
  let isLoadingPlayerCharacters = $state(false);
  let isAddingPlayer = $state(false);
  let removingPlayerUserId = $state('');
  let addPlayerMessage = $state('');

  const sessionId = $derived(page.params.sessionId);
  const isOwner = $derived(Boolean(session && session.ownerUserId === userId));
  const canManageSession = $derived(Boolean(isOwner || isAdminUser));
  const participantUserIds = $derived(new Set(sessionParticipants.map((participant) => participant.userId)));
  const unassignedPlayerUserIds = $derived(
    session
      ? session.playerUserIds.filter(
          (playerUserId) =>
            playerUserId !== session?.ownerUserId && !participantUserIds.has(playerUserId)
        )
      : []
  );
  const availableUsers = $derived(
    users.filter(
      (user) =>
        session &&
        user.userId !== session.ownerUserId &&
        !participantUserIds.has(user.userId)
    )
  );
  const selectedPlayerCharacters = $derived(
    selectedPlayerUserId ? characterOptionsByPlayer[selectedPlayerUserId] ?? [] : []
  );
  const isAssignedPlayer = $derived(
    Boolean(
      session &&
        (isAdminUser ||
        (session.playerUserIds.includes(userId) ||
          (session.participants ?? []).some((participant) => participant.userId === userId)))
    )
  );

  onMount(async () => {
    const allowed = await requireAuth();

    if (!allowed) {
      return;
    }

    userId = getCurrentUser()?.userId ?? '';
    isAdminUser = hasRole(appRoles.admin);

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

      await refreshSessionData(loadedSession);

      if (loadedSession.ownerUserId === userId) {
        await loadUsers();
      }
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać sesji RPG.';
    } finally {
      isLoading = false;
    }
  });

  async function refreshSessionData(nextSession: RpgSession) {
    const viewData = await loadSessionParticipantViewData(nextSession);
    session = nextSession;
    sessionParticipants = viewData.participants;
    participantCharactersByKey = viewData.charactersByKey;
    playerNamesById = viewData.playerNamesById;
  }

  function enterSession() {
    if (session) {
      goto(`/sessions/${session.sessionId}/play`);
    }
  }

  function openParticipantCharacterEditor(participant: RpgSessionParticipant) {
    if (!session || !canManageSession) {
      return;
    }

    goto(
      `/sessions/${session.sessionId}/players/${participant.userId}/characters/${participant.characterId}/edit`
    );
  }

  async function loadUsers(cursor?: string | null) {
    if (!isOwner) {
      return;
    }

    isLoadingUsers = true;
    addPlayerMessage = '';

    try {
      const response = await getUsers({ limit: 100, cursor });
      const nextUsers = response.users.filter((user) => user.userId !== userId);
      users = cursor ? [...users, ...nextUsers] : nextUsers;
      usersNextCursor = response.nextCursor;
    } catch (error) {
      addPlayerMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać listy graczy.';
    } finally {
      isLoadingUsers = false;
    }
  }

  async function selectPlayerForSession(playerUserId: string) {
    if (!session) {
      return;
    }

    selectedPlayerUserId = playerUserId;
    selectedCharacterId = '';
    addPlayerMessage = '';

    if (characterOptionsByPlayer[playerUserId]) {
      return;
    }

    isLoadingPlayerCharacters = true;

    try {
      const response = await getUserCharacters(playerUserId, {
        limit: 100,
        rpgSystem: session.rpgSystem
      });
      characterOptionsByPlayer = {
        ...characterOptionsByPlayer,
        [playerUserId]: response.characterSheets
      };
    } catch (error) {
      addPlayerMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać postaci gracza.';
    } finally {
      isLoadingPlayerCharacters = false;
    }
  }

  async function addSelectedParticipant() {
    if (!session) {
      return;
    }

    if (!selectedPlayerUserId || !selectedCharacterId) {
      addPlayerMessage = 'Wybierz gracza i postać do dodania.';
      return;
    }

    isAddingPlayer = true;
    addPlayerMessage = '';

    try {
      const updatedSession = await addRpgSessionPlayers(session.sessionId, {
        participants: [
          {
            userId: selectedPlayerUserId,
            characterId: selectedCharacterId
          }
        ]
      });
      await refreshSessionData(updatedSession);
      selectedPlayerUserId = '';
      selectedCharacterId = '';
      addPlayerMessage = 'Gracz został dodany do sesji.';
    } catch (error) {
      addPlayerMessage =
        error instanceof Error ? error.message : 'Nie udało się dodać gracza do sesji.';
    } finally {
      isAddingPlayer = false;
    }
  }

  async function removePlayerFromSession(playerUserId: string) {
    if (!session || !isOwner || removingPlayerUserId) {
      return;
    }

    removingPlayerUserId = playerUserId;
    addPlayerMessage = '';

    try {
      const updatedSession = await removeRpgSessionPlayer(session.sessionId, playerUserId);
      await refreshSessionData(updatedSession);

      if (selectedPlayerUserId === playerUserId) {
        selectedPlayerUserId = '';
        selectedCharacterId = '';
      }

      addPlayerMessage = 'Gracz został usunięty z sesji.';
    } catch (error) {
      addPlayerMessage =
        error instanceof Error ? error.message : 'Nie udało się usunąć gracza z sesji.';
    } finally {
      removingPlayerUserId = '';
    }
  }

</script>

<svelte:head>
  <title>{session ? formatRpgSessionName(session) : 'Sesja RPG'}</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-5xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm text-muted-foreground">Sesja RPG</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal">
          {session ? formatRpgSessionName(session) : 'Wczytywanie...'}
        </h1>
        {#if session}
          <p class="mt-2 text-sm text-muted-foreground">{session.rpgSystem}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        {#if session && (isOwner || isAssignedPlayer)}
          <Button type="button" onclick={enterSession}>
            Wejdź do sesji
          </Button>
        {/if}
        <Button type="button" variant="outline" onclick={() => goto('/sessions')}>Wróć do sesji</Button>
      </div>
    </div>

    {#if isLoading}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Pobieranie sesji RPG...</p>
        </CardContent>
      </Card>
    {:else if errorMessage}
      <Card class="border-destructive/40 bg-destructive/10">
        <CardContent class="p-6">
          <p class="text-sm text-destructive-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    {:else if session}
      <div class="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <SessionDetailsCard
          {session}
          {isAdminUser}
          {isOwner}
          {isAssignedPlayer}
        />

        <SessionParticipantsList
          {sessionParticipants}
          {unassignedPlayerUserIds}
          {playerNamesById}
          {participantCharactersByKey}
          {canManageSession}
          {isOwner}
          {removingPlayerUserId}
          message={addPlayerMessage}
          onEdit={openParticipantCharacterEditor}
          onRemove={removePlayerFromSession}
        />
      </div>

      {#if isOwner}
        <AddSessionParticipantPanel
          {session}
          {usersNextCursor}
          {availableUsers}
          {selectedPlayerUserId}
          {selectedCharacterId}
          {selectedPlayerCharacters}
          {isLoadingUsers}
          {isLoadingPlayerCharacters}
          {isAddingPlayer}
          onLoadMore={(cursor) => loadUsers(cursor)}
          onSelectPlayer={selectPlayerForSession}
          onSelectCharacter={(characterId) => (selectedCharacterId = characterId)}
          onAdd={addSelectedParticipant}
        />
      {/if}
    {/if}
  </section>
</main>
