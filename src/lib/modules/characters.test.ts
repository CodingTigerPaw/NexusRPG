import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

vi.mock('$app/environment', () => ({
  browser: true,
  building: false,
  dev: false,
  version: 'test'
}));

import { server } from '../../test/msw';
import { MemoryStorage } from '../../test/browser-storage';
import { charactersAPI, rpgSessionsAPI, usersAPI } from '$lib/modules/repository';
import { clearStoredAuth, persistAuthSession } from './AuthModule/session';
import {
  deleteCharacter,
  deleteCharacterAvatar,
  deleteSessionParticipantCharacterAvatar,
  getCharacter,
  getUserCharacters,
  updateSessionParticipantCharacter,
  uploadSessionParticipantCharacterAvatar
} from './characters';
import type { CharacterCard } from './characters';

const investigator: CharacterCard = {
  userId: 'user-1',
  characterId: 'character-1',
  name: 'Mina Harker',
  rpgSystem: 'Call of Cthulhu 5e',
  occupation: 'Antykwariuszka',
  age: 31,
  characteristics: {
    STR: 50,
    DEX: 65,
    INT: 80
  },
  skills: {
    Accounting: 35,
    'Library Use': 70
  },
  backstory: {
    system: 'Call of Cthulhu 5e',
    birthplace: 'Kraków'
  },
  notes: 'Notatka testowa',
  avatarUrl: 'https://assets.example.test/mina.webp',
  createdAt: '2026-05-14T10:00:00.000Z',
  updatedAt: '2026-05-14T11:00:00.000Z'
};

function authorizeTestSession() {
  persistAuthSession(
    {
      tokens: {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token'
      },
      user: {
        userId: 'user-1',
        username: 'mina'
      }
    },
    false
  );
}

