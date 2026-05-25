import { browser } from "$app/environment";
import type {
  AuthSession,
  CognitoTokens,
  CognitoUser,
} from "$lib/modules/AuthModule/authTypes/session";

const authStorageKey = "coc_auth_session";

// Storage concerns are kept separate from auth operations because persistence is
// the part most likely to change if the app moves from browser storage to cookies.
function getStorage(remember: boolean) {
  return remember ? localStorage : sessionStorage;
}

function parseStoredSession(value: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    return null;
  }
}

export function getStoredAuthSessionWithStorage(): {
  session: AuthSession;
  remember: boolean;
} | null {
  if (!browser) {
    return null;
  }

  const sessionAuth = parseStoredSession(
    sessionStorage.getItem(authStorageKey),
  );

  if (sessionAuth) {
    return {
      session: sessionAuth,
      remember: false,
    };
  }

  const localAuth = parseStoredSession(localStorage.getItem(authStorageKey));

  return localAuth
    ? {
        session: localAuth,
        remember: true,
      }
    : null;
}

export function getStoredAuthSession(): AuthSession | null {
  return getStoredAuthSessionWithStorage()?.session ?? null;
}

export function getAccessToken(): string | null {
  return getStoredAuthSession()?.tokens.accessToken ?? null;
}

export function getIdToken(): string | null {
  return getStoredAuthSession()?.tokens.idToken ?? null;
}

export function persistAuthSession(
  session: AuthSession | undefined,
  remember: boolean,
) {
  if (!browser || !session?.tokens.accessToken) {
    return;
  }

  // Both storages use the same key, so clearing first prevents a stale "remember me"
  // session from surviving after the user chooses a shorter browser-session login.
  clearStoredAuth();
  getStorage(remember).setItem(authStorageKey, JSON.stringify(session));
}

export function clearStoredAuth() {
  if (browser) {
    localStorage.removeItem(authStorageKey);
    sessionStorage.removeItem(authStorageKey);
  }
}

export type { AuthSession, CognitoTokens, CognitoUser };
