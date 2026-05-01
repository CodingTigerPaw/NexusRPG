import {
  apiClient,
  setRefreshAuthSessionHandler
} from '$lib/modules/FetchModule/APIClient';
import {
  clearStoredAuth,
  decodeJwtPayload,
  getAccessToken,
  getJwtExpirationMs,
  getStoredAuthSession,
  getStoredAuthSessionWithStorage,
  persistAuthSession,
  withTokenExpiration
} from '$lib/modules/auth-session';
import type {
  AuthenticatedResult,
  AuthResult,
  AuthSession,
  CognitoTokens,
  CognitoUser,
  CompleteNewPasswordPayload,
  LoginPayload,
  LoginResponse,
  LogoutResponse,
  NewPasswordRequiredResult,
  RefreshResponse
} from '$lib/modules/authTypes';
import { loginAPI, logoutAPI, newPasswordChallengeAPI, refreshAPI } from '$lib/modules/repository';

const tokenRefreshSkewSeconds = 60;

export {
  clearStoredAuth,
  decodeJwtPayload,
  getAccessToken,
  getIdToken,
  getStoredAuthSession,
  type AuthSession,
  type CognitoTokens,
  type CognitoUser
} from '$lib/modules/auth-session';
export type {
  AuthenticatedResult,
  AuthResult,
  CompleteNewPasswordPayload,
  LoginPayload,
  NewPasswordRequiredResult
} from '$lib/modules/authTypes';

function normalizeTokens(response: LoginResponse | RefreshResponse): CognitoTokens | undefined {
  if (response.tokens) {
    return withTokenExpiration({
      accessToken: response.tokens.accessToken ?? response.tokens.AccessToken,
      idToken: response.tokens.idToken ?? response.tokens.IdToken,
      refreshToken: response.tokens.refreshToken ?? response.tokens.RefreshToken,
      expiresIn: response.tokens.expiresIn ?? response.tokens.ExpiresIn,
      tokenType: response.tokens.tokenType ?? response.tokens.TokenType
    });
  }

  if (!response.AuthenticationResult) {
    return undefined;
  }

  return withTokenExpiration({
    accessToken: response.AuthenticationResult.AccessToken,
    idToken: response.AuthenticationResult.IdToken,
    refreshToken: response.AuthenticationResult.RefreshToken,
    expiresIn: response.AuthenticationResult.ExpiresIn,
    tokenType: response.AuthenticationResult.TokenType
  });
}

function normalizeAuthResult(response: LoginResponse): AuthResult {
  const challenge = response.challenge ?? response.ChallengeName;
  const session = response.session ?? response.Session;

  if (challenge === 'NEW_PASSWORD_REQUIRED' && session) {
    return {
      status: 'newPasswordRequired',
      session,
      requiredAttributes: response.requiredAttributes ?? []
    };
  }

  return {
    status: 'authenticated',
    tokens: normalizeTokens(response),
    user: response.user,
    raw: response
  };
}

export function getCurrentUser(): CognitoUser | null {
  const session = getStoredAuthSession();

  if (!session) {
    return null;
  }

  const idTokenPayload = decodeJwtPayload<{
    sub?: string;
    email?: string;
    role?: string;
    'custom:role'?: string;
    'cognito:username'?: string;
    'cognito:groups'?: string[];
  }>(session.tokens.idToken);

  return {
    userId: session.user?.userId ?? idTokenPayload?.sub,
    username: session.user?.username ?? idTokenPayload?.['cognito:username'],
    email: session.user?.email ?? idTokenPayload?.email,
    role:
      session.user?.role ??
      idTokenPayload?.role ??
      idTokenPayload?.['custom:role'] ??
      idTokenPayload?.['cognito:groups']?.[0],
    roles: [
      ...(session.user?.roles ?? []),
      ...(session.user?.role ? [session.user.role] : []),
      ...(idTokenPayload?.role ? [idTokenPayload.role] : []),
      ...(idTokenPayload?.['custom:role'] ? [idTokenPayload['custom:role']] : []),
      ...(idTokenPayload?.['cognito:groups'] ?? [])
    ]
  };
}

export function getCurrentUserRole(): string | null {
  return getCurrentUser()?.role ?? null;
}

const roleHierarchy: Record<string, string[]> = {
  admin: ['admin', 'gm', 'player'],
  gm: ['gm', 'player'],
  player: ['player']
};

export function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function splitRoleValue(role: string) {
  return role
    .split(/[,\s]+/)
    .map(normalizeRole)
    .filter(Boolean);
}

export function expandRole(role: string) {
  const normalizedRole = normalizeRole(role);
  return roleHierarchy[normalizedRole] ?? [normalizedRole];
}

