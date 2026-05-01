<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { getCurrentUser } from '$lib/modules/auth';
  import {
    calculateCoCDerivedStats,
    calculateVtmDerivedStats,
    clearCharacterDraft,
    createCharacterBuilder,
    getCharacterCreationStrategy,
    getCharacterSystemSummaries,
    getClanTemplate,
    getOccupationTemplate,
    isCoCDraft,
    isVtmDraft,
    loadCharacterDraft,
    loadCharacterDraftById,
    saveCharacterDraft,
    vtmDisciplineCatalog,
    type CharacterDraft,
    type CharacteristicKey,
    type GameSystemId,
    type VtmAbilityKey,
    type VtmAttributeKey,
    type VtmBackgroundKey,
    type VtmDisciplineKey,
    type VtmDisciplinePower,
    type VtmVirtueKey
  } from '$lib/modules/charactersModule/character-builder';
  import {
    vtmAbilityGroups,
    vtmAttributeGroups,
    vtmClans,
    vtmDemeanorOptions,
    vtmNatureOptions,
    occupationTemplates,
    personalInterestSkillCatalog
  } from '$lib/modules/charactersModule/character-builder/catalogs';
  import { createCharacter } from '$lib/modules/characters';
  import { requireAuth } from '$lib/modules/rbac';

  const characteristicOrder: CharacteristicKey[] = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'];
  const vtmBackgroundKeys: VtmBackgroundKey[] = ['Allies', 'Contacts', 'Generation', 'Herd', 'Influence', 'Resources'];
  const vtmVirtueKeys: VtmVirtueKey[] = ['Conscience', 'Self-Control', 'Courage'];
  const vtmDisciplineKeys: VtmDisciplineKey[] = ['Primary', 'Secondary', 'Tertiary'];
  const vtmAttributeGroupEntries = Object.entries(vtmAttributeGroups) as Array<
    [string, readonly VtmAttributeKey[]]
  >;
  const vtmAbilityGroupEntries = Object.entries(vtmAbilityGroups) as Array<
    [string, readonly VtmAbilityKey[]]
  >;
  const gameSystems = getCharacterSystemSummaries();

  let stepIndex = $state(0);
  let system = $state<GameSystemId>('coc5');
  let draft = $state<CharacterDraft>(getCharacterCreationStrategy('coc5').createEmptyDraft());
  let currentDraftId = $state<string | null>(null);
  let userId = $state('');
  let loadingDraft = $state(true);
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let savedMessage = $state('');

  const strategy = $derived(getCharacterCreationStrategy(system));
  const steps = $derived(['System RPG', ...strategy.getStepLabels()]);
  const builder = $derived(createCharacterBuilder(strategy as never, draft as never));
  const cocDerivedStats = $derived(isCoCDraft(draft) ? calculateCoCDerivedStats(draft.characteristics) : null);
  const vtmDerivedStats = $derived(isVtmDraft(draft) ? calculateVtmDerivedStats(draft) : null);
  const occupation = $derived(isCoCDraft(draft) ? getOccupationTemplate(draft.occupationKey) : null);
  const clan = $derived(isVtmDraft(draft) ? getClanTemplate(draft.clan) : null);
  const requestedDraftId = $derived(page.url.searchParams.get('draftId'));
  const draftExists = $derived(Boolean(currentDraftId));

  onMount(async () => {
    const authenticated = await requireAuth();

    if (!authenticated) {
      return;
    }

    const user = getCurrentUser();

    if (!user?.userId) {
      await goto('/characters');
      return;
    }

    userId = user.userId;
    currentDraftId = requestedDraftId;

    if (requestedDraftId) {
      const storedDraft = loadCharacterDraftById(user.userId, requestedDraftId);

      if (storedDraft) {
        system = storedDraft.system;
        draft = loadCharacterDraft(user.userId, storedDraft.system, requestedDraftId);
      } else {
        draft = loadCharacterDraft(user.userId, system);
      }
    } else {
      draft = loadCharacterDraft(user.userId, system);
    }

    loadingDraft = false;
  });

  function persistDraft() {
    if (!userId) {
      return;
    }

    currentDraftId = saveCharacterDraft(userId, draft, currentDraftId);
    savedMessage = 'Szkic zapisany lokalnie. Możesz wrócić do niego później.';
  }

  function mutateDraft(mutator: (builder: { setField: Function; setRecordValue: Function; randomize: Function; snapshot: Function }) => void) {
    const nextBuilder = createCharacterBuilder(strategy as never, draft as never) as {
      setField: Function;
      setRecordValue: Function;
      randomize: Function;
      snapshot: Function;
    };
    mutator(nextBuilder);
    draft = nextBuilder.snapshot() as CharacterDraft;
    persistDraft();
  }

  function switchSystem(nextSystem: GameSystemId) {
    if (nextSystem === system) {
      return;
    }

    system = nextSystem;
    stepIndex = 0;
    currentDraftId = null;

    if (userId) {
      draft = loadCharacterDraft(userId, nextSystem);
    } else {
      draft = getCharacterCreationStrategy(nextSystem).createEmptyDraft();
    }

    savedMessage = '';
    errorMessage = '';
  }

  function updateCharacteristic(key: CharacteristicKey, value: string) {
    if (!isCoCDraft(draft)) {
      return;
    }

    const numericValue = Number(value);
    mutateDraft((nextBuilder) => {
      nextBuilder.setRecordValue('characteristics', key, numericValue);
    });
  }

  function rerollCharacteristics() {
    if (!isCoCDraft(draft)) {
      return;
    }

    mutateDraft((nextBuilder) => {
      nextBuilder.randomize();
    });
  }

  function togglePersonalInterest(skill: string) {
    if (!isCoCDraft(draft)) {
      return;
    }

    const selected = draft.personalInterestSkills.includes(skill);
    const nextSkills = selected
      ? draft.personalInterestSkills.filter((entry) => entry !== skill)
      : [...draft.personalInterestSkills, skill].slice(0, 4);

    mutateDraft((nextBuilder) => {
      nextBuilder.setField('personalInterestSkills', nextSkills);
    });
  }

  function updateVtmAttribute(key: VtmAttributeKey, value: string) {
    if (!isVtmDraft(draft)) {
      return;
    }

    mutateDraft((nextBuilder) => {
      nextBuilder.setRecordValue('attributes', key, clampVtmRating(value));
    });
  }

  function updateVtmAbility(key: VtmAbilityKey, value: string) {
    if (!isVtmDraft(draft)) {
      return;
    }

    mutateDraft((nextBuilder) => {
      nextBuilder.setRecordValue('abilities', key, clampVtmRating(value));
    });
  }

  function updateVtmBackground(key: VtmBackgroundKey, value: string) {
    if (!isVtmDraft(draft)) {
      return;
    }

    mutateDraft((nextBuilder) => {
      nextBuilder.setRecordValue('backgrounds', key, clampVtmRating(value));
    });
  }

  function updateVtmVirtue(key: VtmVirtueKey, value: string) {
    if (!isVtmDraft(draft)) {
      return;
    }

    mutateDraft((nextBuilder) => {
      nextBuilder.setRecordValue('virtues', key, clampVtmRating(value));
    });
  }

  function updateVtmDiscipline(key: VtmDisciplineKey, value: string) {
    if (!isVtmDraft(draft)) {
      return;
    }

    mutateDraft((nextBuilder) => {
      nextBuilder.setRecordValue('disciplines', key, value);
    });
  }

  function updateVtmDisciplinePower(
    index: number,
    field: keyof VtmDisciplinePower,
    value: string
  ) {
    if (!isVtmDraft(draft)) {
      return;
    }

    const nextPowers = draft.disciplinePowers.map((power, powerIndex) =>
      powerIndex === index ? { ...power, [field]: value } : power
    );

    mutateDraft((nextBuilder) => {
      nextBuilder.setField('disciplinePowers', nextPowers);
    });
  }

  function addVtmDisciplinePower() {
    if (!isVtmDraft(draft)) {
      return;
    }

    const nextPowers = [...draft.disciplinePowers, { discipline: '', name: '', description: '' }];

    mutateDraft((nextBuilder) => {
      nextBuilder.setField('disciplinePowers', nextPowers);
    });
  }

  function removeVtmDisciplinePower(index: number) {
    if (!isVtmDraft(draft)) {
      return;
    }

    const nextPowers = draft.disciplinePowers.filter((_, powerIndex) => powerIndex !== index);

    mutateDraft((nextBuilder) => {
      nextBuilder.setField(
        'disciplinePowers',
        nextPowers.length > 0 ? nextPowers : [{ discipline: '', name: '', description: '' }]
      );
    });
  }

  function updateDraft() {
    mutateDraft(() => {});
  }

  function clampVtmRating(value: string) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.min(5, Math.max(0, Math.trunc(numericValue)));
  }

  function formatVtmGroupName(group: string) {
    const labels: Record<string, string> = {
      physical: 'Fizyczne',
      social: 'Społeczne',
      mental: 'Mentalne'
    };

    return labels[group] ?? group;
  }

  function goToNextStep() {
    stepIndex = Math.min(stepIndex + 1, steps.length - 1);
  }

  function goToPreviousStep() {
    stepIndex = Math.max(stepIndex - 1, 0);
  }

  function resetDraft() {
    clearCharacterDraft(userId, currentDraftId);
    currentDraftId = null;
    draft = getCharacterCreationStrategy(system).createEmptyDraft();
    savedMessage = '';
    stepIndex = 0;
  }

  async function saveCharacter() {
    errorMessage = '';
    savedMessage = '';

    if (!draft.name.trim()) {
      errorMessage = 'Imię i nazwisko postaci jest wymagane.';
      return;
    }

    isSubmitting = true;

    try {
      await createCharacter(builder.buildPayload());
      clearCharacterDraft(userId, currentDraftId);
      currentDraftId = null;
      await goto('/characters');
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Nie udało się zapisać karty postaci.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Nowa postać</title>
</svelte:head>

<main class="min-h-screen bg-background px-4 py-8">
  <section class="mx-auto w-full max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-normal">Kreator postaci</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Kreator prowadzi przez wybór systemu, przygotowanie szkicu i zapis postaci przypisanej do aktualnego użytkownika.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button type="button" variant="outline" onclick={persistDraft}>Zapisz szkic</Button>
        <Button type="button" variant="ghost" onclick={resetDraft}>Wyczyść</Button>
      </div>
    </div>

    {#if errorMessage}
      <div class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
        {errorMessage}
      </div>
    {/if}

    {#if savedMessage}
      <div class="rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary">
        {savedMessage}
      </div>
    {/if}

    {#if loadingDraft}
      <Card class="border-border/80 bg-card/95">
        <CardContent class="p-6">
          <p class="text-sm text-muted-foreground">Przygotowywanie kreatora postaci...</p>
        </CardContent>
      </Card>
    {:else}
      <div class="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div class="space-y-6">
          <Card class="border-border/80 bg-card/95">
            <CardContent class="p-4">
              <div class="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {#each steps as step, index}
                  <button
                    class={[
                      'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      index === stepIndex
                        ? 'border-primary/60 bg-primary/10 text-foreground'
                        : 'border-border/80 text-muted-foreground hover:bg-muted'
                    ]}
                    type="button"
                    onclick={() => (stepIndex = index)}
                  >
                    <span class="block text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      Etap {index + 1}
                    </span>
                    <span class="block font-medium">{step}</span>
                  </button>
                {/each}
              </div>
            </CardContent>
          </Card>

          {#if stepIndex === 0}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Wybór systemu</CardTitle>
                <CardDescription>
                  Wybierz zasady tworzenia postaci. Każdy system ma osobny szkic zapisany dla użytkownika.
                </CardDescription>
              </CardHeader>
              <CardContent class="grid gap-3 sm:grid-cols-2">
                {#each gameSystems as option}
                  <button
                    class={[
                      'rounded-md border px-4 py-3 text-left transition-colors',
                      option.id === system
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border/80 bg-background/40 hover:bg-muted'
                    ]}
                    type="button"
                    onclick={() => switchSystem(option.id)}
                  >
                    <span class="block font-medium">{option.label}</span>
                    <span class="mt-1 block text-sm text-muted-foreground">{option.shortDescription}</span>
                  </button>
                {/each}
              </CardContent>
            </Card>
          {:else if stepIndex === 1}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>{isCoCDraft(draft) ? 'Tożsamość śledczego' : 'Tożsamość kainity'}</CardTitle>
                <CardDescription>
                  Ustal dane podstawowe. Backend przypisze postać do aktualnie zalogowanego użytkownika.
                </CardDescription>
              </CardHeader>
              <CardContent class="grid gap-5 md:grid-cols-2">
                <div class="space-y-2 md:col-span-2">
                  <Label for="name">Imię i nazwisko</Label>
                  <Input id="name" bind:value={draft.name} oninput={updateDraft} placeholder={isCoCDraft(draft) ? 'Jan Kowalski' : 'Lucien Moreau'} />
                </div>

                <div class="space-y-2">
                  <Label for="age">Wiek</Label>
                  <Input id="age" bind:value={draft.age} oninput={updateDraft} type="number" min="15" max="90" />
                </div>

                {#if isCoCDraft(draft)}
                  <div class="space-y-2">
                    <Label for="occupation">Profesja</Label>
                    <select
                      id="occupation"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      bind:value={draft.occupationKey}
                      onchange={updateDraft}
                    >
                      {#each occupationTemplates as template}
                        <option value={template.key}>{template.label}</option>
                      {/each}
                    </select>
                  </div>
                {:else if isVtmDraft(draft)}
                  <div class="space-y-2">
                    <Label for="clan">Klan</Label>
                    <select
                      id="clan"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      bind:value={draft.clan}
                      onchange={updateDraft}
                    >
                      {#each vtmClans as template}
                        <option value={template.key}>{template.label}</option>
                      {/each}
                    </select>
                  </div>
                {/if}

                <div class="space-y-2">
                  <Label for="birthplace">Miejsce urodzenia</Label>
                  <Input id="birthplace" bind:value={draft.birthplace} oninput={updateDraft} placeholder="Arkham" />
                </div>

                <div class="space-y-2">
                  <Label for="residence">Miejsce zamieszkania</Label>
                  <Input id="residence" bind:value={draft.residence} oninput={updateDraft} placeholder="Boston" />
                </div>

                {#if isVtmDraft(draft)}
                  <div class="space-y-2">
                    <Label for="concept">Koncept</Label>
                    <Input id="concept" bind:value={draft.concept} oninput={updateDraft} placeholder="Neonata, śledczy, artysta..." />
                  </div>
                  <div class="space-y-2">
                    <Label for="sire">Stwórca</Label>
                    <Input id="sire" bind:value={draft.sire} oninput={updateDraft} placeholder="Imię stwórcy" />
                  </div>
                  <div class="space-y-2">
                    <Label for="nature">Natura</Label>
                    <select
                      id="nature"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      bind:value={draft.nature}
                      onchange={updateDraft}
                    >
                      {#each vtmNatureOptions as option}
                        <option value={option}>{option}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="space-y-2">
                    <Label for="demeanor">Maska</Label>
                    <select
                      id="demeanor"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      bind:value={draft.demeanor}
                      onchange={updateDraft}
                    >
                      {#each vtmDemeanorOptions as option}
                        <option value={option}>{option}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
              </CardContent>
            </Card>
          {:else if stepIndex === 2 && isCoCDraft(draft)}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Cechy i statystyki pochodne</CardTitle>
                <CardDescription>
                  Rzuty w stylu klasycznym: STR, CON, POW, DEX, APP = 3D6×5; SIZ i INT = (2D6+6)×5; EDU = (3D6+3)×5.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-5">
                <div class="flex justify-end">
                  <Button type="button" variant="secondary" onclick={rerollCharacteristics}>
                    Rzuć cechy od nowa
                  </Button>
                </div>

                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {#each characteristicOrder as key}
                    <div class="space-y-2">
                      <Label for={key}>{key}</Label>
                      <Input
                        id={key}
                        type="number"
                        min="15"
                        max="99"
                        step="5"
                        value={draft.characteristics[key]}
                        oninput={(event) => updateCharacteristic(key, (event.currentTarget as HTMLInputElement).value)}
                      />
                    </div>
                  {/each}
                </div>

                <div class="grid gap-4 rounded-md border bg-background/50 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <p class="text-muted-foreground">Idea</p>
                    <p class="font-medium">{cocDerivedStats?.idea}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Know</p>
                    <p class="font-medium">{cocDerivedStats?.know}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Luck</p>
                    <p class="font-medium">{cocDerivedStats?.luck}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Sanity</p>
                    <p class="font-medium">{cocDerivedStats?.sanity}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Magic Points</p>
                    <p class="font-medium">{cocDerivedStats?.magicPoints}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Hit Points</p>
                    <p class="font-medium">{cocDerivedStats?.hitPoints}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Damage Bonus</p>
                    <p class="font-medium">{cocDerivedStats?.damageBonus}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          {:else if stepIndex === 2 && isVtmDraft(draft)}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Atrybuty</CardTitle>
                <CardDescription>
                  Wampir: Maskarada opiera tworzenie postaci na atrybutach fizycznych, społecznych i mentalnych.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                {#each vtmAttributeGroupEntries as [group, entries]}
                  <div class="space-y-3">
                    <p class="text-sm font-medium">{formatVtmGroupName(group)}</p>
                    <div class="grid gap-4 sm:grid-cols-3">
                      {#each entries as key}
                        <div class="space-y-2">
                          <Label for={key}>{key}</Label>
                          <Input
                            id={key}
                            type="number"
                            min="0"
                            max="5"
                            step="1"
                            value={draft.attributes[key]}
                            oninput={(event) => updateVtmAttribute(key, (event.currentTarget as HTMLInputElement).value)}
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </CardContent>
            </Card>
          {:else if stepIndex === 3 && isCoCDraft(draft)}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Umiejętności</CardTitle>
                <CardDescription>
                  Profesja daje pakiet umiejętności, a zainteresowania osobiste wzmacniają cztery dodatkowe obszary.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                <div class="rounded-md border bg-background/50 p-4">
                  <p class="text-sm font-medium">{occupation?.label}</p>
                  <p class="mt-1 text-sm text-muted-foreground">{occupation?.description}</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    {#each occupation?.occupationSkills ?? [] as skill}
                      <span class="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">{skill}</span>
                    {/each}
                  </div>
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium">Zainteresowania osobiste</p>
                      <p class="text-sm text-muted-foreground">Wybierz maksymalnie cztery umiejętności.</p>
                    </div>
                    <span class="text-sm text-muted-foreground">{draft.personalInterestSkills.length}/4</span>
                  </div>

                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {#each personalInterestSkillCatalog as skill}
                      <label class="flex items-center gap-3 rounded-md border bg-background/40 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.personalInterestSkills.includes(skill)}
                          disabled={!draft.personalInterestSkills.includes(skill) && draft.personalInterestSkills.length >= 4}
                          onchange={() => togglePersonalInterest(skill)}
                        />
                        <span>{skill}</span>
                      </label>
                    {/each}
                  </div>
                </div>
              </CardContent>
            </Card>
          {:else if stepIndex === 3 && isVtmDraft(draft)}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Zdolności</CardTitle>
                <CardDescription>
                  Talenty, umiejętności i wiedza definiują praktykę nocnej egzystencji.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                {#each vtmAbilityGroupEntries as [group, entries]}
                  <div class="space-y-3">
                    <p class="text-sm font-medium">{formatVtmGroupName(group)}</p>
                    <div class="grid gap-4 sm:grid-cols-3">
                      {#each entries as key}
                        <div class="space-y-2">
                          <Label for={key}>{key}</Label>
                          <Input
                            id={key}
                            type="number"
                            min="0"
                            max="5"
                            step="1"
                            value={draft.abilities[key]}
                            oninput={(event) => updateVtmAbility(key, (event.currentTarget as HTMLInputElement).value)}
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </CardContent>
            </Card>
          {:else if stepIndex === 4 && isCoCDraft(draft)}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Tło postaci</CardTitle>
                <CardDescription>
                  Dodaj krótki opis, ideologię i notatki, aby szkic był gotowy do późniejszego wznowienia.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-5">
                <div class="space-y-2">
                  <Label for="personalDescription">Opis osobisty</Label>
                  <Textarea id="personalDescription" bind:value={draft.personalDescription} oninput={updateDraft} placeholder="Wygląd, maniery, cechy charakterystyczne." />
                </div>

                <div class="space-y-2">
                  <Label for="ideology">Ideologia / przekonania</Label>
                  <Textarea id="ideology" bind:value={draft.ideology} oninput={updateDraft} placeholder="To, co prowadzi śledczego przez mrok." />
                </div>

                <div class="space-y-2">
                  <Label for="notes">Notatki</Label>
                  <Textarea id="notes" bind:value={draft.notes} oninput={updateDraft} placeholder="Kontakty, długi, trauma, szczegóły kampanii." />
                </div>
              </CardContent>
            </Card>
          {:else if stepIndex === 4 && isVtmDraft(draft)}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Dziedzictwo wampira</CardTitle>
                <CardDescription>
                  Klan, dyscypliny, backgroundy i cnoty budują nocną pozycję oraz mechanikę postaci.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                <div class="rounded-md border bg-background/50 p-4 text-sm">
                  <p class="font-medium">{clan?.label}</p>
                  <p class="mt-1 text-muted-foreground">Dyscypliny klanu: {clan?.disciplines.join(', ')}</p>
                </div>

                <div class="grid gap-4 md:grid-cols-3">
                  {#each vtmDisciplineKeys as key, index}
                    <div class="space-y-2">
                      <Label for={key}>{key}</Label>
                      <Input
                        id={key}
                        list="vtm-discipline-options"
                        value={draft.disciplines[key]}
                        oninput={(event) => updateVtmDiscipline(key, (event.currentTarget as HTMLInputElement).value)}
                        placeholder={clan?.disciplines[index] ?? ''}
                      />
                    </div>
                  {/each}
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium">Moce dyscyplin</p>
                      <p class="mt-1 text-sm text-muted-foreground">
                        Wpisz nazwę i opis konkretnej umiejętności wynikającej z dyscypliny.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onclick={addVtmDisciplinePower}>
                      Dodaj moc
                    </Button>
                  </div>

                  <div class="space-y-3">
                    {#each draft.disciplinePowers as power, index}
                      <div class="rounded-md border bg-background/40 p-4">
                        <div class="flex items-start justify-between gap-3">
                          <div class="grid flex-1 gap-4 md:grid-cols-[0.7fr_0.8fr_1.2fr]">
                            <div class="space-y-2">
                              <Label for={`discipline-power-discipline-${index}`}>Dyscyplina</Label>
                              <Input
                                id={`discipline-power-discipline-${index}`}
                                list="vtm-discipline-options"
                                value={power.discipline ?? ''}
                                oninput={(event) =>
                                  updateVtmDisciplinePower(
                                    index,
                                    'discipline',
                                    (event.currentTarget as HTMLInputElement).value
                                  )}
                                placeholder={ 'Animalizm'}
                              />
                            </div>
                            <div class="space-y-2">
                              <Label for={`discipline-power-name-${index}`}>Nazwa</Label>
                              <Input
                                id={`discipline-power-name-${index}`}
                                value={power.name}
                                oninput={(event) =>
                                  updateVtmDisciplinePower(
                                    index,
                                    'name',
                                    (event.currentTarget as HTMLInputElement).value
                                  )}
                                placeholder="np. Awe"
                              />
                            </div>
                            <div class="space-y-2">
                              <Label for={`discipline-power-description-${index}`}>Opis</Label>
                              <Textarea
                                id={`discipline-power-description-${index}`}
                                value={power.description}
                                oninput={(event) =>
                                  updateVtmDisciplinePower(
                                    index,
                                    'description',
                                    (event.currentTarget as HTMLTextAreaElement).value
                                  )}
                                placeholder="Efekt, koszt, pula rzutu albo ograniczenia użycia."
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onclick={() => removeVtmDisciplinePower(index)}
                          >
                            Usuń
                          </Button>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>

                <datalist id="vtm-discipline-options">
                  {#each vtmDisciplineCatalog as option}
                    <option value={option}></option>
                  {/each}
                </datalist>

                <div class="space-y-3">
                  <p class="text-sm font-medium">Backgroundy</p>
                  <div class="grid gap-4 sm:grid-cols-3">
                    {#each vtmBackgroundKeys as key}
                      <div class="space-y-2">
                        <Label for={key}>{key}</Label>
                          <Input
                            id={key}
                            type="number"
                            min="0"
                            max="5"
                            step="1"
                            value={draft.backgrounds[key]}
                            oninput={(event) => updateVtmBackground(key, (event.currentTarget as HTMLInputElement).value)}
                          />
                      </div>
                    {/each}
                  </div>
                </div>

                <div class="space-y-3">
                  <p class="text-sm font-medium">Cnoty</p>
                  <div class="grid gap-4 sm:grid-cols-3">
                    {#each vtmVirtueKeys as key}
                      <div class="space-y-2">
                        <Label for={key}>{key}</Label>
                          <Input
                            id={key}
                            type="number"
                            min="0"
                            max="5"
                            step="1"
                            value={draft.virtues[key]}
                            oninput={(event) => updateVtmVirtue(key, (event.currentTarget as HTMLInputElement).value)}
                          />
                      </div>
                    {/each}
                  </div>
                </div>

                <div class="grid gap-4 rounded-md border bg-background/50 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <p class="text-muted-foreground">Humanity</p>
                    <p class="font-medium">{vtmDerivedStats?.humanity}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Willpower</p>
                    <p class="font-medium">{vtmDerivedStats?.willpower}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Blood Pool</p>
                    <p class="font-medium">{vtmDerivedStats?.bloodPool}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          {:else}
            <Card class="border-border/80 bg-card/95">
              <CardHeader>
                <CardTitle>Podsumowanie</CardTitle>
                <CardDescription>
                  Sprawdź finalny szkic. Po zapisaniu backend utworzy kartę przypisaną do bieżącego użytkownika.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                <div class="grid gap-4 rounded-md border bg-background/50 p-4 sm:grid-cols-2">
                  <div>
                    <p class="text-muted-foreground">Postać</p>
                    <p class="font-medium">{draft.name || 'Bez nazwy'}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">{isCoCDraft(draft) ? 'Profesja' : 'Koncept / klan'}</p>
                    <p class="font-medium">
                      {isCoCDraft(draft) ? occupation?.label : `${draft.clan} - ${draft.concept || 'brak konceptu'}`}
                    </p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Wiek</p>
                    <p class="font-medium">{draft.age || 'brak danych'}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">Szkic zapisany</p>
                    <p class="font-medium">{draftExists ? 'tak' : 'nie'}</p>
                  </div>
                </div>

                {#if isCoCDraft(draft)}
                  <div class="grid gap-4 sm:grid-cols-4">
                    {#each characteristicOrder as key}
                      <div class="rounded-md border bg-background/30 p-3 text-sm">
                        <p class="text-muted-foreground">{key}</p>
                        <p class="font-medium">{draft.characteristics[key]}</p>
                      </div>
                    {/each}
                  </div>

                  <div class="rounded-md border bg-background/30 p-4 text-sm">
                    <p class="font-medium">Zainteresowania osobiste</p>
                    <p class="mt-2 text-muted-foreground">{draft.personalInterestSkills.join(', ') || 'brak'}</p>
                  </div>
                {:else if isVtmDraft(draft)}
                  <div class="grid gap-4 sm:grid-cols-3">
                    {#each vtmAttributeGroupEntries as [group, entries]}
                      <div class="rounded-md border bg-background/30 p-4 text-sm">
                        <p class="font-medium">{formatVtmGroupName(group)}</p>
                        <div class="mt-2 space-y-1">
                          {#each entries as key}
                            <div class="flex items-center justify-between">
                              <span class="text-muted-foreground">{key}</span>
                              <span>{draft.attributes[key]}</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </CardContent>
            </Card>
          {/if}

          <div class="flex items-center justify-between">
            <Button type="button" variant="ghost" disabled={stepIndex === 0} onclick={goToPreviousStep}>
              Wstecz
            </Button>

            {#if stepIndex < steps.length - 1}
              <Button type="button" onclick={goToNextStep}>Dalej</Button>
            {:else}
              <Button type="button" disabled={isSubmitting} onclick={saveCharacter}>
                {isSubmitting ? 'Tworzenie...' : 'Utwórz postać'}
              </Button>
            {/if}
          </div>
        </div>

      
      </div>
    {/if}
  </section>
</main>
