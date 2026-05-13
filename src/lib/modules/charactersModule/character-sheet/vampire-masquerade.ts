import type { CharacterSheetDefinition } from "./types";

const vtmAttributeGroups = {
  physical: ["Siła", "Zręczność", "Wytrzymałość"],
  social: ["Charyzma", "Manipulacja", "Opanowanie"],
  mental: ["Inteligencja", "Spryt", "Determinacja"],
} as const;

const vtmAbilityGroups = {
  physical: [
    "Atletyka",
    "Bijatyka",
    "Rzemiosło",
    "Prowadzenie pojazdów",
    "Broń palna",
    "Kradzież",
    "Broń biała",
    "Skradanie",
    "Sztuka przetrwania",
  ],
  social: [
    "Rozumienie zwierząt",
    "Etykieta",
    "przebiegłość",
    "Zastraszanie",
    "Przywództwo",
    "Występy publiczne",
    "Perswazja",
    "Intuicja",
    "cwaniactwo",
  ],
  mental: [
    "Wiedza akademicka",
    "Czujność",
    "Finanse",
    "Śledztwo",
    "Medycyna",
    "Okultyzm",
    "Polityka",
    "Nauka",
    "Technologia",
  ],
} as const;

function fieldsFromKeys(keys: readonly string[], pathPrefix: string) {
  return keys.map((key) => ({
    label: key,
    path: `${pathPrefix}.${key}`,
    fallback: "0",
    format: "ratingDots" as const,
  }));
}

