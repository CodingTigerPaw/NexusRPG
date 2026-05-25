<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    vtmAbilityGroups,
    vtmAttributeGroups
  } from '$lib/modules/charactersModule/character-builder/data';
  import {
    createEmptyRecordEntry,
    type CharacterEditDraft,
    type CharacterEditRecordEntry
  } from '../services/character-edit-draft';

  type Props = {
    draft: CharacterEditDraft;
    disabled?: boolean;
    isVampireSystem?: boolean;
    onDraftChange: (draft: CharacterEditDraft) => void;
  };

  let { draft, disabled = false, isVampireSystem = false, onDraftChange }: Props = $props();

  const groupLabels: Record<string, string> = {
    physical: 'Fizyczne',
    social: 'Społeczne',
    mental: 'Mentalne'
  };

  function updateDraft(patch: Partial<CharacterEditDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  function updateCharacteristic(key: string, value: string) {
    updateDraft({
      characteristics: {
        ...draft.characteristics,
        [key]: value
      }
    });
  }

  function updateSkill(key: string, value: string) {
    updateDraft({
      skills: {
        ...draft.skills,
        [key]: value
      }
    });
  }

  function ratingDots(value: string) {
    const rating = Math.max(0, Math.min(5, Math.trunc(Number(value) || 0)));
    return Array.from({ length: 5 }, (_, index) => index < rating);
  }

  function setRating(type: 'characteristics' | 'skills', key: string, value: number) {
    if (type === 'characteristics') {
      updateCharacteristic(key, String(value));
      return;
    }

    updateSkill(key, String(value));
  }

  function updateEntry(
    collection: 'backstory' | 'inventory',
    entryId: string,
    patch: Partial<CharacterEditRecordEntry>
  ) {
    updateDraft({
      [collection]: draft[collection].map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry
      )
    });
  }

  function addEntry(collection: 'backstory' | 'inventory', label: string) {
    updateDraft({
      [collection]: [...draft[collection], createEmptyRecordEntry(label)]
    });
  }

  function removeEntry(collection: 'backstory' | 'inventory', entryId: string) {
    updateDraft({
      [collection]: draft[collection].filter((entry) => entry.id !== entryId)
    });
  }
</script>

