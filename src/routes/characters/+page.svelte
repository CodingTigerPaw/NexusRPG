<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { getCurrentUser } from '$lib/modules/AuthModule/user';
  import { hasCharacterDrafts } from '$lib/modules/charactersModule/character-builder';
  import { getCharacters, type CharacterCard } from '$lib/modules/characters';
  import { formatRpgSessionName, getRpgSessions } from '$lib/modules/rpg-sessions';
  import { requireAuth } from '$lib/modules/rbac';

  let characters = $state<CharacterCard[]>([]);
  let isLoading = $state(true);
  let isLoadingMore = $state(false);
  let errorMessage = $state('');
  let loadMoreErrorMessage = $state('');
  let nextCursor = $state<string | null>(null);
  let hasDraft = $state(false);
  let sessionNamesById = $state<Record<string, string>>({});
  const pageLimit = 25;

  onMount(async () => {
    const authenticated = await requireAuth();

    if (!authenticated) {
      return;
    }

    try {
      const user = getCurrentUser();
      hasDraft = Boolean(user?.userId && hasCharacterDrafts(user.userId));
      const [response, sessionsById] = await Promise.all([
        getCharacters({ limit: pageLimit }),
        loadAccessibleSessionNames()
      ]);
      characters = response.characterSheets;
      sessionNamesById = sessionsById;
      nextCursor = response.nextCursor;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać kart postaci.';
    } finally {
      isLoading = false;
    }
  });

  function openCharacter(character: CharacterCard) {
    void goto(`/characters/${character.characterId}`);
  }

  function openCharacterCreator() {
    void goto('/characters/new');
  }

  function openDraftsList() {
    void goto('/characters/drafts');
  }

  async function loadMore() {
    if (!nextCursor) {
      return;
    }

    loadMoreErrorMessage = '';
    isLoadingMore = true;

    try {
      const response = await getCharacters({ limit: pageLimit, cursor: nextCursor });
      characters = [...characters, ...response.characterSheets];
      nextCursor = response.nextCursor;
    } catch (error) {
      loadMoreErrorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać kolejnej strony kart.';
    } finally {
      isLoadingMore = false;
    }
  }

  async function loadAccessibleSessionNames() {
    const sessionsById: Record<string, string> = {};
    let cursor: string | null = null;

    do {
      const response = await getRpgSessions({ limit: 100, cursor });
      response.sessions.forEach((session) => {
        sessionsById[session.sessionId] = formatRpgSessionName(session);
      });
      cursor = response.nextCursor;
    } while (cursor);

    return sessionsById;
  }

  function getCharacterSessionName(character: CharacterCard) {
    if (!character.sessionId) {
      return 'brak';
    }

    return sessionNamesById[character.sessionId] ?? 'Sesja przypisana';
  }
</script>

<svelte:head>
  <title>Postacie</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-normal">Postacie</h1>
  
      </div>

      <div class="flex items-center gap-2">
        {#if hasDraft}
          <Button type="button" variant="outline" onclick={openDraftsList}>
            Wznów szkic postaci
          </Button>
        {/if}
        <Button type="button" onclick={openCharacterCreator}>Nowa postać</Button>
      </div>
    </div>

    {#if isLoading}
      <div class="flex justify-center py-8">
        <div class="flex items-center gap-3">
          <Spinner size="sm" label="Pobieranie kart postaci..." />
          <p class="text-sm text-muted-foreground">Pobieranie kart postaci...</p>
        </div>
      </div>
    {:else if errorMessage}
      <Card class="border-destructive/40 bg-destructive/10">
        <CardContent class="p-6">
          <p class="text-sm text-destructive-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    {:else if characters.length === 0}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Nie znaleziono kart postaci.</p>
        </CardContent>
      </Card>
    {:else}
      {#if loadMoreErrorMessage}
        <Card class="border-destructive/40 bg-destructive/10">
          <CardContent class="p-4">
            <p class="text-sm text-destructive-foreground">{loadMoreErrorMessage}</p>
          </CardContent>
        </Card>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each characters as character (character.characterId)}
          <button
            class="text-left"
            type="button"
            onclick={() => openCharacter(character)}
            aria-label={`Otwórz kartę postaci ${character.name}`}
          >
            <Card class="h-full border-border/80 bg-card/95 transition-colors hover:border-primary/60">
              <CardHeader>
                <div class="flex items-start gap-3">
                  <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background/60">
                    {#if character.avatarUrl}
                      <img
                        class="h-full w-full object-cover"
                        src={character.avatarUrl}
                        alt={`Awatar postaci ${character.name}`}
                      />
                    {:else}
                      <span class="text-lg font-semibold text-muted-foreground">
                        {character.name.slice(0, 1).toUpperCase()}
                      </span>
                    {/if}
                  </div>

                  <div class="min-w-0">
                    <CardTitle class="break-words text-xl tracking-normal">{character.name}</CardTitle>
                    <CardDescription>{character.rpgSystem ?? 'System nieuzupełniony'}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent class="space-y-3">
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p class="text-muted-foreground">Wiek</p>
                    <p class="font-medium">{character.age ?? 'brak danych'}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Sesja</p>
                    <p class="font-medium">{getCharacterSessionName(character)}</p>
                  </div>
                </div>

                {#if character.updatedAt}
                  <p class="text-sm text-muted-foreground">
                    Aktualizacja: <span class="text-foreground">{new Date(character.updatedAt).toLocaleDateString('pl-PL')}</span>
                  </p>
                {/if}
              </CardContent>
            </Card>
          </button>
        {/each}
      </div>

      {#if nextCursor}
        <div class="flex justify-center">
          <Button type="button" variant="secondary" disabled={isLoadingMore} onclick={loadMore}>
            {#if isLoadingMore}
              <Spinner size="sm" class="mr-2 text-secondary-foreground" label="Pobieranie kolejnych postaci..." />
              Pobieranie...
            {:else}
              Pokaż więcej
            {/if}
          </Button>
        </div>
      {/if}
    {/if}
  </section>
</main>
