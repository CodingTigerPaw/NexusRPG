<script lang="ts">
  import { canMoveMapToken } from "../services/map-permissions";
  import type { MapDimensions, MapGridSettings, MapPosition, SessionMapToken } from "../types";
  import MapToken from "./MapToken.svelte";

  type Props = {
    tokens: SessionMapToken[];
    canManageMap: boolean;
    canDeleteMapTokens?: boolean;
    currentUserId?: string;
    hiddenTokenIds?: string[];
    deletingTokenIds?: string[];
    tokenPositions?: Record<string, MapPosition>;
    mapSurfaceElement?: HTMLElement | null;
    mapDimensions?: MapDimensions | null;
    grid?: MapGridSettings | null;
    onTokenDelete?: (token: SessionMapToken) => void;
    onTokenDragPreview?: (token: SessionMapToken, position: MapPosition) => void;
    onTokenDrop?: (token: SessionMapToken, position: MapPosition) => void;
  };

  let {
    tokens,
    canManageMap,
    canDeleteMapTokens = false,
    currentUserId,
    hiddenTokenIds = [],
    deletingTokenIds = [],
    tokenPositions = {},
    mapSurfaceElement = null,
    mapDimensions = null,
    grid = null,
    onTokenDelete,
    onTokenDragPreview,
    onTokenDrop
  }: Props = $props();
  let draggingTokenId = $state<string | null>(null);

  function canSeeToken(token: SessionMapToken) {
    if (canManageMap) {
      return true;
    }

    return token.visibility === "public";
  }

  function sortTokens(left: SessionMapToken, right: SessionMapToken) {
    return left.label.localeCompare(right.label, "pl");
  }

  // Widoczność filtrujemy w warstwie, żeby MapToken pozostał prostym rendererem pojedynczego tokena.
  const visibleTokens = $derived(
    tokens
      .filter((token) => !hiddenTokenIds.includes(token.tokenId))
      .filter(canSeeToken)
      .toSorted(sortTokens)
  );
</script>

<div class="absolute inset-0">
  {#each visibleTokens as token (token.tokenId)}
    <MapToken
      token={{ ...token, position: tokenPositions[token.tokenId] ?? token.position }}
      {canManageMap}
      {mapSurfaceElement}
      {mapDimensions}
      {grid}
      canMove={canMoveMapToken(token, { canManageMap, currentUserId })}
      canDelete={canDeleteMapTokens && Boolean(onTokenDelete)}
      isDragging={draggingTokenId === token.tokenId}
      isDeleting={deletingTokenIds.includes(token.tokenId)}
      onDelete={onTokenDelete}
      onDragStart={(draggedToken) => (draggingTokenId = draggedToken.tokenId)}
      onDragEnd={(draggedToken) => {
        if (draggingTokenId === draggedToken.tokenId) {
          draggingTokenId = null;
        }
      }}
      onDragPreview={onTokenDragPreview}
      onDrop={onTokenDrop}
    />
  {/each}
</div>
