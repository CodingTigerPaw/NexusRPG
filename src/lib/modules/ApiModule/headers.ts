import { AxiosHeaders } from 'axios';

export function toHeaderRecord(headers: HeadersInit | undefined) {
  const result: Record<string, string> = {};

  if (!headers) {
    return result;
  }

  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

function isJsonBody(body: unknown) {
  return Boolean(body) && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob);
}

export function createHeaders(headers: HeadersInit | undefined, body: unknown, token: string | null) {
  const nextHeaders = new AxiosHeaders(toHeaderRecord(headers));

  if (token) {
    nextHeaders.set('authorization', `Bearer ${token}`);
  }

  if (isJsonBody(body) && !nextHeaders.has('content-type')) {
    nextHeaders.set('content-type', 'application/json');
  }

  return nextHeaders;
}