export const vampireMasqueradeSheetDefinition = {
  id: "vtm",
  systemName: "Vampire: The Masquerade",
  matches(character) {
    return character.backstory?.system === "Vampire: The Masquerade";
  },
  derivedStats: [
    {
      id: "humanity",
      label: "Humanity",
      calculator: "vtmLegacyHumanity",
      fallback: "0",
      format: "number",
    },
    {
      id: "willpower",
      label: "Willpower",
      calculator: "vtmV5Willpower",
      fallback: "0",
      format: "number",
    },
    {
      id: "health",
      label: "Punkty życia",
      calculator: "vtmHealth",
      fallback: "3",
      format: "number",
    },
    {
      id: "bloodPool",
      label: "Blood Pool",
      calculator: "vtmLegacyBloodPool",
      fallback: "10",
      format: "number",
    },
    {
      id: "bloodPotency",
      label: "Blood Potency",
      calculator: "vtmBloodPotency",
      fallback: "nie dotyczy tej karty",
      format: "number",
    },
  ],
  sections: [
    {
      id: "identity",
      title: "Podstawowe",
      groups: [
        {
          id: "basic",
          title: "Postac",
          columns: 2,
          fields: [
            { label: "Imie", path: "name", fallback: "Bez nazwy" },
            { label: "Wiek", path: "age", fallback: "brak danych" },
            { label: "Klan", path: "backstory.clan", fallback: "brak danych" },
            {
              label: "Koncept",
              path: "backstory.concept",
              fallback: "brak danych",
            },
            {
              label: "Natura",
              path: "backstory.nature",
              fallback: "brak danych",
            },
            {
              label: "Maska",
              path: "backstory.demeanor",
              fallback: "brak danych",
            },
            {
              label: "Stwórca",
              path: "backstory.sire",
              fallback: "brak danych",
            },
            {
              label: "Generacja",
              path: "characteristics.generation",
              fallback: "13",
            },
          ],
        },
        {
          id: "background",
          title: "",
          columns: 2,
          fields: [
            {
              label: "Miejsce urodzenia",
              path: "backstory.birthplace",
              fallback: "brak danych",
            },
            {
              label: "Miejsce zamieszkania",
              path: "backstory.residence",
              fallback: "brak danych",
            },
            {
              label: "Opis osobisty",
              path: "backstory.personalDescription",
              fallback: "brak opisu",
              format: "longText",
            },
            {
              label: "Ideologia",
              path: "backstory.ideology",
              fallback: "brak wpisu",
              format: "longText",
            },
          ],
        },
      ],
    },
    {
      id: "bloodParameters",
      title: "Pochodne",
      groups: [
        {
          id: "derived",
          title: "Parametry",
          columns: 3,
          fields: [
            {
              label: "Głód",
              path: "characteristics.hunger",
              fallback: "0",
              format: "number",
            },
            {
              label: "Człowieczeństwo",
              derivedStat: "humanity",
              fallback: "0",
              format: "number",
            },
            {
              label: "Siła woli",
              derivedStat: "willpower",
              fallback: "0",
              format: "number",
            },
            {
              label: "Punkty życia",
              derivedStat: "health",
              fallback: "3",
              format: "number",
            },
            {
              label: "Blood Pool",
              derivedStat: "bloodPool",
              fallback: "10",
              format: "number",
            },
            {
              label: "Blood Potency",
              derivedStat: "bloodPotency",
              fallback: "nie dotyczy tej karty",
              format: "number",
            },
          ],
        },
      ],
    },
    {
      id: "traits",
      title: "Atrybuty i zdolnosci",
      groups: [
        {
          id: "physicalAttributes",
          title: "Atrybuty fizyczne",
          categoryTitle: "Atrybuty",
          columns: 3,
          fields: fieldsFromKeys(
            vtmAttributeGroups.physical,
            "characteristics",
          ),
        },
        {
          id: "socialAttributes",
          title: "Atrybuty spoleczne",
          columns: 3,
          fields: fieldsFromKeys(vtmAttributeGroups.social, "characteristics"),
        },
        {
          id: "mentalAttributes",
          title: "Atrybuty mentalne",
          columns: 3,
          fields: fieldsFromKeys(vtmAttributeGroups.mental, "characteristics"),
        },
        {
          id: "physicalAbilities",
          title: "Zdolnosci fizyczne",
          categoryTitle: "Umiejętności",
          columns: 3,
          fields: fieldsFromKeys(vtmAbilityGroups.physical, "skills"),
        },
        {
          id: "socialAbilities",
          title: "Zdolnosci spoleczne",
          columns: 3,
          fields: fieldsFromKeys(vtmAbilityGroups.social, "skills"),
        },
        {
          id: "mentalAbilities",
          title: "Zdolnosci mentalne",
          columns: 3,
          fields: fieldsFromKeys(vtmAbilityGroups.mental, "skills"),
        },
      ],
    },
    {
      id: "advantages",
      title: "Dyscypliny",
      groups: [
        {
          id: "disciplines",
          title: "Dyscypliny",
          columns: 3,
          fields: [
            {
              label: "Główna",
              path: "skills.Disciplines.Primary",
              fallback: "brak danych",
            },
            {
              label: "Dodatkowa",
              path: "skills.Disciplines.Secondary",
              fallback: "brak danych",
            },
            // { label: 'Tertiary', path: 'skills.Disciplines.Tertiary', fallback: 'brak danych' },
            {
              label: "Dyscypliny klanu",
              path: "backstory.clanDisciplines",
              fallback: "brak danych",
              format: "list",
            },
          ],
        },
        {
          id: "disciplinePowers",
          title: "Moce dyscyplin",
          columns: 1,
          fields: [
            {
              label: "Umiejętności z dyscyplin",
              path: "skills.DisciplinePowers",
              fallback: "brak wpisanych mocy",
              format: "namedDescriptions",
            },
          ],
        },
        // {
        //   id: "backgrounds",
        //   title: "Backgroundy",
        //   columns: 3,
        //   fields: fieldsFromKeys(
        //     [
        //       "Allies",
        //       "Contacts",
        //       "Generation",
        //       "Herd",
        //       "Influence",
        //       "Resources",
        //     ],
        //     "skills.Backgrounds",
        //   ),
        // },
        // {
        //   id: "virtues",
        //   title: "Cnoty",
        //   columns: 3,
        //   fields: fieldsFromKeys(
        //     ["Conscience", "Self-Control", "Courage"],
        //     "skills.Virtues",
        //   ),
        // },
      ],
    },
    {
      id: "notes",
      title: "Notatki",
      groups: [
        {
          id: "notes",
          title: "Notatki gracza",
          columns: 1,
          fields: [
            {
              label: "Notatki",
              path: "notes",
              fallback: "brak notatek",
              format: "longText",
            },
          ],
        },
      ],
    },
  ],
} satisfies CharacterSheetDefinition;
