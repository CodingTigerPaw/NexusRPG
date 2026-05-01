import { apiClient, isAPIError } from "$lib/modules/FetchModule/APIClient";
import type {
  CharacterAvatarUploadPayload,
  CharacterCreatePayload,
  CharacterErrorResponse,
  CharacterMutationResponse,
  CharacterSheetResponse,
  CharacterSheetsResponse,
  CharacterUpdatePayload,
  GetCharactersOptions,
} from "$lib/modules/charactersTypes";
import {
  charactersAPI,
  rpgSessionsAPI,
  usersAPI,
} from "$lib/modules/repository";

export type {
  CharacterAvatarUploadPayload,
  CharacterCard,
  CharacterCreatePayload,
  CharacterSheetsResponse,
  CharacterUpdatePayload,
  GetCharactersOptions,
} from "$lib/modules/charactersTypes";

function buildUserCharactersUrl(userId: string) {
  return `${usersAPI}/${encodeURIComponent(userId)}/character-sheets`;
}

function buildCharacterUrl(characterId: string) {
  return `${charactersAPI}/${encodeURIComponent(characterId)}`;
}

function buildCharacterAvatarUrl(characterId: string) {
  return `${buildCharacterUrl(characterId)}/avatar`;
}

function buildSessionParticipantCharacterUrl(
  sessionId: string,
  userId: string,
  characterId: string,
) {
  return `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}/players/${encodeURIComponent(userId)}/character-sheets/${encodeURIComponent(characterId)}`;
}

export async function getCharacters(options: GetCharactersOptions = {}) {
  let data: CharacterSheetsResponse | CharacterErrorResponse | null;

  try {
    data = await apiClient.get<CharacterSheetsResponse>(charactersAPI, {
      token: "id",
      query: options,
      fallbackErrorMessage: "Nie udało się pobrać kart postaci.",
    });
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error("Brak uprawnień do pobrania kart postaci.");
    }

    throw error;
  }

  if (!data || !("characterSheets" in data)) {
    throw new Error(
      "Backend zwrócił nieprawidłową odpowiedź listy kart postaci.",
    );
  }

  return data;
}

export async function getUserCharacters(
  userId: string,
  options: GetCharactersOptions = {},
) {
  let data: CharacterSheetsResponse | CharacterErrorResponse | null;

  try {
    data = await apiClient.get<CharacterSheetsResponse>(
      buildUserCharactersUrl(userId),
      {
        token: "id",
        query: options,
        fallbackErrorMessage: "Nie udało się pobrać kart postaci gracza.",
      },
    );
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error(
        "Brak uprawnień do pobrania kart postaci tego użytkownika.",
      );
    }

    throw error;
  }

  if (!data || !("characterSheets" in data)) {
    throw new Error(
      "Backend zwrócił nieprawidłową odpowiedź listy kart gracza.",
    );
  }

  return data;
}

export async function getCharacter(characterId: string) {
  let data: CharacterSheetResponse | null;

  try {
    data = await apiClient.get<CharacterSheetResponse>(
      buildCharacterUrl(characterId),
      {
        token: "id",
        fallbackErrorMessage: "Nie udało się pobrać karty postaci.",
      },
    );
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error(
        error.message || "Brak uprawnień do pobrania tej karty postaci.",
      );
    }

    if (isAPIError(error) && error.status === 404) {
      throw new Error("Nie znaleziono karty postaci.");
    }

    throw error;
  }

  if (!data?.characterSheet) {
    throw new Error("Backend nie zwrócił danych karty postaci.");
  }

  return data.characterSheet;
}

export async function createCharacter(payload: CharacterCreatePayload) {
  const data = await apiClient.post<CharacterMutationResponse>(
    charactersAPI,
    payload,
    {
      token: "id",
      fallbackErrorMessage: "Nie udało się utworzyć karty postaci.",
    },
  );

  if (!data?.characterSheet) {
    throw new Error("Backend nie zwrócił utworzonej karty postaci.");
  }

  return data.characterSheet;
}

function readCharacterMutationData(data: CharacterMutationResponse | null) {
  if (!data?.characterSheet) {
    throw new Error("Backend nie zwrócił zaktualizowanej karty postaci.");
  }

  return data.characterSheet;
}

async function runCharacterMutation(
  request: () => Promise<CharacterMutationResponse>,
  fallbackMessage: string,
) {
  try {
    return readCharacterMutationData(await request());
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error(
        error.message || "Brak uprawnień do modyfikacji tej karty postaci.",
      );
    }

    if (isAPIError(error)) {
      throw new Error(error.message || fallbackMessage);
    }

    throw error;
  }
}

export async function updateCharacter(
  characterId: string,
  payload: CharacterUpdatePayload,
) {
  return runCharacterMutation(
    () =>
      apiClient.put<CharacterMutationResponse>(
        buildCharacterUrl(characterId),
        payload,
        {
          token: "id",
          fallbackErrorMessage: "Nie udało się zaktualizować karty postaci.",
        },
      ),
    "Nie udało się zaktualizować karty postaci.",
  );
}

export async function uploadCharacterAvatar(
  characterId: string,
  payload: CharacterAvatarUploadPayload,
) {
  return runCharacterMutation(
    () =>
      apiClient.post<CharacterMutationResponse>(
        buildCharacterAvatarUrl(characterId),
        payload,
        {
          token: "id",
          fallbackErrorMessage: "Nie udało się wgrać awatara postaci.",
        },
      ),
    "Nie udało się wgrać awatara postaci.",
  );
}

export async function deleteCharacterAvatar(characterId: string) {
  return runCharacterMutation(
    () =>
      apiClient.delete<CharacterMutationResponse>(
        buildCharacterAvatarUrl(characterId),
        {
          token: "id",
          fallbackErrorMessage: "Nie udało się usunąć awatara postaci.",
        },
      ),
    "Nie udało się usunąć awatara postaci.",
  );
}

export async function updateSessionParticipantCharacter(
  sessionId: string,
  userId: string,
  characterId: string,
  payload: CharacterUpdatePayload,
) {
  return runCharacterMutation(
    () =>
      apiClient.put<CharacterMutationResponse>(
        buildSessionParticipantCharacterUrl(sessionId, userId, characterId),
        payload,
        {
          token: "id",
          fallbackErrorMessage:
            "Nie udało się zaktualizować karty gracza w sesji.",
        },
      ),
    "Nie udało się zaktualizować karty gracza w sesji.",
  );
}
