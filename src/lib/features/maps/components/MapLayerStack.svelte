<script lang="ts">
  import type { MapDimensions, MapPosition, SessionMap, SessionMapToken } from "../types";
  import MapLayoutLayer from "./MapLayoutLayer.svelte";
  import MapTokenLayer from "./MapTokenLayer.svelte";

  type Props = {
    map: SessionMap;
    canManageMap: boolean;
    canDeleteMapTokens?: boolean;
    currentUserId?: string;
    hiddenTokenIds?: string[];
    deletingTokenIds?: string[];
    tokenPositions?: Record<string, MapPosition>;
    mapSurfaceElement?: HTMLElement | null;
    mapDimensions?: MapDimensions | null;
    onTokenDelete?: (token: SessionMapToken) => void;
    onTokenDragPreview?: (token: SessionMapToken, position: MapPosition) => void;
    onTokenDrop?: (token: SessionMapToken, position: MapPosition) => void;
  };

  let {
    map,
    canManageMap,
    canDeleteMapTokens = false,
    currentUserId,
    hiddenTokenIds = [],
    deletingTokenIds = [],
    tokenPositions = {},
    mapSurfaceElement = null,
    mapDimensions = null,
    onTokenDelete,
    onTokenDragPreview,
    onTokenDrop
  }: Props = $props();
</script>

<!-- Kolejność warstw jest jawna, bo późniejsze grid/fog/tokeny muszą dzielić jedną geometrię mapy. -->
<div class="absolute inset-0 pointer-events-none">
  <div class="absolute inset-0 z-10">
    <MapLayoutLayer dimensions={mapDimensions} grid={map.grid} />
  </div>

  <div class="absolute inset-0 z-20 pointer-events-auto">
    <MapTokenLayer
      tokens={map.tokens}
      {canManageMap}
      {canDeleteMapTokens}
      {currentUserId}
      {hiddenTokenIds}
      {deletingTokenIds}
      {tokenPositions}
      {mapSurfaceElement}
      {mapDimensions}
      grid={map.grid}
      {onTokenDelete}
      {onTokenDragPreview}
      {onTokenDrop}
    />
  </div>
</div>
