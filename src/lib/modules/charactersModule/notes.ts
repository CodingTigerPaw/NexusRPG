export type CharacterNote = {
  noteId: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
};

const notesPayloadVersion = 1;

type SerializedCharacterNotes = {
  version: number;
  entries: CharacterNote[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNote(value: unknown): CharacterNote | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const content = typeof value.content === "string" ? value.content : "";

  if (!title && !content.trim()) {
    return null;
  }

  return {
    noteId:
      typeof value.noteId === "string" && value.noteId.trim()
        ? value.noteId
        : createCharacterNoteId(),
    title: title || "Notatka",
    content,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

export function createCharacterNoteId() {
  return globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`;
}

export function createCharacterNote(title: string, content: string): CharacterNote {
  const now = new Date().toISOString();

  return {
    noteId: createCharacterNoteId(),
    title: title.trim() || "Notatka",
    content,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseCharacterNotes(rawNotes: unknown): CharacterNote[] {
  if (!rawNotes) {
    return [];
  }

  if (Array.isArray(rawNotes)) {
    return rawNotes.map(normalizeNote).filter(Boolean) as CharacterNote[];
  }

  if (typeof rawNotes !== "string") {
    return [];
  }

  const trimmedNotes = rawNotes.trim();

  if (!trimmedNotes) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmedNotes) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.map(normalizeNote).filter(Boolean) as CharacterNote[];
    }

    if (isRecord(parsed) && Array.isArray(parsed.entries)) {
      return parsed.entries.map(normalizeNote).filter(Boolean) as CharacterNote[];
    }
  } catch {
    // Stare notatki były pojedynczym tekstem. Traktujemy je jako pierwszy wpis,
    // żeby migracja nie wymagała zmian backendu ani utraty danych gracza.
  }

  return [
    {
      noteId: "legacy-note",
      title: "Notatka",
      content: rawNotes,
    },
  ];
}

export function serializeCharacterNotes(notes: CharacterNote[]) {
  const normalizedNotes = notes.map(normalizeNote).filter(Boolean) as CharacterNote[];

  if (normalizedNotes.length === 0) {
    return null;
  }

  const payload: SerializedCharacterNotes = {
    version: notesPayloadVersion,
    entries: normalizedNotes,
  };

  return JSON.stringify(payload);
}

export function characterNotesToPlainText(rawNotes: unknown) {
  return parseCharacterNotes(rawNotes)
    .map((note) => `${note.title}\n${note.content}`.trim())
    .join("\n\n");
}
