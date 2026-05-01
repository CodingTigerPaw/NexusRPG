<script lang="ts">
  import { Accordion } from 'bits-ui';
  import type { ResolvedCharacterSheet } from '$lib/modules/charactersModule/character-sheet';

  export let sheet: ResolvedCharacterSheet;
  let openSections: string[] = [];
  let initializedSheetId = '';

  $: if (sheet.id !== initializedSheetId) {
    initializedSheetId = sheet.id;
    openSections = sheet.sections[0] ? [sheet.sections[0].id] : [];
  }

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
</script>

<Accordion.Root type="multiple" bind:value={openSections} class="space-y-4">
  {#each sheet.sections as section (section.id)}
    <Accordion.Item value={section.id} class="overflow-hidden rounded-md border border-border/80 bg-card/95">
      <Accordion.Header>
        <Accordion.Trigger
          class="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/50"
        >
          <div>
            <h2 class="text-lg font-semibold tracking-normal">{section.title}</h2>
            {#if section.description}
              <p class="mt-1 text-sm text-muted-foreground">{section.description}</p>
            {/if}
          </div>
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          >
            v
          </span>
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Content class="border-t px-6 py-6">
        <div class="space-y-6">
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
              <h3 class="text-xl font-semibold uppercase tracking-[0.08em] ">
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
        </div>
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>
