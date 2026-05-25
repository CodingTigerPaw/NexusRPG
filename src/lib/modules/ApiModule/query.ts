import type { QueryValue } from './types';

export function toQueryParams(query: Record<string, QueryValue> | undefined) {
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
