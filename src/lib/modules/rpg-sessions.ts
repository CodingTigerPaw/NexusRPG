import { apiClient } from '$lib/modules/ApiModule/client';
import { mapAPIError } from '$lib/modules/ApiModule/errors';
import { expectArrayField, expectField } from '$lib/modules/ApiModule/response';
import { rpgSessionsAPI } from '$lib/modules/repository';

export type RpgSession = {
  sessionId: string;
  ownerUserId: string;
  playerUserIds: string[];
  participants?: RpgSessionParticipant[];
  rpgSystem: string;
  name?: string;
  title?: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RpgSessionParticipant = {
  userId: string;
  characterId: string;
};

export type CreateRpgSessionPayload = {
  rpgSystem: string;
  name?: string;
  title?: string;
  description?: string | null;
  playerUserIds?: string[];
  participants?: RpgSessionParticipant[];
};

export type AddRpgSessionPlayersPayload = {
  userId?: string;
  userIds?: string[];
  characterId?: string;
  participants?: RpgSessionParticipant[];
};

export type GetRpgSessionsOptions = {
  limit?: number;
  cursor?: string | null;
};

type CreateRpgSessionResponse = {
  session?: RpgSession;
  message?: string;
};

type RemoveRpgSessionPlayerResponse = {
  session?: RpgSession;
  removedPlayerUserId?: string;
  removedParticipants?: RpgSessionParticipant[];
  message?: string;
};

type RpgSessionsResponse = {
  userId: string;
  sessions: RpgSession[];
  nextCursor: string | null;
  message?: string;
};

function buildRpgSessionUrl(sessionId: string) {
  return `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}`;
}

function buildRpgSessionPlayersUrl(sessionId: string) {
  return `${buildRpgSessionUrl(sessionId)}/players`;
}

function buildRpgSessionPlayerUrl(sessionId: string, userId: string) {
  return `${buildRpgSessionPlayersUrl(sessionId)}/${encodeURIComponent(userId)}`;
}

export async function getRpgSessions(options: GetRpgSessionsOptions = {}) {
  try {
    const data = await apiClient.get<RpgSessionsResponse>(rpgSessionsAPI, {
      query: options,
      fallbackErrorMessage: 'Nie udało się pobrać sesji RPG.'
    });

    expectArrayField(data, 'sessions', 'Backend zwrócił nieprawidłową listę sesji RPG.');
    return data;
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: 'Brak uprawnień do pobrania sesji RPG.'
    });
  }
}

export async function getRpgSession(sessionId: string) {
  try {
    const data = await apiClient.get<CreateRpgSessionResponse>(buildRpgSessionUrl(sessionId), {
      fallbackErrorMessage: 'Nie udało się pobrać sesji RPG.'
    });

    return expectField(data, 'session', 'Backend nie zwrócił danych sesji RPG.');
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: 'Brak uprawnień do pobrania tej sesji RPG.',
      notFound: 'Nie znaleziono sesji RPG.'
    });
  }
}

export async function createRpgSession(payload: CreateRpgSessionPayload) {
  try {
    const data = await apiClient.post<CreateRpgSessionResponse>(rpgSessionsAPI, payload, {
      fallbackErrorMessage: 'Nie udało się utworzyć sesji RPG.'
    });

    return expectField(data, 'session', 'Backend nie zwrócił utworzonej sesji RPG.');
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: 'Brak uprawnień do utworzenia sesji RPG.'
    });
  }
}

export async function addRpgSessionPlayers(
  sessionId: string,
  payload: AddRpgSessionPlayersPayload
) {
  try {
    const data = await apiClient.post<CreateRpgSessionResponse>(
      buildRpgSessionPlayersUrl(sessionId),
      payload,
      {
        fallbackErrorMessage: 'Nie udało się dodać gracza do sesji RPG.'
      }
    );

    return expectField(data, 'session', 'Backend nie zwrócił zaktualizowanej sesji RPG.');
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: 'Tylko GM będący właścicielem sesji może dodawać graczy.',
      notFound: 'Nie znaleziono sesji RPG albo wybranej karty postaci.',
      fallback: 'Nie udało się dodać gracza do sesji RPG.'
    });
  }
}

export async function removeRpgSessionPlayer(sessionId: string, userId: string) {
  try {
    const data = await apiClient.delete<RemoveRpgSessionPlayerResponse>(
      buildRpgSessionPlayerUrl(sessionId, userId),
      {
        fallbackErrorMessage: 'Nie udało się usunąć gracza z sesji RPG.'
      }
    );

    return expectField(data, 'session', 'Backend nie zwrócił zaktualizowanej sesji RPG.');
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: 'Tylko GM będący właścicielem sesji może usuwać graczy.',
      badRequest: 'Nie można usunąć właściciela sesji.',
      notFound: 'Nie znaleziono sesji RPG albo gracza w tej sesji.',
      fallback: 'Nie udało się usunąć gracza z sesji RPG.'
    });
  }
}

export async function deleteRpgSession(sessionId: string) {
  try {
    const data = await apiClient.delete<{ message?: string }>(buildRpgSessionUrl(sessionId), {
      fallbackErrorMessage: 'Nie udało się usunąć sesji RPG.'
    });

    return data?.message ?? 'RPG session deleted';
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: 'Brak uprawnień do usunięcia tej sesji RPG.',
      notFound: 'Nie znaleziono sesji RPG.'
    });
  }
}

export function formatRpgSessionName(session: RpgSession) {
  return (
    session.name?.trim() ||
    session.title?.trim() ||
    session.description?.trim() ||
    session.rpgSystem
  );
}
