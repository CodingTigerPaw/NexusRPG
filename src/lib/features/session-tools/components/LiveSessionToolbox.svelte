<script lang="ts">
  import FloatingToolboxWindow from './FloatingToolboxWindow.svelte';
  import CharacterResourcePanel from './CharacterResourcePanel.svelte';
  import type {
    SessionToolboxModule,
    SessionToolboxModuleId,
    SessionToolboxCharacterSummary,
    SessionToolboxResourceChange
  } from '../types';

  type Props = {
    title?: string;
    initialPosition?: import('../types').ToolboxPosition;
    characters: SessionToolboxCharacterSummary[];
    savingResourceKey?: string;
    onClose?: () => void;
    onResourceChange?: (change: SessionToolboxResourceChange) => void | Promise<void>;
  };

  let {
    title = 'Toolbox sesji',
    initialPosition,
    characters,
    savingResourceKey = '',
    onClose,
    onResourceChange
  }: Props = $props();

  const modules: SessionToolboxModule[] = [
    {
      id: 'resources',
      label: 'Zasoby',
      description: 'Szybka edycja wartości zmienianych w czasie sceny.'
    }
  ];

  let activeModuleId = $state<SessionToolboxModuleId>(modules[0].id);
</script>

<FloatingToolboxWindow {title} {initialPosition} {onClose}>
  <div class="space-y-3">
    <div class="flex gap-1 rounded-md border bg-background/50 p-1">
      {#each modules as module (module.id)}
        <button
          type="button"
          class={[
            'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors',
            activeModuleId === module.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          ]}
          title={module.description}
          aria-pressed={activeModuleId === module.id}
          onclick={() => (activeModuleId = module.id)}
        >
          {module.label}
        </button>
      {/each}
    </div>

    {#if activeModuleId === 'resources'}
      <CharacterResourcePanel {characters} {savingResourceKey} {onResourceChange} />
    {/if}
  </div>
</FloatingToolboxWindow>
