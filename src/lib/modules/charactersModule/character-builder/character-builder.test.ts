import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
  browser: true,
  building: false,
  dev: false,
  version: 'test'
}));

import { MemoryStorage } from '../../../../test/browser-storage';
import {
  calculateCoCDerivedStats,
  calculateVtmDerivedStats,
  clearCharacterDraft,
  createCharacterBuilder,
  deleteCharacterDraft,
  getCharacterCreationStrategy,
  hasCharacterDrafts,
  isCoCDraft,
  isVtmDraft,
  listCharacterDrafts,
  loadCharacterDraft,
  loadCharacterDraftById,
  saveCharacterDraft,
  type CharacterCreationStrategy,
  type CharacterDraft,
  type CoCDraft,
  type SavedCharacterDraft,
  type VtmDraft
} from '.';

const draftStorageKey = 'coc_character_builder:user-1';

function readRawDrafts(userId = 'user-1') {
  return JSON.parse(localStorage.getItem(`coc_character_builder:${userId}`) ?? '[]') as SavedCharacterDraft[];
}

function getCoCStrategy() {
  return getCharacterCreationStrategy('coc5') as CharacterCreationStrategy<CoCDraft>;
}

function getVtmStrategy() {
  return getCharacterCreationStrategy('vtm') as CharacterCreationStrategy<VtmDraft>;
}

function createNamedCoCDraft(name = 'Mina Harker') {
  const draft = getCoCStrategy().createEmptyDraft();
  draft.name = name;
  draft.age = '31';
  draft.occupationKey = 'antiquarian';
  draft.birthplace = 'Kraków';
  draft.residence = 'Londyn';
  draft.personalDescription = 'Badaczka antyków.';
  draft.ideology = 'Prawda ponad komfort.';
  draft.notes = 'Tajemniczy medalion.';
  draft.characteristics = {
    STR: 50,
    CON: 55,
    POW: 60,
    DEX: 65,
    APP: 45,
    SIZ: 70,
    INT: 80,
    EDU: 75
  };
  draft.personalInterestSkills = ['Accounting', 'Library Use'];
  return draft;
}

function createNamedVtmDraft(name = 'Victor Vale') {
  const draft = getVtmStrategy().createEmptyDraft();
  draft.name = name;
  draft.age = '142';
  draft.clan = 'Tremere';
  draft.concept = 'Okultystyczny doradca';
  draft.birthplace = 'Wiedeń';
  draft.residence = 'Kraków';
  draft.sire = 'Evelyn Ash';
  draft.hunger = 9;
  draft.generation = '12';
  draft.attributes.Siła = 7;
  draft.attributes.Opanowanie = 2;
  draft.attributes.Determinacja = 3;
  draft.abilities.Okultyzm = 4;
  draft.backgrounds.Resources = 8;
  draft.virtues.Conscience = 4;
  draft.virtues['Self-Control'] = 3;
  draft.disciplines.Primary = 'Auspex';
  draft.disciplines.Secondary = 'Dominacja';
  draft.disciplinePowers = [
    {
      discipline: ' Auspex ',
      name: ' Heightened Senses ',
      description: ' Wyostrzone zmysły. '
    },
    {
      discipline: '',
      name: '',
      description: ''
    }
  ];
  return draft;
}

