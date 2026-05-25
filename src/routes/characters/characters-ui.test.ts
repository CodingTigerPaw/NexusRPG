// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';

vi.mock('$app/environment', () => ({
  browser: true,
  building: false,
  dev: false,
  version: 'test'
}));

vi.mock('$env/dynamic/public', () => ({
  env: {}
}));

const mocks = vi.hoisted(() => ({
  goto: vi.fn()
}));

vi.mock('$app/navigation', () => ({
  goto: mocks.goto
}));

vi.mock('$app/state', () => ({
  page: {
    params: {
      characterId: 'character-1'
    }
  }
}));

import CharactersPage from './+page.svelte';
import CharacterDetailsPage from './[characterId]/+page.svelte';
import { server } from '../../test/msw';
import { charactersAPI, rpgSessionsAPI } from '$lib/modules/repository';
import { clearStoredAuth, persistAuthSession } from '$lib/modules/AuthModule/session';
import type { CharacterCard } from '$lib/modules/characters';

const cthulhuCharacter: CharacterCard = {
  userId: 'user-1',
  characterId: 'character-1',
  name: 'Mina Harker',
  rpgSystem: 'Call of Cthulhu 5e',
  occupation: 'Antykwariuszka',
  age: 31,
  characteristics: {
    STR: 50,
    CON: 55,
    POW: 60,
    DEX: 65,
    APP: 45,
    SIZ: 70,
    INT: 80,
    EDU: 75,
    sanity: 42
  },
  skills: {
    Accounting: 35,
    'Library Use': 70,
    Luck: 37
  },
  backstory: {
    system: 'Call of Cthulhu 5e',
    birthplace: 'Kraków',
    residence: 'Londyn',
    personalDescription: 'Badaczka antyków.',
    ideology: 'Prawda jest ważniejsza niż komfort.'
  },
  notes: 'Tajemniczy medalion',
  avatarUrl: 'https://assets.example.test/mina.webp',
  updatedAt: '2026-05-14T11:00:00.000Z'
};

