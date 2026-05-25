// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

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
  goto: vi.fn(),
  page: {
    url: new URL('http://localhost/characters/new')
  }
}));

vi.mock('$app/navigation', () => ({
  goto: mocks.goto
}));

vi.mock('$app/state', () => ({
  page: mocks.page
}));

import NewCharacterPage from './new/+page.svelte';
import DraftsPage from './drafts/+page.svelte';
import { server } from '../../test/msw';
import { MemoryStorage } from '../../test/browser-storage';
import { charactersAPI } from '$lib/modules/repository';
import { clearStoredAuth, persistAuthSession } from '$lib/modules/AuthModule/session';
import {
  getCharacterCreationStrategy,
  listCharacterDrafts,
  saveCharacterDraft,
  type CharacterCreationStrategy,
  type CoCDraft,
  type VtmDraft
} from '$lib/modules/charactersModule/character-builder';

const draftStorageKey = 'coc_character_builder:user-1';

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

function readRawDrafts() {
  return JSON.parse(localStorage.getItem(draftStorageKey) ?? '[]') as Array<{
    id: string;
    system: string;
    draft: {
      name: string;
      age?: string;
      birthplace?: string;
      residence?: string;
      clan?: string;
      concept?: string;
    };
  }>;
}

function createStoredCoCDraft(id = 'draft-1') {
  const draft = (getCharacterCreationStrategy('coc5') as CharacterCreationStrategy<CoCDraft>).createEmptyDraft();
  draft.name = 'Mina Harker';
  draft.age = '31';
  draft.birthplace = 'Kraków';
  draft.residence = 'Londyn';
  saveCharacterDraft('user-1', draft, id);
  return id;
}

function createStoredVtmDraft(id = 'draft-vtm') {
  const draft = (getCharacterCreationStrategy('vtm') as CharacterCreationStrategy<VtmDraft>).createEmptyDraft();
  draft.name = 'Victor Vale';
  draft.age = '142';
  draft.clan = 'Tremere';
  draft.concept = 'Okultystyczny doradca';
  saveCharacterDraft('user-1', draft, id);
  return id;
}

async function openIdentityStep(user = userEvent.setup()) {
  await screen.findByRole('button', { name: /System RPG/ });
  await user.click(screen.getByRole('button', { name: /Tożsamość/ }));
}

async function openSummaryStep(user = userEvent.setup()) {
  await screen.findByRole('button', { name: /System RPG/ });
  await user.click(screen.getByRole('button', { name: /Podsumowanie/ }));
}

