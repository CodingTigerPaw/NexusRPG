import type { CognitoTokens, CognitoUser } from './session';

export type CognitoTokenResponse = CognitoTokens & {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
  TokenType?: string;
};

export type LoginResponse = {
  challengeCompleted?: boolean;
  challenge?: string;
  ChallengeName?: string;
  session?: string;
  Session?: string;
  requiredAttributes?: string[];
  user?: CognitoUser;
  tokens?: CognitoTokenResponse;
  AuthenticationResult?: CognitoTokenResponse;
};

export type RefreshResponse = {
  tokens?: CognitoTokenResponse;
  AuthenticationResult?: CognitoTokenResponse;
  user?: CognitoUser;
};

export type LogoutResponse = {
  message?: string;
};
