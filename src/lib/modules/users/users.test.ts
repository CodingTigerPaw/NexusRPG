import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { usersAPI } from '$lib/modules/repository';
import { server } from '../../../test/msw';
import { getUsers } from './users';

describe('getUsers', () => {
  it('pobiera listę graczy z backendu i zwraca kursor paginacji', async () => {
    server.use(
      http.get(usersAPI, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.get('limit')).toBe('2');
        expect(url.searchParams.get('cursor')).toBe('next-page');

        return HttpResponse.json({
          users: [
            { userId: 'player-1', username: 'Mina', email: 'mina@example.test', role: 'player' },
            { userId: 'player-2', username: 'Victor', email: 'victor@example.test', role: 'player' }
          ],
          nextCursor: 'last-page'
        });
      })
    );

    await expect(getUsers({ limit: 2, cursor: 'next-page' })).resolves.toEqual({
      users: [
        { userId: 'player-1', username: 'Mina', email: 'mina@example.test', role: 'player' },
        { userId: 'player-2', username: 'Victor', email: 'victor@example.test', role: 'player' }
      ],
      nextCursor: 'last-page'
    });
  });

  it('normalizuje brak nextCursor do null', async () => {
    server.use(
      http.get(usersAPI, () => {
        return HttpResponse.json({
          users: [{ userId: 'player-1', username: 'Mina' }]
        });
      })
    );

    await expect(getUsers()).resolves.toEqual({
      users: [{ userId: 'player-1', username: 'Mina' }],
      nextCursor: null
    });
  });
});
