import type {
  OccupationTemplate,
  VtmAbilityKey,
  VtmAttributeKey,
  VtmClan
} from './types';

export const occupationTemplates: OccupationTemplate[] = [
  {
    key: 'antiquarian',
    label: 'Antykwariusz',
    description: 'Badacz przedmiotów, historii i ukrytych powiązań.',
    occupationSkills: [
      'Appraise',
      'Art/Craft',
      'History',
      'Library Use',
      'Other Language',
      'Persuade',
      'Spot Hidden',
      'Credit Rating'
    ]
  },
  {
    key: 'author',
    label: 'Autor',
    description: 'Twórca tekstów, obserwator ludzi i zbieracz opowieści.',
    occupationSkills: [
      'Art (Literature)',
      'History',
      'Library Use',
      'Occult',
      'Other Language',
      'Own Language',
      'Psychology',
      'Credit Rating'
    ]
  },
  {
    key: 'doctor',
    label: 'Lekarz',
    description: 'Medyk z przygotowaniem naukowym i praktyką kliniczną.',
    occupationSkills: [
      'First Aid',
      'Medicine',
      'Other Language (Latin)',
      'Psychology',
      'Science (Biology)',
      'Science (Pharmacy)',
      'Spot Hidden',
      'Credit Rating'
    ]
  },
  {
    key: 'journalist',
    label: 'Dziennikarz',
    description: 'Śledzi tropy, rozmawia z ludźmi i szuka faktów w archiwach.',
    occupationSkills: [
      'Art/Craft (Photography)',
      'History',
      'Library Use',
      'Own Language',
      'Persuade',
      'Psychology',
      'Spot Hidden',
      'Credit Rating'
    ]
  },
  {
    key: 'private_investigator',
    label: 'Prywatny detektyw',
    description: 'Zawodowiec od obserwacji, akt sprawy i niewygodnych pytań.',
    occupationSkills: [
      'Art/Craft (Photography)',
      'Disguise',
      'Law',
      'Library Use',
      'Persuade',
      'Psychology',
      'Spot Hidden',
      'Credit Rating'
    ]
  },
  {
    key: 'professor',
    label: 'Profesor',
    description: 'Akademik z rozległą wiedzą i obyciem w badaniach.',
    occupationSkills: [
      'Library Use',
      'Other Language',
      'Own Language',
      'Psychology',
      'History',
      'Occult',
      'Science',
      'Credit Rating'
    ]
  }
];

export const personalInterestSkillCatalog = [
  'Accounting',
  'Anthropology',
  'Archaeology',
  'Charm',
  'Climb',
  'Credit Rating',
  'Disguise',
  'Drive Auto',
  'Fast Talk',
  'First Aid',
  'History',
  'Intimidate',
  'Jump',
  'Law',
  'Library Use',
  'Listen',
  'Locksmith',
  'Mechanical Repair',
  'Medicine',
  'Natural World',
  'Occult',
  'Persuade',
  'Psychology',
  'Ride',
  'Science',
  'Spot Hidden',
  'Stealth',
  'Survival',
  'Swim'
];

export const vtmClans: Array<{ key: VtmClan; label: string; disciplines: [string, string, string] }> = [
  { key: 'Brujah', label: 'Brujah', disciplines: ['przyspieszenie', 'potencja', 'prezencja'] },
  { key: 'Gangrel', label: 'Gangrel', disciplines: ['Animalizm', 'odporność', 'potencja'] },
  { key: 'Malkavian', label: 'Malkavian', disciplines: ['nadwraźliwość', 'dominacja', 'prezencja'] },
  { key: 'Nosferatu', label: 'Nosferatu', disciplines: ['Animalizm', 'odporność', 'potencja'] },
  { key: 'Toreador', label: 'Toreador', disciplines: ['nadwraźliwość', 'przyspieszenie', 'prezencja'] },
  { key: 'Tremere', label: 'Tremere', disciplines: ['nadwraźliwość', 'dominacja', 'magia krwi'] },
  { key: 'Ventrue', label: 'Ventrue', disciplines: ['dominacja', 'odporność', 'prezencja'] }
];

export const vtmNatureOptions = [
  'Architect',
  'Autocrat',
  'Bon Vivant',
  'Caregiver',
  'Gallant',
  'Judge',
  'Pedagogue',
  'Rebel',
  'Survivor',
  'Traditionalist'
];

export const vtmDemeanorOptions = [
  'Bravo',
  'Curmudgeon',
  'Director',
  'Enigma',
  'Loner',
  'Optimist',
  'Penitent',
  'Rogue',
  'Stoic',
  'Visionary'
];

export const vtmAttributeGroups = {
  physical: ['Siła', 'Zręczność', 'Wytrzymałość'],
  social: ['Charyzma', 'Manipulacja', 'Opanowanie'],
  mental: ['Inteligencja', 'Spryt', 'Determinacja']
} as const satisfies Record<string, VtmAttributeKey[]>;

export const vtmAbilityGroups = {
  physical: [
    'Atletyka',
    'Bijatyka',
    'Rzemiosło',
    'Prowadzenie pojazdów',
    'Broń palna',
    'Kradzież',
    'Broń biała',
    'Skradanie',
    'Sztuka przetrwania'
  ],
  social: [
    'Rozumienie zwierząt',
    'Etykieta',
    'przebiegłość',
    'Zastraszanie',
    'Przywództwo',
    'Występy publiczne',
    'Perswazja',
    'Intuicja',
    'cwaniactwo'
  ],
  mental: [
    'Wiedza akademicka',
    'Czujność',
    'Finanse',
    'Śledztwo',
    'Medycyna',
    'Okultyzm',
    'Polityka',
    'Nauka',
    'Technologia'
  ]
} as const satisfies Record<string, VtmAbilityKey[]>;
