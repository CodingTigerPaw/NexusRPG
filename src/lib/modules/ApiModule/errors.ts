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

export function readErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return null;
  }

  const message = data.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export type APIStatusMessages = {
  unauthorized?: string;
  notFound?: string;
  badRequest?: string;
  fallback?: string;
};

export function mapAPIError(error: unknown, messages: APIStatusMessages): never {
  if (!isAPIError(error)) {
    throw error;
  }

  if ((error.status === 401 || error.status === 403) && messages.unauthorized) {
    throw new Error(error.message || messages.unauthorized);
  }

  if (error.status === 404 && messages.notFound) {
    throw new Error(error.message || messages.notFound);
  }

  if (error.status === 400 && messages.badRequest) {
    throw new Error(error.message || messages.badRequest);
  }

  if (messages.fallback) {
    throw new Error(error.message || messages.fallback);
  }

  throw error;
}
