<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { appRoutes } from '$lib/modules/navigation';
  import {
    getCurrentUser,
    hasRole,
    isAuthenticated,
    logout as logoutUser,
    type CognitoUser
  } from '$lib/modules/auth';

  let authenticated = $state(false);
  let user = $state<CognitoUser | null>(null);

  const pathname = $derived(page.url.pathname);
  const visibleRoutes = $derived(
    appRoutes.filter((route) => {
      if (route.requiresAuth && !authenticated) {
        return false;
      }

      if (route.roles?.length) {
        return hasRole(route.roles);
      }

      return true;
    })
  );

  function refreshAuthState() {
    authenticated = isAuthenticated();
    user = authenticated ? getCurrentUser() : null;
  }

  onMount(() => {
    refreshAuthState();
  });

  afterNavigate(() => {
    refreshAuthState();
  });

  async function logout() {
    try {
      await logoutUser();
    } catch {
      // Tokeny lokalne są czyszczone w logoutUser także przy błędzie backendu.
    }

    refreshAuthState();
    await goto('/');
  }
</script>

{#if authenticated}
  <header class="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
    <div class="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
      <a class="font-serif text-lg font-semibold tracking-normal text-foreground" href="/profile">
        Nexus RPG
      </a>

      <nav class="flex items-center gap-1" aria-label="Główna nawigacja">
        {#each visibleRoutes as route}
          <a
            class={[
              'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
              pathname === route.href ? 'bg-muted text-foreground' : 'text-muted-foreground'
            ]}
            href={route.href}
            aria-current={pathname === route.href ? 'page' : undefined}
          >
            {route.label}
          </a>
        {/each}
      </nav>

      <div class="flex items-center gap-3">
        <div class="hidden text-right text-xs text-muted-foreground sm:block">
          <p class="font-medium text-foreground">{user?.username ?? 'Użytkownik'}</p>
          <p>{user?.role ?? 'brak roli'}</p>
        </div>
        <Button size="sm" variant="secondary" onclick={logout}>Wyloguj</Button>
      </div>
    </div>
  </header>
{/if}
