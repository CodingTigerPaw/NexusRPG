// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/svelte';
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

    expect(screen.queryByText('Toolbox sesji')).not.toBeInTheDocument();
    expect(screen.queryByText('Zasoby postaci')).not.toBeInTheDocument();
  });

  it('renderuje toolboxa dla GM sesji', async () => {
    render(GmOnlyLiveSessionToolbox, {
      props: {
        canManageSession: true,
        characters,
        onResourceChange: vi.fn()
      }
    });

    expect(await screen.findByText('Toolbox sesji')).toBeInTheDocument();
    expect(screen.getByText('Zasoby postaci')).toBeInTheDocument();
    expect(screen.getByText('Nadia')).toBeInTheDocument();
  });
});
