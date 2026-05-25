import { apiClient } from "$lib/modules/ApiModule/client";
import { mapAPIError } from "$lib/modules/ApiModule/errors";
import { expectArrayField, expectField } from "$lib/modules/ApiModule/response";
import { mapAssetsAPI, rpgSessionsAPI } from "$lib/modules/repository";
import type {
  CreateMapTokenPayload,
  CreateSessionMapPayload,
  CreateSessionTokenTemplatePayload,
  MapAssetUploadUrlRequest,
  MapAssetUploadUrlResponse,
  MoveMapTokenPayload,
  SessionAssetsResponse,
  SessionMapResponse,
  SessionMapTokenResponse,
  SessionMapsResponse,
  SessionTokenTemplateResponse,
  SessionTokenTemplatesResponse,
  SessionAssetUploadUrlRequest,
  UpdateMapTokenPayload,
  UpdateSessionMapPayload,
  UpdateSessionTokenTemplatePayload
} from "./types";

function buildSessionMapsUrl(sessionId: string) {
  return `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}/maps`;
}

function buildSessionMapUrl(sessionId: string, mapId: string) {
  return `${buildSessionMapsUrl(sessionId)}/${encodeURIComponent(mapId)}`;
}

function buildSessionMapTokensUrl(sessionId: string, mapId: string) {
  return `${buildSessionMapUrl(sessionId, mapId)}/tokens`;
}

function buildSessionMapTokenUrl(sessionId: string, mapId: string, tokenId: string) {
  return `${buildSessionMapTokensUrl(sessionId, mapId)}/${encodeURIComponent(tokenId)}`;
}

function buildSessionAssetsUrl(sessionId: string) {
  return `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}/assets`;
}

function buildSessionAssetUrl(sessionId: string, assetId: string) {
  return `${buildSessionAssetsUrl(sessionId)}/${encodeURIComponent(assetId)}`;
}

function buildSessionTokenTemplatesUrl(sessionId: string) {
  return `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}/token-templates`;
}

function buildSessionTokenTemplateUrl(sessionId: string, templateId: string) {
  return `${buildSessionTokenTemplatesUrl(sessionId)}/${encodeURIComponent(templateId)}`;
}

export async function createMapAssetUploadUrl(payload: MapAssetUploadUrlRequest) {
  try {
    return await apiClient.post<MapAssetUploadUrlResponse>(
      `${mapAssetsAPI}/upload-url`,
      payload,
      {
        fallbackErrorMessage: "Nie udało się przygotować uploadu mapy."
      }
    );
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do przygotowania uploadu mapy.",
      badRequest: "Wybrany plik mapy ma nieobsługiwany format albo nieprawidłowe metadane.",
      fallback: "Nie udało się przygotować uploadu mapy."
    });
  }
}

export async function getSessionAssets(
  sessionId: string,
  options: { kind?: "map" | "token"; limit?: number; cursor?: string | null } = {}
) {
  try {
    const data = await apiClient.get<SessionAssetsResponse>(buildSessionAssetsUrl(sessionId), {
      query: options,
      fallbackErrorMessage: "Nie udało się pobrać assetów sesji."
    });

    expectArrayField(data, "assets", "Backend zwrócił nieprawidłową listę assetów sesji.");
    return data;
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania assetów tej sesji.",
      notFound: "Nie znaleziono sesji RPG.",
      fallback: "Nie udało się pobrać assetów sesji."
    });
  }
}

export async function createSessionAssetUploadUrl(
  sessionId: string,
  payload: SessionAssetUploadUrlRequest
) {
  try {
    return await apiClient.post<MapAssetUploadUrlResponse>(
      `${buildSessionAssetsUrl(sessionId)}/upload-url`,
      payload,
      {
        fallbackErrorMessage: "Nie udało się przygotować uploadu assetu sesji."
      }
    );
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może dodawać assety sesji.",
      badRequest: "Wybrany plik ma nieobsługiwany format albo nieprawidłowe metadane.",
      fallback: "Nie udało się przygotować uploadu assetu sesji."
    });
  }
}

export async function deleteSessionAsset(sessionId: string, assetId: string) {
  try {
    const data = await apiClient.delete<{ message?: string }>(
      buildSessionAssetUrl(sessionId, assetId),
      {
        fallbackErrorMessage: "Nie udało się usunąć assetu sesji."
      }
    );

    return data?.message ?? "Session asset deleted";
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może usuwać assety sesji.",
      notFound: "Nie znaleziono assetu sesji.",
      fallback: "Nie udało się usunąć assetu sesji."
    });
  }
}

