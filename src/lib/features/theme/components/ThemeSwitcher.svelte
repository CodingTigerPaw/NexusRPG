<script lang="ts">
  import { activeThemeId, applyTheme } from '../theme-store';
  import { themeStrategies } from '../theme-registry';
</script>

<label class="flex items-center gap-2 text-xs text-muted-foreground">
  <span class="sr-only">Motyw aplikacji</span>
  <select
    class="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    aria-label="Motyw aplikacji"
    value={$activeThemeId}
    onchange={(event) => applyTheme(event.currentTarget.value)}
  >
    {#each themeStrategies as theme}
      <option value={theme.id}>{theme.label}</option>
    {/each}
  </select>
</label>
