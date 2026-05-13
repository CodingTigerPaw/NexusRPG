<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import {
    createCharacterNote,
    type CharacterNote
  } from '$lib/modules/charactersModule/notes';

  type Props = {
    notes: CharacterNote[];
    canEdit?: boolean;
    isSaving?: boolean;
    onChange?: (notes: CharacterNote[]) => void | Promise<void>;
  };

  let { notes, canEdit = false, isSaving = false, onChange }: Props = $props();
  let editingNoteId = $state<string | null>(null);
  let draftTitle = $state('');
  let draftContent = $state('');
  let noteMessage = $state('');

  const isEditingExistingNote = $derived(Boolean(editingNoteId));
  const hasDraft = $derived(Boolean(draftTitle.trim() || draftContent.trim()));

  function resetDraft() {
    editingNoteId = null;
    draftTitle = '';
    draftContent = '';
    noteMessage = '';
  }

  function startNewNote() {
    editingNoteId = null;
    draftTitle = '';
    draftContent = '';
    noteMessage = '';
  }

  function startEditingNote(note: CharacterNote) {
    editingNoteId = note.noteId;
    draftTitle = note.title;
    draftContent = note.content;
    noteMessage = '';
  }

  async function saveDraft() {
    const title = draftTitle.trim();

    if (!title) {
      noteMessage = 'Tytuł notatki jest wymagany.';
      return;
    }

    const now = new Date().toISOString();
    const nextNotes = editingNoteId
      ? notes.map((note) =>
          note.noteId === editingNoteId
            ? {
                ...note,
                title,
                content: draftContent,
                updatedAt: now
              }
            : note
        )
      : [createCharacterNote(title, draftContent), ...notes];

    await onChange?.(nextNotes);
    resetDraft();
  }

  async function deleteNote(note: CharacterNote) {
    await onChange?.(notes.filter((entry) => entry.noteId !== note.noteId));

    if (editingNoteId === note.noteId) {
      resetDraft();
    }
  }
</script>

<div class="space-y-4">
  {#if canEdit}
    <div class="rounded-md border bg-background/40 p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-medium">
            {isEditingExistingNote ? 'Edytuj notatkę' : 'Nowa notatka'}
          </h3>
        </div>

        {#if hasDraft || isEditingExistingNote}
          <Button type="button" variant="ghost" size="sm" disabled={isSaving} onclick={resetDraft}>
            Wyczyść
          </Button>
        {/if}
      </div>

      <div class="mt-4 grid gap-3">
        <div class="space-y-2">
          <Label for="character-note-title">Tytuł</Label>
          <Input
            id="character-note-title"
            bind:value={draftTitle}
            disabled={isSaving}
            maxlength={100}
            placeholder="Warte zapamiętania"
          />
        </div>

        <div class="space-y-2">
          <Label for="character-note-content">Treść</Label>
          <Textarea
            id="character-note-content"
            class="min-h-32"
            bind:value={draftContent}
            disabled={isSaving}
            placeholder="Notatka"
          />
        </div>
      </div>

      {#if noteMessage}
        <p class="mt-3 rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
          {noteMessage}
        </p>
      {/if}

      <div class="mt-4 flex justify-end gap-2">
        {#if isEditingExistingNote}
          <Button type="button" variant="outline" disabled={isSaving} onclick={startNewNote}>
            Nowa
          </Button>
        {/if}
        <Button type="button" disabled={isSaving || !draftTitle.trim()} onclick={saveDraft}>
          {isSaving ? 'Zapisywanie...' : isEditingExistingNote ? 'Zapisz notatkę' : 'Dodaj notatkę'}
        </Button>
      </div>
    </div>
  {/if}

  {#if notes.length > 0}
    <div class="grid gap-3">
      {#each notes as note (note.noteId)}
        <article class="rounded-md border bg-background/40 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold">{note.title}</h3>
              {#if note.updatedAt || note.createdAt}
                <p class="mt-1 text-xs text-muted-foreground">
                  {new Date(note.updatedAt ?? note.createdAt ?? '').toLocaleString('pl-PL')}
                </p>
              {/if}
            </div>

            {#if canEdit}
              <div class="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" disabled={isSaving} onclick={() => startEditingNote(note)}>
                  Edytuj
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={isSaving} onclick={() => deleteNote(note)}>
                  Usuń
                </Button>
              </div>
            {/if}
          </div>

          {#if note.content.trim()}
            <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
          {:else}
            <p class="mt-3 text-sm text-muted-foreground">Brak treści.</p>
          {/if}
        </article>
      {/each}
    </div>
  {:else}
    <div class="rounded-md border border-dashed bg-background/40 p-6 text-center text-sm text-muted-foreground">
      Brak notatek dla tej postaci.
    </div>
  {/if}
</div>
