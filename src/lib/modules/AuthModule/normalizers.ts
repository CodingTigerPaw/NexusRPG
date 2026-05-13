import type {
  AuthResult,
} from "$lib/modules/AuthModule/authTypes/results";
import type {
  CognitoTokens,
} from "$lib/modules/AuthModule/authTypes/session";
import type {
  CognitoTokenResponse,
  LoginResponse,
  RefreshResponse,
} from "$lib/modules/AuthModule/authTypes/responses";
import { withTokenExpiration } from "./tokens";

// The API boundary is the only place that should know about Cognito's PascalCase
// response shape; internal code works with the app's camelCase token model.
function readCognitoTokens(tokens: CognitoTokenResponse): CognitoTokens {
  return {
    accessToken: tokens.accessToken ?? tokens.AccessToken,
    idToken: tokens.idToken ?? tokens.IdToken,
    refreshToken: tokens.refreshToken ?? tokens.RefreshToken,
    expiresIn: tokens.expiresIn ?? tokens.ExpiresIn,
    tokenType: tokens.tokenType ?? tokens.TokenType,
  };
}

export function normalizeTokens(
  response: LoginResponse | RefreshResponse,
): CognitoTokens | undefined {
  const tokens = response.tokens ?? response.AuthenticationResult;

  if (!tokens) {
    return undefined;
  }

  // The backend currently accepts Cognito-shaped and frontend-shaped responses.
  // Normalizing at the boundary keeps the rest of auth code independent from that API detail.
  return withTokenExpiration(readCognitoTokens(tokens));
}

export function normalizeAuthResult(response: LoginResponse): AuthResult {
  const challenge = response.challenge ?? response.ChallengeName;
  const session = response.session ?? response.Session;

  if (challenge === "NEW_PASSWORD_REQUIRED" && session) {
    return {
      status: "newPasswordRequired",
      session,
      requiredAttributes: response.requiredAttributes ?? [],
    };
  }

  return {
    status: "authenticated",
    tokens: normalizeTokens(response),
    user: response.user,
    raw: response,
  };
}
