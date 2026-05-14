<script lang="ts">
  import FloatingToolboxWindow from './FloatingToolboxWindow.svelte';
  import CharacterResourcePanel from './CharacterResourcePanel.svelte';
  import type {
    SessionToolboxCharacterSummary,
    SessionToolboxResourceChange
  } from '../types';

  type Props = {
    characters: SessionToolboxCharacterSummary[];
    savingResourceKey?: string;
    onResourceChange?: (change: SessionToolboxResourceChange) => void | Promise<void>;
  };

  let { characters, savingResourceKey = '', onResourceChange }: Props = $props();
</script>

<FloatingToolboxWindow title="Toolbox sesji">
  <CharacterResourcePanel {characters} {savingResourceKey} {onResourceChange} />
</FloatingToolboxWindow>
