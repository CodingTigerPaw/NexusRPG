import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type Method
} from 'axios';
import {
  browserStorageAuthProvider,
  getRetryTokenType,
  type APIAuthProvider
} from './auth';
import { createHeaders } from './headers';
import { toQueryParams } from './query';
import { handleResponse } from './response';
import type { APIRequestOptions, AuthTokenType } from './types';

export class APIClient {
  private readonly client: AxiosInstance;
  private readonly authProvider: APIAuthProvider;

  constructor(baseURL = '', authProvider = browserStorageAuthProvider) {
    // Auth is injected so the HTTP client does not need to know where tokens are
    // stored or how Cognito refresh is implemented.
    this.authProvider = authProvider;
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
    const tokenType = options.token ?? 'id';
    const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
    const response = await this.client.request<unknown>(
      await this.createConfig(method, url, options, tokenType)
    );

    if (response.status === 401 && retryOnUnauthorized) {
      const retryResponse = await this.retryAfterUnauthorized<TResponse>(method, url, options, tokenType);

      if (retryResponse) {
        return retryResponse;
      }
    }

    return handleResponse<TResponse>(response, options.fallbackErrorMessage);
  }

  private async retryAfterUnauthorized<TResponse>(
    method: Method,
    url: string | URL,
    options: APIRequestOptions,
    tokenType: AuthTokenType
  ): Promise<TResponse | null> {
    const retryTokenType = getRetryTokenType(tokenType);

    // Public/auth endpoints opt out with token: 'none'; retrying them with an
    // identity token would silently change the request contract after a 401.
    if (!retryTokenType || !this.authProvider.hasRefreshToken()) {
      return null;
    }

    const refreshedSession = await this.authProvider.refresh(true).catch(() => null);
    const refreshedToken =
      retryTokenType === 'access'
        ? refreshedSession?.tokens.accessToken
        : refreshedSession?.tokens.idToken;

    if (!refreshedToken) {
      return null;
    }

    const retryResponse = await this.client.request<unknown>(
      await this.createConfig(method, url, options, tokenType, refreshedToken)
    );
    return handleResponse<TResponse>(retryResponse, options.fallbackErrorMessage);
  }

  private async createConfig(
    method: Method,
    input: string | URL,
    options: APIRequestOptions,
    tokenType: AuthTokenType,
    explicitToken?: string
  ): Promise<AxiosRequestConfig> {
    const token = explicitToken ?? (await this.getToken(tokenType));

    return {
      method,
      url: input.toString(),
      params: toQueryParams(options.query),
      data: options.body,
      headers: createHeaders(options.headers, options.body, token),
      signal: options.signal
    };
  }

  private async getToken(tokenType: AuthTokenType) {
    if (tokenType === 'none') {
      return null;
    }

    return this.authProvider.getToken(tokenType);
  }
}

export const apiClient = new APIClient();
