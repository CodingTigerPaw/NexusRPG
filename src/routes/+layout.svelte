<script lang="ts">
  import AppNavigation from '$lib/components/AppNavigation.svelte';
  import '../app.css';

  let { children } = $props();
</script>

<AppNavigation />
{@render children()}
