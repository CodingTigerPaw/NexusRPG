<script lang="ts">
  import { activeThemeId } from '../theme-store';
  import CthulhuThemeDecorations from './decorations/CthulhuThemeDecorations.svelte';
  import DefaultThemeDecorations from './decorations/DefaultThemeDecorations.svelte';
  import VampireThemeDecorations from './decorations/VampireThemeDecorations.svelte';
</script>

<div class="decoration-glass-layer" aria-hidden="true">
  <!--
    Ta warstwa jest tylko przezroczystą szybą; konkretne elementy należą
    do komponentu wybranego theme, żeby nie mieszać dekoracji różnych klimatów.
  -->
  {#if $activeThemeId === 'cthulhu'}
    <CthulhuThemeDecorations />
  {:else if $activeThemeId === 'vampire'}
    <VampireThemeDecorations />
  {:else}
    <DefaultThemeDecorations />
  {/if}
</div>
