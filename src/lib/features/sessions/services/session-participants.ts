import type { CharacterCard } from "$lib/modules/charactersModule/charactersTypes";
import { getUserCharacters } from "$lib/modules/characters";
import { type AppUser } from "$lib/modules/users/userType";
import { getUsers } from "$lib/modules/users/users";
import type { RpgSession, RpgSessionParticipant } from "$lib/modules/rpg-sessions";

export function participantKey(userId: string, characterId: string) {
  return `${userId}:${characterId}`;
}

function formatUserName(user: AppUser) {
  return user.username ?? user.email ?? user.userId;
}

export async function loadSessionPlayerNames(
  session: RpgSession,
  participants: RpgSessionParticipant[] = session.participants ?? [],
) {
  const wantedUserIds = new Set([
    ...session.playerUserIds,
    ...participants.map((participant) => participant.userId),
  ]);

  if (wantedUserIds.size === 0) {
    return {};
  }

  const usersById: Record<string, string> = {};
  let cursor: string | null = null;

  do {
    const response = await getUsers({ limit: 100, cursor });
    response.users.forEach((user) => {
      if (wantedUserIds.has(user.userId)) {
        usersById[user.userId] = formatUserName(user);
      }
    });
    cursor = response.nextCursor;
  } while (cursor && Object.keys(usersById).length < wantedUserIds.size);

  return usersById;
}

export async function loadSessionParticipants(session: RpgSession) {
  const participants = session.participants ?? [];
  if (participants.length > 0) {
    return participants;
  }

  if (session.playerUserIds.length === 0) {
    return [];
  }

  const entries = await Promise.all(
    session.playerUserIds.map(async (playerUserId) => {
      try {
        const response = await getUserCharacters(playerUserId, {
          limit: 100,
          rpgSystem: session.rpgSystem,
        });

        return response.characterSheets
          .filter((character) => character.sessionId === session.sessionId)
          .map((character) => ({
            userId: playerUserId,
            characterId: character.characterId,
          }));
      } catch {
        return [];
      }
    }),
  );

  return entries.flat();
}

export async function loadParticipantCharacters(
  session: RpgSession,
  participants: RpgSessionParticipant[],
) {
  if (participants.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    participants.map(async (participant) => {
      const key = participantKey(participant.userId, participant.characterId);

      try {
        const response = await getUserCharacters(participant.userId, {
          limit: 100,
          rpgSystem: session.rpgSystem,
        });
        const character = response.characterSheets.find(
          (entry) => entry.characterId === participant.characterId,
        );

        return [key, character ?? null] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<string, CharacterCard | null>;
}

export async function loadSessionParticipantViewData(session: RpgSession) {
  const participants = await loadSessionParticipants(session);
  const [charactersByKey, playerNamesById] = await Promise.all([
    loadParticipantCharacters(session, participants),
    loadSessionPlayerNames(session, participants),
  ]);

  return {
    participants,
    charactersByKey,
    playerNamesById,
  };
}
