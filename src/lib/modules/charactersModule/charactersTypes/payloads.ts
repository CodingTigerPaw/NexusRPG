export type CharacterCreatePayload = {
  name: string;
  rpgSystem?: string;
  sessionId?: string;
  occupation?: string;
  age?: number;
  characteristics?: Record<string, unknown>;
  skills?: Record<string, unknown>;
  backstory?: Record<string, unknown>;
  inventory?: unknown;
  notes?: string;
};

export type CharacterUpdatePayload = Partial<{
  name: string;
  occupation: string | null;
  age: number | null;
  characteristics: Record<string, unknown>;
  skills: Record<string, unknown>;
  removeSkills: string[];
  backstory: Record<string, unknown>;
  inventory: unknown;
  notes: string | null;
}>;

export type CharacterAvatarUploadPayload = {
  fileName?: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  imageBase64: string;
};

export type GetCharactersOptions = {
  limit?: number;
  cursor?: string | null;
  rpgSystem?: string | null;
};
