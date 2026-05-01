<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import { appRoles } from '$lib/modules/navigation';
  import { requireRole } from '$lib/modules/rbac';

  let allowed = $state(false);

  onMount(async () => {
    allowed = await requireRole(appRoles.admin);
  });
</script>

<svelte:head>
  <title>Admin</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-background px-4 py-10">
  <section class="w-full max-w-xl">
    <Card class="border-border/80 bg-card/95 shadow-2xl shadow-black/20">
      <CardHeader class="space-y-2">
        <CardTitle class="text-2xl tracking-normal">Panel admina</CardTitle>
        <CardDescription>Ta trasa wymaga roli admin.</CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        {#if allowed}
          <p class="text-sm text-muted-foreground">
            Dostęp przyznany. Tu możesz dodać narzędzia administracyjne.
          </p>
          <Button variant="secondary" onclick={() => goto('/profile')}>Wróć do profilu</Button>
        {:else}
          <p class="text-sm text-muted-foreground">Sprawdzanie uprawnień...</p>
        {/if}
      </CardContent>
    </Card>
  </section>
</main>
