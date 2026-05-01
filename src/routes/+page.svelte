<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Eye, EyeOff } from 'lucide-svelte';
  import {
    completeNewPasswordChallenge,
    isAuthenticated,
    login,
    type NewPasswordRequiredResult
  } from '$lib/modules/auth';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let username = $state('');
  let password = $state('');
  let newPassword = $state('');
  let confirmNewPassword = $state('');
  let remember = $state(true);
  let showPassword = $state(false);
  let showNewPassword = $state(false);
  let pendingChallenge = $state<NewPasswordRequiredResult | null>(null);
  let errorMessage = $state('');
  let successMessage = $state('');
  let isSubmitting = $state(false);

  const isNewPasswordStep = $derived(Boolean(pendingChallenge));

  onMount(() => {
    if (isAuthenticated()) {
      void goto('/profile');
    }
  });

  async function handleLogin() {
    errorMessage = '';
    successMessage = '';
    isSubmitting = true;

    try {
      const result = await login({ username, password, remember });

      if (result.status === 'newPasswordRequired') {
        pendingChallenge = result;
        password = '';
        successMessage = 'Ustaw nowe hasło, aby dokończyć pierwsze logowanie.';
        return;
      }

      await goto('/profile');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Nie udało się zalogować.';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleNewPassword() {
    errorMessage = '';
    successMessage = '';

    if (!pendingChallenge) {
      errorMessage = 'Brakuje aktywnej sesji Cognito. Zaloguj się ponownie.';
      return;
    }

    if (newPassword !== confirmNewPassword) {
      errorMessage = 'Hasła nie są takie same.';
      return;
    }

    isSubmitting = true;

    try {
      await completeNewPasswordChallenge({
        username,
        newPassword,
        session: pendingChallenge.session,
        remember
      });

      pendingChallenge = null;
      newPassword = '';
      confirmNewPassword = '';
      await goto('/profile');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Nie udało się ustawić nowego hasła.';
    } finally {
      isSubmitting = false;
    }
  }

  function resetChallenge() {
    pendingChallenge = null;
    newPassword = '';
    confirmNewPassword = '';
    errorMessage = '';
    successMessage = '';
  }
</script>

<svelte:head>
  <title>Logowanie | Nexus RPG</title>
  <meta
    name="description"
    content="Ekran logowania aplikacji SvelteKit dla kampanii Call of Cthulhu RPG."
  />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-background px-4 py-10">
  <section class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <div class="mx-auto mb-4 h-10 w-10 rounded-md border border-primary/30 bg-primary/10 shadow-sm"></div>
      <p class="text-sm font-medium text-muted-foreground">Nexus RPG</p>
    </div>

    <Card class="border-border/80 bg-card/95 shadow-2xl shadow-black/20">
      <CardHeader class="space-y-2 text-center">
        <CardTitle class="text-2xl tracking-normal">
          {isNewPasswordStep ? 'Ustaw nowe hasło' : 'Logowanie'}
        </CardTitle>
        <CardDescription>
          {isNewPasswordStep
            ? 'Cognito wymaga zmiany hasła przy pierwszym logowaniu.'
            : 'Zaloguj się do panelu kampanii.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {#if errorMessage}
          <p class="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {errorMessage}
          </p>
        {/if}

        {#if successMessage}
          <p class="mb-5 rounded-md border border-primary/35 bg-primary/10 px-3 py-2 text-sm text-primary">
            {successMessage}
          </p>
        {/if}

        {#if isNewPasswordStep}
          <form class="space-y-5" onsubmit={(event) => { event.preventDefault(); void handleNewPassword(); }}>
            <div class="space-y-2">
              <Label for="new-password">Nowe hasło</Label>
              <div class="relative">
                <Input
                  id="new-password"
                  bind:value={newPassword}
                  class="pr-10"
                  type={showNewPassword ? 'text' : 'password'}
                  autocomplete="new-password"
                  placeholder="Wprowadź nowe hasło"
                  disabled={isSubmitting}
                />
                <button
                  class="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  aria-label={showNewPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                  onclick={() => (showNewPassword = !showNewPassword)}
                >
                  {#if showNewPassword}
                    <EyeOff class="h-4 w-4" aria-hidden="true" />
                  {:else}
                    <Eye class="h-4 w-4" aria-hidden="true" />
                  {/if}
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="confirm-new-password">Powtórz nowe hasło</Label>
              <Input
                id="confirm-new-password"
                bind:value={confirmNewPassword}
                type="password"
                autocomplete="new-password"
                placeholder="Powtórz nowe hasło"
                disabled={isSubmitting}
              />
            </div>

            <Button class="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Zapisywanie...' : 'Ustaw hasło'}
            </Button>

            <Button class="w-full" variant="ghost" type="button" disabled={isSubmitting} onclick={resetChallenge}>
              Wróć do logowania
            </Button>
          </form>
        {:else}
        <form class="space-y-5" onsubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
          <div class="space-y-2">
            <Label for="login">Login</Label>
            <Input
              id="login"
              bind:value={username}
              type="text"
              autocomplete="username"
              placeholder="gm"
              disabled={isSubmitting}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-4">
              <Label for="password">Hasło</Label>
              <!-- <a class="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/">
                Nie pamiętasz?
              </a> -->
            </div>
            <div class="relative">
              <Input
                id="password"
                bind:value={password}
                class="pr-10"
                type={showPassword ? 'text' : 'password'}
                autocomplete="current-password"
                placeholder="••••••••"
                disabled={isSubmitting}
              />
              <button
                class="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                disabled={isSubmitting}
                onclick={() => (showPassword = !showPassword)}
              >
                {#if showPassword}
                  <EyeOff class="h-4 w-4" aria-hidden="true" />
                {:else}
                  <Eye class="h-4 w-4" aria-hidden="true" />
                {/if}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-4">
            <label class="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <input
                bind:checked={remember}
                class="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                type="checkbox"
                disabled={isSubmitting}
              />
              <span>Zapamiętaj mnie</span>
            </label>
          </div>

          <Button class="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logowanie...' : 'Zaloguj'}
          </Button>
        </form>
        {/if}
      </CardContent>
    </Card>
  </section>
</main>
