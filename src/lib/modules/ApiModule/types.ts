export type AuthTokenType = 'id' | 'access' | 'none';

export type QueryValue = string | number | boolean | null | undefined;

export type APIRequestOptions = {
  token?: AuthTokenType;
  query?: Record<string, QueryValue>;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
  fallbackErrorMessage?: string;
  retryOnUnauthorized?: boolean;
};
