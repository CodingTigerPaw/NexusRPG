<script lang="ts">
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import type { RpgSession } from '../types';

  type Props = {
    session: RpgSession;
    isAdminUser: boolean;
    isOwner: boolean;
    isAssignedPlayer: boolean;
  };

  let { session, isAdminUser, isOwner, isAssignedPlayer }: Props = $props();

  function formatDate(value: string | undefined) {
    return value ? new Date(value).toLocaleString('pl-PL') : 'brak danych';
  }
</script>

<Card class="border-border/80 bg-card/95">
  <CardHeader>
    <CardTitle>Szczegóły</CardTitle>
  </CardHeader>

  <CardContent class="grid gap-4 text-sm sm:grid-cols-2">
    <div>
      <p class="text-muted-foreground">Session ID</p>
      <p class="break-all font-medium">{session.sessionId}</p>
    </div>
    <div>
      <p class="text-muted-foreground">System RPG</p>
      <p class="font-medium">{session.rpgSystem}</p>
    </div>
    <div>
      <p class="text-muted-foreground">Twój dostęp</p>
      <p class="font-medium">
        {isAdminUser ? 'Admin' : isOwner ? 'GM sesji' : isAssignedPlayer ? 'Gracz w sesji' : 'brak'}
      </p>
    </div>
    <div>
      <p class="text-muted-foreground">Utworzono</p>
      <p class="font-medium">{formatDate(session.createdAt)}</p>
    </div>
    <div>
      <p class="text-muted-foreground">Zaktualizowano</p>
      <p class="font-medium">{formatDate(session.updatedAt)}</p>
    </div>
    <div class="sm:col-span-2">
      <p class="text-muted-foreground">Opis</p>
      <p class="whitespace-pre-wrap font-medium">{session.description || 'brak opisu'}</p>
    </div>
  </CardContent>
</Card>
