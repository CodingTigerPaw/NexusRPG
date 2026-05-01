export type CognitoTokens = {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  accessTokenExpiresAt?: number;
  idTokenExpiresAt?: number;
  tokenType?: string;
};

export type CognitoUser = {
  userId?: string;
  username?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

export type AuthSession = {
  tokens: CognitoTokens;
  user?: CognitoUser;
};
