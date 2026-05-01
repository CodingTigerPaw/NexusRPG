import { browser } from '$app/environment';
import type { AuthSession, CognitoTokens } from '$lib/modules/authTypes';

const authStorageKey = 'coc_auth_session';

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

export function getStoredAuthSessionWithStorage():
  | { session: AuthSession; remember: boolean }
  | null {
  if (!browser) {
    return null;
  }

  const sessionAuth = parseStoredSession(sessionStorage.getItem(authStorageKey));

  if (sessionAuth) {
    return {
      session: sessionAuth,
      remember: false
    };
  }

  const localAuth = parseStoredSession(localStorage.getItem(authStorageKey));

  return localAuth
    ? {
        session: localAuth,
        remember: true
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

export function persistAuthSession(session: AuthSession | undefined, remember: boolean) {
  if (!browser || !session?.tokens.accessToken) {
    return;
  }

  clearStoredAuth();
  getStorage(remember).setItem(authStorageKey, JSON.stringify(session));
}

export function clearStoredAuth() {
  if (browser) {
    localStorage.removeItem(authStorageKey);
    sessionStorage.removeItem(authStorageKey);
  }
}

export function decodeJwtPayload<
  TPayload extends Record<string, unknown> = Record<string, unknown>
>(token: string | undefined): TPayload | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '='
    );

    return JSON.parse(atob(paddedPayload)) as TPayload;
  } catch {
    return null;
  }
}

export function getJwtExpirationMs(token: string | undefined): number | undefined {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ? payload.exp * 1000 : undefined;
}

function getTokenExpiresAt(token: string | undefined, expiresIn: number | undefined) {
  return getJwtExpirationMs(token) ?? (expiresIn ? Date.now() + expiresIn * 1000 : undefined);
}

export function withTokenExpiration(tokens: CognitoTokens): CognitoTokens {
  return {
    ...tokens,
    accessTokenExpiresAt:
      tokens.accessTokenExpiresAt ?? getTokenExpiresAt(tokens.accessToken, tokens.expiresIn),
    idTokenExpiresAt: tokens.idTokenExpiresAt ?? getTokenExpiresAt(tokens.idToken, tokens.expiresIn)
  };
}

export type { AuthSession, CognitoTokens, CognitoUser } from '$lib/modules/authTypes';
