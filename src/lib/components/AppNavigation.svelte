<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount, tick } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { appRoutes } from '$lib/modules/navigation';
  import { getCurrentUser } from '$lib/modules/AuthModule/user';
  import { hasRole } from '$lib/modules/AuthModule/roles';
  import { isAuthenticated, logout as logoutUser } from '$lib/modules/AuthModule/service';
  import type { CognitoUser } from '$lib/modules/AuthModule/authTypes/session';

  let authenticated = $state(false);
  let user = $state<CognitoUser | null>(null);
  let headerElement = $state<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | null = null;

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
    scheduleNavigationHeightSync();
  }

  onMount(() => {
    refreshAuthState();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    document.documentElement.style.removeProperty('--app-navigation-height');
  });

  afterNavigate(() => {
    refreshAuthState();
  });

  function setNavigationHeight(height: number) {
    document.documentElement.style.setProperty('--app-navigation-height', `${Math.ceil(height)}px`);
  }

  function syncNavigationHeight() {
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (!authenticated || !headerElement) {
      setNavigationHeight(0);
      return;
    }

    setNavigationHeight(headerElement.getBoundingClientRect().height);
    resizeObserver = new ResizeObserver(([entry]) => {
      setNavigationHeight(entry.contentRect.height);
    });
    resizeObserver.observe(headerElement);
  }

  function scheduleNavigationHeightSync() {
    void tick().then(syncNavigationHeight);
  }

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
  <header bind:this={headerElement} class="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
    <div class="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
      <a class="app-title-brand text-xl tracking-normal text-foreground" href="/profile">
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
