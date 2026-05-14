<script lang="ts">
  import LiveSessionToolbox from './LiveSessionToolbox.svelte';
  import type {
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
</script>

{#if canManageSession}
  <LiveSessionToolbox {characters} {savingResourceKey} {onResourceChange} />
{/if}
