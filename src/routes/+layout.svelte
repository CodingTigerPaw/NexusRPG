<script lang="ts">
  import { env } from '$env/dynamic/public';
  import AppNavigation from '$lib/components/AppNavigation.svelte';
  import { ThemeProvider } from '$lib/features/theme';
  import '../app.css';

  let { children } = $props();
  let isVersionInfoOpen = $state(false);

  const appEnvironment = (env.PUBLIC_APP_ENV?.trim() || 'local').toLowerCase();
  const appEnvironmentLabel =
    appEnvironment === 'stable' ? 'stable' : appEnvironment === 'dev' ? 'dev' : 'local';

  function closeVersionInfo() {
    isVersionInfoOpen = false;
  }
</script>

<ThemeProvider>
  <AppNavigation />
  <div class="fixed right-1 top-1 z-[120]">
    {#if isVersionInfoOpen}
      <button
        type="button"
        class="fixed inset-0 cursor-default"
        aria-label="Zamknij informacje o wersji"
        onclick={closeVersionInfo}
      ></button>
    {/if}

    <div class="relative">
      <button
        type="button"
        class="relative z-10 rounded-sm border bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-normal text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
        aria-label="Pokaż informacje o wersji"
        aria-expanded={isVersionInfoOpen}
        onclick={() => (isVersionInfoOpen = !isVersionInfoOpen)}
      >
        Beta
      </button>

      {#if isVersionInfoOpen}
        <div
          class="ui-popover-in absolute right-0 top-full z-20 mt-1 min-w-36 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-lg ring-1 ring-border/60 backdrop-blur"
          role="tooltip"
        >
          <p class="font-medium">Beta v0.2</p>
          <p class="mt-1 text-muted-foreground">
            ENV:
            <span class="font-medium uppercase text-primary">{appEnvironmentLabel}</span>
          </p>
        </div>
      {/if}
    </div>
  </div>
  {@render children()}
</ThemeProvider>
