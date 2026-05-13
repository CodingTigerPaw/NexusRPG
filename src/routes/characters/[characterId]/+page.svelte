<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import DataDrivenCharacterSheet from '$lib/components/character-sheet/DataDrivenCharacterSheet.svelte';
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
  import { resolveCharacterSheet } from '$lib/modules/charactersModule/character-sheet';
  import {
    deleteCharacter,
    deleteCharacterAvatar,
    getCharacter,
    uploadCharacterAvatar,
    type CharacterAvatarUploadPayload,
    type CharacterCard
  } from '$lib/modules/characters';
  import { formatRpgSessionName, getRpgSession } from '$lib/modules/rpg-sessions';
  import { requireAuth } from '$lib/modules/rbac';

  const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
  const maxAvatarBytes = 2 * 1024 * 1024;

  let character = $state<CharacterCard | null>(null);
  let sessionName = $state('');
  let isLoading = $state(true);
  let isUploadingAvatar = $state(false);
  let isDeletingAvatar = $state(false);
  let isDeletingCharacter = $state(false);
  let errorMessage = $state('');
  let avatarMessage = $state('');
  let deleteMessage = $state('');

  const characterId = $derived(page.params.characterId);
  const sheet = $derived(character ? resolveCharacterSheet(character) : null);

  onMount(async () => {
    const authenticated = await requireAuth();

    if (!authenticated) {
      return;
    }

    try {
      if (!characterId) {
        errorMessage = 'Brakuje identyfikatora karty postaci.';
        return;
      }

      character = await getCharacter(characterId);

      if (!character) {
        errorMessage = 'Nie znaleziono karty postaci.';
      } else if (character.sessionId) {
        const session = await getRpgSession(character.sessionId);
        sessionName = formatRpgSessionName(session);
      }
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się pobrać karty postaci.';
    } finally {
      isLoading = false;
    }
  });

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

  async function handleAvatarFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    avatarMessage = '';

    if (!file || !character) {
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
      const imageBase64 = await readFileAsDataUrl(file);
      character = await uploadCharacterAvatar(character.characterId, {
        fileName: file.name,
        contentType: file.type,
        imageBase64
      });
      avatarMessage = 'Awatar został zapisany.';
    } catch (error) {
      avatarMessage = error instanceof Error ? error.message : 'Nie udało się wgrać awatara.';
    } finally {
      isUploadingAvatar = false;
      input.value = '';
    }
  }

  async function deleteAvatar() {
    if (!character?.avatarUrl || isDeletingAvatar) {
      return;
    }

    isDeletingAvatar = true;
    avatarMessage = '';

    try {
      character = await deleteCharacterAvatar(character.characterId);
      avatarMessage = 'Awatar został usunięty.';
    } catch (error) {
      avatarMessage = error instanceof Error ? error.message : 'Nie udało się usunąć awatara.';
    } finally {
      isDeletingAvatar = false;
    }
  }

  async function deleteCurrentCharacter() {
    if (!character || isDeletingCharacter) {
      return;
    }

    if (character.sessionId) {
      alert(
        `Nie można usunąć postaci "${character.name}", ponieważ jest przypisana do sesji "${sessionName || character.sessionId}". Najpierw usuń ją z uczestników sesji, aby nie zostawić niespójnych danych.`
      );
      return;
    }

    const confirmed = confirm(
      `Usunąć postać "${character.name}"? Tej operacji nie można cofnąć.`
    );

    if (!confirmed) {
      return;
    }

    isDeletingCharacter = true;
    deleteMessage = '';

    try {
      if (character.avatarUrl || character.avatarKey) {
        // Avatar ma osobny endpoint, bo to on zna szczegóły czyszczenia obiektu S3.
        // Usunięcie pliku wykonujemy przed skasowaniem karty, żeby nie stracić identyfikatora zasobu.
        await deleteCharacterAvatar(character.characterId);
      }

      await deleteCharacter(character.characterId);
      goto('/characters');
    } catch (error) {
      deleteMessage =
        error instanceof Error ? error.message : 'Nie udało się usunąć postaci.';
    } finally {
      isDeletingCharacter = false;
    }
  }
