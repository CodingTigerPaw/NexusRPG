import { setRefreshAuthSessionHandler } from "$lib/modules/ApiModule/auth";
import { apiClient } from "$lib/modules/ApiModule/client";
import type {
  AuthenticatedResult,
  AuthResult,
} from "$lib/modules/AuthModule/authTypes/results";
import type {
  AuthSession,
} from "$lib/modules/AuthModule/authTypes/session";
import type {
  CompleteNewPasswordPayload,
  LoginPayload,
} from "$lib/modules/AuthModule/authTypes/payloads";
import type {
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
} from "$lib/modules/AuthModule/authTypes/responses";
import {
  loginAPI,
  logoutAPI,
  newPasswordChallengeAPI,
  refreshAPI,
} from "$lib/modules/repository";
import {
  clearStoredAuth,
  getAccessToken,
  getStoredAuthSession,
  getStoredAuthSessionWithStorage,
  persistAuthSession,
} from "./session";
import { normalizeAuthResult, normalizeTokens } from "./normalizers";
import { getJwtExpirationMs, withTokenExpiration } from "./tokens";
import { getCurrentUser } from "./user";

// The service module owns side effects: network calls, refresh registration, and
// session writes. Pure helpers stay in sibling files to keep this flow readable.
const tokenRefreshSkewSeconds = 60;

export function isAuthenticated(): boolean {
  const tokens = getStoredAuthSession()?.tokens;
  return Boolean(tokens?.accessToken || tokens?.refreshToken);
}

let refreshPromise: Promise<AuthSession | null> | null = null;

function shouldRefreshToken(
  token: string | undefined,
  expiresAt: number | undefined,
) {
  const expiration = expiresAt ?? getJwtExpirationMs(token);

  if (!expiration) {
    return false;
  }

  return expiration <= Date.now() + tokenRefreshSkewSeconds * 1000;
}

function shouldRefreshSession(session: AuthSession) {
  if (!session.tokens.refreshToken) {
    return false;
  }

  return (
    shouldRefreshToken(
      session.tokens.accessToken,
      session.tokens.accessTokenExpiresAt,
    ) ||
    shouldRefreshToken(session.tokens.idToken, session.tokens.idTokenExpiresAt)
  );
}

function mergeRefreshedSession(
  currentSession: AuthSession,
  response: RefreshResponse,
): AuthSession {
  const refreshedTokens = normalizeTokens(response);

  if (!refreshedTokens?.accessToken && !refreshedTokens?.idToken) {
    throw new Error("Endpoint odświeżania nie zwrócił nowych tokenów.");
  }

  return {
    tokens: withTokenExpiration({
      ...currentSession.tokens,
      ...refreshedTokens,
      refreshToken:
        refreshedTokens.refreshToken ?? currentSession.tokens.refreshToken,
    }),
    user: response.user ?? currentSession.user,
  };
}

export async function refreshAuthSession(
  force = false,
): Promise<AuthSession | null> {
  const storedAuth = getStoredAuthSessionWithStorage();

  if (!storedAuth?.session.tokens.refreshToken) {
    return storedAuth?.session ?? null;
  }

  if (!force && !shouldRefreshSession(storedAuth.session)) {
    return storedAuth.session;
  }

  if (!refreshPromise) {
    // A single shared promise prevents a burst of protected requests from sending
    // several refresh calls with the same refresh token and racing their storage writes.
    refreshPromise = apiClient
      .post<RefreshResponse>(
        refreshAPI,
        {
          refreshToken: storedAuth.session.tokens.refreshToken,
          username: getCurrentUser()?.username,
        },
        {
          token: "none",
          retryOnUnauthorized: false,
          fallbackErrorMessage: "Nie udało się odświeżyć sesji użytkownika.",
        },
      )
      .then((response) => {
        const nextSession = mergeRefreshedSession(storedAuth.session, response);
        persistAuthSession(nextSession, storedAuth.remember);
        return nextSession;
      })
      .catch((error) => {
        clearStoredAuth();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function persistAuthenticatedResult(result: AuthResult, remember: boolean) {
  if (result.status !== "authenticated") {
    return;
  }

  // Login and first-password challenge both end with the same persisted session,
  // so this shared branch keeps their behavior aligned.
  persistAuthSession(
    result.tokens
      ? {
          tokens: result.tokens,
          user: result.user,
        }
      : undefined,
    remember,
  );
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const result = normalizeAuthResult(
    await apiClient.post<LoginResponse>(
      loginAPI,
      {
        username: payload.username,
        password: payload.password,
      },
      {
        token: "none",
        retryOnUnauthorized: false,
        fallbackErrorMessage: "Nie udało się połączyć z usługą logowania.",
      },
    ),
  );

  persistAuthenticatedResult(result, payload.remember);

  return result;
}

export async function completeNewPasswordChallenge(
  payload: CompleteNewPasswordPayload,
): Promise<AuthenticatedResult> {
  const result = normalizeAuthResult(
    await apiClient.post<LoginResponse>(
      newPasswordChallengeAPI,
      {
        username: payload.username,
        newPassword: payload.newPassword,
        session: payload.session,
        requiredAttributes: payload.requiredAttributes ?? {},
      },
      {
        token: "none",
        retryOnUnauthorized: false,
        fallbackErrorMessage: "Nie udało się ustawić nowego hasła.",
      },
    ),
  );

  if (result.status === "newPasswordRequired") {
    throw new Error("Cognito nadal wymaga ustawienia nowego hasła.");
  }

  persistAuthenticatedResult(result, payload.remember);

  return result;
}

export async function logout() {
  const accessToken = getAccessToken();

  try {
    if (!accessToken) {
      return;
    }

    await apiClient.post<LogoutResponse>(logoutAPI, undefined, {
      token: "access",
      fallbackErrorMessage: "Nie udało się wylogować przez Cognito.",
    });
  } finally {
    // Local cleanup is deliberately independent from Cognito logout success so the
    // browser never keeps using a session after the user chose to leave it.
    clearStoredAuth();
  }
}

// APIClient stays generic and receives auth behavior by registration, which avoids
// a direct APIClient -> auth service import cycle.
setRefreshAuthSessionHandler(refreshAuthSession);
