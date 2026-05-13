import { apiClient } from "$lib/modules/ApiModule/client";
import { mapAPIError } from "$lib/modules/ApiModule/errors";
import { expectField } from "$lib/modules/ApiModule/response";
import type {
  CharacterAvatarUploadPayload,
  CharacterCreatePayload,
  CharacterMutationResponse,
  CharacterSheetResponse,
  CharacterSheetsResponse,
  CharacterUpdatePayload,
  GetCharactersOptions,
} from "$lib/modules/charactersModule/charactersTypes";
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
} from "$lib/modules/charactersModule/charactersTypes";

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

function buildSessionParticipantCharacterAvatarUrl(
  sessionId: string,
  userId: string,
  characterId: string,
) {
  return `${buildSessionParticipantCharacterUrl(sessionId, userId, characterId)}/avatar`;
}

export async function getCharacters(options: GetCharactersOptions = {}) {
  try {
    const data = await apiClient.get<CharacterSheetsResponse>(charactersAPI, {
      query: options,
      fallbackErrorMessage: "Nie udało się pobrać kart postaci.",
    });

    expectField(
      data,
      "characterSheets",
      "Backend zwrócił nieprawidłową odpowiedź listy kart postaci.",
    );

    return data;
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania kart postaci.",
    });
  }
}

export async function getUserCharacters(
  userId: string,
  options: GetCharactersOptions = {},
) {
  try {
    const data = await apiClient.get<CharacterSheetsResponse>(
      buildUserCharactersUrl(userId),
      {
        query: options,
        fallbackErrorMessage: "Nie udało się pobrać kart postaci gracza.",
      },
    );

    expectField(
      data,
      "characterSheets",
      "Backend zwrócił nieprawidłową odpowiedź listy kart gracza.",
    );

    return data;
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania kart postaci tego użytkownika.",
    });
  }
}

export async function getCharacter(characterId: string) {
  try {
    const data = await apiClient.get<CharacterSheetResponse>(
      buildCharacterUrl(characterId),
      {
        fallbackErrorMessage: "Nie udało się pobrać karty postaci.",
      },
    );

    return expectField(
      data,
      "characterSheet",
      "Backend nie zwrócił danych karty postaci.",
    );
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania tej karty postaci.",
      notFound: "Nie znaleziono karty postaci.",
    });
  }
}

export async function createCharacter(payload: CharacterCreatePayload) {
  const data = await apiClient.post<CharacterMutationResponse>(
    charactersAPI,
    payload,
    {
      fallbackErrorMessage: "Nie udało się utworzyć karty postaci.",
    },
  );

  return expectField(
    data,
    "characterSheet",
    "Backend nie zwrócił utworzonej karty postaci.",
  );
}

function readCharacterMutationData(data: CharacterMutationResponse | null) {
  return expectField(
    data,
    "characterSheet",
    "Backend nie zwrócił zaktualizowanej karty postaci.",
  );
}

async function runCharacterMutation(
  request: () => Promise<CharacterMutationResponse>,
  fallbackMessage: string,
) {
  try {
    return readCharacterMutationData(await request());
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do modyfikacji tej karty postaci.",
      fallback: fallbackMessage,
    });
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
          fallbackErrorMessage: "Nie udało się zaktualizować karty postaci.",
        },
      ),
    "Nie udało się zaktualizować karty postaci.",
  );
}

export async function deleteCharacter(characterId: string) {
  try {
    const data = await apiClient.delete<CharacterMutationResponse>(
      buildCharacterUrl(characterId),
      {
        fallbackErrorMessage: "Nie udało się usunąć karty postaci.",
      },
    );

    return data?.message ?? "Character deleted";
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do usunięcia tej karty postaci.",
      notFound: "Nie znaleziono karty postaci.",
      fallback: "Nie udało się usunąć karty postaci.",
    });
  }
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
          fallbackErrorMessage: "Nie udało się usunąć awatara postaci.",
        },
      ),
    "Nie udało się usunąć awatara postaci.",
  );
}

export async function uploadSessionParticipantCharacterAvatar(
  sessionId: string,
  userId: string,
  characterId: string,
  payload: CharacterAvatarUploadPayload,
) {
  return runCharacterMutation(
    () =>
      apiClient.post<CharacterMutationResponse>(
        buildSessionParticipantCharacterAvatarUrl(
          sessionId,
          userId,
          characterId,
        ),
        payload,
        {
          fallbackErrorMessage:
            "Nie udało się wgrać awatara postaci gracza w sesji.",
        },
      ),
    "Nie udało się wgrać awatara postaci gracza w sesji.",
  );
}

export async function deleteSessionParticipantCharacterAvatar(
  sessionId: string,
  userId: string,
  characterId: string,
) {
  return runCharacterMutation(
    () =>
      apiClient.delete<CharacterMutationResponse>(
        buildSessionParticipantCharacterAvatarUrl(
          sessionId,
          userId,
          characterId,
        ),
        {
          fallbackErrorMessage:
            "Nie udało się usunąć awatara postaci gracza w sesji.",
        },
      ),
    "Nie udało się usunąć awatara postaci gracza w sesji.",
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
          fallbackErrorMessage:
            "Nie udało się zaktualizować karty gracza w sesji.",
        },
      ),
    "Nie udało się zaktualizować karty gracza w sesji.",
  );
}