describe('characters API module', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    clearStoredAuth();
  });

  afterEach(() => {
    clearStoredAuth();
    vi.unstubAllGlobals();
  });

  it('pobiera listę postaci konkretnego użytkownika z query params i tokenem ID', async () => {
    authorizeTestSession();
    const userId = 'user/with space';
    const expectedUrl = `${usersAPI}/${encodeURIComponent(userId)}/character-sheets`;

    server.use(
      http.get(expectedUrl, ({ request }) => {
        const url = new URL(request.url);

        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        expect(url.searchParams.get('limit')).toBe('2');
        expect(url.searchParams.get('cursor')).toBe('next page');
        expect(url.searchParams.get('rpgSystem')).toBe('Call of Cthulhu 5e');

        return HttpResponse.json({
          userId,
          characterSheets: [
            investigator,
            {
              ...investigator,
              characterId: 'character-2',
              name: 'Jonathan Harker',
              rpgSystem: 'Vampire: The Masquerade'
            }
          ],
          nextCursor: 'last-page'
        });
      })
    );

    await expect(
      getUserCharacters(userId, {
        limit: 2,
        cursor: 'next page',
        rpgSystem: 'Call of Cthulhu 5e'
      })
    ).resolves.toEqual({
      userId,
      characterSheets: [
        investigator,
        {
          ...investigator,
          characterId: 'character-2',
          name: 'Jonathan Harker',
          rpgSystem: 'Vampire: The Masquerade'
        }
      ],
      nextCursor: 'last-page'
    });
  });

  it('odrzuca listę postaci użytkownika, gdy backend nie zwróci wymaganej tablicy characterSheets', async () => {
    authorizeTestSession();

    server.use(
      http.get(`${usersAPI}/user-1/character-sheets`, () => {
        return HttpResponse.json({
          userId: 'user-1',
          nextCursor: null
        });
      })
    );

    await expect(getUserCharacters('user-1')).rejects.toThrow(
      'Backend zwrócił nieprawidłową odpowiedź listy kart gracza.'
    );
  });

  it('mapuje odmowę dostępu przy pobieraniu listy postaci użytkownika', async () => {
    authorizeTestSession();

    server.use(
      http.get(`${usersAPI}/user-1/character-sheets`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Nie możesz przeglądać kart tego gracza.'
          },
          {
            status: 403
          }
        );
      })
    );

    await expect(getUserCharacters('user-1')).rejects.toThrow(
      'Nie możesz przeglądać kart tego gracza.'
    );
  });

  it('pobiera szczegóły konkretnej postaci z zakodowanym identyfikatorem i tokenem ID', async () => {
    authorizeTestSession();
    const characterId = 'character/with space';
    const expectedUrl = `${charactersAPI}/${encodeURIComponent(characterId)}`;

    server.use(
      http.get(expectedUrl, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          characterSheet: {
            ...investigator,
            characterId
          }
        });
      })
    );

    await expect(getCharacter(characterId)).resolves.toEqual({
      ...investigator,
      characterId
    });
  });

  it('odrzuca szczegóły postaci, gdy backend nie zwróci pola characterSheet', async () => {
    authorizeTestSession();

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          message: 'OK bez danych'
        });
      })
    );

    await expect(getCharacter('character-1')).rejects.toThrow(
      'Backend nie zwrócił danych karty postaci.'
    );
  });

  it('mapuje brak znalezionej postaci na czytelny błąd z backendu', async () => {
    authorizeTestSession();

    server.use(
      http.get(`${charactersAPI}/missing-character`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Postać nie istnieje.'
          },
          {
            status: 404
          }
        );
      })
    );

    await expect(getCharacter('missing-character')).rejects.toThrow('Postać nie istnieje.');
  });

  it('odrzuca pobieranie szczegółów postaci bez zapisanej sesji i nie wysyła Authorization', async () => {
    server.use(
      http.get(`${charactersAPI}/character-1`, ({ request }) => {
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

    await expect(getCharacter('character-1')).rejects.toThrow('Brak tokenu autoryzacyjnego.');
  });

  it('usuwa postać przez zakodowany identyfikator i token ID', async () => {
    authorizeTestSession();
    const characterId = 'character/with space';
    const expectedUrl = `${charactersAPI}/${encodeURIComponent(characterId)}`;

    server.use(
      http.delete(expectedUrl, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          message: 'Character deleted'
        });
      })
    );

    await expect(deleteCharacter(characterId)).resolves.toBe('Character deleted');
  });

  it('zwraca domyślny komunikat usunięcia postaci, gdy backend nie zwróci message', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${charactersAPI}/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({});
      })
    );

    await expect(deleteCharacter('character-1')).resolves.toBe('Character deleted');
  });

  it('mapuje odmowę usunięcia postaci przypisanej albo cudzej na komunikat backendu', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${charactersAPI}/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Nie można usunąć postaci przypisanej do aktywnej sesji.'
          },
          {
            status: 403
          }
        );
      })
    );

    await expect(deleteCharacter('character-1')).rejects.toThrow(
      'Nie można usunąć postaci przypisanej do aktywnej sesji.'
    );
  });

  it('mapuje brak postaci przy usuwaniu na czytelny błąd', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${charactersAPI}/missing-character`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Postać nie istnieje.'
          },
          {
            status: 404
          }
        );
      })
    );

    await expect(deleteCharacter('missing-character')).rejects.toThrow('Postać nie istnieje.');
  });

  it('używa fallbacku błędu przy nieudanym usunięciu postaci bez message', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json(
          {
            error: 'InternalServerError'
          },
          {
            status: 500
          }
        );
      })
    );

    await expect(deleteCharacter('character-1')).rejects.toThrow('Nie udało się usunąć karty postaci.');
  });

  it('usuwa avatar postaci przez osobny endpoint przed kasowaniem zasobu S3', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${charactersAPI}/character-1/avatar`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          characterSheet: {
            ...investigator,
            avatarUrl: null,
            avatarKey: null,
            avatarUpdatedAt: null
          }
        });
      })
    );

    await expect(deleteCharacterAvatar('character-1')).resolves.toMatchObject({
      characterId: 'character-1',
      avatarUrl: null,
      avatarKey: null,
      avatarUpdatedAt: null
    });
  });

  it('mapuje błąd usuwania avatara postaci bez utraty kontekstu backendu', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${charactersAPI}/character-1/avatar`, () => {
        return HttpResponse.json(
          {
            message: 'Nie udało się usunąć pliku avatara z S3.'
          },
          {
            status: 500
          }
        );
      })
    );

    await expect(deleteCharacterAvatar('character-1')).rejects.toThrow(
      'Nie udało się usunąć pliku avatara z S3.'
    );
  });

  it('aktualizuje kartę uczestnika sesji przez endpoint z userId i characterId', async () => {
    authorizeTestSession();
    const sessionId = 'session/one';
    const userId = 'user/with space';
    const characterId = 'character/with space';
    const expectedUrl = `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}/players/${encodeURIComponent(userId)}/character-sheets/${encodeURIComponent(characterId)}`;

    server.use(
      http.put(expectedUrl, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        await expect(request.json()).resolves.toEqual({
          characteristics: {
            STR: 55
          }
        });

        return HttpResponse.json({
          characterSheet: {
            ...investigator,
            characterId,
            userId,
            sessionId,
            characteristics: {
              ...investigator.characteristics,
              STR: 55
            }
          }
        });
      })
    );

    await expect(
      updateSessionParticipantCharacter(sessionId, userId, characterId, {
        characteristics: {
          STR: 55
        }
      })
    ).resolves.toMatchObject({
      characterId,
      userId,
      sessionId,
      characteristics: {
        STR: 55
      }
    });
  });

  it('mapuje odmowę aktualizacji karty uczestnika sesji, gdy postać nie jest powiązana z sesją', async () => {
    authorizeTestSession();

    server.use(
      http.put(`${rpgSessionsAPI}/session-1/players/user-1/character-sheets/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Ta karta nie jest uczestnikiem sesji.'
          },
          {
            status: 403
          }
        );
      })
    );

    await expect(
      updateSessionParticipantCharacter('session-1', 'user-1', 'character-1', {
        notes: 'Aktualizacja z sesji'
      })
    ).rejects.toThrow('Ta karta nie jest uczestnikiem sesji.');
  });

  it('wgrywa avatar karty uczestnika sesji przez endpoint powiązania sesja-gracz-postać', async () => {
    authorizeTestSession();

    server.use(
      http.post(`${rpgSessionsAPI}/session-1/players/user-1/character-sheets/character-1/avatar`, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        await expect(request.json()).resolves.toMatchObject({
          fileName: 'mina.webp',
          contentType: 'image/webp',
          imageBase64: 'data:image/webp;base64,AAAA'
        });

        return HttpResponse.json({
          characterSheet: {
            ...investigator,
            sessionId: 'session-1',
            avatarUrl: 'https://assets.example.test/mina-session.webp'
          }
        });
      })
    );

    await expect(
      uploadSessionParticipantCharacterAvatar('session-1', 'user-1', 'character-1', {
        fileName: 'mina.webp',
        contentType: 'image/webp',
        imageBase64: 'data:image/webp;base64,AAAA'
      })
    ).resolves.toMatchObject({
      characterId: 'character-1',
      sessionId: 'session-1',
      avatarUrl: 'https://assets.example.test/mina-session.webp'
    });
  });

  it('usuwa avatar karty uczestnika sesji przez endpoint powiązania sesja-gracz-postać', async () => {
    authorizeTestSession();

    server.use(
      http.delete(`${rpgSessionsAPI}/session-1/players/user-1/character-sheets/character-1/avatar`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          characterSheet: {
            ...investigator,
            sessionId: 'session-1',
            avatarUrl: null,
            avatarKey: null
          }
        });
      })
    );

    await expect(
      deleteSessionParticipantCharacterAvatar('session-1', 'user-1', 'character-1')
    ).resolves.toMatchObject({
      characterId: 'character-1',
      sessionId: 'session-1',
      avatarUrl: null,
      avatarKey: null
    });
  });
});