describe('character builder module', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tworzy builder CoC z pustego draftu i zwraca snapshot bez współdzielenia referencji', () => {
    const strategy = getCoCStrategy();
    const builder = createCharacterBuilder(strategy);

    const firstSnapshot = builder.snapshot();
    builder.setField('name', 'Mina Harker').setRecordValue('characteristics', 'STR', 55);
    const secondSnapshot = builder.snapshot();

    expect(isCoCDraft(firstSnapshot)).toBe(true);
    expect(firstSnapshot.name).toBe('');
    expect(firstSnapshot.characteristics.STR).not.toBe(secondSnapshot.characteristics.STR);
    expect(secondSnapshot).toMatchObject({
      system: 'coc5',
      name: 'Mina Harker',
      characteristics: {
        STR: 55
      }
    });
  });

  it('nie mutuje seed draftu przekazanego do buildera', () => {
    const seed = createNamedCoCDraft();
    const builder = createCharacterBuilder(getCoCStrategy(), seed);

    builder.setField('name', 'Lucy Westenra').setRecordValue('characteristics', 'POW', 90);

    expect(seed.name).toBe('Mina Harker');
    expect(seed.characteristics.POW).toBe(60);
    expect(builder.snapshot()).toMatchObject({
      name: 'Lucy Westenra',
      characteristics: {
        POW: 90
      }
    });
  });

  it('ignoruje setRecordValue dla pól, które nie są rekordami', () => {
    const builder = createCharacterBuilder(getCoCStrategy(), createNamedCoCDraft());

    builder.setRecordValue('name', 'unused-field', 'Nie powinno zmienić nazwy');

    expect(builder.snapshot().name).toBe('Mina Harker');
  });

  it('randomizuje cechy CoC w klasycznych zakresach i wielokrotnościach pięciu', () => {
    const builder = createCharacterBuilder(getCoCStrategy(), createNamedCoCDraft());

    builder.randomize();
    const characteristics = (builder.snapshot() as CoCDraft).characteristics;

    expect(characteristics.STR).toBeGreaterThanOrEqual(15);
    expect(characteristics.STR).toBeLessThanOrEqual(90);
    expect(characteristics.SIZ).toBeGreaterThanOrEqual(40);
    expect(characteristics.SIZ).toBeLessThanOrEqual(90);
    expect(characteristics.EDU).toBeGreaterThanOrEqual(30);
    expect(characteristics.EDU).toBeLessThanOrEqual(105);
    Object.values(characteristics).forEach((value) => {
      expect(value % 5).toBe(0);
    });
  });

  it('buduje payload CoC z przyciętą nazwą, profesją, cechami, skillami i backstory', () => {
    const draft = createNamedCoCDraft('  Mina Harker  ');
    const payload = createCharacterBuilder(getCoCStrategy(), draft).buildPayload();

    expect(payload).toMatchObject({
      name: 'Mina Harker',
      rpgSystem: 'Call of Cthulhu 5e',
      occupation: 'Antykwariusz',
      age: 31,
      characteristics: draft.characteristics,
      backstory: {
        system: 'Call of Cthulhu 5e',
        birthplace: 'Kraków',
        residence: 'Londyn',
        personalDescription: 'Badaczka antyków.',
        ideology: 'Prawda ponad komfort.'
      },
      inventory: [],
      notes: 'Tajemniczy medalion.'
    });
    expect(payload.skills).toMatchObject({
      Accounting: 40,
      'Library Use': 70,
      Idea: 80,
      Know: 75,
      Luck: 60
    });
  });

  it('wylicza statystyki pochodne CoC z cech draftu', () => {
    expect(calculateCoCDerivedStats(createNamedCoCDraft().characteristics)).toEqual({
      idea: 80,
      know: 75,
      luck: 60,
      sanity: 60,
      magicPoints: 12,
      hitPoints: 12,
      damageBonus: '0'
    });
  });

  it('buduje payload Wampira z clampem kropek, głodu i oczyszczonymi mocami dyscyplin', () => {
    const payload = createCharacterBuilder(
      getVtmStrategy(),
      createNamedVtmDraft('  Victor Vale  ')
    ).buildPayload();

    expect(payload).toMatchObject({
      name: 'Victor Vale',
      rpgSystem: 'Vampire: The Masquerade',
      occupation: 'Tremere - Okultystyczny doradca',
      age: 142,
      characteristics: {
        Siła: 5,
        Opanowanie: 2,
        Determinacja: 3,
        generation: '12',
        hunger: 5
      },
      skills: {
        Okultyzm: 4,
        Backgrounds: {
          Resources: 5
        },
        Virtues: {
          Conscience: 4,
          'Self-Control': 3
        },
        Disciplines: {
          Primary: 'Auspex',
          Secondary: 'Dominacja'
        },
        DisciplinePowers: [
          {
            discipline: 'Auspex',
            name: 'Heightened Senses',
            description: 'Wyostrzone zmysły.'
          }
        ]
      },
      backstory: {
        system: 'Vampire: The Masquerade',
        clan: 'Tremere',
        concept: 'Okultystyczny doradca',
        sire: 'Evelyn Ash'
      },
      inventory: []
    });
  });

  it('wylicza parametry pochodne Wampira z atrybutów, cnót i generacji', () => {
    expect(calculateVtmDerivedStats(createNamedVtmDraft())).toEqual({
      humanity: 7,
      willpower: 5,
      bloodPool: 11
    });
  });

  it('zapisuje nowy draft w localStorage pod kluczem użytkownika', () => {
    const draft = createNamedCoCDraft();

    const draftId = saveCharacterDraft('user-1', draft);

    const storedDrafts = readRawDrafts();
    expect(draftId).toEqual(expect.any(String));
    expect(localStorage.getItem(draftStorageKey)).toContain('Mina Harker');
    expect(storedDrafts).toHaveLength(1);
    expect(storedDrafts[0]).toMatchObject({
      id: draftId,
      userId: 'user-1',
      system: 'coc5',
      updatedAt: '2026-05-15T10:00:00.000Z',
      draft: {
        name: 'Mina Harker'
      }
    });
  });

  it('nadpisuje istniejący draft o tym samym id zamiast tworzyć duplikat', () => {
    const firstDraft = createNamedCoCDraft('Pierwsza wersja');
    const secondDraft = createNamedCoCDraft('Druga wersja');

    saveCharacterDraft('user-1', firstDraft, 'draft-1');
    vi.setSystemTime(new Date('2026-05-15T11:00:00.000Z'));
    const draftId = saveCharacterDraft('user-1', secondDraft, 'draft-1');

    expect(draftId).toBe('draft-1');
    expect(readRawDrafts()).toHaveLength(1);
    expect(readRawDrafts()[0]).toMatchObject({
      id: 'draft-1',
      updatedAt: '2026-05-15T11:00:00.000Z',
      draft: {
        name: 'Druga wersja'
      }
    });
  });

  it('trzyma drafty różnych użytkowników w osobnych kolekcjach localStorage', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft('Mina'), 'draft-user-1');
    saveCharacterDraft('user-2', createNamedCoCDraft('Lucy'), 'draft-user-2');

    expect(listCharacterDrafts('user-1')).toEqual([
      expect.objectContaining({
        id: 'draft-user-1',
        name: 'Mina'
      })
    ]);
    expect(listCharacterDrafts('user-2')).toEqual([
      expect.objectContaining({
        id: 'draft-user-2',
        name: 'Lucy'
      })
    ]);
  });

  it('sortuje listę szkiców po updatedAt malejąco i pokazuje fallback nazwy', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft('Starszy'), 'older');
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    saveCharacterDraft('user-1', createNamedVtmDraft(''), 'newer');

    expect(listCharacterDrafts('user-1')).toEqual([
      expect.objectContaining({
        id: 'newer',
        system: 'vtm',
        name: 'Szkic bez nazwy',
        updatedAt: '2026-05-15T12:00:00.000Z'
      }),
      expect.objectContaining({
        id: 'older',
        system: 'coc5',
        name: 'Starszy'
      })
    ]);
  });

  it('ładuje zapisany draft po id oraz zwraca null dla brakującego szkicu', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft(), 'draft-1');

    expect(loadCharacterDraftById('user-1', 'draft-1')).toMatchObject({
      id: 'draft-1',
      draft: {
        name: 'Mina Harker'
      }
    });
    expect(loadCharacterDraftById('user-1', 'missing')).toBeNull();
  });

  it('ładuje pusty draft, gdy draftId nie istnieje albo system nie pasuje', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft('Mina'), 'draft-1');

    expect(loadCharacterDraft('user-1', 'coc5').name).toBe('');
    expect(loadCharacterDraft('user-1', 'coc5', 'missing').name).toBe('');
    expect(loadCharacterDraft('user-1', 'vtm', 'draft-1')).toMatchObject({
      system: 'vtm',
      name: ''
    });
  });

  it('klonuje draft przy ładowaniu, żeby zmiany w UI nie mutowały kopii ze storage', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft('Mina'), 'draft-1');

    const loadedDraft = loadCharacterDraft('user-1', 'coc5', 'draft-1') as CoCDraft;
    loadedDraft.name = 'Zmieniona lokalnie';
    loadedDraft.characteristics.STR = 99;

    expect(loadCharacterDraft('user-1', 'coc5', 'draft-1')).toMatchObject({
      name: 'Mina',
      characteristics: {
        STR: 50
      }
    });
  });

  it('usuwa draft i aktualizuje hasCharacterDrafts', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft(), 'draft-1');

    expect(hasCharacterDrafts('user-1')).toBe(true);
    deleteCharacterDraft('user-1', 'draft-1');

    expect(listCharacterDrafts('user-1')).toEqual([]);
    expect(hasCharacterDrafts('user-1')).toBe(false);
  });

  it('clearCharacterDraft ignoruje brak id i usuwa wskazany szkic', () => {
    saveCharacterDraft('user-1', createNamedCoCDraft(), 'draft-1');

    clearCharacterDraft('user-1', null);
    expect(hasCharacterDrafts('user-1')).toBe(true);

    clearCharacterDraft('user-1', 'draft-1');
    expect(hasCharacterDrafts('user-1')).toBe(false);
  });

  it('bezpiecznie traktuje uszkodzony JSON w localStorage jako brak draftów', () => {
    localStorage.setItem(draftStorageKey, '{bad json');

    expect(listCharacterDrafts('user-1')).toEqual([]);
    expect(loadCharacterDraftById('user-1', 'draft-1')).toBeNull();
  });

  it('bezpiecznie traktuje nie-tablicę w localStorage jako brak draftów', () => {
    localStorage.setItem(draftStorageKey, JSON.stringify({ id: 'draft-1' }));

    expect(listCharacterDrafts('user-1')).toEqual([]);
  });

  it('obsługuje błąd odczytu localStorage jako pustą listę szkiców', () => {
    class ThrowingReadStorage extends MemoryStorage {
      getItem(): string | null {
        throw new Error('Storage read failed');
      }
    }

    vi.stubGlobal('localStorage', new ThrowingReadStorage());

    expect(listCharacterDrafts('user-1')).toEqual([]);
    expect(loadCharacterDraft('user-1', 'coc5', 'draft-1')).toMatchObject({
      system: 'coc5',
      name: ''
    });
  });

  it('zgłasza kontrolowany błąd, gdy zapis draftu do localStorage się nie powiedzie', () => {
    class ThrowingWriteStorage extends MemoryStorage {
      setItem() {
        throw new Error('Quota exceeded');
      }
    }

    vi.stubGlobal('localStorage', new ThrowingWriteStorage());

    expect(() => saveCharacterDraft('user-1', createNamedCoCDraft())).toThrow(
      'Nie udało się zapisać szkicu postaci w localStorage.'
    );
  });

  it('rozpoznaje typy draftów przez type guardy systemowe', () => {
    const cocDraft: CharacterDraft = createNamedCoCDraft();
    const vtmDraft: CharacterDraft = createNamedVtmDraft();

    expect(isCoCDraft(cocDraft)).toBe(true);
    expect(isVtmDraft(cocDraft)).toBe(false);
    expect(isVtmDraft(vtmDraft)).toBe(true);
    expect(isCoCDraft(vtmDraft)).toBe(false);
  });

  it('odtwarza stare drafty Wampira z brakującymi polami przez wartości domyślne', () => {
    const partialDraft = {
      ...createNamedVtmDraft(),
      abilities: {
        Okultyzm: 4
      },
      disciplinePowers: undefined
    } as unknown as VtmDraft;
    saveCharacterDraft('user-1', partialDraft, 'legacy-vtm');

    const loadedDraft = loadCharacterDraft('user-1', 'vtm', 'legacy-vtm') as VtmDraft;

    expect(loadedDraft.abilities.Okultyzm).toBe(4);
    expect(loadedDraft.abilities.Atletyka).toBeDefined();
    expect(loadedDraft.disciplinePowers).toEqual([
      {
        discipline: '',
        name: '',
        description: ''
      }
    ]);
  });
});
