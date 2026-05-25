<script lang="ts">
  export type SessionTableParticipant = {
    participantId: string;
    label: string;
    subtitle?: string;
    avatarUrl?: string | null;
    isActive?: boolean;
  };

  type Props = {
    participants: SessionTableParticipant[];
    backgroundUrl?: string | null;
    backgroundLabel?: string;
  };

  let { participants, backgroundUrl = null, backgroundLabel = "Tło stołu" }: Props = $props();

  function avatarInitial(label: string) {
    return label.trim().slice(0, 1).toUpperCase() || "?";
  }

</script>

<div class="relative h-full min-h-0 w-full overflow-hidden bg-background">
  {#if backgroundUrl}
    <img
      class="absolute inset-0 h-full w-full object-cover"
      src={backgroundUrl}
      alt={backgroundLabel}
    />
  {/if}
  <div class="absolute inset-0 bg-background/10"></div>

  {#if participants.length > 0}
    <div class="absolute inset-0 z-10 flex items-center justify-center p-8">
      <div class="flex max-w-[min(78rem,calc(100vw-4rem))] flex-wrap items-center justify-center gap-8 sm:gap-12">
    {#each participants as participant (participant.participantId)}
      <div class="ui-popover-in flex w-40 flex-col items-center gap-3 text-center sm:w-52">
        <div
          class="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-4xl font-semibold text-muted-foreground shadow-2xl sm:h-44 sm:w-44"
        >
          {#if participant.avatarUrl}
            <img
              class="h-full w-full object-cover"
              src={participant.avatarUrl}
              alt={`Avatar: ${participant.label}`}
            />
          {:else}
            {avatarInitial(participant.label)}
          {/if}
        </div>

        <div class="max-w-full rounded-md border bg-card/90 px-3 py-2 shadow-md backdrop-blur">
          <p class="truncate text-sm font-semibold sm:text-base">{participant.label}</p>
          {#if participant.subtitle}
            <p class="truncate text-xs text-muted-foreground sm:text-sm">{participant.subtitle}</p>
          {/if}
        </div>
      </div>
    {/each}
      </div>
    </div>
  {:else}
    <div class="absolute inset-0 flex items-center justify-center p-6 text-center">
      <div class="max-w-sm rounded-md border bg-card/80 px-4 py-3 shadow-lg backdrop-blur">
        <p class="text-sm font-medium">Brak uczestników przy stole</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Po dodaniu postaci ich avatary pojawią się w tym widoku.
        </p>
      </div>
    </div>
  {/if}
</div>