export async function uploadMapAssetToS3(
  uploadUrl: string,
  file: File,
  headers: Record<string, string> = {}
) {
  // Presigned URL jest kompletnym adresem S3, więc omijamy APIClient, żeby nie dodać
  // tokenów Cognito ani bazowego URL naszej aplikacji do żądania wysyłanego poza backend.
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file
  });

  if (!response.ok) {
    throw new Error("Nie udało się wysłać pliku mapy do S3.");
  }
}

export async function getSessionTokenTemplates(
  sessionId: string,
  options: { limit?: number; cursor?: string | null } = {}
) {
  try {
    const data = await apiClient.get<SessionTokenTemplatesResponse>(
      buildSessionTokenTemplatesUrl(sessionId),
      {
        query: options,
        fallbackErrorMessage: "Nie udało się pobrać biblioteki tokenów sesji."
      }
    );

    expectArrayField(
      data,
      "tokenTemplates",
      "Backend zwrócił nieprawidłową listę szablonów tokenów."
    );
    return data;
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania biblioteki tokenów tej sesji.",
      notFound: "Nie znaleziono sesji RPG.",
      fallback: "Nie udało się pobrać biblioteki tokenów sesji."
    });
  }
}

export async function createSessionTokenTemplate(
  sessionId: string,
  payload: CreateSessionTokenTemplatePayload
) {
  try {
    const data = await apiClient.post<SessionTokenTemplateResponse>(
      buildSessionTokenTemplatesUrl(sessionId),
      payload,
      {
        fallbackErrorMessage: "Nie udało się utworzyć szablonu tokena."
      }
    );

    return expectField(data, "tokenTemplate", "Backend nie zwrócił utworzonego szablonu tokena.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może dodawać szablony tokenów.",
      notFound: "Nie znaleziono sesji RPG albo assetu.",
      badRequest: "Dane szablonu tokena są nieprawidłowe.",
      fallback: "Nie udało się utworzyć szablonu tokena."
    });
  }
}

export async function updateSessionTokenTemplate(
  sessionId: string,
  templateId: string,
  payload: UpdateSessionTokenTemplatePayload
) {
  try {
    const data = await apiClient.put<SessionTokenTemplateResponse>(
      buildSessionTokenTemplateUrl(sessionId, templateId),
      payload,
      {
        fallbackErrorMessage: "Nie udało się zaktualizować szablonu tokena."
      }
    );

    return expectField(
      data,
      "tokenTemplate",
      "Backend nie zwrócił zaktualizowanego szablonu tokena."
    );
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może aktualizować szablony tokenów.",
      notFound: "Nie znaleziono szablonu tokena.",
      badRequest: "Dane szablonu tokena są nieprawidłowe.",
      fallback: "Nie udało się zaktualizować szablonu tokena."
    });
  }
}

export async function deleteSessionTokenTemplate(sessionId: string, templateId: string) {
  try {
    const data = await apiClient.delete<{ message?: string }>(
      buildSessionTokenTemplateUrl(sessionId, templateId),
      {
        fallbackErrorMessage: "Nie udało się usunąć szablonu tokena."
      }
    );

    return data?.message ?? "Session token template deleted";
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może usuwać szablony tokenów.",
      notFound: "Nie znaleziono szablonu tokena.",
      fallback: "Nie udało się usunąć szablonu tokena."
    });
  }
}

export async function createSessionMap(sessionId: string, payload: CreateSessionMapPayload) {
  try {
    const data = await apiClient.post<SessionMapResponse>(
      buildSessionMapsUrl(sessionId),
      payload,
      {
        fallbackErrorMessage: "Nie udało się utworzyć mapy sesji."
      }
    );

    return expectField(data, "map", "Backend nie zwrócił utworzonej mapy sesji.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może dodawać mapy.",
      notFound: "Nie znaleziono sesji RPG dla tej mapy.",
      badRequest: "Dane mapy są nieprawidłowe.",
      fallback: "Nie udało się utworzyć mapy sesji."
    });
  }
}

export async function getSessionMaps(sessionId: string, options: { limit?: number; cursor?: string | null } = {}) {
  try {
    const data = await apiClient.get<SessionMapsResponse>(buildSessionMapsUrl(sessionId), {
      query: options,
      fallbackErrorMessage: "Nie udało się pobrać map sesji."
    });

    expectArrayField(data, "maps", "Backend zwrócił nieprawidłową listę map sesji.");
    return data;
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania map tej sesji.",
      notFound: "Nie znaleziono sesji RPG.",
      fallback: "Nie udało się pobrać map sesji."
    });
  }
}

