import type { CharacterSheetDefinition } from './types';

const cocCharacteristics = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'] as const;

const cocDerivedStats = [
  {
    id: 'idea',
    label: 'Idea',
    calculator: 'cocIdea',
    fallback: '0',
    format: 'number'
  },
  {
    id: 'know',
    label: 'Know',
    calculator: 'cocKnow',
    fallback: '0',
    format: 'number'
  },
  {
    id: 'luck',
    label: 'Luck',
    calculator: 'cocLuck',
    fallback: '0',
    format: 'number'
  },
  {
    id: 'sanity',
    label: 'Sanity',
    calculator: 'cocSanity',
    fallback: '0',
    format: 'number'
  },
  {
    id: 'magicPoints',
    label: 'Magic Points',
    calculator: 'cocMagicPoints',
    fallback: '0',
    format: 'number'
  },
  {
    id: 'hitPoints',
    label: 'Hit Points',
    calculator: 'cocHitPoints',
    fallback: '0',
    format: 'number'
  },
  {
    id: 'damageBonus',
    label: 'Damage Bonus',
    calculator: 'cocDamageBonus',
    fallback: '0'
  }
] as const;

function fieldsFromKeys(keys: readonly string[], pathPrefix: string) {
  return keys.map((key) => ({
    label: key,
    path: `${pathPrefix}.${key}`,
    fallback: '0',
    format: 'number' as const
  }));
}

function derivedFieldsFromIds(ids: readonly (typeof cocDerivedStats)[number]['id'][]) {
  return ids.map((id) => {
    const stat = cocDerivedStats.find((entry) => entry.id === id) ?? {
      id,
      label: id,
      calculator: id,
      fallback: '0'
    };

    return {
      label: stat.label,
      derivedStat: id,
      fallback: stat.fallback,
      format: 'format' in stat ? stat.format : undefined
    };
  });
}

export const callOfCthulhuSheetDefinition = {
  id: 'coc5',
  systemName: 'Call of Cthulhu 5e',
  matches(character) {
    return character.backstory?.system === 'Call of Cthulhu 5e';
  },
  derivedStats: cocDerivedStats,
  sections: [
    {
      id: 'identity',
      title: 'Tozsamosc',
      groups: [
        {
          id: 'basic',
          title: 'Postac',
          columns: 2,
          fields: [
            { label: 'Imie', path: 'name', fallback: 'Bez nazwy' },
            { label: 'Wiek', path: 'age', fallback: 'brak danych' },
            { label: 'Profesja', path: 'occupation', fallback: 'brak danych' },
            { label: 'System', path: 'backstory.system', fallback: 'Call of Cthulhu 5e' },
            { label: 'Miejsce urodzenia', path: 'backstory.birthplace', fallback: 'brak danych' },
            { label: 'Miejsce zamieszkania', path: 'backstory.residence', fallback: 'brak danych' }
          ]
        },
        {
          id: 'background',
          title: 'Tlo',
          columns: 2,
          fields: [
            {
              label: 'Opis osobisty',
              path: 'backstory.personalDescription',
              fallback: 'brak opisu',
              format: 'longText'
            },
            {
              label: 'Ideologia',
              path: 'backstory.ideology',
              fallback: 'brak wpisu',
              format: 'longText'
            }
          ]
        }
      ]
    },
    {
      id: 'characteristics',
      title: 'Cechy',
      groups: [
        {
          id: 'characteristics',
          title: 'Cechy podstawowe',
          columns: 3,
          fields: fieldsFromKeys(cocCharacteristics, 'characteristics')
        },
        {
          id: 'derived',
          title: 'Statystyki pochodne',
          columns: 3,
          fields: derivedFieldsFromIds([
            'idea',
            'know',
            'luck',
            'sanity',
            'magicPoints',
            'hitPoints',
            'damageBonus'
          ])
        }
      ]
    },
    {
      id: 'skills',
      title: 'Umiejetnosci',
      groups: [
        {
          id: 'core-rolls',
          title: 'Testy glowne',
          columns: 3,
          fields: derivedFieldsFromIds(['idea', 'know', 'luck'])
        },
        {
          id: 'skills',
          title: 'Pakiet umiejetnosci',
          columns: 3,
          fields: [
            { label: 'Accounting', path: 'skills.Accounting', fallback: '0', format: 'number' },
            { label: 'Anthropology', path: 'skills.Anthropology', fallback: '0', format: 'number' },
            { label: 'Archaeology', path: 'skills.Archaeology', fallback: '0', format: 'number' },
            { label: 'Charm', path: 'skills.Charm', fallback: '0', format: 'number' },
            { label: 'Credit Rating', path: 'skills.Credit Rating', fallback: '0', format: 'number' },
            { label: 'Disguise', path: 'skills.Disguise', fallback: '0', format: 'number' },
            { label: 'Drive Auto', path: 'skills.Drive Auto', fallback: '0', format: 'number' },
            { label: 'Fast Talk', path: 'skills.Fast Talk', fallback: '0', format: 'number' },
            { label: 'First Aid', path: 'skills.First Aid', fallback: '0', format: 'number' },
            { label: 'History', path: 'skills.History', fallback: '0', format: 'number' },
            { label: 'Library Use', path: 'skills.Library Use', fallback: '0', format: 'number' },
            { label: 'Listen', path: 'skills.Listen', fallback: '0', format: 'number' },
            { label: 'Medicine', path: 'skills.Medicine', fallback: '0', format: 'number' },
            { label: 'Occult', path: 'skills.Occult', fallback: '0', format: 'number' },
            { label: 'Persuade', path: 'skills.Persuade', fallback: '0', format: 'number' },
            { label: 'Psychology', path: 'skills.Psychology', fallback: '0', format: 'number' },
            { label: 'Science', path: 'skills.Science', fallback: '0', format: 'number' },
            { label: 'Spot Hidden', path: 'skills.Spot Hidden', fallback: '0', format: 'number' },
            { label: 'Stealth', path: 'skills.Stealth', fallback: '0', format: 'number' },
            { label: 'Survival', path: 'skills.Survival', fallback: '0', format: 'number' }
          ]
        }
      ]
    },
    {
      id: 'notes',
      title: 'Notatki',
      groups: [
        {
          id: 'notes',
          title: 'Notatki gracza',
          columns: 1,
          fields: [{ label: 'Notatki', path: 'notes', fallback: 'brak notatek', format: 'longText' }]
        }
      ]
    }
  ]
} satisfies CharacterSheetDefinition;
