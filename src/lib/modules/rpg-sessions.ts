import { apiClient, isAPIError } from '$lib/modules/FetchModule/APIClient';
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
  let data: RpgSessionsResponse | null;

  try {
    data = await apiClient.get<RpgSessionsResponse>(rpgSessionsAPI, {
      token: 'id',
      query: options,
      fallbackErrorMessage: 'Nie udało się pobrać sesji RPG.'
    });
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error('Brak uprawnień do pobrania sesji RPG.');
    }

    throw error;
  }

  if (!data || !Array.isArray(data.sessions)) {
    throw new Error('Backend zwrócił nieprawidłową listę sesji RPG.');
  }

  return data;
}

export async function getRpgSession(sessionId: string) {
  let data: CreateRpgSessionResponse | null;

  try {
    data = await apiClient.get<CreateRpgSessionResponse>(buildRpgSessionUrl(sessionId), {
      token: 'id',
      fallbackErrorMessage: 'Nie udało się pobrać sesji RPG.'
    });
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error('Brak uprawnień do pobrania tej sesji RPG.');
    }

    if (isAPIError(error) && error.status === 404) {
      throw new Error('Nie znaleziono sesji RPG.');
    }

    throw error;
  }

  if (!data?.session) {
    throw new Error('Backend nie zwrócił danych sesji RPG.');
  }

  return data.session;
}

export async function createRpgSession(payload: CreateRpgSessionPayload) {
  let data: CreateRpgSessionResponse | null;

  try {
    data = await apiClient.post<CreateRpgSessionResponse>(rpgSessionsAPI, payload, {
      token: 'id',
      fallbackErrorMessage: 'Nie udało się utworzyć sesji RPG.'
    });
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error('Brak uprawnień do utworzenia sesji RPG.');
    }

    throw error;
  }

  if (!data?.session) {
    throw new Error('Backend nie zwrócił utworzonej sesji RPG.');
  }

  return data.session;
}

export async function addRpgSessionPlayers(
  sessionId: string,
  payload: AddRpgSessionPlayersPayload
) {
  let data: CreateRpgSessionResponse | null;

  try {
    data = await apiClient.post<CreateRpgSessionResponse>(
      buildRpgSessionPlayersUrl(sessionId),
      payload,
      {
        token: 'id',
        fallbackErrorMessage: 'Nie udało się dodać gracza do sesji RPG.'
      }
    );
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error(error.message || 'Tylko GM będący właścicielem sesji może dodawać graczy.');
    }

    if (isAPIError(error) && error.status === 404) {
      throw new Error(error.message || 'Nie znaleziono sesji RPG albo wybranej karty postaci.');
    }

    if (isAPIError(error)) {
      throw new Error(error.message || 'Nie udało się dodać gracza do sesji RPG.');
    }

    throw error;
  }

  if (!data?.session) {
    throw new Error('Backend nie zwrócił zaktualizowanej sesji RPG.');
  }

  return data.session;
}

export async function removeRpgSessionPlayer(sessionId: string, userId: string) {
  let data: RemoveRpgSessionPlayerResponse | null;

  try {
    data = await apiClient.delete<RemoveRpgSessionPlayerResponse>(
      buildRpgSessionPlayerUrl(sessionId, userId),
      {
        token: 'id',
        fallbackErrorMessage: 'Nie udało się usunąć gracza z sesji RPG.'
      }
    );
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error(error.message || 'Tylko GM będący właścicielem sesji może usuwać graczy.');
    }

    if (isAPIError(error) && error.status === 400) {
      throw new Error(error.message || 'Nie można usunąć właściciela sesji.');
    }

    if (isAPIError(error) && error.status === 404) {
      throw new Error(error.message || 'Nie znaleziono sesji RPG albo gracza w tej sesji.');
    }

    if (isAPIError(error)) {
      throw new Error(error.message || 'Nie udało się usunąć gracza z sesji RPG.');
    }

    throw error;
  }

  if (!data?.session) {
    throw new Error('Backend nie zwrócił zaktualizowanej sesji RPG.');
  }

  return data.session;
}

export async function deleteRpgSession(sessionId: string) {
  let data: { message?: string } | null;

  try {
    data = await apiClient.delete<{ message?: string }>(buildRpgSessionUrl(sessionId), {
      token: 'id',
      fallbackErrorMessage: 'Nie udało się usunąć sesji RPG.'
    });
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error(error.message || 'Brak uprawnień do usunięcia tej sesji RPG.');
    }

    if (isAPIError(error) && error.status === 404) {
      throw new Error('Nie znaleziono sesji RPG.');
    }

    throw error;
  }

  return data?.message ?? 'RPG session deleted';
}

export function formatRpgSessionName(session: RpgSession) {
  return (
    session.name?.trim() ||
    session.title?.trim() ||
    session.description?.trim() ||
    session.rpgSystem
  );
}
