<script lang="ts">
  import type { ResolvedCharacterSheet } from '$lib/modules/charactersModule/character-sheet';
  import CharacterSheetSectionView from './CharacterSheetSectionView.svelte';

  export let sheet: ResolvedCharacterSheet;

  let activeSectionId = '';
  let initializedSheetId = '';

  $: if (sheet.id !== initializedSheetId) {
    initializedSheetId = sheet.id;
    activeSectionId = sheet.sections[0]?.id ?? '';
  }

  $: activeSection =
    sheet.sections.find((section) => section.id === activeSectionId) ?? sheet.sections[0] ?? null;
</script>

<div class="overflow-hidden rounded-md border border-border/80 bg-card/95">
  <div class="border-b px-4 py-4 sm:px-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 class="text-lg font-semibold tracking-normal">{sheet.characterName}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{sheet.systemName}</p>
      </div>

      <div class="flex max-w-full gap-2 overflow-x-auto pb-1">
        {#each sheet.sections as section (section.id)}
          <button
            type="button"
            class={[
              'shrink-0 rounded-md border px-3 py-2 text-sm transition-colors',
              section.id === activeSection?.id
                ? 'border-primary/60 bg-primary/10 text-foreground'
                : 'border-border/80 bg-background/40 text-muted-foreground hover:bg-muted'
            ]}
            onclick={() => (activeSectionId = section.id)}
          >
            {section.title}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="px-4 py-5 sm:px-6">
    {#if activeSection}
      {#if activeSection.description}
        <p class="mb-4 text-sm text-muted-foreground">{activeSection.description}</p>
      {/if}

      <CharacterSheetSectionView {sheet} section={activeSection} />
    {:else}
      <p class="text-sm text-muted-foreground">Brak sekcji karty postaci.</p>
    {/if}
  </div>
</div>
