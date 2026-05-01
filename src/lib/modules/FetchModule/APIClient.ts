import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method
} from 'axios';
import {
  type AuthSession,
  getAccessToken,
  getIdToken,
  getStoredAuthSession
} from '$lib/modules/auth-session';

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

export class APIError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown = null
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

let refreshAuthSessionHandler: ((force?: boolean) => Promise<AuthSession | null>) | null = null;

export function setRefreshAuthSessionHandler(
  handler: ((force?: boolean) => Promise<AuthSession | null>) | null
) {
  refreshAuthSessionHandler = handler;
}

function readErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return null;
  }

  const message = data.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

function toHeaderRecord(headers: HeadersInit | undefined) {
  const result: Record<string, string> = {};

  if (!headers) {
    return result;
  }

  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

function toQueryParams(query: Record<string, QueryValue> | undefined) {
  const params: Record<string, string> = {};

  if (!query) {
    return params;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    params[key] = String(value);
  }

  return params;
}

function isJsonBody(body: unknown) {
  return Boolean(body) && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob);
}

export class APIClient {
  private readonly client: AxiosInstance;

  constructor(baseURL = '') {
    this.client = axios.create({
      baseURL: baseURL || undefined,
      validateStatus: () => true
    });
  }

  get<TResponse>(url: string | URL, options: Omit<APIRequestOptions, 'body'> = {}) {
    return this.request<TResponse>('GET', url, options);
  }

  post<TResponse>(url: string | URL, body?: unknown, options: Omit<APIRequestOptions, 'body'> = {}) {
    return this.request<TResponse>('POST', url, {
      ...options,
      body
    });
  }

  put<TResponse>(url: string | URL, body?: unknown, options: Omit<APIRequestOptions, 'body'> = {}) {
    return this.request<TResponse>('PUT', url, {
      ...options,
      body
    });
  }

  delete<TResponse>(url: string | URL, options: Omit<APIRequestOptions, 'body'> = {}) {
    return this.request<TResponse>('DELETE', url, options);
  }

  async request<TResponse>(
    method: Method,
    url: string | URL,
    options: APIRequestOptions = {}
  ): Promise<TResponse> {
    const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
    const response = await this.client.request<unknown>(
      await this.createConfig(method, url, options)
    );

    if (
      response.status === 401 &&
      retryOnUnauthorized &&
      refreshAuthSessionHandler &&
      getStoredAuthSession()?.tokens.refreshToken
    ) {
      const refreshedSession = await refreshAuthSessionHandler(true).catch(() => null);
      const refreshedToken =
        options.token === 'access'
          ? refreshedSession?.tokens.accessToken
          : refreshedSession?.tokens.idToken;

      if (refreshedToken) {
        const retryResponse = await this.client.request<unknown>(
          await this.createConfig(method, url, options, refreshedToken)
        );
        return this.handleResponse<TResponse>(retryResponse, options.fallbackErrorMessage);
      }
    }

    return this.handleResponse<TResponse>(response, options.fallbackErrorMessage);
  }

  private async createConfig(
    method: Method,
    input: string | URL,
    options: APIRequestOptions,
    explicitToken?: string
  ): Promise<AxiosRequestConfig> {
    const headers = new AxiosHeaders(toHeaderRecord(options.headers));
    const token = explicitToken ?? (await this.getToken(options.token ?? 'id'));

    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }

    if (isJsonBody(options.body) && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    return {
      method,
      url: input.toString(),
      params: toQueryParams(options.query),
      data: options.body,
      headers,
      signal: options.signal
    };
  }

  private async getToken(tokenType: AuthTokenType) {
    if (tokenType === 'none') {
      return null;
    }

    await refreshAuthSessionHandler?.().catch(() => null);

    return tokenType === 'access' ? getAccessToken() : getIdToken();
  }

  private handleResponse<TResponse>(
    response: AxiosResponse<unknown>,
    fallbackErrorMessage?: string
  ) {
    if (response.status < 200 || response.status >= 300) {
      throw new APIError(
        readErrorMessage(response.data) ?? fallbackErrorMessage ?? 'Nie udało się wykonać żądania API.',
        response.status,
        response.data
      );
    }

    return response.data as TResponse;
  }
}

export const apiClient = new APIClient();
