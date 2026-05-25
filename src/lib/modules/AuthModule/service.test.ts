import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';

vi.mock('$app/environment', () => ({
  browser: true,
  building: false,
  dev: false,
  version: 'test'
}));

import { server } from '../../../test/msw';
import {
  loginAPI,
  logoutAPI,
  newPasswordChallengeAPI,
  refreshAPI,
  usersAPI
} from '$lib/modules/repository';
import {
  completeNewPasswordChallenge,
  isAuthenticated,
  login,
  logout,
  refreshAuthSession
} from './service';
import { MemoryStorage } from '../../../test/browser-storage';
import {
  clearStoredAuth,
  getAccessToken,
  getIdToken,
  getStoredAuthSession,
  getStoredAuthSessionWithStorage,
  persistAuthSession
} from './session';
import { getCurrentUser } from './user';
import { getCurrentUserRoles, hasRole } from './roles';
import { getUsers } from '$lib/modules/users/users';
import type { AuthSession } from './authTypes/session';

const authStorageKey = 'coc_auth_session';

function encodeBase64Url(value: unknown) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createJwt(payload: Record<string, unknown>) {
  return `${encodeBase64Url({ alg: 'none', typ: 'JWT' })}.${encodeBase64Url(payload)}.signature`;
}

function createAuthSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    tokens: {
      accessToken: 'access-token',
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      ...overrides.tokens
    },
    user: {
      userId: 'user-1',
      username: 'mina',
      email: 'mina@example.test',
      role: 'player',
      ...overrides.user
    }
  };
}

function persistTestSession(overrides: Partial<AuthSession> = {}, remember = false) {
  const session = createAuthSession(overrides);
  persistAuthSession(session, remember);
  return session;
}

