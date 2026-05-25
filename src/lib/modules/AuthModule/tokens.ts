import type { CognitoTokens } from "$lib/modules/AuthModule/authTypes/session";

// Token helpers are isolated from browser storage so parsing JWT and calculating
// expiration can stay reusable for both normal login and refresh flows.
export function decodeJwtPayload<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
>(token: string | undefined): TPayload | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(atob(paddedPayload)) as TPayload;
  } catch {
    return null;
  }
}

export function getJwtExpirationMs(
  token: string | undefined,
): number | undefined {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ? payload.exp * 1000 : undefined;
}

function getTokenExpiresAt(
  token: string | undefined,
  expiresIn: number | undefined,
) {
  return (
    getJwtExpirationMs(token) ??
    (expiresIn ? Date.now() + expiresIn * 1000 : undefined)
  );
}

export function withTokenExpiration(tokens: CognitoTokens): CognitoTokens {
  return {
    ...tokens,
    accessTokenExpiresAt:
      tokens.accessTokenExpiresAt ??
      getTokenExpiresAt(tokens.accessToken, tokens.expiresIn),
    idTokenExpiresAt:
      tokens.idTokenExpiresAt ??
      getTokenExpiresAt(tokens.idToken, tokens.expiresIn),
  };
}
