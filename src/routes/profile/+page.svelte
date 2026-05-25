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
  import { ThemeSwitcher } from '$lib/features/theme';
  import { getCurrentUser } from '$lib/modules/AuthModule/user';
  import { getStoredAuthSession } from '$lib/modules/AuthModule/session';
  import { logout as logoutUser } from '$lib/modules/AuthModule/service';
  import type { AuthSession, CognitoUser } from '$lib/modules/AuthModule/authTypes/session';

  let session = $state<AuthSession | null>(null);
  let user = $state<CognitoUser | null>(null);

  onMount(() => {
    session = getStoredAuthSession();

    if (!session?.tokens.accessToken) {
      void goto('/');
      return;
    }

    user = getCurrentUser();
  });

  async function logout() {
    try {
      await logoutUser();
    } catch {
      // Tokeny lokalne są czyszczone w logoutUser także przy błędzie backendu.
    }

    await goto('/');
  }
</script>

<svelte:head>
  <title>Profil</title>
</svelte:head>

<main class="min-h-[calc(100vh-var(--app-navigation-height,0px))] bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-3xl space-y-4">
    <Card class="border-border/80 bg-card/95 shadow-2xl shadow-black/20">
      <CardHeader class="space-y-2">
        <CardTitle class="text-2xl tracking-normal">Profil gracza</CardTitle>
        <CardDescription>Podstawowe informacje i wygląd aplikacji.</CardDescription>
      </CardHeader>

      <CardContent class="space-y-6">
        {#if session}
          <div class="grid gap-3 rounded-md border bg-background/50 p-4 text-sm sm:grid-cols-2">
            <div>
              <p class="text-muted-foreground">Nazwa użytkownika</p>
              <p class="font-medium">{user?.username ?? 'brak danych'}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Email</p>
              <p class="break-all font-medium">{user?.email ?? 'brak danych'}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Rola</p>
              <p class="font-medium">{user?.role ?? 'brak danych'}</p>
            </div>
          </div>

          <div class="rounded-md border bg-background/50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-medium">Motyw aplikacji</p>
                <p class="mt-1 text-sm text-muted-foreground">
                  Wybierz klimat interfejsu dla swojego widoku.
                </p>
              </div>
              <ThemeSwitcher />
            </div>
          </div>

          <Button type="button" variant="secondary" onclick={logout}>Wyloguj</Button>
        {:else}
          <p class="text-sm text-muted-foreground">Sprawdzanie sesji...</p>
        {/if}
      </CardContent>
    </Card>
  </section>
</main>
