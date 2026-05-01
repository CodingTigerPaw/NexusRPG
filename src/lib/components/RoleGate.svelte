<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { hasRole } from '$lib/modules/auth';

  type Props = {
    roles: string | string[];
    children?: Snippet;
    fallback?: Snippet;
  };

  let { roles, children, fallback }: Props = $props();
  let allowed = $state(false);
  let ready = $state(false);

  onMount(() => {
    allowed = hasRole(roles);
    ready = true;
  });
</script>

{#if ready && allowed}
  {@render children?.()}
{:else if ready}
  {@render fallback?.()}
{/if}
