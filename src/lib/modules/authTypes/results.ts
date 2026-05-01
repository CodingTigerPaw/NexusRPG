import type { CognitoTokens, CognitoUser } from './session';

export type NewPasswordRequiredResult = {
  status: 'newPasswordRequired';
  session: string;
  requiredAttributes: string[];
};

export type AuthenticatedResult = {
  status: 'authenticated';
  tokens?: CognitoTokens;
  user?: CognitoUser;
  raw: unknown;
};

export type AuthResult = NewPasswordRequiredResult | AuthenticatedResult;
