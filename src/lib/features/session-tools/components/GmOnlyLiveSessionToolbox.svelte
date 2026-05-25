<script lang="ts">
  import { Plus } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import LiveSessionToolbox from './LiveSessionToolbox.svelte';
  import type {
    SessionToolboxInstance,
    SessionToolboxCharacterSummary,
    SessionToolboxResourceChange
  } from '../types';

  type Props = {
    canManageSession: boolean;
    characters: SessionToolboxCharacterSummary[];
    savingResourceKey?: string;
    onResourceChange?: (change: SessionToolboxResourceChange) => void | Promise<void>;
  };

  let {
    canManageSession,
    characters,
    savingResourceKey = '',
    onResourceChange
  }: Props = $props();

  let nextToolboxIndex = 1;
  let toolboxInstances = $state<SessionToolboxInstance[]>([]);

  function createToolboxInstance() {
    const index = nextToolboxIndex++;
    // Każde nowe okno dostaje lekki offset, żeby GM od razu widział, że powstała osobna instancja.
    const offset = (index - 1) * 28;

    toolboxInstances = [
      ...toolboxInstances,
      {
        instanceId: `toolbox-${Date.now()}-${index}`,
        title: `Toolbox sesji ${index}`,
        initialPosition: {
          x: Math.max(16, window.innerWidth - 384 - offset),
          y: Math.max(128, 196 + offset)
        }
      }
    ];
  }

  function closeToolboxInstance(instanceId: string) {
    toolboxInstances = toolboxInstances.filter((toolbox) => toolbox.instanceId !== instanceId);
  }
</script>

{#if canManageSession}
  <div class="fixed right-3 top-[calc(var(--app-navigation-height,0px)+5rem)] z-[90]">
    <Button
      type="button"
      size="sm"
      variant="outline"
      class="gap-2 bg-background/90 shadow-lg backdrop-blur"
      onclick={createToolboxInstance}
      aria-label="Dodaj toolbox"
    >
      <Plus class="size-4" />
      Toolbox
    </Button>
  </div>

  {#each toolboxInstances as toolbox (toolbox.instanceId)}
    <LiveSessionToolbox
      title={toolbox.title}
      initialPosition={toolbox.initialPosition}
      {characters}
      {savingResourceKey}
      {onResourceChange}
      onClose={() => closeToolboxInstance(toolbox.instanceId)}
    />
  {/each}
{/if}