describe('character builder UI', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    clearStoredAuth();
    authorizeTestSession();
    mocks.goto.mockReset();
    mocks.page.url = new URL('http://localhost/characters/new');
  });

  afterEach(() => {
    cleanup();
    clearStoredAuth();
    vi.unstubAllGlobals();
  });

  it('przekierowuje kreator do logowania, gdy użytkownik nie ma sesji', async () => {
    clearStoredAuth();

    render(NewCharacterPage);

    await waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith('/');
    });
  });

  it('pokazuje domyślny kreator CoC po autoryzacji', async () => {
    render(NewCharacterPage);

    expect(await screen.findByRole('heading', { name: 'Kreator postaci' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Zew Cthulhu 5e/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wampir: Maskarada/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /System RPG/ })).toBeInTheDocument();
  });

  it('automatycznie zapisuje zmiany tożsamości CoC do draftu w localStorage', async () => {
    const user = userEvent.setup();

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina Harker');
    await user.clear(screen.getByLabelText('Wiek'));
    await user.type(screen.getByLabelText('Wiek'), '31');

    expect(await screen.findByText('Szkic zapisany lokalnie. Możesz wrócić do niego później.')).toBeInTheDocument();
    await waitFor(() => {
      const drafts = readRawDrafts();
      expect(drafts).toHaveLength(1);
      expect(drafts[0]).toMatchObject({
        system: 'coc5',
        draft: {
          name: 'Mina Harker',
          age: 31
        }
      });
    });
  });

  it('nadpisuje ten sam draft przy kolejnych zmianach zamiast tworzyć duplikaty', async () => {
    const user = userEvent.setup();

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina');
    await user.type(screen.getByLabelText('Miejsce urodzenia'), 'Kraków');

    await waitFor(() => {
      expect(readRawDrafts()).toHaveLength(1);
      expect(readRawDrafts()[0].draft).toMatchObject({
        name: 'Mina',
        birthplace: 'Kraków'
      });
    });
  });

  it('pokazuje kontrolowany błąd, gdy localStorage odrzuci zapis draftu', async () => {
    class ThrowingWriteStorage extends MemoryStorage {
      setItem() {
        throw new Error('Quota exceeded');
      }
    }
    const user = userEvent.setup();

    vi.stubGlobal('localStorage', new ThrowingWriteStorage());

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina');

    expect(await screen.findByText('Nie udało się zapisać szkicu postaci w localStorage.')).toBeInTheDocument();
    expect(screen.queryByText('Szkic zapisany lokalnie. Możesz wrócić do niego później.')).not.toBeInTheDocument();
  });

  it('wczytuje istniejący draft po draftId z query stringa', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('draft-1');
    mocks.page.url = new URL('http://localhost/characters/new?draftId=draft-1');

    render(NewCharacterPage);

    await openIdentityStep(user);

    expect(screen.getByLabelText('Imię i nazwisko')).toHaveValue('Mina Harker');
    expect(screen.getByLabelText('Wiek')).toHaveValue(31);
    expect(screen.getByLabelText('Miejsce urodzenia')).toHaveValue('Kraków');
  });

  it('po powrocie do kreatora odtwarza wcześniej zapisany draft z localStorage', async () => {
    const user = userEvent.setup();

    const firstRender = render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina Harker');
    await user.clear(screen.getByLabelText('Wiek'));
    await user.type(screen.getByLabelText('Wiek'), '31');
    await user.type(screen.getByLabelText('Miejsce urodzenia'), 'Kraków');
    await user.type(screen.getByLabelText('Miejsce zamieszkania'), 'Londyn');

    await waitFor(() => {
      expect(readRawDrafts()).toHaveLength(1);
    });
    const draftId = readRawDrafts()[0].id;

    firstRender.unmount();
    cleanup();
    mocks.page.url = new URL(`http://localhost/characters/new?draftId=${draftId}`);

    render(NewCharacterPage);

    await openIdentityStep(user);

    expect(screen.getByLabelText('Imię i nazwisko')).toHaveValue('Mina Harker');
    expect(screen.getByLabelText('Wiek')).toHaveValue(31);
    expect(screen.getByLabelText('Miejsce urodzenia')).toHaveValue('Kraków');
    expect(screen.getByLabelText('Miejsce zamieszkania')).toHaveValue('Londyn');
  });

  it('kontynuacja wznowionego draftu aktualizuje ten sam wpis localStorage bez duplikatu', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('draft-1');
    mocks.page.url = new URL('http://localhost/characters/new?draftId=draft-1');

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Miejsce zamieszkania'), ' - dzielnica portowa');

    await waitFor(() => {
      const drafts = readRawDrafts();
      expect(drafts).toHaveLength(1);
      expect(drafts[0]).toMatchObject({
        id: 'draft-1',
        draft: {
          name: 'Mina Harker',
          birthplace: 'Kraków',
          residence: 'Londyn - dzielnica portowa'
        }
      });
    });
  });

  it('wznowienie draftu Wampira automatycznie przełącza kreator na właściwy system', async () => {
    const user = userEvent.setup();
    createStoredVtmDraft('draft-vtm');
    mocks.page.url = new URL('http://localhost/characters/new?draftId=draft-vtm');

    render(NewCharacterPage);

    await openIdentityStep(user);

    expect(screen.getByRole('heading', { name: 'Tożsamość kainity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Imię i nazwisko')).toHaveValue('Victor Vale');
    expect(screen.getByLabelText('Wiek')).toHaveValue(142);
    expect(screen.getByLabelText('Klan')).toHaveValue('Tremere');
    expect(screen.getByLabelText('Koncept')).toHaveValue('Okultystyczny doradca');
  });

  it('nie ładuje draftu o tym samym id zapisanego dla innego użytkownika', async () => {
    const otherUserDraft = (getCharacterCreationStrategy('coc5') as CharacterCreationStrategy<CoCDraft>).createEmptyDraft();
    otherUserDraft.name = 'Lucy Westenra';
    otherUserDraft.birthplace = 'Whitby';
    saveCharacterDraft('user-2', otherUserDraft, 'shared-draft-id');
    mocks.page.url = new URL('http://localhost/characters/new?draftId=shared-draft-id');

    render(NewCharacterPage);

    await openIdentityStep(userEvent.setup());

    expect(screen.getByLabelText('Imię i nazwisko')).toHaveValue('');
    expect(screen.getByLabelText('Miejsce urodzenia')).toHaveValue('');
    expect(localStorage.getItem('coc_character_builder:user-2')).toContain('Lucy Westenra');
  });

  it('dla brakującego draftId startuje od pustego szkicu', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('existing-draft');
    mocks.page.url = new URL('http://localhost/characters/new?draftId=missing-draft');

    render(NewCharacterPage);

    await openIdentityStep(user);

    expect(screen.getByLabelText('Imię i nazwisko')).toHaveValue('');
    expect(screen.getByLabelText('Miejsce urodzenia')).toHaveValue('');
  });

  it('po przełączeniu systemu zapisuje osobny draft Wampira', async () => {
    const user = userEvent.setup();

    render(NewCharacterPage);

    await user.click(await screen.findByRole('button', { name: /Wampir: Maskarada/ }));
    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Victor Vale');
    await user.selectOptions(screen.getByLabelText('Klan'), 'Tremere');
    await user.type(screen.getByLabelText('Koncept'), 'Okultystyczny doradca');

    await waitFor(() => {
      expect(readRawDrafts()).toHaveLength(1);
      expect(readRawDrafts()[0]).toMatchObject({
        system: 'vtm',
        draft: {
          name: 'Victor Vale',
          clan: 'Tremere'
        }
      });
    });
  });

  it('blokuje utworzenie postaci bez imienia zanim wyśle request do backendu', async () => {
    const user = userEvent.setup();
    const createRequest = vi.fn();
    server.use(
      http.post(charactersAPI, () => {
        createRequest();
        return HttpResponse.json({});
      })
    );

    render(NewCharacterPage);

    await openSummaryStep(user);
    await user.click(screen.getByRole('button', { name: 'Utwórz postać' }));

    expect(await screen.findByText('Imię i nazwisko postaci jest wymagane.')).toBeInTheDocument();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('wysyła payload CoC do backendu, czyści draft i wraca do listy po sukcesie', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(charactersAPI, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer id-token');
        await expect(request.json()).resolves.toMatchObject({
          name: 'Mina Harker',
          rpgSystem: 'Call of Cthulhu 5e',
          age: 31,
          backstory: {
            system: 'Call of Cthulhu 5e'
          },
          inventory: []
        });

        return HttpResponse.json({
          characterSheet: {
            characterId: 'character-1',
            userId: 'user-1',
            name: 'Mina Harker',
            rpgSystem: 'Call of Cthulhu 5e'
          }
        });
      })
    );

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina Harker');
    await user.clear(screen.getByLabelText('Wiek'));
    await user.type(screen.getByLabelText('Wiek'), '31');
    await openSummaryStep(user);
    await user.click(screen.getByRole('button', { name: 'Utwórz postać' }));

    await waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith('/characters');
      expect(listCharacterDrafts('user-1')).toEqual([]);
    });
  });

  it('utworzenie postaci ze wznowionego draftu czyści tylko ten draft, zostawiając inne szkice', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('draft-to-submit');
    createStoredVtmDraft('draft-to-keep');
    mocks.page.url = new URL('http://localhost/characters/new?draftId=draft-to-submit');
    server.use(
      http.post(charactersAPI, async ({ request }) => {
        await expect(request.json()).resolves.toMatchObject({
          name: 'Mina Harker',
          rpgSystem: 'Call of Cthulhu 5e'
        });

        return HttpResponse.json({
          characterSheet: {
            characterId: 'character-1',
            userId: 'user-1',
            name: 'Mina Harker',
            rpgSystem: 'Call of Cthulhu 5e'
          }
        });
      })
    );

    render(NewCharacterPage);

    await openSummaryStep(user);
    await user.click(screen.getByRole('button', { name: 'Utwórz postać' }));

    await waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith('/characters');
    });
    expect(listCharacterDrafts('user-1')).toEqual([
      expect.objectContaining({
        id: 'draft-to-keep',
        name: 'Victor Vale',
        system: 'vtm'
      })
    ]);
  });

  it('pokazuje błąd backendu przy tworzeniu postaci i zostawia draft lokalnie', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(charactersAPI, () =>
        HttpResponse.json(
          {
            message: 'Nie udało się utworzyć karty postaci.'
          },
          {
            status: 500
          }
        )
      )
    );

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina Harker');
    await openSummaryStep(user);
    await user.click(screen.getByRole('button', { name: 'Utwórz postać' }));

    expect(await screen.findByText('Nie udało się utworzyć karty postaci.')).toBeInTheDocument();
    expect(mocks.goto).not.toHaveBeenCalledWith('/characters');
    expect(listCharacterDrafts('user-1')).toHaveLength(1);
  });

  it('czyści bieżący draft po kliknięciu Wyczyść', async () => {
    const user = userEvent.setup();

    render(NewCharacterPage);

    await openIdentityStep(user);
    await user.type(screen.getByLabelText('Imię i nazwisko'), 'Mina Harker');
    expect(await screen.findByText('Szkic zapisany lokalnie. Możesz wrócić do niego później.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wyczyść' }));

    await waitFor(() => {
      expect(listCharacterDrafts('user-1')).toEqual([]);
    });
    expect(screen.getByRole('button', { name: /System RPG/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Imię i nazwisko')).not.toBeInTheDocument();
  });

  it('lista szkiców pokazuje zapisane drafty i pozwala wznowić wybrany szkic', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('draft-1');
    createStoredVtmDraft('draft-2');

    render(DraftsPage);

    expect(await screen.findByRole('heading', { name: 'Niedokończone postacie' })).toBeInTheDocument();
    expect(await screen.findByText('Mina Harker')).toBeInTheDocument();
    expect(screen.getByText('Victor Vale')).toBeInTheDocument();
    expect(screen.getByText(/Zew Cthulhu 5e/)).toBeInTheDocument();
    expect(screen.getByText(/Wampir: Maskarada/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Wznów' })[0]);

    expect(mocks.goto).toHaveBeenCalledWith(expect.stringMatching(/^\/characters\/new\?draftId=draft-/));
  });

  it('lista szkiców wznawia konkretnie kliknięty draft, a nie pierwszy z listy', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('draft-coc');
    createStoredVtmDraft('draft-vtm');

    render(DraftsPage);

    const victorCard = (await screen.findByText('Victor Vale')).closest('.rounded-lg');
    expect(victorCard).not.toBeNull();

    await user.click(within(victorCard as HTMLElement).getByRole('button', { name: 'Wznów' }));

    expect(mocks.goto).toHaveBeenCalledWith('/characters/new?draftId=draft-vtm');
  });

  it('lista szkiców pozwala usunąć draft bez requestu do backendu', async () => {
    const user = userEvent.setup();
    createStoredCoCDraft('draft-1');

    render(DraftsPage);

    expect(await screen.findByText('Mina Harker')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń szkic' }));

    expect(await screen.findByText('Brak niedokończonych postaci.')).toBeInTheDocument();
    expect(listCharacterDrafts('user-1')).toEqual([]);
  });

  it('lista szkiców przekierowuje do logowania bez sesji', async () => {
    clearStoredAuth();

    render(DraftsPage);

    await waitFor(() => {
      expect(mocks.goto).toHaveBeenCalledWith('/');
    });
  });
});
