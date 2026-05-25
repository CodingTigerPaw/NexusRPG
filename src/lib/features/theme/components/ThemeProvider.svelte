<script lang="ts">
  import { onMount } from 'svelte';
  import DecorationLayer from './DecorationLayer.svelte';
  import { initializeTheme } from '../theme-store';

  let { children } = $props();

  onMount(() => {
    initializeTheme();
  });
</script>

<div class="app-shell min-h-screen">
  <DecorationLayer />
  <div class="app-shell-content min-h-screen">
    {@render children()}
  </div>
</div>
