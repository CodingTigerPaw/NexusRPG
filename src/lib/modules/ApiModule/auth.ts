import type { AuthSession } from "$lib/modules/AuthModule/authTypes/session";
import {
  getAccessToken,
  getIdToken,
  getStoredAuthSession,
} from "$lib/modules/AuthModule/session";
import type { AuthTokenType } from "./types";

export type APIAuthProvider = {
  getToken(type: Exclude<AuthTokenType, "none">): Promise<string | null>;
  refresh(force?: boolean): Promise<AuthSession | null>;
  hasRefreshToken(): boolean;
};

let refreshAuthSessionHandler:
  | ((force?: boolean) => Promise<AuthSession | null>)
  | null = null;

// Auth registers refresh lazily to avoid a hard import cycle between API transport
// and the auth service that itself performs HTTP calls.
export function setRefreshAuthSessionHandler(
  handler: ((force?: boolean) => Promise<AuthSession | null>) | null,
) {
  refreshAuthSessionHandler = handler;
}

export function getRetryTokenType(
  tokenType: AuthTokenType,
): Exclude<AuthTokenType, "none"> | null {
  return tokenType === "none" ? null : tokenType;
}

// This default provider preserves the current browser-storage behavior while
// allowing tests or future SSR/cookie auth to provide a different implementation.
export const browserStorageAuthProvider: APIAuthProvider = {
  async getToken(type) {
    await refreshAuthSessionHandler?.().catch(() => null);
    return type === "access" ? getAccessToken() : getIdToken();
  },
  refresh(force) {
    return refreshAuthSessionHandler?.(force) ?? Promise.resolve(null);
  },
  hasRefreshToken() {
    return Boolean(getStoredAuthSession()?.tokens.refreshToken);
  },
};
