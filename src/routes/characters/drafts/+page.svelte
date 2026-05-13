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
  import { getCurrentUser } from '$lib/modules/AuthModule/user';
  import {
    deleteCharacterDraft,
    getCharacterSystemSummaries,
    listCharacterDrafts,
    type CharacterDraftSummary
  } from '$lib/modules/charactersModule/character-builder';
  import { requireAuth } from '$lib/modules/rbac';

  let drafts = $state<CharacterDraftSummary[]>([]);
  let loading = $state(true);
  const gameSystems = getCharacterSystemSummaries();

  onMount(async () => {
    const authenticated = await requireAuth();

    if (!authenticated) {
      return;
    }

    const user = getCurrentUser();

    if (!user?.userId) {
      await goto('/characters');
      return;
    }

    drafts = listCharacterDrafts(user.userId);
    loading = false;
  });

  function getSystemLabel(system: CharacterDraftSummary['system']) {
    return gameSystems.find((entry) => entry.id === system)?.label ?? system;
  }

  function resumeDraft(draftId: string) {
    void goto(`/characters/new?draftId=${draftId}`);
  }

  function removeDraft(draftId: string) {
    const user = getCurrentUser();

    if (!user?.userId) {
      return;
    }

    deleteCharacterDraft(user.userId, draftId);
    drafts = listCharacterDrafts(user.userId);
  }
</script>

<svelte:head>
  <title>Szkice postaci</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-5xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-normal">Niedokończone postacie</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Wybierz szkic do wznowienia. Każdy szkic jest zapisany lokalnie dla aktualnego użytkownika.
        </p>
      </div>

      <Button type="button" onclick={() => goto('/characters/new')}>Nowa postać</Button>
    </div>

    {#if loading}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Pobieranie szkiców...</p>
        </CardContent>
      </Card>
    {:else if drafts.length === 0}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Brak niedokończonych postaci.</p>
        </CardContent>
      </Card>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each drafts as draft (draft.id)}
          <Card class="border-border/80 bg-card/95">
            <CardHeader class="space-y-2">
              <CardTitle class="text-xl tracking-normal">{draft.name}</CardTitle>
              <CardDescription>
                {getSystemLabel(draft.system)} • {new Date(draft.updatedAt).toLocaleString('pl-PL')}
              </CardDescription>
            </CardHeader>

            <CardContent class="flex items-center justify-between gap-3">
              <Button type="button" onclick={() => resumeDraft(draft.id)}>Wznów</Button>
              <Button type="button" variant="ghost" onclick={() => removeDraft(draft.id)}>
                Usuń szkic
              </Button>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}
  </section>
</main>
