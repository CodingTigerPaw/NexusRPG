<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import {
    buildActionCheckOptions,
    buildVtmAbilityOptions,
    buildVtmAttributeOptions
  } from '../ui-adapters/check-options';
  import type { CharacterCard } from '$lib/modules/characters';
  import {
    getCharacterSystemDefinitionByRpgSystem,
    getCharacterSystemDefinitionForCharacter,
    type CharacterActionDefinition,
    type CharacterActionInputDefinition,
    type CharacterActionInputValues
  } from '$lib/modules/charactersModule/systems';

  type Props = {
    character: CharacterCard | null | undefined;
    fallbackRpgSystem?: string;
    selectedActionId: string;
    inputValues: CharacterActionInputValues;
    autoSelectFirstAction?: boolean;
    onActionChange: (actionId: string) => void;
    onInputChange: (inputId: string, value: string) => void;
  };

  let {
    character,
    fallbackRpgSystem,
    selectedActionId,
    inputValues,
    autoSelectFirstAction = true,
    onActionChange,
    onInputChange
  }: Props = $props();

  const systemDefinition = $derived(
    character
      ? getCharacterSystemDefinitionForCharacter(character)
      : getCharacterSystemDefinitionByRpgSystem(fallbackRpgSystem)
  );
  const actions = $derived(systemDefinition?.actions.checks ?? []);
  const selectedAction = $derived(
    actions.find((action) => action.id === selectedActionId) ?? null
  );
  const actionContextKey = $derived(
    character?.characterId ?? systemDefinition?.id ?? fallbackRpgSystem ?? 'no-system'
  );
  let defaultedActionContextKey = $state('');
  let focusedInputId = $state('');
  let blurredInputs = $state<Record<string, boolean>>({});

  $effect(() => {
    if (
      actions.length > 0 &&
      autoSelectFirstAction &&
      !selectedActionId &&
      defaultedActionContextKey !== actionContextKey
    ) {
      defaultedActionContextKey = actionContextKey;
      onActionChange(actions[0].id);
    }
  });

  function optionsForInput(input: CharacterActionInputDefinition) {
    if (input.source === 'skills-and-characteristics') {
      return buildActionCheckOptions(character, fallbackRpgSystem);
    }

    if (input.source === 'vtm-attributes') {
      return buildVtmAttributeOptions(character, fallbackRpgSystem);
    }

    return buildVtmAbilityOptions(character, fallbackRpgSystem);
  }

  function valueFor(inputId: string) {
    return inputValues[inputId] ?? '';
  }

  function selectedOptionForInput(input: CharacterActionInputDefinition) {
    const value = valueFor(input.id);
    return (
      optionsForInput(input).find(
        (entry) => entry.id === value || entry.label.toLowerCase() === value.toLowerCase()
      ) ?? null
    );
  }

  function displayValueFor(input: CharacterActionInputDefinition) {
    return selectedOptionForInput(input)?.label ?? valueFor(input.id);
  }

  function filteredOptionsForInput(input: CharacterActionInputDefinition) {
    const query = displayValueFor(input).trim().toLowerCase();
    const options = optionsForInput(input);

    if (!query) {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.id.toLowerCase().includes(query)
    );
  }

  function selectInputOption(inputId: string, value: string) {
    onInputChange(inputId, value);
    blurredInputs = {
      ...blurredInputs,
      [inputId]: true
    };
    focusedInputId = '';
  }

  function normalizeInputValue(input: CharacterActionInputDefinition) {
    const selectedOption = selectedOptionForInput(input);

    if (selectedOption && selectedOption.id !== valueFor(input.id)) {
      onInputChange(input.id, selectedOption.id);
    }
  }

  function isVtmRatingInput(input: CharacterActionInputDefinition) {
    return input.source === 'vtm-attributes' || input.source === 'vtm-abilities';
  }

  function ratingDots(value: number) {
    const rating = Math.max(0, Math.min(5, Math.trunc(value)));
    return Array.from({ length: 5 }, (_, index) => index < rating);
  }

  function isValidInputValue(input: CharacterActionInputDefinition) {
    const value = valueFor(input.id);
    return Boolean(value && optionsForInput(input).some((option) => option.id === value));
  }

  function shouldShowInvalidState(input: CharacterActionInputDefinition) {
    const value = valueFor(input.id);
    return Boolean(
      value &&
        blurredInputs[input.id] &&
        !optionsForInput(input).some((option) => option.id === value)
    );
  }

  function descriptionFor(action: CharacterActionDefinition) {
    return action.systemId === 'coc5'
      ? 'Rzut k100 zostanie rozliczony przez flow systemu Zewu Cthulhu.'
      : 'Pula kości zostanie zbudowana z wybranych wartości karty i aktualnego głodu.';
  }
