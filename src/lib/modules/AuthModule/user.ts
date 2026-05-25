import type { CognitoUser } from "$lib/modules/AuthModule/authTypes/session";
import { getStoredAuthSession } from "./session";
import { decodeJwtPayload } from "./tokens";

type IdTokenUserPayload = {
  sub?: string;
  email?: string;
  role?: string;
  "custom:role"?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string[];
};

// User data is resolved from stored backend data first and JWT claims second so a
// richer backend user object can override the minimal Cognito payload when present.
export function getCurrentUser(): CognitoUser | null {
  const session = getStoredAuthSession();

  if (!session) {
    return null;
  }

  const idTokenPayload = decodeJwtPayload<IdTokenUserPayload>(
    session.tokens.idToken,
  );

  return {
    userId: session.user?.userId ?? idTokenPayload?.sub,
    username: session.user?.username ?? idTokenPayload?.["cognito:username"],
    email: session.user?.email ?? idTokenPayload?.email,
    role:
      session.user?.role ??
      idTokenPayload?.role ??
      idTokenPayload?.["custom:role"] ??
      idTokenPayload?.["cognito:groups"]?.[0],
    roles: [
      ...(session.user?.roles ?? []),
      ...(session.user?.role ? [session.user.role] : []),
      ...(idTokenPayload?.role ? [idTokenPayload.role] : []),
      ...(idTokenPayload?.["custom:role"]
        ? [idTokenPayload["custom:role"]]
        : []),
      ...(idTokenPayload?.["cognito:groups"] ?? []),
    ],
  };
}

export function getCurrentUserRole(): string | null {
  return getCurrentUser()?.role ?? null;
}
