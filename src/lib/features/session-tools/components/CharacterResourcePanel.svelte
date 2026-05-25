<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import type {
    SessionToolboxCharacterSummary,
    SessionToolboxResource,
    SessionToolboxResourceChange
  } from '../types';

  type Props = {
    characters: SessionToolboxCharacterSummary[];
    savingResourceKey?: string;
    onResourceChange?: (change: SessionToolboxResourceChange) => void | Promise<void>;
  };

  let { characters, savingResourceKey = '', onResourceChange }: Props = $props();

  function resourceKey(characterId: string, resourceId: string) {
    return `${characterId}:${resourceId}`;
  }

  function clamp(value: number, resource: SessionToolboxResource) {
    const min = resource.min ?? 0;
    return Math.max(min, Math.min(Math.trunc(value), resource.max));
  }

  function toneClass(resource: SessionToolboxResource) {
    if (resource.tone === 'health') {
      return 'text-red-500';
    }

    if (resource.tone === 'willpower') {
      return 'text-sky-300';
    }

    if (resource.tone === 'hunger') {
      return 'text-rose-700';
    }

    if (resource.tone === 'luck') {
      return 'text-amber-300';
    }

    if (resource.tone === 'sanity') {
      return 'text-emerald-300';
    }

    return 'text-primary';
  }

  function dotClass(resource: SessionToolboxResource, filled: boolean) {
    if (resource.tone === 'health') {
      return filled ? 'border-red-500 bg-red-500' : 'border-red-500/45 bg-transparent';
    }

    if (resource.tone === 'willpower') {
      return filled ? 'border-sky-300 bg-sky-300' : 'border-sky-300/45 bg-transparent';
    }

    if (resource.tone === 'hunger') {
      return filled ? 'border-rose-800 bg-rose-800' : 'border-rose-800/45 bg-transparent';
    }

    if (resource.tone === 'luck') {
      return filled ? 'border-amber-300 bg-amber-300' : 'border-amber-300/45 bg-transparent';
    }

    if (resource.tone === 'sanity') {
      return filled ? 'border-emerald-300 bg-emerald-300' : 'border-emerald-300/45 bg-transparent';
    }

    return filled ? 'border-primary bg-primary' : 'border-primary/45 bg-transparent';
  }

  function visibleDotCount(resource: SessionToolboxResource) {
    return Math.min(resource.max, 20);
  }

  function valueFromDotIndex(index: number) {
    return index + 1;
  }

  async function updateResource(
    character: SessionToolboxCharacterSummary,
    resource: SessionToolboxResource,
    value: number
  ) {
    if (!character.canEdit || !onResourceChange) {
      return;
    }

    await onResourceChange({
      characterId: character.characterId,
      resourceId: resource.id,
      value: clamp(value, resource)
    });
  }
</script>

<div class="space-y-3">
  <div>
    <p class="text-sm font-medium">Zasoby postaci</p>
    <p class="mt-1 text-xs text-muted-foreground">
      Szybka korekta wartości, które najczęściej zmieniają się w trakcie sceny.
    </p>
  </div>

  {#if characters.length === 0}
    <div class="rounded-md border border-dashed bg-background/50 px-3 py-4 text-center text-sm text-muted-foreground">
      Brak dostępnych postaci.
    </div>
  {:else}
    <div class="space-y-2">
      {#each characters as character (character.characterId)}
        <div class="rounded-md border bg-background/50 px-3 py-2">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{character.characterName}</p>
              <p class="mt-1 truncate text-xs text-muted-foreground">
                {character.playerName}{character.systemId ? ` · ${character.systemId}` : ''}
              </p>
            </div>
            {#if !character.canEdit}
              <span class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                podgląd
              </span>
            {/if}
          </div>

          {#if character.resources.length === 0}
            <p class="mt-3 text-xs text-muted-foreground">
              Brak szybkich zasobów dla tego systemu.
            </p>
          {:else}
            <div class="mt-3 space-y-2">
              {#each character.resources as resource (resource.id)}
                {@const key = resourceKey(character.characterId, resource.id)}
                {@const isSaving = savingResourceKey === key}
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <p class="min-w-0 truncate text-xs text-muted-foreground">{resource.label}</p>
                    <p class={['text-sm font-semibold', toneClass(resource)]}>
                      {resource.value}/{resource.max}
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <div
                      class="flex min-w-0 flex-1 flex-wrap gap-1"
                      aria-label={`${resource.label}: ${resource.value} z ${resource.max}`}
                    >
                      {#each Array.from({ length: visibleDotCount(resource) }) as _, index}
                        {@const dotValue = valueFromDotIndex(index)}
                        <button
                          type="button"
                          class={[
                            'size-3 rounded-full border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100',
                            dotClass(resource, index < resource.value)
                          ]}
                          disabled={!character.canEdit || isSaving}
                          title={`${resource.label}: ustaw ${dotValue}`}
                          aria-label={`${resource.label}: ustaw ${dotValue}`}
                          onclick={() => updateResource(character, resource, dotValue)}
                        ></button>
                      {/each}
                      {#if resource.max > visibleDotCount(resource)}
                        <span class="text-[10px] text-muted-foreground">
                          +{resource.max - visibleDotCount(resource)}
                        </span>
                      {/if}
                    </div>

                    <Input
                      class="h-7 w-14 shrink-0 px-2 text-center text-xs"
                      type="number"
                      min={resource.min ?? 0}
                      max={resource.max}
                      value={resource.value}
                      disabled={!character.canEdit || isSaving}
                      aria-label={`${resource.label}: wartość bieżąca`}
                      onchange={(event) =>
                        updateResource(character, resource, Number(event.currentTarget.value))}
                    />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
