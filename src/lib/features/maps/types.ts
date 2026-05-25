export type SessionMapId = string;
export type SessionMapTokenId = string;
export type MapAssetId = string;
export type MapClientMutationId = string;

export type MapAssetKind = "map" | "token";

export type MapNormalizedCoordinate = number;

export type MapPosition = {
  x: MapNormalizedCoordinate;
  y: MapNormalizedCoordinate;
};

export type MapDimensions = {
  width: number;
  height: number;
};

export type MapAsset = {
  assetId: MapAssetId;
  kind: MapAssetKind;
  url: string;
  fileName?: string;
  mimeType?: string;
  dimensions?: MapDimensions;
  sizeBytes?: number;
  createdByUserId?: string;
  createdAt?: string;
};

export type SessionAsset = MapAsset & {
  sessionId: string;
  label?: string;
};

export type MapGridType = "square" | "hex-vertical" | "hex-horizontal";

export type MapGridSettings = {
  enabled: boolean;
  type: MapGridType;
  cellSize: number;
  color?: string;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
};

export type MapViewport = {
  center: MapPosition;
  zoom: number;
};

export type MapLayer = "background" | "object" | "token" | "overlay";

export type MapTokenVisibility = "public" | "gmOnly" | "hidden";

export type MapTokenLockState = "unlocked" | "positionLocked" | "locked";

export type MapTokenSizeUnit = "relative" | "grid";

export type MapTokenSize = {
  width: number;
  height: number;
  unit: MapTokenSizeUnit;
};

export type MapTokenOwnership = {
  ownerUserId?: string | null;
  characterId?: string | null;
  controlledByUserIds?: string[];
};

export type SessionMapToken = {
  tokenId: SessionMapTokenId;
  sessionId: string;
  mapId: SessionMapId;
  label: string;
  asset: MapAsset;
  position: MapPosition;
  size: MapTokenSize;
  rotation?: number;
  visibility: MapTokenVisibility;
  lockState?: MapTokenLockState;
  ownership?: MapTokenOwnership;
  layer?: MapLayer;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
};

export type MapTokenTemplate = {
  templateId: string;
  sessionId?: string;
  label: string;
  assetId: MapAssetId;
  asset: MapAsset;
  size?: MapTokenSize;
  visibility?: MapTokenVisibility;
  lockState?: MapTokenLockState;
  layer?: MapLayer;
  defaultSize?: MapTokenSize;
  defaultVisibility?: MapTokenVisibility;
  defaultLockState?: MapTokenLockState;
  defaultLayer?: MapLayer;
  createdByUserId?: string;
  createdAt?: string;
};

export type MapFogOfWarSettings = {
  enabled: boolean;
};