</script>

{#if actions.length > 0}
  <div class="rounded-md border bg-background/40 p-4">
    <Label for="character-action">Akcja z karty postaci</Label>
    <select
      id="character-action"
      class="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={selectedActionId}
      onchange={(event) => onActionChange(event.currentTarget.value)}
    >
      <option value="">Rzut bez testu mechanicznego</option>
      {#each actions as action}
        <option value={action.id}>{action.label}</option>
      {/each}
    </select>

    {#if selectedAction}
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        {#each selectedAction.inputs as input}
          <div class="relative">
            <Label for={`action-input-${input.id}`}>{input.label}</Label>
            <input
              id={`action-input-${input.id}`}
              class={[
                'mt-2 h-10 w-full rounded-md border bg-background px-3 py-2 text-sm',
                shouldShowInvalidState(input)
                  ? 'border-destructive focus-visible:outline-destructive'
                  : 'border-input'
              ]}
              value={displayValueFor(input)}
              placeholder="Zacznij pisać albo wybierz z listy"
              autocomplete="off"
              onfocus={() => (focusedInputId = input.id)}
              oninput={(event) => {
                blurredInputs = {
                  ...blurredInputs,
                  [input.id]: false
                };
                onInputChange(input.id, event.currentTarget.value);
              }}
              onblur={() => {
                setTimeout(() => {
                  normalizeInputValue(input);
                  blurredInputs = {
                    ...blurredInputs,
                    [input.id]: true
                  };
                  if (focusedInputId === input.id) {
                    focusedInputId = '';
                  }
                }, 120);
              }}
            />
            {#if focusedInputId === input.id}
              <div class="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-lg">
                {#if filteredOptionsForInput(input).length > 0}
                  {#each filteredOptionsForInput(input) as option}
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left hover:bg-muted"
                      onpointerdown={(event) => {
                        event.preventDefault();
                        selectInputOption(input.id, option.id);
                      }}
                    >
                      <span>{option.label}</span>
                      {#if isVtmRatingInput(input)}
                        <span
                          class="flex shrink-0 items-center gap-1"
                          aria-label={`Wartość ${option.value} z 5`}
                        >
                          {#each ratingDots(option.value) as filled}
                            <span
                              class={[
                                'h-2 w-2 rounded-full border border-primary/70',
                                filled ? 'bg-primary' : 'bg-transparent'
                              ]}
                            ></span>
                          {/each}
                        </span>
                      {:else}
                        <span class="text-xs text-muted-foreground">{option.value}</span>
                      {/if}
                    </button>
                  {/each}
                {:else}
                  <p class="px-3 py-2 text-muted-foreground">Brak pasujących pozycji.</p>
                {/if}
              </div>
            {/if}
            {#if selectedOptionForInput(input)}
              {@const selectedOption = selectedOptionForInput(input)}
              <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{selectedOption?.label}</span>
                {#if isVtmRatingInput(input)}
                  <span
                    class="flex items-center gap-1"
                    aria-label={`Wartość ${selectedOption?.value ?? 0} z 5`}
                  >
                    {#each ratingDots(selectedOption?.value ?? 0) as filled}
                      <span
                        class={[
                          'h-1.5 w-1.5 rounded-full border border-primary/70',
                          filled ? 'bg-primary' : 'bg-transparent'
                        ]}
                      ></span>
                    {/each}
                  </span>
                {:else}
                  <span>{selectedOption?.value}</span>
                {/if}
              </div>
            {:else if shouldShowInvalidState(input)}
              <p class="mt-1 text-xs text-destructive">
                Wybierz wartość z listy. Wpis spoza listy nie pozwoli wykonać rzutu.
              </p>
            {/if}
          </div>
        {/each}
      </div>
      <!-- <p class="mt-3 text-xs text-muted-foreground">{descriptionFor(selectedAction)}</p> -->
    {/if}
  </div>
{/if}