describe('AuthModule service', () => {
  let localStorageMock: MemoryStorage;
  let sessionStorageMock: MemoryStorage;

  beforeEach(() => {
    localStorageMock = new MemoryStorage();
    sessionStorageMock = new MemoryStorage();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
    clearStoredAuth();
  });

  afterEach(() => {
    clearStoredAuth();
    vi.unstubAllGlobals();
  });

  it('loguje użytkownika przez backend Cognito i zapisuje sesję po poprawnym loginie', async () => {
    server.use(
      http.post(loginAPI, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          username: 'mina',
          password: 'secret'
        });
        expect(request.headers.get('authorization')).toBeNull();

        return HttpResponse.json({
          AuthenticationResult: {
            AccessToken: 'access-token',
            IdToken: 'id-token',
            RefreshToken: 'refresh-token',
            ExpiresIn: 3600,
            TokenType: 'Bearer'
          },
          user: {
            userId: 'user-1',
            username: 'mina',
            email: 'mina@example.test',
            role: 'player'
          }
        });
      })
    );

    await expect(login({ username: 'mina', password: 'secret', remember: false })).resolves.toMatchObject({
      status: 'authenticated',
      tokens: {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer'
      },
      user: {
        userId: 'user-1',
        username: 'mina'
      }
    });

    expect(getAccessToken()).toBe('access-token');
    expect(getIdToken()).toBe('id-token');
    expect(getCurrentUser()).toMatchObject({
      userId: 'user-1',
      username: 'mina',
      role: 'player'
    });
    expect(isAuthenticated()).toBe(true);
  });

  it('zapisuje login bez remember me w sessionStorage, a nie w localStorage', async () => {
    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json({
          tokens: {
            accessToken: 'session-access-token',
            idToken: 'session-id-token',
            refreshToken: 'session-refresh-token'
          },
          user: {
            userId: 'user-1',
            username: 'mina'
          }
        })
      )
    );

    await login({ username: 'mina', password: 'secret', remember: false });

    expect(sessionStorageMock.getItem(authStorageKey)).toContain('session-access-token');
    expect(localStorageMock.getItem(authStorageKey)).toBeNull();
    expect(getStoredAuthSessionWithStorage()).toMatchObject({
      remember: false,
      session: {
        tokens: {
          accessToken: 'session-access-token'
        }
      }
    });
  });

  it('zapisuje login z remember me w localStorage, a nie w sessionStorage', async () => {
    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json({
          tokens: {
            accessToken: 'remember-access-token',
            idToken: 'remember-id-token',
            refreshToken: 'remember-refresh-token'
          },
          user: {
            userId: 'user-1',
            username: 'mina'
          }
        })
      )
    );

    await login({ username: 'mina', password: 'secret', remember: true });

    expect(localStorageMock.getItem(authStorageKey)).toContain('remember-access-token');
    expect(sessionStorageMock.getItem(authStorageKey)).toBeNull();
    expect(getStoredAuthSessionWithStorage()).toMatchObject({
      remember: true,
      session: {
        tokens: {
          accessToken: 'remember-access-token'
        }
      }
    });
  });

  it('czyści poprzednie storage przy zmianie trybu remember me', async () => {
    let loginCount = 0;

    server.use(
      http.post(loginAPI, () => {
        loginCount += 1;

        return HttpResponse.json({
          tokens: {
            accessToken: `access-token-${loginCount}`,
            idToken: `id-token-${loginCount}`,
            refreshToken: `refresh-token-${loginCount}`
          },
          user: {
            userId: 'user-1',
            username: 'mina'
          }
        });
      })
    );

    await login({ username: 'mina', password: 'secret', remember: true });
    await login({ username: 'mina', password: 'secret', remember: false });

    expect(localStorageMock.getItem(authStorageKey)).toBeNull();
    expect(sessionStorageMock.getItem(authStorageKey)).toContain('access-token-2');
    expect(getStoredAuthSessionWithStorage()?.remember).toBe(false);
  });

  it('normalizuje frontendowy camelCase response logowania bez zależności od formatu Cognito', async () => {
    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json({
          tokens: {
            accessToken: 'camel-access-token',
            idToken: 'camel-id-token',
            refreshToken: 'camel-refresh-token',
            expiresIn: 1200,
            tokenType: 'Bearer'
          },
          user: {
            userId: 'user-3',
            username: 'lucy'
          }
        })
      )
    );

    await expect(login({ username: 'lucy', password: 'secret', remember: false })).resolves.toMatchObject({
      status: 'authenticated',
      tokens: {
        accessToken: 'camel-access-token',
        idToken: 'camel-id-token',
        refreshToken: 'camel-refresh-token',
        tokenType: 'Bearer'
      }
    });

    expect(getStoredAuthSession()).toMatchObject({
      tokens: {
        accessToken: 'camel-access-token',
        idToken: 'camel-id-token'
      },
      user: {
        username: 'lucy'
      }
    });
  });

  it('uzupełnia czasy wygaśnięcia tokenów z pola expiresIn', async () => {
    const beforeLogin = Date.now();

    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json({
          tokens: {
            accessToken: 'expiring-access-token',
            idToken: 'expiring-id-token',
            refreshToken: 'expiring-refresh-token',
            expiresIn: 3600
          },
          user: {
            userId: 'user-1',
            username: 'mina'
          }
        })
      )
    );

    await login({ username: 'mina', password: 'secret', remember: false });

    const storedTokens = getStoredAuthSession()?.tokens;
    expect(storedTokens?.accessTokenExpiresAt).toBeGreaterThanOrEqual(beforeLogin + 3600 * 1000);
    expect(storedTokens?.idTokenExpiresAt).toBeGreaterThanOrEqual(beforeLogin + 3600 * 1000);
  });

  it('nie zapisuje sesji, gdy backend zwróci wynik authenticated bez access tokena', async () => {
    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json({
          user: {
            userId: 'user-1',
            username: 'mina'
          }
        })
      )
    );

    await expect(login({ username: 'mina', password: 'secret', remember: false })).resolves.toMatchObject({
      status: 'authenticated',
      tokens: undefined
    });

    expect(getStoredAuthSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('przekazuje komunikat błędu logowania z backendu i nie zapisuje sesji', async () => {
    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json(
          {
            message: 'Niepoprawny login albo hasło.'
          },
          {
            status: 401
          }
        )
      )
    );

    await expect(login({ username: 'mina', password: 'wrong', remember: true })).rejects.toThrow(
      'Niepoprawny login albo hasło.'
    );
    expect(getStoredAuthSession()).toBeNull();
    expect(localStorageMock.length).toBe(0);
    expect(sessionStorageMock.length).toBe(0);
  });

  it('używa fallbacku błędu logowania, gdy backend nie zwróci czytelnej wiadomości', async () => {
    server.use(
      http.post(loginAPI, () =>
        HttpResponse.json(
          {
            error: 'InternalServerError'
          },
          {
            status: 500
          }
        )
      )
    );

    await expect(login({ username: 'mina', password: 'secret', remember: false })).rejects.toThrow(
      'Nie udało się połączyć z usługą logowania.'
    );
    expect(getStoredAuthSession()).toBeNull();
  });

  it('obsługuje challenge NEW_PASSWORD_REQUIRED bez zapisywania niepełnej sesji', async () => {
    server.use(
      http.post(loginAPI, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          username: 'victor',
          password: 'temporary'
        });
        expect(request.headers.get('authorization')).toBeNull();

        return HttpResponse.json({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: 'cognito-challenge-session',
          requiredAttributes: ['email']
        });
      })
    );

    await expect(login({ username: 'victor', password: 'temporary', remember: true })).resolves.toEqual({
      status: 'newPasswordRequired',
      session: 'cognito-challenge-session',
      requiredAttributes: ['email']
    });

    expect(getStoredAuthSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('kończy challenge Cognito i zapisuje sesję po ustawieniu nowego hasła', async () => {
    server.use(
      http.post(newPasswordChallengeAPI, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          username: 'victor',
          newPassword: 'new-strong-password',
          session: 'cognito-challenge-session',
          requiredAttributes: {
            email: 'victor@example.test'
          }
        });
        expect(request.headers.get('authorization')).toBeNull();

        return HttpResponse.json({
          tokens: {
            accessToken: 'challenge-access-token',
            idToken: 'challenge-id-token',
            refreshToken: 'challenge-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          },
          user: {
            userId: 'user-2',
            username: 'victor',
            email: 'victor@example.test',
            role: 'player'
          }
        });
      })
    );

    await expect(
      completeNewPasswordChallenge({
        username: 'victor',
        newPassword: 'new-strong-password',
        session: 'cognito-challenge-session',
        requiredAttributes: {
          email: 'victor@example.test'
        },
        remember: true
      })
    ).resolves.toMatchObject({
      status: 'authenticated',
      tokens: {
        accessToken: 'challenge-access-token',
        idToken: 'challenge-id-token',
        refreshToken: 'challenge-refresh-token'
      },
      user: {
        userId: 'user-2',
        username: 'victor'
      }
    });

    expect(getStoredAuthSessionWithStorage()).toMatchObject({
      remember: true,
      session: {
        tokens: {
          accessToken: 'challenge-access-token',
          idToken: 'challenge-id-token',
          refreshToken: 'challenge-refresh-token'
        },
        user: {
          userId: 'user-2',
          username: 'victor'
        }
      }
    });
  });

  it('odrzuca challenge, jeśli Cognito nadal wymaga ustawienia hasła po próbie zakończenia', async () => {
    server.use(
      http.post(newPasswordChallengeAPI, () =>
        HttpResponse.json({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: 'next-cognito-session'
        })
      )
    );

    await expect(
      completeNewPasswordChallenge({
        username: 'victor',
        newPassword: 'too-weak',
        session: 'cognito-challenge-session',
        remember: true
      })
    ).rejects.toThrow('Cognito nadal wymaga ustawienia nowego hasła.');
    expect(getStoredAuthSession()).toBeNull();
  });

  it('odrzuca challenge z komunikatem backendu i nie zapisuje sesji', async () => {
    server.use(
      http.post(newPasswordChallengeAPI, () =>
        HttpResponse.json(
          {
            message: 'Hasło nie spełnia polityki bezpieczeństwa.'
          },
          {
            status: 400
          }
        )
      )
    );

    await expect(
      completeNewPasswordChallenge({
        username: 'victor',
        newPassword: 'weak',
        session: 'cognito-challenge-session',
        remember: false
      })
    ).rejects.toThrow('Hasło nie spełnia polityki bezpieczeństwa.');
    expect(getStoredAuthSession()).toBeNull();
  });

  it('odczytuje użytkownika i role z payloadu id tokena, gdy backend nie zapisał pełnego profilu', () => {
    persistAuthSession(
      {
        tokens: {
          accessToken: 'access-token',
          idToken: createJwt({
            sub: 'jwt-user-1',
            email: 'jwt-user@example.test',
            'cognito:username': 'jwt-mina',
            'cognito:groups': ['gm', 'chronicle-keeper']
          }),
          refreshToken: 'refresh-token'
        }
      },
      false
    );

    expect(getCurrentUser()).toMatchObject({
      userId: 'jwt-user-1',
      username: 'jwt-mina',
      email: 'jwt-user@example.test',
      role: 'gm'
    });
    expect(getCurrentUserRoles()).toEqual(expect.arrayContaining(['gm', 'player', 'chronicle-keeper']));
    expect(hasRole('player')).toBe(true);
    expect(hasRole('gm')).toBe(true);
    expect(hasRole('admin')).toBe(false);
  });

  it('preferuje dane użytkownika zapisane przez backend przed claimami z id tokena', () => {
    persistAuthSession(
      {
        tokens: {
          accessToken: 'access-token',
          idToken: createJwt({
            sub: 'jwt-user-1',
            email: 'jwt-user@example.test',
            'cognito:username': 'jwt-mina',
            'custom:role': 'admin'
          }),
          refreshToken: 'refresh-token'
        },
        user: {
          userId: 'backend-user-1',
          username: 'backend-mina',
          email: 'backend-user@example.test',
          role: 'player'
        }
      },
      false
    );

    expect(getCurrentUser()).toMatchObject({
      userId: 'backend-user-1',
      username: 'backend-mina',
      email: 'backend-user@example.test',
      role: 'player'
    });
    expect(getCurrentUserRoles()).toEqual(expect.arrayContaining(['player', 'admin']));
  });

  it('nie odświeża sesji, gdy tokeny nie wygasają i refresh nie jest wymuszony', async () => {
    const session = persistTestSession({
      tokens: {
        accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
        idTokenExpiresAt: Date.now() + 30 * 60 * 1000
      }
    });

    server.use(
      http.post(refreshAPI, () =>
        HttpResponse.json(
          {
            message: 'Refresh nie powinien zostać wywołany.'
          },
          {
            status: 500
          }
        )
      )
    );

    await expect(refreshAuthSession()).resolves.toEqual(session);
  });

  it('odświeża sesję, gdy token wygasł, zachowując refresh token i tryb remember', async () => {
    persistTestSession(
      {
        tokens: {
          accessToken: 'old-access-token',
          idToken: 'old-id-token',
          refreshToken: 'old-refresh-token',
          accessTokenExpiresAt: Date.now() - 1000,
          idTokenExpiresAt: Date.now() + 30 * 60 * 1000
        },
        user: {
          username: 'mina'
        }
      },
      true
    );

    server.use(
      http.post(refreshAPI, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          refreshToken: 'old-refresh-token',
          username: 'mina'
        });
        expect(request.headers.get('authorization')).toBeNull();

        return HttpResponse.json({
          tokens: {
            accessToken: 'new-access-token',
            idToken: 'new-id-token'
          },
          user: {
            userId: 'user-1',
            username: 'mina-refreshed',
            role: 'gm'
          }
        });
      })
    );

    await expect(refreshAuthSession()).resolves.toMatchObject({
      tokens: {
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        refreshToken: 'old-refresh-token'
      },
      user: {
        username: 'mina-refreshed',
        role: 'gm'
      }
    });

    expect(getStoredAuthSessionWithStorage()).toMatchObject({
      remember: true,
      session: {
        tokens: {
          accessToken: 'new-access-token',
          idToken: 'new-id-token',
          refreshToken: 'old-refresh-token'
        }
      }
    });
  });

  it('wymusza refresh nawet dla niewygasłej sesji, gdy chroniony request dostanie 401', async () => {
    persistTestSession({
      tokens: {
        accessToken: 'valid-access-token',
        idToken: 'stale-id-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
        idTokenExpiresAt: Date.now() + 30 * 60 * 1000
      }
    });

    let usersRequestCount = 0;

    server.use(
      http.get(usersAPI, ({ request }) => {
        usersRequestCount += 1;

        if (usersRequestCount === 1) {
          expect(request.headers.get('authorization')).toBe('Bearer stale-id-token');

          return HttpResponse.json(
            {
              message: 'Token wygasł.'
            },
            {
              status: 401
            }
          );
        }

        expect(request.headers.get('authorization')).toBe('Bearer fresh-id-token');

        return HttpResponse.json({
          users: [
            {
              userId: 'user-1',
              username: 'mina'
            }
          ],
          nextCursor: null
        });
      }),
      http.post(refreshAPI, async ({ request }) => {
        await expect(request.json()).resolves.toEqual({
          refreshToken: 'refresh-token',
          username: 'mina'
        });

        return HttpResponse.json({
          tokens: {
            accessToken: 'fresh-access-token',
            idToken: 'fresh-id-token',
            refreshToken: 'fresh-refresh-token'
          }
        });
      })
    );

    await expect(getUsers()).resolves.toEqual({
      users: [
        {
          userId: 'user-1',
          username: 'mina'
        }
      ],
      nextCursor: null
    });
    expect(usersRequestCount).toBe(2);
    expect(getIdToken()).toBe('fresh-id-token');
  });

  it('dołącza id token do chronionego requestu, gdy sesja jest poprawna', async () => {
    persistTestSession({
      tokens: {
        idToken: 'protected-id-token',
        accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
        idTokenExpiresAt: Date.now() + 30 * 60 * 1000
      }
    });

    server.use(
      http.get(usersAPI, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer protected-id-token');

        return HttpResponse.json({
          users: [
            {
              userId: 'user-1',
              username: 'mina'
            }
          ],
          nextCursor: null
        });
      })
    );

    await expect(getUsers()).resolves.toMatchObject({
      users: [
        {
          username: 'mina'
        }
      ]
    });
  });

  it('współdzieli równoległy refresh, żeby nie wysyłać kilku requestów tym samym refresh tokenem', async () => {
    persistTestSession({
      tokens: {
        accessToken: 'old-access-token',
        idToken: 'old-id-token',
        refreshToken: 'shared-refresh-token',
        accessTokenExpiresAt: Date.now() - 1000,
        idTokenExpiresAt: Date.now() - 1000
      }
    });
    let refreshCount = 0;

    server.use(
      http.post(refreshAPI, async () => {
        refreshCount += 1;
        await delay(20);

        return HttpResponse.json({
          tokens: {
            accessToken: 'shared-new-access-token',
            idToken: 'shared-new-id-token'
          }
        });
      })
    );

    const sessions = await Promise.all([
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession()
    ]);

    expect(refreshCount).toBe(1);
    sessions.forEach((session) => {
      expect(session?.tokens.accessToken).toBe('shared-new-access-token');
      expect(session?.tokens.idToken).toBe('shared-new-id-token');
    });
  });

  it('czyści sesję, gdy refresh zwróci błąd', async () => {
    persistTestSession({
      tokens: {
        accessTokenExpiresAt: Date.now() - 1000,
        idTokenExpiresAt: Date.now() - 1000
      }
    });

    server.use(
      http.post(refreshAPI, () =>
        HttpResponse.json(
          {
            message: 'Refresh token został odrzucony.'
          },
          {
            status: 401
          }
        )
      )
    );

    await expect(refreshAuthSession()).rejects.toThrow('Refresh token został odrzucony.');
    expect(getStoredAuthSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('odrzuca refresh bez nowych tokenów i czyści sesję', async () => {
    persistTestSession({
      tokens: {
        accessTokenExpiresAt: Date.now() - 1000,
        idTokenExpiresAt: Date.now() - 1000
      }
    });

    server.use(
      http.post(refreshAPI, () =>
        HttpResponse.json({
          user: {
            userId: 'user-1',
            username: 'mina'
          }
        })
      )
    );

    await expect(refreshAuthSession()).rejects.toThrow('Endpoint odświeżania nie zwrócił nowych tokenów.');
    expect(getStoredAuthSession()).toBeNull();
  });

  it('nie próbuje odświeżać sesji bez refresh tokena', async () => {
    persistAuthSession(
      {
        tokens: {
          accessToken: 'access-token-without-refresh',
          idToken: 'id-token-without-refresh',
          accessTokenExpiresAt: Date.now() - 1000,
          idTokenExpiresAt: Date.now() - 1000
        },
        user: {
          userId: 'user-1',
          username: 'mina'
        }
      },
      false
    );

    server.use(
      http.post(refreshAPI, () =>
        HttpResponse.json(
          {
            message: 'Refresh nie powinien zostać wywołany.'
          },
          {
            status: 500
          }
        )
      )
    );

    await expect(refreshAuthSession()).resolves.toMatchObject({
      tokens: {
        accessToken: 'access-token-without-refresh'
      }
    });
  });

  it('odrzuca chroniony request użytkownika bez tokenu i nie próbuje doklejać Authorization', async () => {
    server.use(
      http.get(usersAPI, ({ request }) => {
        expect(request.headers.get('authorization')).toBeNull();

        return HttpResponse.json(
          {
            message: 'Brak tokenu autoryzacyjnego.'
          },
          {
            status: 401
          }
        );
      })
    );

    await expect(getUsers()).rejects.toThrow('Brak tokenu autoryzacyjnego.');
  });

  it('wylogowuje przez Cognito access tokenem i zawsze czyści lokalną sesję', async () => {
    persistTestSession({
      tokens: {
        accessToken: 'logout-access-token',
        idToken: 'logout-id-token',
        refreshToken: 'logout-refresh-token',
        accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
        idTokenExpiresAt: Date.now() + 30 * 60 * 1000
      }
    });

    server.use(
      http.post(logoutAPI, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer logout-access-token');

        return HttpResponse.json({
          message: 'Wylogowano.'
        });
      })
    );

    await expect(logout()).resolves.toBeUndefined();
    expect(getStoredAuthSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('czyści lokalną sesję nawet wtedy, gdy backend logout zwróci błąd', async () => {
    persistTestSession({
      tokens: {
        accessToken: 'logout-access-token',
        idToken: 'logout-id-token',
        refreshToken: 'logout-refresh-token',
        accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
        idTokenExpiresAt: Date.now() + 30 * 60 * 1000
      }
    });

    server.use(
      http.post(logoutAPI, () =>
        HttpResponse.json(
          {
            message: 'Cognito logout nie powiódł się.'
          },
          {
            status: 500
          }
        )
      )
    );

    await expect(logout()).rejects.toThrow('Cognito logout nie powiódł się.');
    expect(getStoredAuthSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('wylogowanie bez access tokena tylko czyści storage i nie wysyła requestu', async () => {
    let logoutRequests = 0;
    localStorageMock.setItem(
      authStorageKey,
      JSON.stringify({
        tokens: {
          refreshToken: 'refresh-only-token'
        }
      })
    );

    server.use(
      http.post(logoutAPI, () => {
        logoutRequests += 1;

        return HttpResponse.json({});
      })
    );

    await expect(logout()).resolves.toBeUndefined();
    expect(logoutRequests).toBe(0);
    expect(getStoredAuthSession()).toBeNull();
  });
});
