<script lang="ts">
  import CharacterNotesSection from './CharacterNotesSection.svelte';
  import type {
    ResolvedCharacterSheet,
    ResolvedCharacterSheetSection
  } from '$lib/modules/charactersModule/character-sheet/types';
  import type { CharacterNote } from '$lib/modules/charactersModule/notes';

  export let sheet: ResolvedCharacterSheet;
  export let section: ResolvedCharacterSheetSection;
  export let canEditNotes = false;
  export let isSavingNotes = false;
  export let onNotesChange: ((notes: CharacterNote[]) => void | Promise<void>) | undefined = undefined;

  function gridClass(columns: 1 | 2 | 3 | undefined) {
    if (columns === 1) {
      return 'grid gap-3';
    }

    if (columns === 2) {
      return 'grid gap-3 md:grid-cols-2';
    }

    return 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
  }

  function ratingValue(value: string) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.min(5, Math.max(0, Math.trunc(numericValue))) : 0;
  }

  function resourceValue(value: string) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0;
  }

  function isDerivedResource(field: { derivedStat?: string }) {
    return ['health', 'willpower', 'humanity', 'bloodPool'].includes(field.derivedStat ?? '');
  }

  function isResourceField(field: { derivedStat?: string; path?: string }) {
    return isDerivedResource(field) || field.path === 'characteristics.hunger';
  }

  function resourceDotCount(
    field: { derivedStat?: string; path?: string; maxValue?: string },
    value: string
  ) {
    if (field.path === 'characteristics.hunger') {
      return 5;
    }

    if (field.derivedStat === 'humanity') {
      return 10;
    }

    const maxValue = field.maxValue ?? value;

    if (field.derivedStat === 'bloodPool') {
      return Math.max(1, resourceValue(maxValue));
    }

    return Math.max(1, resourceValue(maxValue));
  }

  function resourceColorClass(field: { derivedStat?: string; path?: string }, filled: boolean) {
    if (field.derivedStat === 'health') {
      return filled ? 'border-red-500 bg-red-500' : 'border-red-500/45 bg-transparent';
    }

    if (field.derivedStat === 'willpower') {
      return filled ? 'border-sky-300 bg-sky-300' : 'border-sky-300/45 bg-transparent';
    }

    if (field.path === 'characteristics.hunger') {
      return filled ? 'border-rose-800 bg-rose-800' : 'border-rose-800/45 bg-transparent';
    }

    if (field.derivedStat === 'bloodPool') {
      return filled ? 'border-red-700 bg-red-700' : 'border-red-700/45 bg-transparent';
    }

    return filled ? 'border-amber-300 bg-amber-300' : 'border-amber-300/45 bg-transparent';
  }
</script>

<div class="space-y-6">
  {#if section.id === 'notes'}
    <CharacterNotesSection
      notes={sheet.notes}
      canEdit={canEditNotes}
      isSaving={isSavingNotes}
      onChange={onNotesChange}
    />
  {:else}
  {#if section.id === 'identity' && sheet.avatarUrl && section.groups[0]}
    <div class="grid gap-6 md:grid-cols-[10rem_1fr] md:items-start">
      <img
        class="h-40 w-40 rounded-full border object-cover"
        src={sheet.avatarUrl}
        alt={`Avatar postaci ${sheet.characterName}`}
      />

      <section class="space-y-3">
        <div>
          <h3 class="text-sm font-medium">{section.groups[0].title}</h3>
          {#if section.groups[0].description}
            <p class="mt-1 text-sm text-muted-foreground">{section.groups[0].description}</p>
          {/if}
        </div>

        <div class={gridClass(section.groups[0].columns)}>
          {#each section.groups[0].fields as field (`${section.groups[0].id}:${field.path ?? field.derivedStat}`)}
            <div
              class={[
                'rounded-md border bg-background/40 text-sm',
                field.format === 'ratingDots' ? 'px-3 py-2' : 'p-3'
              ]}
            >
              <p class="text-muted-foreground">{field.label}</p>
              <p
                class={[
                  'mt-1 font-medium text-foreground',
                  field.format === 'longText' || field.format === 'namedDescriptions'
                    ? 'whitespace-pre-wrap leading-relaxed'
                    : ''
                ]}
              >
                {field.value}
              </p>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  {#each section.id === 'identity' && sheet.avatarUrl ? section.groups.slice(1) : section.groups as group (group.id)}
    {#if group.categoryTitle}
      <div class="border-b pb-2">
        <h3 class="text-xl font-semibold uppercase tracking-[0.08em]">
          {group.categoryTitle}
        </h3>
      </div>
    {/if}

    <section class="space-y-3">
      <div>
        <h3 class="text-sm font-medium">{group.title}</h3>
        {#if group.description}
          <p class="mt-1 text-sm text-muted-foreground">{group.description}</p>
        {/if}
      </div>

      <div class={gridClass(group.columns)}>
        {#each group.fields as field (`${group.id}:${field.path ?? field.derivedStat}`)}
          <div
            class={[
              'rounded-md border bg-background/40 text-sm',
              field.format === 'ratingDots' ? 'px-3 py-2' : 'p-3'
            ]}
          >
            {#if field.format === 'ratingDots'}
              <div class="flex min-h-6 items-center justify-between gap-3">
                <p class="truncate text-xs text-muted-foreground">{field.label}</p>
                <div
                  class="flex shrink-0 items-center gap-1"
                  aria-label={`${field.label}: ${ratingValue(field.value)} z 5`}
                  title={`${field.label}: ${ratingValue(field.value)} z 5`}
                >
                  {#each Array.from({ length: 5 }) as _, index}
                    <span
                      class={[
                        'h-2.5 w-2.5 rounded-full border border-primary/70',
                        index < ratingValue(field.value) ? 'bg-primary' : 'bg-transparent'
                      ]}
                    ></span>
                  {/each}
                </div>
              </div>
            {:else if isResourceField(field)}
              <div class="flex min-h-6 items-center justify-between gap-3">
                <p class="truncate text-xs text-muted-foreground">{field.label}</p>
                <div
                  class="flex shrink-0 items-center gap-1"
                  aria-label={`${field.label}: ${resourceValue(field.value)} z ${resourceDotCount(field, field.value)}`}
                  title={`${field.label}: ${resourceValue(field.value)} z ${resourceDotCount(field, field.value)}`}
                >
                  {#each Array.from({ length: resourceDotCount(field, field.value) }) as _, index}
                    <span
                      class={[
                        'h-2.5 w-2.5 rounded-full border',
                        resourceColorClass(field, index < resourceValue(field.value))
                      ]}
                    ></span>
                  {/each}
                </div>
              </div>
            {:else}
              <p class="text-muted-foreground">{field.label}</p>
              <p
                class={[
                  'mt-1 font-medium text-foreground',
                  field.format === 'longText' || field.format === 'namedDescriptions'
                    ? 'whitespace-pre-wrap leading-relaxed'
                    : ''
                ]}
              >
                {field.value}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
  {/if}
</div>
