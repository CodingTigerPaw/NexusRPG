import type { CharacterCreationStrategy, CharacterDraft } from "./types";

export class CharacterBuilder<TDraft extends CharacterDraft> {
  private readonly strategy: CharacterCreationStrategy<TDraft>;
  private draft: TDraft;

  constructor(strategy: CharacterCreationStrategy<TDraft>, seed?: TDraft) {
    this.strategy = strategy;
    // utworzenie draftu postaci lub załadowanie istniejącej z local storage
    this.draft = seed
      ? this.strategy.cloneDraft(seed)
      : this.strategy.createEmptyDraft();
  }

  //metoda buildera do ustawienia pojedyńczego wpisu np.
  //builder
  //.setField('name', 'Anna')
  //.setField('age', '30');

  setField<K extends keyof TDraft>(key: K, value: TDraft[K]) {
    this.draft[key] = value;
    return this;
  }
  //metoda buildera do wpisów obiektów np.
  //atributes:{
  // Siła: 2,
  //Zręczność: 2
  //}
  // setRecordValue('attributes', 'Siła', 3)

  setRecordValue<K extends keyof TDraft>(
    key: K,
    field: string,
    value: unknown,
  ) {
    //Pobiera aktualną wartość pola.
    const currentValue = this.draft[key];

    if (
      currentValue &&
      typeof currentValue === "object" &&
      !Array.isArray(currentValue)
    ) {
      this.draft[key] = {
        ...(currentValue as Record<string, unknown>),
        [field]: value,
      } as TDraft[K];
    }

    return this;
  }

  // Metoda do losowania wybranych części draftu.
  // Obecnie realne znaczenie ma głównie dla Cthulhu, gdzie można losować cechy.

  randomize() {
    if (this.strategy.randomize) {
      this.draft = this.strategy.randomize(this.draft);
    }

    return this;
  }

  //zwraca aktualny stan draftu
  snapshot() {
    return this.strategy.cloneDraft(this.draft);
  }
  // buduje payload do backendu
  buildPayload() {
    return this.strategy.buildPayload(this.draft);
  }
}
// Funkcja pomocnicza/factory.
// Tworzy builder bez konieczności pisania new CharacterBuilder(...) w komponentach.

export function createCharacterBuilder<TDraft extends CharacterDraft>(
  strategy: CharacterCreationStrategy<TDraft>,
  draft?: TDraft,
) {
  return new CharacterBuilder(strategy, draft);
}
