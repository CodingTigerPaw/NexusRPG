<script lang="ts">
  import { onDestroy } from "svelte";
  import { Trash2 } from "lucide-svelte";
  import { clientPointToMapPosition, type ClientPoint } from "../services/map-coordinate";
  import { snapMapPositionToGrid } from "../services/map-layout";
  import type { MapDimensions, MapGridSettings, MapPosition, SessionMapToken } from "../types";

  type Props = {
    token: SessionMapToken;
    showLabel?: boolean;
    canManageMap?: boolean;
    mapSurfaceElement?: HTMLElement | null;
    mapDimensions?: MapDimensions | null;
    grid?: MapGridSettings | null;
    canMove?: boolean;
    canDelete?: boolean;
    isDeleting?: boolean;
    isDragging?: boolean;
    onDelete?: (token: SessionMapToken) => void;
    onDragStart?: (token: SessionMapToken) => void;
    onDragEnd?: (token: SessionMapToken) => void;
    onDragPreview?: (token: SessionMapToken, position: MapPosition) => void;
    onDrop?: (token: SessionMapToken, position: MapPosition) => void;
  };

  let {
    token,
    showLabel = true,
    canManageMap = false,
    mapSurfaceElement = null,
    mapDimensions = null,
    grid = null,
    canMove = false,
    canDelete = false,
    isDeleting = false,
    isDragging = false,
    onDelete,
    onDragStart,
    onDragEnd,
    onDragPreview,
    onDrop
  }: Props = $props();
  let imageFailed = $state(false);
  let activePointerId: number | null = null;
  let dragOffset = $state<MapPosition | null>(null);

  function clampNormalized(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  }

  function subtractPositions(left: MapPosition, right: MapPosition): MapPosition {
    return {
      x: left.x - right.x,
      y: left.y - right.y
    };
  }

  function resolveDraggedPosition(point: ClientPoint) {
    if (!mapSurfaceElement || !dragOffset) {
      return null;
    }

    const pointerPosition = clientPointToMapPosition(point, mapSurfaceElement);

    const freePosition = {
      x: clampNormalized(pointerPosition.x - dragOffset.x),
      y: clampNormalized(pointerPosition.y - dragOffset.y)
    };

    return snapMapPositionToGrid(freePosition, mapDimensions, grid);
  }

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest("button"));
  }

  function handlePointerDown(event: PointerEvent) {
    if (!canMove || isDeleting || !mapSurfaceElement || isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pointerPosition = clientPointToMapPosition(
      { x: event.clientX, y: event.clientY },
      mapSurfaceElement
    );

    // Offset miejsca złapania zapobiega skokowi tokena środkiem pod kursor.
    dragOffset = subtractPositions(pointerPosition, token.position);
    activePointerId = event.pointerId;
    onDragStart?.(token);

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  }

  function handlePointerMove(event: PointerEvent) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const nextPosition = resolveDraggedPosition({ x: event.clientX, y: event.clientY });

    if (!nextPosition) {
      return;
    }

    onDragPreview?.(token, nextPosition);
  }

  function handlePointerUp(event: PointerEvent) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const nextPosition = resolveDraggedPosition({ x: event.clientX, y: event.clientY });
    cleanupPointerDrag();

    if (nextPosition) {
      onDrop?.(token, nextPosition);
    }

    onDragEnd?.(token);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    cleanupPointerDrag();
    onDragEnd?.(token);
  }

  function cleanupPointerDrag() {
    activePointerId = null;
    dragOffset = null;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerCancel);
  }

  function resolveTokenSize(token: SessionMapToken) {
    // Token renderujemy jako kwadrat, bo okrągły pionek powinien zachować kształt
    // niezależnie od tego, czy backend albo formularz poda różne width/height.
    const relativeSize = Math.max(token.size.width, token.size.height);

    if (token.size.unit === "relative") {
      return {
        width: `${clampNormalized(relativeSize) * 100}%`
      };
    }

    return {
      width: "6%"
    };
  }

  const position = $derived({
    x: `${clampNormalized(token.position.x) * 100}%`,
    y: `${clampNormalized(token.position.y) * 100}%`
  });
  const size = $derived(resolveTokenSize(token));
  const rotation = $derived(Number.isFinite(token.rotation) ? token.rotation : 0);
  const fallbackLabel = $derived((token.label.trim() || "?").slice(0, 1).toUpperCase());

  onDestroy(cleanupPointerDrag);
</script>

<div
  data-map-token
  role="button"
  tabindex={canMove ? 0 : -1}
  aria-label={canMove ? `Przesuń token ${token.label}` : `Token ${token.label}`}
  class={[
    "absolute pointer-events-auto",
    canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default",
    // Odbiorcy dostają pozycje w dyskretnych eventach WS, więc krótka animacja
    // maskuje skoki bez dodawania większego ruchu sieciowego.
    isDragging ? "opacity-80" : "transition-[left,top] duration-75 ease-linear"
  ]}
  style:left={position.x}
  style:top={position.y}
  style:width={size.width}
  style:aspect-ratio="1 / 1"
  style:transform={`translate(-50%, -50%) rotate(${rotation}deg)`}
  title={token.label}
  onpointerdown={handlePointerDown}
>
  <div class="relative h-full w-full">
    <div class="h-full w-full overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm ring-1 ring-border">
      {#if token.asset.url && !imageFailed}
        <img
          class="h-full w-full object-cover"
          src={token.asset.url}
          alt={token.label}
          draggable="false"
          onerror={() => {
            imageFailed = true;
          }}
        />
      {:else}
        <div class="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
          {fallbackLabel}
        </div>
      {/if}
    </div>

    {#if canDelete}
      <button
        type="button"
        class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isDeleting}
        aria-label={`Usuń token ${token.label} z mapy`}
        title="Usuń token z mapy"
        onclick={() => onDelete?.(token)}
      >
        <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    {/if}

    {#if showLabel}
      <div class="pointer-events-none absolute left-1/2 top-full mt-1 max-w-28 -translate-x-1/2 truncate rounded-sm border bg-background/90 px-1.5 py-0.5 text-[10px] text-foreground shadow-sm">
        {token.label}
      </div>
    {/if}
  </div>
</div>