</script>

<svelte:head>
  <title>{character?.name ?? 'Karta postaci'} </title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm text-muted-foreground">Karta postaci</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal">
          {character?.name ?? 'Wczytywanie...'}
        </h1>
        {#if character?.rpgSystem}
          <p class="mt-2 text-sm text-muted-foreground">{character.rpgSystem}</p>
        {/if}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {#if character}
          <Button
            type="button"
            variant="outline"
            class="border-destructive/50 text-destructive hover:bg-destructive/10"
            disabled={isDeletingCharacter}
            onclick={deleteCurrentCharacter}
          >
            {isDeletingCharacter ? 'Usuwanie...' : 'Usuń postać'}
          </Button>
        {/if}
        <Button type="button" variant="outline" onclick={() => goto('/characters')}>Wroc do listy</Button>
      </div>
    </div>

    {#if isLoading}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Pobieranie karty postaci...</p>
        </CardContent>
      </Card>
    {:else if errorMessage}
      <Card class="border-destructive/40 bg-destructive/10">
        <CardContent class="p-6">
          <p class="text-sm text-destructive-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    {:else if character && sheet}
      {#if deleteMessage}
        <Card class="border-destructive/40 bg-destructive/10">
          <CardContent class="p-4">
            <p class="text-sm text-destructive-foreground">{deleteMessage}</p>
          </CardContent>
        </Card>
      {/if}

      <Card class="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Awatar</CardTitle>

        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div class="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background/60">
              {#if character.avatarUrl}
                <img
                  class="h-full w-full object-cover"
                  src={character.avatarUrl}
                  alt={`Awatar postaci ${character.name}`}
                />
              {:else}
                <span class="px-3 text-center text-sm text-muted-foreground">Brak awatara</span>
              {/if}
            </div>

            <div class="w-full space-y-3">
              <div class="space-y-2">
                <Label for="character-avatar">Plik awatara</Label>
                <Input
                  id="character-avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isUploadingAvatar || isDeletingAvatar}
                  onchange={handleAvatarFileChange}
                />
              </div>

              {#if character.avatarUrl}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploadingAvatar || isDeletingAvatar}
                  onclick={deleteAvatar}
                >
                  {isDeletingAvatar ? 'Usuwanie...' : 'Usuń awatar'}
                </Button>
              {/if}

              <p class="text-sm text-muted-foreground">
                JPEG, PNG lub WebP. Maksymalny rozmiar pliku: 2 MB.
              </p>

              {#if character.avatarUpdatedAt && character.avatarUrl}
                <p class="text-sm text-muted-foreground">
                  Ostatnia aktualizacja:
                  <span class="text-foreground">
                    {new Date(character.avatarUpdatedAt).toLocaleString('pl-PL')}
                  </span>
                </p>
              {/if}

              {#if isUploadingAvatar}
                <p class="text-sm text-muted-foreground">Wgrywanie awatara...</p>
              {:else if isDeletingAvatar}
                <p class="text-sm text-muted-foreground">Usuwanie awatara...</p>
              {:else if avatarMessage}
                <p class="text-sm text-muted-foreground">{avatarMessage}</p>
              {/if}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>Sesja</CardTitle>
        </CardHeader>
        <CardContent class="text-sm">
          {#if character.sessionId}
            <p class="text-muted-foreground">Postać bierze udział w sesji:</p>
            <p class="mt-1 font-medium">{sessionName || 'Sesja przypisana'}</p>
          {:else}
            <p class="text-muted-foreground">Postać nie jest przypisana do żadnej sesji.</p>
          {/if}
        </CardContent>
      </Card>

      <DataDrivenCharacterSheet {sheet} />
    {:else if character}
      <Card class="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle>{character.name}</CardTitle>
          <CardDescription>
            Dla tej karty nie ma jeszcze definicji data-driven. Dostepny jest surowy podglad danych.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre class="overflow-auto rounded-md border bg-background/50 p-4 text-xs">{JSON.stringify(character, null, 2)}</pre>
        </CardContent>
      </Card>
    {/if}
  </section>
</main>
