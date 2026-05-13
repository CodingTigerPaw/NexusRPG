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
  import type { RpgSessionParticipant } from '$lib/modules/rpg-sessions';

  type Props = {
    sessionParticipants: RpgSessionParticipant[];
    unassignedPlayerUserIds: string[];
    playerNamesById: Record<string, string>;
    participantCharactersByKey: Record<string, CharacterCard | null>;
    canManageSession: boolean;
    isOwner: boolean;
    removingPlayerUserId: string;
    message?: string;
    onEdit: (participant: RpgSessionParticipant) => void;
    onRemove: (playerUserId: string) => void;
  };

  let {
    sessionParticipants,
    unassignedPlayerUserIds,
    playerNamesById,
    participantCharactersByKey,
    canManageSession,
    isOwner,
    removingPlayerUserId,
    message = '',
    onEdit,
    onRemove
  }: Props = $props();

  function participantKey(userId: string, characterId: string) {
    return `${userId}:${characterId}`;
  }

  function getPlayerName(playerUserId: string) {
    return playerNamesById[playerUserId] ?? 'Gracz niedostępny';
  }

  function getParticipantCharacterName(participant: RpgSessionParticipant) {
    const key = participantKey(participant.userId, participant.characterId);
    return participantCharactersByKey[key]?.name ?? 'Postać niedostępna';
  }
</script>

<Card class="border-border/80 bg-card/95">
  <CardHeader>
    <CardTitle>Gracze</CardTitle>

  </CardHeader>

  <CardContent>
    {#if message}
      <div class="mb-3 rounded-md border border-border/80 bg-background/40 px-3 py-2 text-sm">
        {message}
      </div>
    {/if}

    {#if sessionParticipants.length || unassignedPlayerUserIds.length}
      <div class="space-y-2">
        {#each sessionParticipants as participant}
          <div class="rounded-md border border-border/80 bg-background/40 px-3 py-2 text-sm">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium">{getPlayerName(participant.userId)}</p>
                <p class="mt-1 text-muted-foreground">
                  Postać: {getParticipantCharacterName(participant)}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                {#if canManageSession}
                  <Button type="button" variant="outline" size="sm" onclick={() => onEdit(participant)}>
                    Edytuj
                  </Button>
                {/if}
                {#if isOwner}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(removingPlayerUserId)}
                    onclick={() => onRemove(participant.userId)}
                  >
                    {removingPlayerUserId === participant.userId ? 'Usuwanie...' : 'Usuń'}
                  </Button>
                {/if}
              </div>
            </div>
          </div>
        {/each}

        {#each unassignedPlayerUserIds as playerUserId}
          <div class="rounded-md border bg-background/40 px-3 py-2 text-sm">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium">{getPlayerName(playerUserId)}</p>
                <p class="mt-1 text-muted-foreground">
                  Postać: nie znaleziono karty z przypisanym `sessionId`
                </p>
              </div>
              {#if isOwner}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={Boolean(removingPlayerUserId)}
                  onclick={() => onRemove(playerUserId)}
                >
                  {removingPlayerUserId === playerUserId ? 'Usuwanie...' : 'Usuń'}
                </Button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">Brak przypisanych graczy.</p>
    {/if}
  </CardContent>
</Card>