<div class="space-y-5">
  <section class="rounded-md border bg-background/40 p-4">
    <div class="grid gap-4 md:grid-cols-3">
      <div class="space-y-2 md:col-span-2">
        <Label for="character-edit-name">Nazwa postaci</Label>
        <Input
          id="character-edit-name"
          value={draft.name}
          {disabled}
          oninput={(event) => updateDraft({ name: event.currentTarget.value })}
        />
      </div>

      <div class="space-y-2">
        <Label for="character-edit-age">Wiek</Label>
        <Input
          id="character-edit-age"
          type="number"
          min="0"
          value={draft.age}
          {disabled}
          oninput={(event) => updateDraft({ age: event.currentTarget.value })}
        />
      </div>

      <div class="space-y-2 md:col-span-3">
        <Label for="character-edit-occupation">Profesja / rola</Label>
        <Input
          id="character-edit-occupation"
          value={draft.occupation}
          {disabled}
          oninput={(event) => updateDraft({ occupation: event.currentTarget.value })}
        />
      </div>

      {#if isVampireSystem}
        <div class="space-y-2">
          <Label for="character-edit-hunger">Głód</Label>
          <Input
            id="character-edit-hunger"
            type="number"
            min="0"
            max="5"
            value={draft.hunger}
            {disabled}
            oninput={(event) => updateDraft({ hunger: event.currentTarget.value })}
          />
        </div>
      {/if}
    </div>
  </section>

  <section class="rounded-md border bg-background/40 p-4">
    <div class="space-y-1">
      <h3 class="text-sm font-medium">Cechy</h3>
      <p class="text-xs text-muted-foreground">
        Wartości zapisują się jako pola strukturalne, bez ręcznej edycji JSON.
      </p>
    </div>

    {#if isVampireSystem}
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        {#each Object.entries(vtmAttributeGroups) as [groupId, fields]}
          <div class="space-y-3 rounded-md border bg-background/50 p-3">
            <p class="text-xs font-medium uppercase text-muted-foreground">{groupLabels[groupId] ?? groupId}</p>
            {#each fields as field}
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm">{field}</span>
                <div class="flex items-center gap-1">
                  {#each ratingDots(draft.characteristics[field]) as filled, index}
                    <button
                      type="button"
                      class={`h-4 w-4 rounded-full border ${
                        filled ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}
                      disabled={disabled}
                      aria-label={`${field}: ${index + 1}`}
                      onclick={() => setRating('characteristics', field, index + 1)}
                    ></button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        {#each Object.entries(draft.characteristics) as [key, value]}
          <div class="space-y-2">
            <Label for={`characteristic-${key}`}>{key}</Label>
            <Input
              id={`characteristic-${key}`}
              value={value}
              {disabled}
              oninput={(event) => updateCharacteristic(key, event.currentTarget.value)}
            />
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="rounded-md border bg-background/40 p-4">
    <div class="space-y-1">
      <h3 class="text-sm font-medium">Umiejętności</h3>
      <p class="text-xs text-muted-foreground">
        Kropki zmieniają wartości bezpośrednio w modelu umiejętności.
      </p>
    </div>

    {#if isVampireSystem}
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        {#each Object.entries(vtmAbilityGroups) as [groupId, fields]}
          <div class="space-y-3 rounded-md border bg-background/50 p-3">
            <p class="text-xs font-medium uppercase text-muted-foreground">{groupLabels[groupId] ?? groupId}</p>
            {#each fields as field}
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm">{field}</span>
                <div class="flex items-center gap-1">
                  {#each ratingDots(draft.skills[field]) as filled, index}
                    <button
                      type="button"
                      class={`h-4 w-4 rounded-full border ${
                        filled ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}
                      disabled={disabled}
                      aria-label={`${field}: ${index + 1}`}
                      onclick={() => setRating('skills', field, index + 1)}
                    ></button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        {#each Object.entries(draft.skills) as [key, value]}
          <div class="space-y-2">
            <Label for={`skill-${key}`}>{key}</Label>
            <Input
              id={`skill-${key}`}
              value={value}
              {disabled}
              oninput={(event) => updateSkill(key, event.currentTarget.value)}
            />
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="rounded-md border bg-background/40 p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <h3 class="text-sm font-medium">Historia</h3>
        <p class="text-xs text-muted-foreground">Pola z tytułem i treścią zastępują ręczny JSON historii.</p>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onclick={() => addEntry('backstory', 'Nowy wpis')}>
        Dodaj wpis
      </Button>
    </div>

    <div class="mt-4 space-y-3">
      {#each draft.backstory as entry (entry.id)}
        <div class="grid gap-2 rounded-md border bg-background/50 p-3 md:grid-cols-[0.7fr_1fr_auto] md:items-start">
          <Input
            aria-label="Tytuł wpisu historii"
            value={entry.key}
            {disabled}
            oninput={(event) => updateEntry('backstory', entry.id, { key: event.currentTarget.value })}
          />
          <Textarea
            aria-label="Treść wpisu historii"
            value={entry.value}
            {disabled}
            oninput={(event) => updateEntry('backstory', entry.id, { value: event.currentTarget.value })}
          />
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onclick={() => removeEntry('backstory', entry.id)}>
            Usuń
          </Button>
        </div>
      {/each}
    </div>
  </section>

  <section class="rounded-md border bg-background/40 p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-1">
        <h3 class="text-sm font-medium">Ekwipunek</h3>
        <p class="text-xs text-muted-foreground">Lista pozycji zostanie zapisana jako tablica w payloadzie postaci.</p>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onclick={() => addEntry('inventory', 'Pozycja')}>
        Dodaj pozycję
      </Button>
    </div>

    <div class="mt-4 space-y-3">
      {#each draft.inventory as entry (entry.id)}
        <div class="grid gap-2 rounded-md border bg-background/50 p-3 md:grid-cols-[1fr_auto] md:items-start">
          <Input
            aria-label="Pozycja ekwipunku"
            value={entry.value}
            {disabled}
            oninput={(event) => updateEntry('inventory', entry.id, { value: event.currentTarget.value })}
          />
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onclick={() => removeEntry('inventory', entry.id)}>
            Usuń
          </Button>
        </div>
      {/each}
    </div>
  </section>

  <section class="rounded-md border bg-background/40 p-4">
    <div class="space-y-2">
      <Label for="character-edit-notes">Notatki</Label>
      <Textarea
        id="character-edit-notes"
        value={draft.notes}
        {disabled}
        oninput={(event) => updateDraft({ notes: event.currentTarget.value })}
      />
    </div>
  </section>
</div>
