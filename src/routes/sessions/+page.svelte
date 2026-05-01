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
  import { getCurrentUser, hasRole } from '$lib/modules/auth';
  import { appRoles } from '$lib/modules/navigation';
  import {
    formatRpgSessionName,
    getRpgSessions,
    type RpgSession
  } from '$lib/modules/rpg-sessions';
  import { requireAuth } from '$lib/modules/rbac';

  let sessions = $state<RpgSession[]>([]);
  let isLoading = $state(true);
  let isLoadingMore = $state(false);
  let errorMessage = $state('');
  let nextCursor = $state<string | null>(null);
  let userId = $state('');
  const pageLimit = 25;
  const canCreateSession = $derived(hasRole(appRoles.gm));

  onMount(async () => {
    const allowed = await requireAuth();

    if (!allowed) {
      return;
    }

    userId = getCurrentUser()?.userId ?? '';

    try {
      const response = await getRpgSessions({ limit: pageLimit });
      sessions = response.sessions;
      nextCursor = response.nextCursor;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać sesji RPG.';
    } finally {
      isLoading = false;
    }
  });

  async function loadMore() {
    if (!nextCursor) {
      return;
    }

    errorMessage = '';
    isLoadingMore = true;

    try {
      const response = await getRpgSessions({ limit: pageLimit, cursor: nextCursor });
      sessions = [...sessions, ...response.sessions];
      nextCursor = response.nextCursor;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać kolejnej strony sesji.';
    } finally {
      isLoadingMore = false;
    }
  }

  function formatDate(value: string | undefined) {
    return value ? new Date(value).toLocaleString('pl-PL') : 'brak danych';
  }

  function getSessionAccessLabel(session: RpgSession) {
    if (session.ownerUserId === userId) {
      return 'GM';
    }

    return 'Gracz';
  }
</script>

<svelte:head>
  <title>Sesje RPG</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-normal">Sesje RPG</h1>
 
      </div>

      {#if canCreateSession}
        <Button type="button" onclick={() => goto('/sessions/new')}>Nowa sesja</Button>
      {/if}
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
    {:else if sessions.length === 0}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Nie znaleziono sesji przypisanych do tego konta.</p>
        </CardContent>
      </Card>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each sessions as session (session.sessionId)}
          <button
            class="text-left"
            type="button"
            onclick={() => goto(`/sessions/${session.sessionId}`)}
            aria-label={`Otwórz sesję ${formatRpgSessionName(session)}`}
          >
            <Card class="h-full border-border/80 bg-card/95 transition-colors hover:border-primary/60">
              <CardHeader class="space-y-2">
                <CardTitle class="text-xl tracking-normal">{formatRpgSessionName(session)}</CardTitle>
                <CardDescription>{session.rpgSystem}</CardDescription>
              </CardHeader>

              <CardContent class="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p class="text-muted-foreground">Gracze</p>
                  <p class="font-medium">{session.playerUserIds.length}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Twoja rola</p>
                  <p class="font-medium">{getSessionAccessLabel(session)}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Aktualizacja</p>
                  <p class="font-medium">{formatDate(session.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        {/each}
      </div>

      {#if nextCursor}
        <div class="flex justify-center">
          <Button type="button" variant="secondary" disabled={isLoadingMore} onclick={loadMore}>
            {isLoadingMore ? 'Pobieranie...' : 'Pokaż więcej'}
          </Button>
        </div>
      {/if}
    {/if}
  </section>
</main>
