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
    onActionChange: (actionId: string) => void;
    onInputChange: (inputId: string, value: string) => void;
  };

  let {
    character,
    fallbackRpgSystem,
    selectedActionId,
    inputValues,
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

  function filteredOptionsForInput(input: CharacterActionInputDefinition) {
    const query = valueFor(input.id).trim().toLowerCase();
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

  function selectedOptionLabel(input: CharacterActionInputDefinition) {
    const value = valueFor(input.id);
    const option = optionsForInput(input).find((entry) => entry.id === value);
    return option ? `${option.label}: ${option.value}` : '';
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
              value={valueFor(input.id)}
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
                      onmousedown={(event) => event.preventDefault()}
                      onclick={() => selectInputOption(input.id, option.id)}
                    >
                      <span>{option.label}</span>
                      <span class="text-xs text-muted-foreground">{option.value}</span>
                    </button>
                  {/each}
                {:else}
                  <p class="px-3 py-2 text-muted-foreground">Brak pasujących pozycji.</p>
                {/if}
              </div>
            {/if}
            {#if selectedOptionLabel(input)}
              <p class="mt-1 text-xs text-muted-foreground">{selectedOptionLabel(input)}</p>
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
