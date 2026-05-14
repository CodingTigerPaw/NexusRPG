// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GmOnlyLiveSessionToolbox from './GmOnlyLiveSessionToolbox.svelte';
import type { SessionToolboxCharacterSummary } from '../types';

const characters: SessionToolboxCharacterSummary[] = [
  {
    characterId: 'character-1',
    userId: 'player-1',
    characterName: 'Nadia',
    playerName: 'Mina',
    systemId: 'Vampire: The Masquerade',
    canEdit: true,
    resources: [
      {
        id: 'hunger',
        label: 'Głód',
        value: 2,
        max: 5,
        min: 0,
        tone: 'hunger'
      }
    ]
  }
];

afterEach(() => {
  cleanup();
});

describe('GmOnlyLiveSessionToolbox', () => {
  it('nie renderuje toolboxa dla gracza bez uprawnień GM', () => {
    render(GmOnlyLiveSessionToolbox, {
      props: {
        canManageSession: false,
        characters,
        onResourceChange: vi.fn()
      }
    });

    expect(screen.queryByRole('button', { name: 'Dodaj toolbox' })).not.toBeInTheDocument();
    expect(screen.queryByText('Toolbox sesji')).not.toBeInTheDocument();
    expect(screen.queryByText('Zasoby postaci')).not.toBeInTheDocument();
  });

  it('dla GM sesji pokazuje przycisk tworzenia, ale nie renderuje okna domyślnie', () => {
    render(GmOnlyLiveSessionToolbox, {
      props: {
        canManageSession: true,
        characters,
        onResourceChange: vi.fn()
      }
    });

    expect(screen.getByRole('button', { name: 'Dodaj toolbox' })).toBeInTheDocument();
    expect(screen.queryByText('Toolbox sesji 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Zasoby postaci')).not.toBeInTheDocument();
  });

  it('tworzy nową instancję toolboxa po kliknięciu przycisku GM', async () => {
    const user = userEvent.setup();

    render(GmOnlyLiveSessionToolbox, {
      props: {
        canManageSession: true,
        characters,
        onResourceChange: vi.fn()
      }
    });

    await user.click(screen.getByRole('button', { name: 'Dodaj toolbox' }));

    expect(await screen.findByText('Toolbox sesji 1')).toBeInTheDocument();
    expect(screen.getByText('Zasoby postaci')).toBeInTheDocument();
    expect(screen.getByText('Nadia')).toBeInTheDocument();
  });

  it('pozwala GM utworzyć więcej niż jedną niezależną instancję toolboxa', async () => {
    const user = userEvent.setup();

    render(GmOnlyLiveSessionToolbox, {
      props: {
        canManageSession: true,
        characters,
        onResourceChange: vi.fn()
      }
    });

    const createButton = screen.getByRole('button', { name: 'Dodaj toolbox' });

    await user.click(createButton);
    await user.click(createButton);

    expect(await screen.findByText('Toolbox sesji 1')).toBeInTheDocument();
    expect(await screen.findByText('Toolbox sesji 2')).toBeInTheDocument();
    expect(screen.getAllByText('Zasoby postaci')).toHaveLength(2);
  });

  it('pozwala zamknąć pojedynczą instancję toolboxa bez usuwania pozostałych', async () => {
    const user = userEvent.setup();

    render(GmOnlyLiveSessionToolbox, {
      props: {
        canManageSession: true,
        characters,
        onResourceChange: vi.fn()
      }
    });

    const createButton = screen.getByRole('button', { name: 'Dodaj toolbox' });

    await user.click(createButton);
    await user.click(createButton);
    await user.click((await screen.findAllByRole('button', { name: 'Zamknij toolbox' }))[0]);

    await waitFor(() => {
      expect(screen.queryByText('Toolbox sesji 1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Toolbox sesji 2')).toBeInTheDocument();
  });
});
