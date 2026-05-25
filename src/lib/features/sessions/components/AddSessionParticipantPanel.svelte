<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import type { CharacterCard } from '$lib/modules/charactersModule/charactersTypes';
  import type { RpgSession } from '$lib/modules/rpg-sessions';
  import {type AppUser } from '$lib/modules/users/userType';

  type Props = {
    session: RpgSession;
    usersNextCursor: string | null;
    availableUsers: AppUser[];
    selectedPlayerUserId: string;
    selectedCharacterId: string;
    selectedPlayerCharacters: CharacterCard[];
    isLoadingUsers: boolean;
    isLoadingPlayerCharacters: boolean;
    isAddingPlayer: boolean;
    onLoadMore: (cursor: string) => void;
    onSelectPlayer: (userId: string) => void;
    onSelectCharacter: (characterId: string) => void;
    onAdd: () => void;
  };

  let {
    session,
    usersNextCursor,
    availableUsers,
    selectedPlayerUserId,
    selectedCharacterId,
    selectedPlayerCharacters,
    isLoadingUsers,
    isLoadingPlayerCharacters,
    isAddingPlayer,
    onLoadMore,
    onSelectPlayer,
    onSelectCharacter,
    onAdd
  }: Props = $props();

  function formatUserName(user: AppUser) {
    return user.username ?? user.email ?? user.userId;
  }
</script>

<Card class="border-border/80 bg-card/95">
  <CardHeader>
    <CardTitle>Dodaj gracza do sesji</CardTitle>
    <CardDescription>
      Wybierz gracza, potem jedną z jego kart zgodnych z systemem {session.rpgSystem}.
    </CardDescription>
  </CardHeader>

  <CardContent class="grid gap-5 lg:grid-cols-[1fr_1fr]">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-medium">Gracze</h3>
        {#if usersNextCursor}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoadingUsers}
            onclick={() => onLoadMore(usersNextCursor)}
          >
            Pokaż więcej
          </Button>
        {/if}
      </div>

      {#if isLoadingUsers && availableUsers.length === 0}
        <p class="text-sm text-muted-foreground">Pobieranie graczy...</p>
      {:else if availableUsers.length === 0}
        <p class="text-sm text-muted-foreground">Brak graczy dostępnych do dodania.</p>
      {:else}
        <div class="grid gap-2 sm:grid-cols-2">
          {#each availableUsers as user (user.userId)}
            <button
              class={[
                'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                selectedPlayerUserId === user.userId
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border/80 bg-background/40 hover:bg-muted'
              ]}
              type="button"
              onclick={() => onSelectPlayer(user.userId)}
            >
              <span class="block break-all font-medium">{formatUserName(user)}</span>
              <span class="mt-1 block text-xs text-muted-foreground">
                wybierz, aby pobrać postacie
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium">Postać gracza</h3>
      {#if !selectedPlayerUserId}
        <p class="text-sm text-muted-foreground">Najpierw wybierz gracza z listy.</p>
      {:else if isLoadingPlayerCharacters}
        <p class="text-sm text-muted-foreground">Pobieranie postaci gracza...</p>
      {:else if selectedPlayerCharacters.length === 0}
        <p class="text-sm text-muted-foreground">
          Ten gracz nie ma postaci dla systemu {session.rpgSystem}.
        </p>
      {:else}
        <div class="grid gap-2">
          {#each selectedPlayerCharacters as character (character.characterId)}
            <button
              class={[
                'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                selectedCharacterId === character.characterId
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border/80 bg-background/40 hover:bg-muted'
              ]}
              type="button"
              onclick={() => onSelectCharacter(character.characterId)}
            >
              <span class="block font-medium">{character.name}</span>
              <span class="mt-1 block text-xs text-muted-foreground">
                {character.rpgSystem ?? session.rpgSystem}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex justify-end">
        <Button
          type="button"
          disabled={isAddingPlayer || !selectedPlayerUserId || !selectedCharacterId}
          onclick={onAdd}
        >
          {isAddingPlayer ? 'Dodawanie...' : 'Dodaj gracza z postacią'}
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