const vampireCharacter: CharacterCard = {
  userId: 'user-1',
  characterId: 'character-2',
  name: 'Victor Vale',
  rpgSystem: 'Vampire: The Masquerade',
  age: 142,
  sessionId: 'session-1',
  characteristics: {
    Siła: 3,
    Zręczność: 2,
    Wytrzymałość: 4,
    Charyzma: 2,
    Manipulacja: 3,
    Opanowanie: 2,
    Inteligencja: 4,
    Spryt: 3,
    Determinacja: 3,
    hunger: 2,
    generation: 12,
    bloodPotency: 1
  },
  skills: {
    Atletyka: 2,
    Bijatyka: 3,
    'Broń biała': 2,
    Perswazja: 3,
    Okultyzm: 4,
    Virtues: {
      Conscience: 4,
      'Self-Control': 3,
      Courage: 2
    },
    Disciplines: {
      Primary: 'Auspex',
      Secondary: 'Dominacja'
    }
  },
  backstory: {
    system: 'Vampire: The Masquerade',
    clan: 'Tremere',
    concept: 'Okultystyczny doradca',
    nature: 'Badacz',
    demeanor: 'Dżentelmen',
    sire: 'Evelyn Ash',
    birthplace: 'Wiedeń',
    residence: 'Kraków',
    personalDescription: 'Elegancki, chłodny i uważny.',
    ideology: 'Wiedza wymaga ceny.'
  },
  updatedAt: '2026-05-13T09:00:00.000Z'
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

function mockSessionList() {
  server.use(
    http.get(rpgSessionsAPI, ({ request }) => {
      expect(request.headers.get('authorization')).toBe('Bearer id-token');

      return HttpResponse.json({
        userId: 'user-1',
        sessions: [
          {
            sessionId: 'session-1',
            ownerUserId: 'gm-1',
            playerUserIds: ['user-1'],
            rpgSystem: 'Vampire: The Masquerade',
            name: 'Nocne sekrety'
          }
        ],
        nextCursor: null
      });
    })
  );
}

beforeEach(() => {
  mocks.goto.mockReset();
  clearStoredAuth();
  authorizeTestSession();
});

afterEach(() => {
  cleanup();
  clearStoredAuth();
  vi.unstubAllGlobals();
});

describe('characters UI', () => {
  it('pokazuje spinner listy postaci zanim dane zostaną pobrane', async () => {
    server.use(
      http.get(charactersAPI, async () => {
        await delay(50);

        return HttpResponse.json({
          userId: 'user-1',
          characterSheets: [cthulhuCharacter],
          nextCursor: null
        });
      })
    );
    mockSessionList();

    render(CharactersPage);

    expect(screen.getByRole('status', { name: 'Pobieranie kart postaci...' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Otwórz kartę postaci Mina Harker' })).toBeInTheDocument();
  });

  it('wyświetla pobraną listę postaci użytkownika wraz z metadanymi i sesją', async () => {
    server.use(
      http.get(charactersAPI, ({ request }) => {
        const url = new URL(request.url);

        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        expect(url.searchParams.get('limit')).toBe('25');

        return HttpResponse.json({
          userId: 'user-1',
          characterSheets: [cthulhuCharacter, vampireCharacter],
          nextCursor: null
        });
      })
    );
    mockSessionList();

    render(CharactersPage);

    expect(await screen.findByRole('heading', { name: 'Postacie' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Otwórz kartę postaci Mina Harker' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otwórz kartę postaci Victor Vale' })).toBeInTheDocument();
    expect(screen.getByText('Call of Cthulhu 5e')).toBeInTheDocument();
    expect(screen.getByText('Vampire: The Masquerade')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('brak')).toBeInTheDocument();
    expect(screen.getByText('Nocne sekrety')).toBeInTheDocument();
    expect(screen.getByAltText('Awatar postaci Mina Harker')).toHaveAttribute(
      'src',
      'https://assets.example.test/mina.webp'
    );
  });

  it('wyświetla empty state, gdy użytkownik nie ma żadnych postaci', async () => {
    server.use(
      http.get(charactersAPI, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          userId: 'user-1',
          characterSheets: [],
          nextCursor: null
        });
      })
    );
    mockSessionList();

    render(CharactersPage);

    expect(await screen.findByText('Nie znaleziono kart postaci.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Otwórz kartę postaci/ })).not.toBeInTheDocument();
  });

  it('pobiera kolejną stronę postaci i dopisuje ją do listy', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(charactersAPI, ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get('cursor') === 'next-page') {
          expect(url.searchParams.get('limit')).toBe('25');

          return HttpResponse.json({
            userId: 'user-1',
            characterSheets: [vampireCharacter],
            nextCursor: null
          });
        }

        expect(url.searchParams.get('limit')).toBe('25');
        expect(url.searchParams.get('cursor')).toBeNull();

        return HttpResponse.json({
          userId: 'user-1',
          characterSheets: [cthulhuCharacter],
          nextCursor: 'next-page'
        });
      })
    );
    mockSessionList();

    render(CharactersPage);

    expect(await screen.findByRole('button', { name: 'Otwórz kartę postaci Mina Harker' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Otwórz kartę postaci Victor Vale' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(await screen.findByRole('button', { name: 'Otwórz kartę postaci Victor Vale' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).not.toBeInTheDocument();
  });

  it('pokazuje błąd kolejnej strony bez usuwania już pobranych postaci', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(charactersAPI, ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get('cursor') === 'broken-page') {
          return HttpResponse.json(
            {
              message: 'Nie udało się pobrać kolejnej strony.'
            },
            {
              status: 500
            }
          );
        }

        return HttpResponse.json({
          userId: 'user-1',
          characterSheets: [cthulhuCharacter],
          nextCursor: 'broken-page'
        });
      })
    );
    mockSessionList();

    render(CharactersPage);

    expect(await screen.findByRole('button', { name: 'Otwórz kartę postaci Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(await screen.findByText('Nie udało się pobrać kolejnej strony.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otwórz kartę postaci Mina Harker' })).toBeInTheDocument();
  });

  it('przekierowuje listę postaci do logowania, gdy użytkownik nie ma sesji', async () => {
    clearStoredAuth();

    render(CharactersPage);

    await waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith('/');
    });
  });

  it('po kliknięciu karty postaci przechodzi do szczegółów wybranej postaci', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(charactersAPI, () => {
        return HttpResponse.json({
          userId: 'user-1',
          characterSheets: [cthulhuCharacter],
          nextCursor: null
        });
      })
    );
    mockSessionList();

    render(CharactersPage);

    await user.click(await screen.findByRole('button', { name: 'Otwórz kartę postaci Mina Harker' }));

    expect(mocks.goto).toHaveBeenCalledWith('/characters/character-1');
  });

  it('przycisk powrotu ze szczegółów prowadzi do listy postaci', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wroc do listy' }));

    expect(mocks.goto).toHaveBeenCalledWith('/characters');
  });

  it('pokazuje błąd pobierania szczegółów postaci z backendu', async () => {
    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json(
          {
            message: 'Nie udało się pobrać tej postaci.'
          },
          {
            status: 500
          }
        );
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByText('Nie udało się pobrać tej postaci.')).toBeInTheDocument();
  });

  it('przekierowuje szczegóły postaci do logowania, gdy użytkownik nie ma sesji', async () => {
    clearStoredAuth();

    render(CharacterDetailsPage);

    await waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith('/');
    });
  });

  it('renderuje szczegóły konkretnej postaci i pola data-driven karty', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      })
    );

    render(CharacterDetailsPage);

    expect(screen.getByRole('status', { name: 'Pobieranie karty postaci...' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();
    expect(screen.getAllByText('Call of Cthulhu 5e').length).toBeGreaterThan(0);
    expect(screen.getAllByAltText('Awatar postaci Mina Harker')[0]).toHaveAttribute(
      'src',
      'https://assets.example.test/mina.webp'
    );
    expect(screen.getByText('Postać nie jest przypisana do żadnej sesji.')).toBeInTheDocument();
    expect(screen.getByText('Antykwariuszka')).toBeInTheDocument();
    expect(screen.getByText('Kraków')).toBeInTheDocument();
    expect(screen.getByText('Londyn')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cechy' }));

    await waitFor(() => {
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Idea')).toBeInTheDocument();
      expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
      expect(screen.getByText('Luck')).toBeInTheDocument();
      expect(screen.getByText('37%')).toBeInTheDocument();
      expect(screen.getByText('Sanity')).toBeInTheDocument();
      expect(screen.getByText('42%')).toBeInTheDocument();
      expect(screen.getByText('Magic Points')).toBeInTheDocument();
      expect(screen.getByText('Hit Points')).toBeInTheDocument();
      expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: 'Umiejetnosci' }));

    await waitFor(() => {
      expect(screen.getByText('Accounting')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('Library Use')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  it('renderuje surowy podgląd danych dla postaci bez definicji data-driven', async () => {
    const customCharacter: CharacterCard = {
      ...cthulhuCharacter,
      characterId: 'custom-character',
      name: 'Bez Systemu',
      rpgSystem: 'System Autorski',
      backstory: {
        system: 'System Autorski'
      }
    };

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: customCharacter
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 3, name: 'Bez Systemu' })).toBeInTheDocument();
    expect(screen.getByText(/Dla tej karty nie ma jeszcze definicji data-driven/)).toBeInTheDocument();
    expect(screen.getByText(/"rpgSystem": "System Autorski"/)).toBeInTheDocument();
  });

  it('renderuje szczegóły karty Wampira i jej wartości pochodne jako właściwe elementy UI', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          characterSheet: vampireCharacter
        });
      }),
      http.get(`${rpgSessionsAPI}/session-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          session: {
            sessionId: 'session-1',
            ownerUserId: 'gm-1',
            playerUserIds: ['user-1'],
            rpgSystem: 'Vampire: The Masquerade',
            name: 'Nocne sekrety'
          }
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Victor Vale' })).toBeInTheDocument();
    expect(screen.getAllByText('Vampire: The Masquerade').length).toBeGreaterThan(0);
    expect(await screen.findByText('Tremere')).toBeInTheDocument();
    expect(screen.getByText('Okultystyczny doradca')).toBeInTheDocument();
    expect(screen.getByText('Nocne sekrety')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pochodne' }));

    await waitFor(() => {
      expect(screen.getByText('Parametry')).toBeInTheDocument();
      expect(screen.getByLabelText('Głód: 2 z 5')).toBeInTheDocument();
      expect(screen.getByLabelText('Człowieczeństwo: 7 z 10')).toBeInTheDocument();
      expect(screen.getByLabelText('Siła woli: 5 z 5')).toBeInTheDocument();
      expect(screen.getByLabelText('Punkty życia: 7 z 7')).toBeInTheDocument();
      expect(screen.getByLabelText('Blood Pool: 11 z 11')).toBeInTheDocument();
      expect(screen.getByText('Blood Potency')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Atrybuty i zdolnosci' }));

    await waitFor(() => {
      expect(screen.getByText('Atrybuty fizyczne')).toBeInTheDocument();
      expect(screen.getByLabelText('Siła: 3 z 5')).toBeInTheDocument();
      expect(screen.getByLabelText('Wytrzymałość: 4 z 5')).toBeInTheDocument();
      expect(screen.getByLabelText('Okultyzm: 4 z 5')).toBeInTheDocument();
    });
  });

  it('odrzuca upload avatara o niedozwolonym typie bez requestu do backendu', async () => {
    const user = userEvent.setup({ applyAccept: false });

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('Plik awatara'),
      new File(['not-image'], 'avatar.gif', {
        type: 'image/gif'
      })
    );

    expect(screen.getByText('Obsługiwane formaty avatara to JPEG, PNG albo WebP.')).toBeInTheDocument();
  });

  it('odrzuca zbyt duży avatar bez requestu do backendu', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('Plik awatara'),
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'too-large.png', {
        type: 'image/png'
      })
    );

    expect(screen.getByText('Awatar może mieć maksymalnie 2 MB.')).toBeInTheDocument();
  });

  it('po wybraniu pliku avatara wysyła upload do backendu i pokazuje zaktualizowany avatar', async () => {
    const user = userEvent.setup();
    const uploadedCharacter = {
      ...cthulhuCharacter,
      avatarUrl: 'https://assets.example.test/mina-new.webp',
      avatarUpdatedAt: '2026-05-14T12:00:00.000Z'
    };

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      }),
      http.post(`${charactersAPI}/character-1/avatar`, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        const payload = await request.json();
        expect(payload).toMatchObject({
          fileName: 'mina-new.webp',
          contentType: 'image/webp'
        });
        expect((payload as { imageBase64?: string }).imageBase64).toMatch(
          /^data:image\/webp;base64,/
        );

        return HttpResponse.json({
          characterSheet: uploadedCharacter
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    const avatarInput = screen.getByLabelText('Plik awatara');
    const file = new File(['new-avatar'], 'mina-new.webp', {
      type: 'image/webp'
    });

    await user.upload(avatarInput, file);

    expect(await screen.findByText('Awatar został zapisany.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByAltText('Awatar postaci Mina Harker')[0]).toHaveAttribute(
        'src',
        'https://assets.example.test/mina-new.webp'
      );
    });
  });

  it('pokazuje błąd uploadu avatara i zostawia poprzedni obraz', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      }),
      http.post(`${charactersAPI}/character-1/avatar`, () => {
        return HttpResponse.json(
          {
            message: 'Nie udało się zapisać avatara.'
          },
          {
            status: 500
          }
        );
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('Plik awatara'),
      new File(['new-avatar'], 'mina-new.png', {
        type: 'image/png'
      })
    );

    expect(await screen.findByText('Nie udało się zapisać avatara.')).toBeInTheDocument();
    expect(screen.getAllByAltText('Awatar postaci Mina Harker')[0]).toHaveAttribute(
      'src',
      'https://assets.example.test/mina.webp'
    );
  });

  it('usuwa avatar postaci przez backend i aktualizuje widok szczegółów', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      }),
      http.delete(`${charactersAPI}/character-1/avatar`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json({
          characterSheet: {
            ...cthulhuCharacter,
            avatarUrl: null,
            avatarKey: null,
            avatarUpdatedAt: null
          }
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();
    expect(screen.getAllByAltText('Awatar postaci Mina Harker').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Usuń awatar' }));

    expect(await screen.findByText('Awatar został usunięty.')).toBeInTheDocument();
    expect(screen.getByText('Brak awatara')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuń awatar' })).not.toBeInTheDocument();
  });

  it('pokazuje błąd usuwania avatara i zostawia przycisk usuwania', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      }),
      http.delete(`${charactersAPI}/character-1/avatar`, () => {
        return HttpResponse.json(
          {
            message: 'Nie udało się usunąć avatara.'
          },
          {
            status: 500
          }
        );
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń awatar' }));

    expect(await screen.findByText('Nie udało się usunąć avatara.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuń awatar' })).toBeInTheDocument();
    expect(screen.getAllByAltText('Awatar postaci Mina Harker')[0]).toHaveAttribute(
      'src',
      'https://assets.example.test/mina.webp'
    );
  });

  it('blokuje usunięcie postaci przypisanej do sesji i pokazuje alert', async () => {
    const user = userEvent.setup();
    const alert = vi.fn();
    const confirm = vi.fn(() => true);
    const deleteRequest = vi.fn();
    vi.stubGlobal('alert', alert);
    vi.stubGlobal('confirm', confirm);

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: vampireCharacter
        });
      }),
      http.get(`${rpgSessionsAPI}/session-1`, () => {
        return HttpResponse.json({
          session: {
            sessionId: 'session-1',
            ownerUserId: 'gm-1',
            playerUserIds: ['user-1'],
            rpgSystem: 'Vampire: The Masquerade',
            name: 'Nocne sekrety'
          }
        });
      }),
      http.delete(`${charactersAPI}/character-1`, () => {
        deleteRequest();

        return HttpResponse.json({
          message: 'Character deleted'
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Victor Vale' })).toBeInTheDocument();
    expect(await screen.findByText('Nocne sekrety')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń postać' }));

    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Nie można usunąć postaci "Victor Vale"'));
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Nocne sekrety'));
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteRequest).not.toHaveBeenCalled();
    expect(mocks.goto).not.toHaveBeenCalledWith('/characters');
  });

  it('nie usuwa postaci, gdy użytkownik anuluje potwierdzenie', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: {
            ...cthulhuCharacter,
            avatarUrl: null
          }
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń postać' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Usunąć postać "Mina Harker"?'));
    expect(mocks.goto).not.toHaveBeenCalledWith('/characters');
  });

  it('usuwa avatar przed usunięciem postaci i wraca do listy po sukcesie', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => true);
    const deletedAvatar = vi.fn();
    const deletedCharacter = vi.fn();
    vi.stubGlobal('confirm', confirm);

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      }),
      http.delete(`${charactersAPI}/character-1/avatar`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        deletedAvatar();

        return HttpResponse.json({
          characterSheet: {
            ...cthulhuCharacter,
            avatarUrl: null,
            avatarKey: null
          }
        });
      }),
      http.delete(`${charactersAPI}/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        deletedCharacter();

        return HttpResponse.json({
          message: 'Character deleted'
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń postać' }));

    await waitFor(() => {
      expect(deletedAvatar).toHaveBeenCalledTimes(1);
      expect(deletedCharacter).toHaveBeenCalledTimes(1);
      expect(mocks.goto).toHaveBeenCalledWith('/characters');
    });
  });

  it('pokazuje błąd usunięcia postaci bez nawigowania do listy', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => true);
    const deleteRequest = vi.fn();
    vi.stubGlobal('confirm', confirm);

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: {
            ...cthulhuCharacter,
            avatarUrl: null,
            avatarKey: null
          }
        });
      }),
      http.delete(`${charactersAPI}/character-1`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        deleteRequest();

        return HttpResponse.json(
          {
            message: 'Nie udało się usunąć karty postaci.'
          },
          {
            status: 500
          }
        );
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń postać' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Usunąć postać "Mina Harker"?'));
    expect(deleteRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Nie udało się usunąć karty postaci.')).toBeInTheDocument();
    expect(mocks.goto).not.toHaveBeenCalledWith('/characters');
  });

  it('przerywa usuwanie postaci, gdy usunięcie avatara przed kasowaniem karty się nie powiedzie', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => true);
    const deleteCharacterRequest = vi.fn();
    vi.stubGlobal('confirm', confirm);

    server.use(
      http.get(`${charactersAPI}/character-1`, () => {
        return HttpResponse.json({
          characterSheet: cthulhuCharacter
        });
      }),
      http.delete(`${charactersAPI}/character-1/avatar`, ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');

        return HttpResponse.json(
          {
            message: 'Nie udało się usunąć avatara przed skasowaniem postaci.'
          },
          {
            status: 500
          }
        );
      }),
      http.delete(`${charactersAPI}/character-1`, () => {
        deleteCharacterRequest();

        return HttpResponse.json({
          message: 'Character deleted'
        });
      })
    );

    render(CharacterDetailsPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mina Harker' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń postać' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Usunąć postać "Mina Harker"?'));
    expect(await screen.findByText('Nie udało się usunąć avatara przed skasowaniem postaci.')).toBeInTheDocument();
    expect(deleteCharacterRequest).not.toHaveBeenCalled();
    expect(mocks.goto).not.toHaveBeenCalledWith('/characters');
  });

  it('wyświetla komunikat błędu listy postaci z backendu', async () => {
    server.use(
      http.get(charactersAPI, () => {
        return HttpResponse.json(
          {
            message: 'Nie udało się pobrać kart.'
          },
          {
            status: 500
          }
        );
      }),
      http.get(rpgSessionsAPI, () => {
        return HttpResponse.json({
          userId: 'user-1',
          sessions: [],
          nextCursor: null
        });
      })
    );

    render(CharactersPage);

    expect(await screen.findByText('Nie udało się pobrać kart.')).toBeInTheDocument();
  });
});