export function getCurrentUserRoles(): string[] {
  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  const directRoles = [
    ...(user.roles ?? []),
    ...(user.role ? [user.role] : [])
  ].flatMap(splitRoleValue);

  return [...new Set(directRoles.flatMap(expandRole))];
}

export function hasRole(allowedRoles: string | string[]): boolean {
  const currentRoles = getCurrentUserRoles();
  const roles = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRole);

  return roles.some((role) => currentRoles.includes(role));
}

export function isAuthenticated(): boolean {
  const tokens = getStoredAuthSession()?.tokens;
  return Boolean(tokens?.accessToken || tokens?.refreshToken);
}

let refreshPromise: Promise<AuthSession | null> | null = null;

function shouldRefreshToken(token: string | undefined, expiresAt: number | undefined) {
  const expiration = expiresAt ?? getJwtExpirationMs(token);

  if (!expiration) {
    return false;
  }

  return expiration <= Date.now() + tokenRefreshSkewSeconds * 1000;
}

function shouldRefreshSession(session: AuthSession, token: 'access' | 'id') {
  if (!session.tokens.refreshToken) {
    return false;
  }

  return token === 'access'
    ? shouldRefreshToken(session.tokens.accessToken, session.tokens.accessTokenExpiresAt)
    : shouldRefreshToken(session.tokens.idToken, session.tokens.idTokenExpiresAt);
}

function mergeRefreshedSession(currentSession: AuthSession, response: RefreshResponse): AuthSession {
  const refreshedTokens = normalizeTokens(response);

  if (!refreshedTokens?.accessToken && !refreshedTokens?.idToken) {
    throw new Error('Endpoint odświeżania nie zwrócił nowych tokenów.');
  }

  return {
    tokens: withTokenExpiration({
      ...currentSession.tokens,
      ...refreshedTokens,
      refreshToken: refreshedTokens.refreshToken ?? currentSession.tokens.refreshToken
    }),
    user: response.user ?? currentSession.user
  };
}

export async function refreshAuthSession(force = false): Promise<AuthSession | null> {
  const storedAuth = getStoredAuthSessionWithStorage();

  if (!storedAuth?.session.tokens.refreshToken) {
    return storedAuth?.session ?? null;
  }

  if (
    !force &&
    !shouldRefreshSession(storedAuth.session, 'access') &&
    !shouldRefreshSession(storedAuth.session, 'id')
  ) {
    return storedAuth.session;
  }

  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<RefreshResponse>(
        refreshAPI,
        {
          refreshToken: storedAuth.session.tokens.refreshToken,
          username: getCurrentUser()?.username
        },
        {
          token: 'none',
          retryOnUnauthorized: false,
          fallbackErrorMessage: 'Nie udało się odświeżyć sesji użytkownika.'
        }
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

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const result = normalizeAuthResult(
    await apiClient.post<LoginResponse>(
      loginAPI,
      {
        username: payload.username,
        password: payload.password
      },
      {
        token: 'none',
        retryOnUnauthorized: false,
        fallbackErrorMessage: 'Nie udało się połączyć z usługą logowania.'
      }
    )
  );

  if (result.status === 'authenticated') {
    persistAuthSession(
      result.tokens
        ? {
            tokens: result.tokens,
            user: result.user
          }
        : undefined,
      payload.remember
    );
  }

  return result;
}

export async function completeNewPasswordChallenge(
  payload: CompleteNewPasswordPayload
): Promise<AuthenticatedResult> {
  const result = normalizeAuthResult(
    await apiClient.post<LoginResponse>(
      newPasswordChallengeAPI,
      {
        username: payload.username,
        newPassword: payload.newPassword,
        session: payload.session,
        requiredAttributes: payload.requiredAttributes ?? {}
      },
      {
        token: 'none',
        retryOnUnauthorized: false,
        fallbackErrorMessage: 'Nie udało się ustawić nowego hasła.'
      }
    )
  );

  if (result.status === 'newPasswordRequired') {
    throw new Error('Cognito nadal wymaga ustawienia nowego hasła.');
  }

  persistAuthSession(
    result.tokens
      ? {
          tokens: result.tokens,
          user: result.user
        }
      : undefined,
    payload.remember
  );

  return result;
}

export async function logout() {
  const accessToken = getAccessToken();

  try {
    if (!accessToken) {
      return;
    }

    await apiClient.post<LogoutResponse>(logoutAPI, undefined, {
      token: 'access',
      fallbackErrorMessage: 'Nie udało się wylogować przez Cognito.'
    });
  } finally {
    clearStoredAuth();
  }
}

setRefreshAuthSessionHandler(refreshAuthSession);
