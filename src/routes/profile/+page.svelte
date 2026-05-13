<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import RoleGate from '$lib/components/RoleGate.svelte';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import {
    getCurrentUser
  } from '$lib/modules/AuthModule/user';
  import { getStoredAuthSession } from '$lib/modules/AuthModule/session';
  import { decodeJwtPayload } from '$lib/modules/AuthModule/tokens';
  import { logout as logoutUser } from '$lib/modules/AuthModule/service';
  import type { AuthSession, CognitoUser } from '$lib/modules/AuthModule/authTypes/session';

  let session = $state<AuthSession | null>(null);
  let user = $state<CognitoUser | null>(null);
  let accessTokenPayload = $state<Record<string, unknown> | null>(null);
  let idTokenPayload = $state<Record<string, unknown> | null>(null);

  onMount(() => {
    session = getStoredAuthSession();

    if (!session?.tokens.accessToken) {
      void goto('/');
      return;
    }

    user = getCurrentUser();
    accessTokenPayload = decodeJwtPayload(session.tokens.accessToken);
    idTokenPayload = decodeJwtPayload(session.tokens.idToken);
  });

  function formatDateFromSeconds(value: unknown) {
    if (typeof value !== 'number') {
      return 'brak danych';
    }

    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value * 1000));
  }

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

<main class="flex min-h-screen items-center justify-center bg-background px-4 py-10">
  <section class="w-full max-w-2xl">
    <Card class="border-border/80 bg-card/95 shadow-2xl shadow-black/20">
      <CardHeader class="space-y-2">
        <CardTitle class="text-2xl tracking-normal">Profil</CardTitle>
        <CardDescription>Dane użytkownika</CardDescription>
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
              <p class="text-muted-foreground">User ID</p>
              <p class="break-all font-medium">{user?.userId ?? 'brak danych'}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Rola</p>
              <p class="font-medium">{user?.role ?? 'brak danych'}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Token wygasa</p>
              <p class="font-medium">{formatDateFromSeconds(accessTokenPayload?.exp)}</p>
            </div>
          </div>

          <RoleGate roles="admin">
            <div class="rounded-md border border-primary/35 bg-primary/10 p-4 text-sm">
              <p class="font-medium text-primary">Sekcja administracyjna</p>
              <p class="mt-1 text-muted-foreground">
                Ten blok jest renderowany tylko dla użytkowników z rolą admin.
              </p>
            </div>
          </RoleGate>

          <!-- <div class="space-y-2">
            <p class="text-sm font-medium">JWT access token</p>
            <pre class="max-h-52 overflow-auto rounded-md border bg-background/70 p-3 text-xs text-muted-foreground">{JSON.stringify(accessTokenPayload, null, 2)}</pre>
          </div>

          <div class="space-y-2">
            <p class="text-sm font-medium">JWT ID token</p>
            <pre class="max-h-52 overflow-auto rounded-md border bg-background/70 p-3 text-xs text-muted-foreground">{JSON.stringify(idTokenPayload, null, 2)}</pre>
          </div> -->

          <Button type="button" variant="secondary" onclick={logout}>Wyloguj</Button>
        {:else}
          <p class="text-sm text-muted-foreground">Sprawdzanie sesji...</p>
        {/if}
      </CardContent>
    </Card>
  </section>
</main>
