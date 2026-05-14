export type ToolboxPosition = {
  x: number;
  y: number;
};

export type ToolboxState = {
  isCollapsed: boolean;
  position: ToolboxPosition;
};

export type SessionToolboxCharacterSummary = {
  characterId: string;
  characterName: string;
  userId: string;
  playerName: string;
  systemId?: string;
  resources: SessionToolboxResource[];
  canEdit: boolean;
};

export type SessionToolboxResourceId =
  | "health"
  | "willpower"
  | "hunger"
  | "hitPoints"
  | "luck"
  | "sanity";

export type SessionToolboxResourceTone =
  | "health"
  | "willpower"
  | "hunger"
  | "luck"
  | "sanity"
  | "neutral";

export type SessionToolboxResource = {
  id: SessionToolboxResourceId;
  label: string;
  value: number;
  max: number;
  min?: number;
  tone?: SessionToolboxResourceTone;
};

export type SessionToolboxResourceChange = {
  characterId: string;
  resourceId: SessionToolboxResourceId;
  value: number;
};
