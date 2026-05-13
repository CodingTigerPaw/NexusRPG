import type { AxiosResponse } from 'axios';
import { APIError, readErrorMessage } from './errors';

export function handleResponse<TResponse>(
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

export function expectField<TData, TKey extends keyof NonNullable<TData>>(
  data: TData | null | undefined,
  key: TKey,
  message: string
): NonNullable<NonNullable<TData>[TKey]> {
  const value = data?.[key];

  if (!value) {
    throw new Error(message);
  }

  return value as NonNullable<NonNullable<TData>[TKey]>;
}

export function expectArrayField<TData, TKey extends keyof NonNullable<TData>>(
  data: TData | null | undefined,
  key: TKey,
  message: string
): Extract<NonNullable<NonNullable<TData>[TKey]>, unknown[]> {
  const value = data?.[key];

  if (!Array.isArray(value)) {
    throw new Error(message);
  }

  return value as Extract<NonNullable<NonNullable<TData>[TKey]>, unknown[]>;
}
