// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LiveSessionToolbox from './LiveSessionToolbox.svelte';
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
        id: 'health',
        label: 'Życie',
        value: 4,
        max: 5,
        min: 0,
        tone: 'health'
      },
      {
        id: 'hunger',
        label: 'Głód',
        value: 1,
        max: 5,
        min: 0,
        tone: 'hunger'
      }
    ]
  },
  {
    characterId: 'character-2',
    userId: 'player-2',
    characterName: 'Evelyn',
    playerName: 'Victor',
    systemId: 'Call of Cthulhu 5e',
    canEdit: false,
    resources: [
      {
        id: 'sanity',
        label: 'Poczytalność',
        value: 42,
        max: 99,
        min: 0,
        tone: 'sanity'
      }
    ]
  }
];

afterEach(() => {
  cleanup();
});

describe('LiveSessionToolbox', () => {
  it('renderuje floating dialog z listą zasobów postaci', async () => {
    render(LiveSessionToolbox, {
      props: {
        characters,
        onResourceChange: vi.fn()
      }
    });

    expect(await screen.findByText('Toolbox sesji')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zasoby' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Zasoby postaci')).toBeInTheDocument();
    expect(screen.getByText('Nadia')).toBeInTheDocument();
    expect(screen.getByText('Evelyn')).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('podgląd')).toBeInTheDocument();
  });

  it('zwija i rozwija okno bez niszczenia stanu floating dialogu', async () => {
    const user = userEvent.setup();

    render(LiveSessionToolbox, {
      props: {
        characters,
        onResourceChange: vi.fn()
      }
    });

    expect(await screen.findByText('Zasoby postaci')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zwiń toolbox' }));

    expect(screen.queryByText('Zasoby postaci')).not.toBeInTheDocument();
    expect(screen.getByText('Toolbox sesji')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rozwiń toolbox' }));

    expect(await screen.findByText('Zasoby postaci')).toBeInTheDocument();
  });

  it('wysyła zmianę zasobu z klikniętej kropki do callbacka integrującego toolbox z kartą postaci', async () => {
    const user = userEvent.setup();
    const onResourceChange = vi.fn();

    render(LiveSessionToolbox, {
      props: {
        characters,
        onResourceChange
      }
    });

    await user.click(await screen.findByRole('button', { name: 'Głód: ustaw 3' }));

    expect(onResourceChange).toHaveBeenCalledWith({
      characterId: 'character-1',
      resourceId: 'hunger',
      value: 3
    });
  });

  it('nie pozwala edytować zasobów postaci w trybie podglądu', async () => {
    render(LiveSessionToolbox, {
      props: {
        characters,
        onResourceChange: vi.fn()
      }
    });

    const sanityDots = await screen.findAllByRole('button', {
      name: /Poczytalność: ustaw/
    });

    expect(sanityDots[0]).toBeDisabled();
  });

  it('pozwala przeciągnąć floating dialog bez zwijania jego zawartości', async () => {
    render(LiveSessionToolbox, {
      props: {
        characters,
        onResourceChange: vi.fn()
      }
    });

    const toolbox = await screen.findByText('Toolbox sesji');
    const floatingDialog = toolbox.closest('div[style]');

    expect(floatingDialog).toBeTruthy();
    const beforeDragTransform = floatingDialog?.getAttribute('style');

    await waitFor(() => {
      expect(floatingDialog?.getAttribute('style')).toContain('translate3d');
    });

    const header = toolbox.parentElement?.parentElement;

    expect(header).toBeTruthy();
    header?.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 300,
        clientY: 180
      })
    );
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 240,
        clientY: 220
      })
    );
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));

    await waitFor(() => {
      expect(floatingDialog?.getAttribute('style')).not.toBe(beforeDragTransform);
    });
    expect(screen.getByText('Zasoby postaci')).toBeInTheDocument();
  });
});
