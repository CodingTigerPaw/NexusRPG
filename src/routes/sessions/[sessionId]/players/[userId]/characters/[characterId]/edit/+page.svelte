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
  import { Textarea } from '$lib/components/ui/textarea';
  import { getCurrentUser, hasRole } from '$lib/modules/auth';
  import {
    getUserCharacters,
    updateSessionParticipantCharacter,
    type CharacterCard,
    type CharacterUpdatePayload
  } from '$lib/modules/characters';
  import { resolveCharacterSheet } from '$lib/modules/charactersModule/character-sheet';
  import { vtmDisciplineCatalog } from '$lib/modules/charactersModule/character-builder';
  import { appRoles } from '$lib/modules/navigation';
  import { formatRpgSessionName, getRpgSession, type RpgSession } from '$lib/modules/rpg-sessions';
  import { requireAuth } from '$lib/modules/rbac';

  type DisciplinePower = {
    discipline: string;
    name: string;
    description: string;
  };

  let session = $state<RpgSession | null>(null);
  let character = $state<CharacterCard | null>(null);
  let currentUserId = $state('');
  let isAdminUser = $state(false);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let errorMessage = $state('');
  let editorMessage = $state('');
  let editName = $state('');
  let editOccupation = $state('');
  let editAge = $state('');
  let editNotes = $state('');
  let editCharacteristics = $state<Record<string, unknown>>({});
  let editSkills = $state<Record<string, unknown>>({});
  let editBackstory = $state('');
  let editInventory = $state('');
  let disciplinePowers = $state<DisciplinePower[]>([]);
  let isRemovingDiscipline = $state(false);

  const sessionId = $derived(page.params.sessionId);
  const playerUserId = $derived(page.params.userId);
  const characterId = $derived(page.params.characterId);
  const canManageSession = $derived(Boolean(session && (session.ownerUserId === currentUserId || isAdminUser)));
  const sheet = $derived(character ? resolveCharacterSheet(character) : null);
  const editableCharacteristics = $derived(getEditableRecordEntries(editCharacteristics));
  const editableSkills = $derived(getEditableRecordEntries(editSkills));
  const isVampireCharacter = $derived(Boolean(character?.rpgSystem && /vampire|wampir|vtm|maskarada/i.test(character.rpgSystem)));
  const removableDisciplineKeys = $derived(getRemovableDisciplineKeys(editSkills));

  onMount(async () => {
    const authenticated = await requireAuth();

    if (!authenticated) {
      return;
    }

    currentUserId = getCurrentUser()?.userId ?? '';
    isAdminUser = hasRole(appRoles.admin);

    try {
      if (!sessionId || !playerUserId || !characterId) {
        errorMessage = 'Brakuje danych sesji, gracza albo postaci.';
        return;
      }

      const loadedSession = await getRpgSession(sessionId);
      session = loadedSession;

      const hasManagementAccess = loadedSession.ownerUserId === currentUserId || isAdminUser;

      if (!hasManagementAccess) {
        errorMessage = 'Tylko GM tej sesji albo admin może edytować kartę gracza w kontekście sesji.';
        return;
      }

      const isParticipant = (loadedSession.participants ?? []).some(
        (participant) =>
          participant.userId === playerUserId && participant.characterId === characterId
      );

      if (!isParticipant) {
        errorMessage = 'Ta postać nie jest przypisana do uczestników tej sesji.';
        return;
      }

      const response = await getUserCharacters(playerUserId, {
        limit: 100,
        rpgSystem: loadedSession.rpgSystem
      });
      const loadedCharacter =
        response.characterSheets.find((entry) => entry.characterId === characterId) ?? null;

      if (!loadedCharacter) {
        errorMessage = 'Nie udało się pobrać karty postaci tego gracza.';
        return;
      }

      character = loadedCharacter;
      fillEditor(loadedCharacter);
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się przygotować edycji karty.';
    } finally {
      isLoading = false;
    }
  });

  function getEditableRecordEntries(record: Record<string, unknown>) {
    return Object.entries(record).filter(([, value]) => typeof value !== 'object' || value === null);
  }

  function getRemovableDisciplineKeys(skills: Record<string, unknown>) {
    const disciplineNames = new Set(vtmDisciplineCatalog.map((name) => name.toLowerCase()));

    return Object.keys(skills).filter(
      (key) => key !== 'DisciplinePowers' && disciplineNames.has(key.toLowerCase())
    );
  }

  function fillEditor(character: CharacterCard) {
    editName = character.name;
    editOccupation = character.occupation ?? '';
    editAge = character.age === undefined || character.age === null ? '' : String(character.age);
    editNotes = character.notes ?? '';
    editCharacteristics = { ...(character.characteristics ?? {}) };
    editSkills = { ...(character.skills ?? {}) };
    editBackstory = JSON.stringify(character.backstory ?? {}, null, 2);
    editInventory = JSON.stringify(character.inventory ?? [], null, 2);
    disciplinePowers = readDisciplinePowers(character.skills);
  }

  function readDisciplinePowers(skills: Record<string, unknown> | undefined) {
    const powers = skills?.DisciplinePowers;

    if (!Array.isArray(powers)) {
      return [{ discipline: '', name: '', description: '' }];
    }

    const parsed = powers
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
      .filter((power): power is DisciplinePower => Boolean(power));

    return parsed.length ? parsed : [{ discipline: '', name: '', description: '' }];
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

  function parseFieldValue(currentValue: unknown, nextValue: string) {
    if (typeof currentValue === 'number') {
      const numericValue = Number(nextValue);
      return Number.isFinite(numericValue) ? numericValue : 0;
    }

    return nextValue;
  }

  function updateCharacteristic(key: string, value: string) {
    editCharacteristics = {
      ...editCharacteristics,
      [key]: parseFieldValue(editCharacteristics[key], value)
    };
  }

  function updateSkill(key: string, value: string) {
    editSkills = {
      ...editSkills,
      [key]: parseFieldValue(editSkills[key], value)
    };
  }

  function updateDisciplinePower(index: number, field: keyof DisciplinePower, value: string) {
    disciplinePowers = disciplinePowers.map((power, powerIndex) =>
      powerIndex === index ? { ...power, [field]: value } : power
    );
  }

  function addDisciplinePower() {
    disciplinePowers = [...disciplinePowers, { discipline: '', name: '', description: '' }];
  }

  function removeDisciplinePower(index: number) {
    const nextPowers = disciplinePowers.filter((_, powerIndex) => powerIndex !== index);
    disciplinePowers = nextPowers.length ? nextPowers : [{ discipline: '', name: '', description: '' }];
  }

  function buildCleanDisciplinePowers() {
    return disciplinePowers
      .map((power) => ({
        discipline: power.discipline.trim(),
        name: power.name.trim(),
        description: power.description.trim()
      }))
      .filter((power) => power.discipline || power.name || power.description);
  }

  async function saveCharacterChanges() {
    if (!session || !playerUserId || !character || !canManageSession) {
      return;
    }

    const name = inputValueToString(editName).trim();

    if (!name) {
      editorMessage = 'Nazwa postaci jest wymagana.';
      return;
    }

    let payload: CharacterUpdatePayload;

    try {
      const ageText = inputValueToString(editAge).trim();
      payload = {
        name,
        occupation: inputValueToString(editOccupation).trim() || null,
        age: ageText ? Number(ageText) : null,
        notes: inputValueToString(editNotes).trim() || null,
        characteristics: editCharacteristics,
        skills: {
          ...editSkills,
          DisciplinePowers: buildCleanDisciplinePowers()
        },
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
      const updatedCharacter = await updateSessionParticipantCharacter(
        session.sessionId,
        playerUserId,
        character.characterId,
        payload
      );
      character = updatedCharacter;
      fillEditor(updatedCharacter);
      editorMessage = 'Karta gracza została zaktualizowana.';
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się zapisać zmian w karcie gracza.';
    } finally {
      isSaving = false;
    }
  }

  async function removeDisciplineSkill(key: string) {
    if (!session || !playerUserId || !character || !canManageSession || isRemovingDiscipline) {
      return;
    }

    isRemovingDiscipline = true;
    editorMessage = '';

    try {
      const updatedCharacter = await updateSessionParticipantCharacter(
        session.sessionId,
        playerUserId,
        character.characterId,
        { removeSkills: [key] }
      );
      character = updatedCharacter;
      fillEditor(updatedCharacter);
      editorMessage = `Dyscyplina "${key}" została usunięta z karty gracza.`;
    } catch (error) {
      editorMessage =
        error instanceof Error ? error.message : 'Nie udało się usunąć dyscypliny z karty gracza.';
    } finally {
      isRemovingDiscipline = false;
    }
  }
</script>

<svelte:head>
  <title>Edycja gracza: {character?.name ?? 'Karta postaci'} | Call of Cthulhu RPG</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-7xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-sm text-muted-foreground">Edycja karty gracza w sesji</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal">
          {character?.name ?? 'Wczytywanie...'}
        </h1>
        {#if session}
          <p class="mt-2 text-sm text-muted-foreground">{formatRpgSessionName(session)}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        {#if session}
          <Button type="button" variant="outline" onclick={() => goto(`/sessions/${session?.sessionId}`)}>
            Szczegóły sesji
          </Button>
          <Button type="button" variant="outline" onclick={() => goto(`/sessions/${session?.sessionId}/play`)}>
            Wejdź do sesji
          </Button>
        {/if}
      </div>
    </div>

    {#if isLoading}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Pobieranie karty gracza...</p>
        </CardContent>
      </Card>
    {:else if errorMessage}
      <Card class="border-destructive/40 bg-destructive/10">
        <CardContent class="p-6">
          <p class="text-sm text-destructive-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    {:else if character}
      <div class="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card class="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle>Formularz GM</CardTitle>
            <CardDescription>
              Edytujesz kartę uczestnika sesji przez endpoint GM, nie zwykłą edycję właściciela.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-6">
            {#if editorMessage}
              <div class="rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary">
                {editorMessage}
              </div>
            {/if}

            <div class="grid gap-4 md:grid-cols-3">
              <div class="space-y-2 md:col-span-2">
                <Label for="session-character-name">Nazwa postaci</Label>
                <Input id="session-character-name" bind:value={editName} disabled={isSaving} />
              </div>

              <div class="space-y-2">
                <Label for="session-character-age">Wiek</Label>
                <Input id="session-character-age" type="number" min="0" bind:value={editAge} disabled={isSaving} />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="session-character-occupation">Profesja / rola</Label>
              <Input id="session-character-occupation" bind:value={editOccupation} disabled={isSaving} />
            </div>

            <div class="space-y-2">
              <Label for="session-character-notes">Notatki</Label>
              <Textarea id="session-character-notes" bind:value={editNotes} disabled={isSaving} />
            </div>

            <div class="space-y-3">
              <p class="text-sm font-medium">Atrybuty i cechy</p>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {#each editableCharacteristics as [key, value]}
                  <div class="space-y-2">
                    <Label for={`characteristic-${key}`}>{key}</Label>
                    <Input
                      id={`characteristic-${key}`}
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={String(value ?? '')}
                      disabled={isSaving}
                      oninput={(event) => updateCharacteristic(key, (event.currentTarget as HTMLInputElement).value)}
                    />
                  </div>
                {/each}
              </div>
            </div>

            <div class="space-y-3">
              <p class="text-sm font-medium">Skille / umiejętności</p>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {#each editableSkills as [key, value]}
                  <div class="space-y-2">
                    <Label for={`skill-${key}`}>{key}</Label>
                    <Input
                      id={`skill-${key}`}
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={String(value ?? '')}
                      disabled={isSaving}
                      oninput={(event) => updateSkill(key, (event.currentTarget as HTMLInputElement).value)}
                    />
                  </div>
                {/each}
              </div>
            </div>

            {#if isVampireCharacter}
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">Dyscypliny</p>
                    <p class="mt-1 text-sm text-muted-foreground">Dodawaj albo modyfikuj moce dyscyplin tej postaci.</p>
                  </div>
                  <Button type="button" variant="outline" disabled={isSaving} onclick={addDisciplinePower}>
                    Dodaj moc
                  </Button>
                </div>

                <div class="space-y-3">
                  {#if removableDisciplineKeys.length}
                    <div class="rounded-md border bg-background/40 p-4">
                      <p class="text-sm font-medium">Dyscypliny zapisane w umiejętnościach</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        {#each removableDisciplineKeys as key}
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSaving || isRemovingDiscipline}
                            onclick={() => removeDisciplineSkill(key)}
                          >
                            Usuń {key}
                          </Button>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#each disciplinePowers as power, index}
                    <div class="rounded-md border bg-background/40 p-4">
                      <div class="grid gap-4 lg:grid-cols-[0.7fr_0.8fr_1.2fr_auto]">
                        <div class="space-y-2">
                          <Label for={`discipline-${index}`}>Dyscyplina</Label>
                          <Input
                            id={`discipline-${index}`}
                            list="session-edit-vtm-disciplines"
                            value={power.discipline}
                            disabled={isSaving}
                            oninput={(event) =>
                              updateDisciplinePower(index, 'discipline', (event.currentTarget as HTMLInputElement).value)}
                          />
                        </div>
                        <div class="space-y-2">
                          <Label for={`discipline-power-${index}`}>Nazwa mocy</Label>
                          <Input
                            id={`discipline-power-${index}`}
                            value={power.name}
                            disabled={isSaving}
                            oninput={(event) =>
                              updateDisciplinePower(index, 'name', (event.currentTarget as HTMLInputElement).value)}
                          />
                        </div>
                        <div class="space-y-2">
                          <Label for={`discipline-description-${index}`}>Opis</Label>
                          <Textarea
                            id={`discipline-description-${index}`}
                            value={power.description}
                            disabled={isSaving}
                            oninput={(event) =>
                              updateDisciplinePower(index, 'description', (event.currentTarget as HTMLTextAreaElement).value)}
                          />
                        </div>
                        <div class="flex items-end">
                          <Button type="button" variant="ghost" disabled={isSaving} onclick={() => removeDisciplinePower(index)}>
                            Usuń
                          </Button>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>

                <datalist id="session-edit-vtm-disciplines">
                  {#each vtmDisciplineCatalog as option}
                    <option value={option}></option>
                  {/each}
                </datalist>
              </div>
            {/if}

            <div class="grid gap-4 lg:grid-cols-2">
              <div class="space-y-2">
                <Label for="session-character-backstory">Historia JSON</Label>
                <Textarea
                  id="session-character-backstory"
                  class="min-h-56 font-mono text-xs"
                  bind:value={editBackstory}
                  disabled={isSaving}
                />
              </div>

              <div class="space-y-2">
                <Label for="session-character-inventory">Ekwipunek JSON</Label>
                <Textarea
                  id="session-character-inventory"
                  class="min-h-56 font-mono text-xs"
                  bind:value={editInventory}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={isSaving} onclick={() => character && fillEditor(character)}>
                Cofnij zmiany
              </Button>
              <Button type="button" disabled={isSaving} onclick={saveCharacterChanges}>
                {isSaving ? 'Zapisywanie...' : 'Zapisz kartę gracza'}
              </Button>
            </div>
          </CardContent>
        </Card>


      </div>
    {/if}
  </section>
</main>