export type MapAnnotation = {
  annotationId: string;
  sessionId: string;
  mapId: SessionMapId;
  type: "marker" | "area" | "text";
  position: MapPosition;
  label?: string;
  visibleToPlayers?: boolean;
  createdByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MapMeasurement = {
  measurementId: string;
  sessionId: string;
  mapId: SessionMapId;
  from: MapPosition;
  to: MapPosition;
  label?: string;
  createdByUserId?: string;
};

export type SessionMap = {
  mapId: SessionMapId;
  sessionId: string;
  name?: string;
  asset: MapAsset;
  dimensions?: MapDimensions;
  defaultViewport?: MapViewport;
  grid?: MapGridSettings | null;
  fogOfWar?: MapFogOfWarSettings | null;
  tokens: SessionMapToken[];
  annotations?: MapAnnotation[];
  createdByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
};

export type CreateSessionMapPayload = {
  name?: string;
  assetId?: MapAssetId;
  asset?: MapAsset;
  dimensions?: MapDimensions;
  grid?: MapGridSettings | null;
  defaultViewport?: MapViewport;
};

export type UpdateSessionMapPayload = Partial<{
  name: string;
  assetId: MapAssetId;
  asset: MapAsset;
  dimensions: MapDimensions;
  grid: MapGridSettings | null;
  defaultViewport: MapViewport;
  fogOfWar: MapFogOfWarSettings | null;
  version: number;
}>;

export type CreateMapTokenPayload = {
  label: string;
  assetId?: MapAssetId;
  asset?: MapAsset;
  position: MapPosition;
  size?: MapTokenSize;
  rotation?: number;
  visibility?: MapTokenVisibility;
  lockState?: MapTokenLockState;
  ownership?: MapTokenOwnership;
  layer?: MapLayer;
  clientMutationId?: MapClientMutationId;
};

export type UpdateMapTokenPayload = Partial<{
  label: string;
  assetId: MapAssetId;
  asset: MapAsset;
  position: MapPosition;
  size: MapTokenSize;
  rotation: number;
  visibility: MapTokenVisibility;
  lockState: MapTokenLockState;
  ownership: MapTokenOwnership;
  layer: MapLayer;
  version: number;
  clientMutationId: MapClientMutationId;
}>;

export type MoveMapTokenPayload = {
  tokenId: SessionMapTokenId;
  position: MapPosition;
  rotation?: number;
  version?: number;
  clientMoveId?: MapClientMutationId;
};

export type MapAssetUploadUrlRequest = {
  kind: MapAssetKind;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  dimensions?: MapDimensions;
};

export type SessionAssetUploadUrlRequest = MapAssetUploadUrlRequest & {
  label?: string;
};

export type MapAssetUploadUrlResponse = {
  assetId: MapAssetId;
  uploadUrl: string;
  assetUrl: string;
  asset?: SessionAsset;
  headers?: Record<string, string>;
  expiresAt?: string;
};

export type SessionAssetsResponse = {
  assets: SessionAsset[];
  nextCursor?: string | null;
  message?: string;
};

export type CreateSessionTokenTemplatePayload = {
  label: string;
  assetId: MapAssetId;
  defaultSize: MapTokenSize;
  defaultVisibility?: MapTokenVisibility;
  defaultLockState?: MapTokenLockState;
  defaultLayer?: MapLayer;
};

export type UpdateSessionTokenTemplatePayload = Partial<CreateSessionTokenTemplatePayload>;

export type SessionTokenTemplateResponse = {
  tokenTemplate: MapTokenTemplate;
  message?: string;
};

export type SessionTokenTemplatesResponse = {
  tokenTemplates: MapTokenTemplate[];
  nextCursor?: string | null;
  message?: string;
};

export type SessionMapResponse = {
  map: SessionMap | null;
  message?: string;
};

export type SessionMapsResponse = {
  maps: SessionMap[];
  nextCursor?: string | null;
  message?: string;
};

export type SessionMapTokenResponse = {
  token: SessionMapToken;
  message?: string;
};

export type SessionMapTokensResponse = {
  tokens: SessionMapToken[];
  nextCursor?: string | null;
  message?: string;
};

export type SessionMapLiveEventBase = {
  sessionId: string;
  mapId: SessionMapId;
  actorUserId?: string;
  clientMutationId?: MapClientMutationId;
  updatedAt?: string;
};

export type SessionMapCreatedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.created";
  map: SessionMap;
};

export type SessionMapUpdatedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.updated";
  map: SessionMap;
  version?: number;
};

export type SessionMapDeletedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.deleted";
  deletedAt?: string;
};

export type SessionMapTokenCreatedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.tokenCreated";
  token: SessionMapToken;
};

export type SessionMapTokenUpdatedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.tokenUpdated";
  token: SessionMapToken;
  version?: number;
};

export type SessionMapTokenMovedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.tokenMoved";
  tokenId: SessionMapTokenId;
  position: MapPosition;
  rotation?: number;
  version?: number;
  movedByUserId?: string;
  clientMoveId?: MapClientMutationId;
};

export type SessionMapTokenDraggingEvent = SessionMapLiveEventBase & {
  type: "sessionMap.tokenDragging";
  tokenId: SessionMapTokenId;
  position: MapPosition;
  phase?: "dragging";
  clientMoveId?: MapClientMutationId;
};

export type SessionMapTokenDeletedEvent = SessionMapLiveEventBase & {
  type: "sessionMap.tokenDeleted";
  tokenId: SessionMapTokenId;
  deletedAt?: string;
};

export type SessionMapLiveEvent =
  | SessionMapCreatedEvent
  | SessionMapUpdatedEvent
  | SessionMapDeletedEvent
  | SessionMapTokenCreatedEvent
  | SessionMapTokenUpdatedEvent
  | SessionMapTokenDraggingEvent
  | SessionMapTokenMovedEvent
  | SessionMapTokenDeletedEvent;
