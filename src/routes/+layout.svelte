<script lang="ts">
  import AppNavigation from '$lib/components/AppNavigation.svelte';
  import { ThemeProvider } from '$lib/features/theme';
  import '../app.css';

  let { children } = $props();
</script>

<ThemeProvider>
  <AppNavigation />
  <div class="pointer-events-none fixed right-1 top-1 z-[120] rounded-sm border bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-normal text-muted-foreground shadow-sm backdrop-blur">
    Beta v0.2
  </div>
  {@render children()}
</ThemeProvider>
