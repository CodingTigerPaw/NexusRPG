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
import { rpgSessionsAPI } from '$lib/modules/repository';
import { clearStoredAuth, persistAuthSession } from './AuthModule/session';
import {
  addRpgSessionPlayers,
  removeRpgSessionPlayer,
  type RpgSession
} from './rpg-sessions';

const sessionWithParticipant: RpgSession = {
  sessionId: 'session-1',
  ownerUserId: 'gm-1',
  playerUserIds: ['player-1'],
  participants: [
    {
      userId: 'player-1',
      characterId: 'character-1'
    }
  ],
  rpgSystem: 'Call of Cthulhu 5e',
  name: 'Cienie Arkham'
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
        userId: 'gm-1',
        username: 'keeper',
        role: 'gm'
      }
    },
    false
  );
}

describe('rpg sessions participant character binding', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    clearStoredAuth();
    authorizeTestSession();
  });

  afterEach(() => {
    clearStoredAuth();
    vi.unstubAllGlobals();
  });

  it('dodaje gracza z konkretną postacią do sesji i wysyła payload participants', async () => {
    server.use(
      http.post(`${rpgSessionsAPI}/session-1/players`, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        await expect(request.json()).resolves.toEqual({
          participants: [
            {
              userId: 'player-1',
              characterId: 'character-1'
            }
          ]
        });

        return HttpResponse.json({
          session: sessionWithParticipant
        });
      })
    );

    await expect(
      addRpgSessionPlayers('session-1', {
        participants: [
          {
            userId: 'player-1',
            characterId: 'character-1'
          }
        ]
      })
    ).resolves.toEqual(sessionWithParticipant);
  });

  it('koduje sessionId przy dodawaniu uczestnika z postacią', async () => {
    const sessionId = 'session/with space';
    const expectedUrl = `${rpgSessionsAPI}/${encodeURIComponent(sessionId)}/players`;

    server.use(
      http.post(expectedUrl, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        await expect(request.json()).resolves.toMatchObject({
          userId: 'player-1',
          characterId: 'character-1'
        });

        return HttpResponse.json({
          session: {
            ...sessionWithParticipant,
            sessionId
          }
        });
      })
    );

    await expect(
      addRpgSessionPlayers(sessionId, {
        userId: 'player-1',
        characterId: 'character-1'
      })
    ).resolves.toMatchObject({
      sessionId,
      participants: [
        {
          userId: 'player-1',
          characterId: 'character-1'
        }
      ]
    });
  });

  it('mapuje błąd dodania uczestnika, gdy wybrana postać nie istnieje albo nie należy do gracza', async () => {
    server.use(
      http.post(`${rpgSessionsAPI}/session-1/players`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Nie znaleziono sesji RPG albo wybranej karty postaci.'
          },
          {
            status: 404
          }
        );
      })
    );

    await expect(
      addRpgSessionPlayers('session-1', {
        participants: [
          {
            userId: 'player-1',
            characterId: 'missing-character'
          }
        ]
      })
    ).rejects.toThrow('Nie znaleziono sesji RPG albo wybranej karty postaci.');
  });

  it('usuwa gracza z sesji i zwraca sesję bez powiązanej postaci uczestnika', async () => {
    server.use(
      http.delete(`${rpgSessionsAPI}/session-1/players/player-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          session: {
            ...sessionWithParticipant,
            playerUserIds: [],
            participants: []
          },
          removedPlayerUserId: 'player-1',
          removedParticipants: [
            {
              userId: 'player-1',
              characterId: 'character-1'
            }
          ]
        });
      })
    );

    await expect(removeRpgSessionPlayer('session-1', 'player-1')).resolves.toMatchObject({
      sessionId: 'session-1',
      playerUserIds: [],
      participants: []
    });
  });

  it('koduje userId przy usuwaniu uczestnika sesji', async () => {
    const userId = 'player/with space';
    const expectedUrl = `${rpgSessionsAPI}/session-1/players/${encodeURIComponent(userId)}`;

    server.use(
      http.delete(expectedUrl, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          session: {
            ...sessionWithParticipant,
            playerUserIds: [],
            participants: []
          }
        });
      })
    );

    await expect(removeRpgSessionPlayer('session-1', userId)).resolves.toMatchObject({
      participants: []
    });
  });

  it('blokuje usunięcie właściciela sesji z czytelnym komunikatem', async () => {
    server.use(
      http.delete(`${rpgSessionsAPI}/session-1/players/gm-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Nie można usunąć właściciela sesji.'
          },
          {
            status: 400
          }
        );
      })
    );

    await expect(removeRpgSessionPlayer('session-1', 'gm-1')).rejects.toThrow(
      'Nie można usunąć właściciela sesji.'
    );
  });
});
