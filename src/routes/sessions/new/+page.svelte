<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
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
  import { getCurrentUser } from '$lib/modules/auth';
  import { getUserCharacters, type CharacterCard } from '$lib/modules/characters';
  import { appRoles } from '$lib/modules/navigation';
  import {
    createRpgSession,
    type RpgSession,
    type RpgSessionParticipant
  } from '$lib/modules/rpg-sessions';
  import { requireRole } from '$lib/modules/rbac';
  import { getUsers } from '$lib/modules/users/users';
  import { type AppUser } from '$lib/modules/users/userType';

  type SystemOption = {
    id: string;
    label: string;
    description: string;
  };

  const systemOptions: SystemOption[] = [
    {
      id: 'Call of Cthulhu 5e',
      label: 'Zew Cthulhu 5e',
      description: 'Śledczy, profesje, cechy procentowe i sanity.'
    },
    {
      id: 'Vampire: The Masquerade',
      label: 'Wampir: Maskarada',
      description: 'Klan, atrybuty, zdolności, cnoty i dyscypliny.'
    }
  ];

  const steps = ['System', 'Uczestnicy', 'Podsumowanie'];

  let allowed = $state(false);
  let ready = $state(false);
  let stepIndex = $state(0);
  let rpgSystem = $state(systemOptions[0].id);
  let sessionName = $state('');
  let description = $state('');
  let users = $state<AppUser[]>([]);
  let usersNextCursor = $state<string | null>(null);
  let selectedPlayerIds = $state<string[]>([]);
  let characterOptionsByPlayer = $state<Record<string, CharacterCard[]>>({});
  let selectedCharacterIdsByPlayer = $state<Record<string, string>>({});
  let isLoadingUsers = $state(false);
  let isLoadingPickerCharacters = $state(false);
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let pickerErrorMessage = $state('');
  let createdSession = $state<RpgSession | null>(null);
  let currentUserId = $state('');
  let pickerPlayerId = $state<string | null>(null);
  let pickerSelectedCharacterId = $state('');

  const pickerPlayer = $derived(
    pickerPlayerId ? users.find((user) => user.userId === pickerPlayerId) ?? null : null
  );
  const pickerCharacters = $derived(
    pickerPlayerId ? characterOptionsByPlayer[pickerPlayerId] ?? [] : []
  );
  const selectedPlayers = $derived(
    selectedPlayerIds
      .map((userId) => users.find((user) => user.userId === userId))
      .filter((user): user is AppUser => Boolean(user))
  );
  const canGoNext = $derived(
    (stepIndex === 0 && sessionName.trim().length > 0) ||
      (stepIndex === 1 &&
        selectedPlayerIds.length > 0 &&
        selectedPlayerIds.every((userId) => selectedCharacterIdsByPlayer[userId])) ||
      stepIndex === 2
  );

  onMount(async () => {
    allowed = await requireRole(appRoles.gm);
    ready = true;

    if (!allowed) {
      return;
    }

    currentUserId = getCurrentUser()?.userId ?? '';
    await loadUsers();
  });

  async function loadUsers(cursor?: string | null) {
    isLoadingUsers = true;
    errorMessage = '';

    try {
      const response = await getUsers({ limit: 100, cursor });
      const nextUsers = response.users.filter((user) => user.userId !== currentUserId);
      users = cursor ? [...users, ...nextUsers] : nextUsers;
      usersNextCursor = response.nextCursor;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać listy graczy.';
    } finally {
      isLoadingUsers = false;
    }
  }

  function selectSystem(systemId: string) {
    rpgSystem = systemId;
    characterOptionsByPlayer = {};
    selectedPlayerIds = [];
    selectedCharacterIdsByPlayer = {};
    closeCharacterPicker();
  }

  function formatUserName(user: AppUser) {
    return user.username ?? user.email ?? user.userId;
  }

  async function openCharacterPicker(userId: string) {
    pickerPlayerId = userId;
    pickerSelectedCharacterId = selectedCharacterIdsByPlayer[userId] ?? '';
    pickerErrorMessage = '';

    if (characterOptionsByPlayer[userId]) {
      return;
    }

    isLoadingPickerCharacters = true;

    try {
      const response = await getUserCharacters(userId, {
        limit: 100,
        rpgSystem
      });
      characterOptionsByPlayer = {
        ...characterOptionsByPlayer,
        [userId]: response.characterSheets
      };
    } catch (error) {
      pickerErrorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać postaci gracza.';
    } finally {
      isLoadingPickerCharacters = false;
    }
  }

  function closeCharacterPicker() {
    pickerPlayerId = null;
    pickerSelectedCharacterId = '';
    pickerErrorMessage = '';
    isLoadingPickerCharacters = false;
  }

  function addPickedCharacter() {
    if (!pickerPlayerId || !pickerSelectedCharacterId) {
      pickerErrorMessage = 'Wybierz postać do dodania.';
      return;
    }

    selectedCharacterIdsByPlayer = {
      ...selectedCharacterIdsByPlayer,
      [pickerPlayerId]: pickerSelectedCharacterId
    };

    if (!selectedPlayerIds.includes(pickerPlayerId)) {
      selectedPlayerIds = [...selectedPlayerIds, pickerPlayerId];
    }

    closeCharacterPicker();
  }

  function removeParticipant(userId: string) {
    selectedPlayerIds = selectedPlayerIds.filter((entry) => entry !== userId);
    const nextSelectedCharacters = { ...selectedCharacterIdsByPlayer };
    delete nextSelectedCharacters[userId];
    selectedCharacterIdsByPlayer = nextSelectedCharacters;
  }

  function goNext() {
    if (!canGoNext) {
      errorMessage =
        stepIndex === 1
          ? 'Dodaj przynajmniej jednego gracza z wybraną postacią.'
          : 'Podaj nazwę sesji.';
      return;
    }

    errorMessage = '';
    stepIndex = Math.min(stepIndex + 1, steps.length - 1);
  }

  function goBack() {
    errorMessage = '';
    stepIndex = Math.max(stepIndex - 1, 0);
  }

  function getSelectedCharacter(userId: string) {
    const characterId = selectedCharacterIdsByPlayer[userId];
    return characterOptionsByPlayer[userId]?.find((character) => character.characterId === characterId);
  }

  function buildParticipants(): RpgSessionParticipant[] {
    return selectedPlayerIds.map((userId) => ({
      userId,
      characterId: selectedCharacterIdsByPlayer[userId]
    }));
  }

  async function handleSubmit() {
    errorMessage = '';
    createdSession = null;

    if (!selectedPlayerIds.every((userId) => selectedCharacterIdsByPlayer[userId])) {
      errorMessage = 'Dodaj postać dla każdego gracza.';
      return;
    }

    if (!sessionName.trim()) {
      errorMessage = 'Podaj nazwę sesji.';
      return;
    }

    isSubmitting = true;

    try {
      createdSession = await createRpgSession({
        rpgSystem,
        name: sessionName.trim(),
        description: description.trim() || null,
        participants: buildParticipants()
      });
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się utworzyć sesji RPG.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Nowa sesja RPG </title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-normal">Nowa sesja RPG</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Wybierz system, kliknij gracza i dodaj jego postać do listy uczestników.
        </p>
      </div>

      <Button type="button" variant="outline" onclick={() => goto('/sessions')}>Sesje</Button>
    </div>

    {#if !ready}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Sprawdzanie uprawnień...</p>
        </CardContent>
      </Card>
    {:else if allowed}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-4">
          <div class="grid gap-2 sm:grid-cols-3">
            {#each steps as step, index}
              <button
                class={[
                  'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  index === stepIndex
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border/80 text-muted-foreground hover:bg-muted'
                ]}
                type="button"
                onclick={() => (stepIndex = index)}
              >
                <span class="block text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Krok {index + 1}
                </span>
                <span class="block font-medium">{step}</span>
              </button>
            {/each}
          </div>
        </CardContent>
      </Card>

      {#if errorMessage}
        <div class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {errorMessage}
        </div>
      {/if}

      {#if createdSession}
        <div class="rounded-md border border-primary/35 bg-primary/10 p-4 text-sm">
          <p class="font-medium text-primary">Sesja została utworzona.</p>
          <div class="mt-4 flex justify-end">
            <Button type="button" onclick={() => goto(`/sessions/${createdSession?.sessionId}`)}>
              Przejdź do sesji
            </Button>
          </div>
        </div>
      {/if}

      {#if stepIndex === 0}
        <Card class="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>System RPG</CardTitle>
            <CardDescription>Podaj nazwę sesji i wybierz system, który zawęzi listę kart postaci.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <Label for="session-name">Nazwa sesji</Label>
              <Input
                id="session-name"
                bind:value={sessionName}
                placeholder="Cienie nad Arkham"
              />
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              {#each systemOptions as option}
                <button
                  class={[
                    'rounded-md border px-4 py-3 text-left transition-colors',
                    option.id === rpgSystem
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border/80 bg-background/40 hover:bg-muted'
                  ]}
                  type="button"
                  onclick={() => selectSystem(option.id)}
                >
                  <span class="block font-medium">{option.label}</span>
                  <span class="mt-1 block text-sm text-muted-foreground">{option.description}</span>
                </button>
              {/each}
            </div>
          </CardContent>
        </Card>
      {:else if stepIndex === 1}
        <div class="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card class="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Gracze</CardTitle>
              <CardDescription>Kliknij gracza, aby wybrać jego postać dla systemu {rpgSystem}.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              {#if isLoadingUsers}
                <p class="text-sm text-muted-foreground">Pobieranie graczy...</p>
              {:else if users.length === 0}
                <p class="text-sm text-muted-foreground">Brak użytkowników do wyboru.</p>
              {:else}
                <div class="grid gap-3 md:grid-cols-2">
                  {#each users as user (user.userId)}
                    <button
                      class={[
                        'rounded-md border px-4 py-3 text-left transition-colors',
                        selectedPlayerIds.includes(user.userId)
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/80 bg-background/40 hover:bg-muted'
                      ]}
                      type="button"
                      onclick={() => openCharacterPicker(user.userId)}
                    >
                      <span class="block break-all font-medium">{formatUserName(user)}</span>
                      <span class="mt-1 block text-sm text-muted-foreground">
                        {getSelectedCharacter(user.userId)?.name ?? 'kliknij, aby wybrać postać'}
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}

              {#if usersNextCursor}
                <Button type="button" variant="secondary" disabled={isLoadingUsers} onclick={() => loadUsers(usersNextCursor)}>
                  Pokaż więcej
                </Button>
              {/if}
            </CardContent>
          </Card>

          <Card class="border-border/80 bg-card/95">
            <CardHeader>
              <CardTitle>Dodane postacie</CardTitle>
              <CardDescription>Lista uczestników, którzy zostaną wysłani do backendu jako `participants`.</CardDescription>
            </CardHeader>
            <CardContent>
              {#if selectedPlayers.length === 0}
                <p class="text-sm text-muted-foreground">Nie dodano jeszcze żadnej postaci.</p>
              {:else}
                <div class="space-y-2">
                  {#each selectedPlayers as player (player.userId)}
                    <div class="rounded-md border bg-background/40 px-3 py-2 text-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="font-medium">{formatUserName(player)}</p>
                          <p class="mt-1 text-muted-foreground">
                            Postać: {getSelectedCharacter(player.userId)?.name ?? 'brak'}
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="ghost" onclick={() => removeParticipant(player.userId)}>
                          Usuń
                        </Button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </CardContent>
          </Card>
        </div>
      {:else}
        <Card class="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Podsumowanie</CardTitle>
            <CardDescription>
              Backend utworzy sesję na podstawie wybranych uczestników i zapisze `sessionId` na wskazanych kartach postaci.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <Label for="session-name-summary">Nazwa sesji</Label>
              <Input
                id="session-name-summary"
                bind:value={sessionName}
                disabled={isSubmitting}
                placeholder="Cienie nad Arkham"
              />
            </div>

            <div class="space-y-2">
              <Label for="description">Opis sesji</Label>
              <Textarea
                id="description"
                bind:value={description}
                disabled={isSubmitting}
                placeholder="Kampania osadzona w Arkham."
              />
            </div>

            <div class="rounded-md border bg-background/40 p-4 text-sm">
              <p class="font-medium">{sessionName || 'Sesja bez nazwy'}</p>
              <p class="mt-1 text-muted-foreground">System: {rpgSystem}</p>
              <div class="mt-3 space-y-2">
                {#each selectedPlayers as player (player.userId)}
                  <div class="flex flex-col gap-1 rounded-md border bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>{formatUserName(player)}</span>
                    <span class="text-muted-foreground">{getSelectedCharacter(player.userId)?.name ?? 'brak postaci'}</span>
                  </div>
                {/each}
              </div>
            </div>
          </CardContent>
        </Card>
      {/if}

      <div class="flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={stepIndex === 0 || isSubmitting} onclick={goBack}>
          Wstecz
        </Button>

        {#if stepIndex < steps.length - 1}
          <Button type="button" disabled={!canGoNext} onclick={goNext}>Dalej</Button>
        {:else}
          <Button type="button" disabled={isSubmitting || Boolean(createdSession)} onclick={handleSubmit}>
            {isSubmitting ? 'Tworzenie...' : 'Utwórz sesję'}
          </Button>
        {/if}
      </div>
    {/if}
  </section>

  {#if pickerPlayer}
    <div
      class="bg-background/80 backdrop-blur-sm"
      style="position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; min-height: 100vh; width: 100vw; padding: 1rem;"
    >
      <div
        class="flex flex-col rounded-md border bg-card p-3 shadow-2xl sm:p-4"
        style="width: min(42rem, calc(100vw - 2rem)); max-height: calc(100vh - 2rem);"
      >
        <div class="flex items-start justify-between gap-4 rounded-sm border-b px-5 py-5 sm:px-6">
          <div>
            <h2 class="text-xl font-semibold tracking-normal">Wybierz postać</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {formatUserName(pickerPlayer)} · {rpgSystem}
            </p>
          </div>
          <Button type="button" variant="ghost" onclick={closeCharacterPicker}>Zamknij</Button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {#if pickerErrorMessage}
            <p class="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {pickerErrorMessage}
            </p>
          {/if}

          {#if isLoadingPickerCharacters}
            <p class="text-sm text-muted-foreground">Pobieranie postaci...</p>
          {:else if pickerCharacters.length === 0}
            <p class="text-sm text-muted-foreground">Ten gracz nie ma postaci dla wybranego systemu.</p>
          {:else}
            <div class="grid gap-4 md:grid-cols-2">
              {#each pickerCharacters as character (character.characterId)}
                <button
                  class={[
                    'rounded-md border px-4 py-3 text-left transition-colors',
                    pickerSelectedCharacterId === character.characterId
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border/80 bg-background/40 hover:bg-muted'
                  ]}
                  type="button"
                  onclick={() => (pickerSelectedCharacterId = character.characterId)}
                >
                  <span class="block font-medium">{character.name}</span>
                  <span class="mt-1 block text-sm text-muted-foreground">
                    {character.rpgSystem ?? rpgSystem}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex items-center justify-end gap-2 rounded-sm border-t px-5 py-5 sm:px-6">
          <Button type="button" variant="ghost" onclick={closeCharacterPicker}>Anuluj</Button>
          <Button
            type="button"
            disabled={isLoadingPickerCharacters || !pickerSelectedCharacterId}
            onclick={addPickedCharacter}
          >
            Dodaj
          </Button>
        </div>
      </div>
    </div>
  {/if}
</main>