export async function getSessionMap(sessionId: string, mapId: string) {
  try {
    const data = await apiClient.get<SessionMapResponse>(buildSessionMapUrl(sessionId, mapId), {
      fallbackErrorMessage: "Nie udało się pobrać mapy sesji."
    });

    return expectField(data, "map", "Backend nie zwrócił mapy sesji.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania tej mapy.",
      notFound: "Nie znaleziono mapy sesji.",
      fallback: "Nie udało się pobrać mapy sesji."
    });
  }
}

export async function updateSessionMap(
  sessionId: string,
  mapId: string,
  payload: UpdateSessionMapPayload
) {
  try {
    const data = await apiClient.put<SessionMapResponse>(
      buildSessionMapUrl(sessionId, mapId),
      payload,
      {
        fallbackErrorMessage: "Nie udało się zaktualizować mapy sesji."
      }
    );

    return expectField(data, "map", "Backend nie zwrócił zaktualizowanej mapy sesji.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może aktualizować mapę.",
      notFound: "Nie znaleziono mapy sesji.",
      badRequest: "Dane mapy są nieprawidłowe.",
      fallback: "Nie udało się zaktualizować mapy sesji."
    });
  }
}

export async function deleteSessionMap(sessionId: string, mapId: string) {
  try {
    const data = await apiClient.delete<{ message?: string }>(
      buildSessionMapUrl(sessionId, mapId),
      {
        fallbackErrorMessage: "Nie udało się usunąć mapy sesji."
      }
    );

    return data?.message ?? "Session map deleted";
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może usuwać mapę.",
      notFound: "Nie znaleziono mapy sesji.",
      fallback: "Nie udało się usunąć mapy sesji."
    });
  }
}

export async function createSessionMapToken(
  sessionId: string,
  mapId: string,
  payload: CreateMapTokenPayload
) {
  try {
    const data = await apiClient.post<SessionMapTokenResponse>(
      buildSessionMapTokensUrl(sessionId, mapId),
      payload,
      {
        fallbackErrorMessage: "Nie udało się utworzyć tokena mapy."
      }
    );

    return expectField(data, "token", "Backend nie zwrócił utworzonego tokena mapy.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może dodawać tokeny.",
      notFound: "Nie znaleziono sesji RPG albo mapy.",
      badRequest: "Dane tokena są nieprawidłowe.",
      fallback: "Nie udało się utworzyć tokena mapy."
    });
  }
}

export async function updateSessionMapToken(
  sessionId: string,
  mapId: string,
  tokenId: string,
  payload: UpdateMapTokenPayload
) {
  try {
    const data = await apiClient.put<SessionMapTokenResponse>(
      buildSessionMapTokenUrl(sessionId, mapId, tokenId),
      payload,
      {
        fallbackErrorMessage: "Nie udało się zaktualizować tokena mapy."
      }
    );

    return expectField(data, "token", "Backend nie zwrócił zaktualizowanego tokena mapy.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może aktualizować tokeny.",
      notFound: "Nie znaleziono mapy albo tokena.",
      badRequest: "Dane tokena są nieprawidłowe.",
      fallback: "Nie udało się zaktualizować tokena mapy."
    });
  }
}

export async function deleteSessionMapToken(sessionId: string, mapId: string, tokenId: string) {
  try {
    const data = await apiClient.delete<{ message?: string }>(
      buildSessionMapTokenUrl(sessionId, mapId, tokenId),
      {
        fallbackErrorMessage: "Nie udało się usunąć tokena z mapy."
      }
    );

    return data?.message ?? "Session map token deleted";
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Tylko GM będący właścicielem sesji może usuwać tokeny.",
      notFound: "Nie znaleziono mapy albo tokena.",
      fallback: "Nie udało się usunąć tokena z mapy."
    });
  }
}

export async function moveSessionMapToken(
  sessionId: string,
  mapId: string,
  tokenId: string,
  payload: Omit<MoveMapTokenPayload, "tokenId">
) {
  try {
    const data = await apiClient.post<SessionMapTokenResponse>(
      `${buildSessionMapTokenUrl(sessionId, mapId, tokenId)}/move`,
      payload,
      {
        fallbackErrorMessage: "Nie udało się przesunąć tokena mapy."
      }
    );

    return expectField(data, "token", "Backend nie zwrócił przesuniętego tokena mapy.");
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Nie masz uprawnień do przesunięcia tego tokena.",
      notFound: "Nie znaleziono mapy albo tokena.",
      badRequest: "Pozycja tokena jest nieprawidłowa albo token jest zablokowany.",
      fallback: "Nie udało się przesunąć tokena mapy."
    });
  }
}
