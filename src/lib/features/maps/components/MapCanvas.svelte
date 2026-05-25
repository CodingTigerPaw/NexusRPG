<script lang="ts">
  import { onMount } from "svelte";
  import type { MapDimensions, MapPosition, SessionMap, SessionMapToken } from "../types";
  import MapLayerStack from "./MapLayerStack.svelte";

  type Props = {
    map: SessionMap;
    canManageMap?: boolean;
    canDeleteMapTokens?: boolean;
    currentUserId?: string;
    fitContainer?: boolean;
    hiddenTokenIds?: string[];
    deletingTokenIds?: string[];
    tokenPositions?: Record<string, MapPosition>;
    onTokenDelete?: (token: SessionMapToken) => void;
    onTokenDragPreview?: (token: SessionMapToken, position: MapPosition) => void;
    onTokenDrop?: (token: SessionMapToken, position: MapPosition) => void;
  };

  let {
    map,
    canManageMap = false,
    canDeleteMapTokens = false,
    currentUserId,
    fitContainer = false,
    hiddenTokenIds = [],
    deletingTokenIds = [],
    tokenPositions = {},
    onTokenDelete,
    onTokenDragPreview,
    onTokenDrop
  }: Props = $props();
  let imageLoaded = $state(false);
  let imageFailed = $state(false);
  let fitContainerElement = $state<HTMLElement | null>(null);
  let mapSurfaceElement = $state<HTMLElement | null>(null);
  let fittedSurfaceWidth = $state(0);
  let fittedSurfaceHeight = $state(0);
  let panStart: { pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null =
    null;
  let isPanning = $state(false);
  let lastFittedSurfaceKey = "";

  function resolveMapDimensions(map: SessionMap): MapDimensions | null {
    return map.dimensions ?? map.asset.dimensions ?? null;
  }

  function resolveMapAspectRatio(map: SessionMap) {
    const dimensions = resolveMapDimensions(map);

    if (!dimensions?.width || !dimensions.height) {
      return "16 / 9";
    }

    // Proporcje bierzemy z metadanych, bo tokeny będą używać współrzędnych 0..1
    // względem tej samej geometrii niezależnie od rozmiaru ekranu.
    return `${dimensions.width} / ${dimensions.height}`;
  }

  const aspectRatio = $derived(resolveMapAspectRatio(map));
  const mapDimensions = $derived(resolveMapDimensions(map));
  const numericAspectRatio = $derived(
    mapDimensions?.width && mapDimensions.height ? mapDimensions.width / mapDimensions.height : 16 / 9
  );

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateFittedSurfaceSize();
    });

    if (fitContainerElement) {
      resizeObserver.observe(fitContainerElement);
    }

    updateFittedSurfaceSize();

    return () => {
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    numericAspectRatio;
    fitContainer;
    updateFittedSurfaceSize();
  });

  function updateFittedSurfaceSize() {
    if (!fitContainer || !fitContainerElement) {
      fittedSurfaceWidth = 0;
      fittedSurfaceHeight = 0;
      return;
    }

    const containerRect = fitContainerElement.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    if (!containerWidth || !containerHeight) {
      return;
    }

    // W trybie stołu mapa ma przykryć cały viewport mapy bez pustych marginesów.
    // Nadmiar wymiaru zostawiamy jako scroll wewnętrzny, żeby nie zaburzać
    // geometrii tokenów i nie mieszać skali mapy z layoutem strony.
    if (containerWidth / containerHeight > numericAspectRatio) {
      fittedSurfaceWidth = Math.floor(containerWidth);
      fittedSurfaceHeight = Math.floor(containerWidth / numericAspectRatio);
    } else {
      fittedSurfaceHeight = Math.floor(containerHeight);
      fittedSurfaceWidth = Math.floor(containerHeight * numericAspectRatio);
    }

    centerMapScrollAfterResize();
  }

  function centerMapScrollAfterResize() {
    if (!fitContainer || !fitContainerElement || !fittedSurfaceWidth || !fittedSurfaceHeight) {
      return;
    }

    const nextKey = `${fittedSurfaceWidth}x${fittedSurfaceHeight}:${map.mapId}`;

    if (nextKey === lastFittedSurfaceKey) {
      return;
    }

    lastFittedSurfaceKey = nextKey;

    requestAnimationFrame(() => {
      if (!fitContainerElement) {
        return;
      }

      fitContainerElement.scrollLeft =
        (fitContainerElement.scrollWidth - fitContainerElement.clientWidth) / 2;
      fitContainerElement.scrollTop =
        (fitContainerElement.scrollHeight - fitContainerElement.clientHeight) / 2;
    });
  }

  function isMapPanBlockedTarget(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      Boolean(target.closest("button, input, select, textarea, a, [data-map-token]"))
    );
  }

  function handlePanPointerDown(event: PointerEvent) {
    if (!fitContainer || !fitContainerElement || event.button !== 0 || isMapPanBlockedTarget(event.target)) {
      return;
    }

    event.preventDefault();
    panStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: fitContainerElement.scrollLeft,
      scrollTop: fitContainerElement.scrollTop
    };
    isPanning = true;
    fitContainerElement.setPointerCapture(event.pointerId);
  }

  function handlePanPointerMove(event: PointerEvent) {
    if (!fitContainerElement || !panStart || panStart.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    fitContainerElement.scrollLeft = panStart.scrollLeft - (event.clientX - panStart.x);
    fitContainerElement.scrollTop = panStart.scrollTop - (event.clientY - panStart.y);
  }

  function finishPan(event: PointerEvent) {
    if (!fitContainerElement || !panStart || panStart.pointerId !== event.pointerId) {
      return;
    }

    if (fitContainerElement.hasPointerCapture(event.pointerId)) {
      fitContainerElement.releasePointerCapture(event.pointerId);
    }

    panStart = null;
    isPanning = false;
  }

  function preventWheelScroll(event: WheelEvent) {
    if (!fitContainer) {
      return;
    }

    // Widok stołu ma być przesuwany gestem przeciągnięcia. Wheel blokujemy,
    // żeby gracze nie przesuwali przypadkowo mapy podczas rzutu albo obsługi UI.
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<div
  bind:this={fitContainerElement}
  role={fitContainer ? "region" : undefined}
  aria-label={fitContainer ? "Przewijany widok mapy" : undefined}
  class={[
    fitContainer ? "map-scroll-viewport h-full min-h-0 w-full overflow-auto overscroll-contain bg-muted/30" : "",
    fitContainer ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
  ]}
  onpointerdown={handlePanPointerDown}
  onpointermove={handlePanPointerMove}
  onpointerup={finishPan}
  onpointercancel={finishPan}
  onwheel={preventWheelScroll}
>
  <div
    bind:this={mapSurfaceElement}
    role="application"
    aria-label={map.name ? `Mapa sesji: ${map.name}` : "Mapa sesji"}
    class={[
      "relative overflow-hidden rounded-md border bg-muted",
      fitContainer ? "shrink-0" : "w-full"
    ]}
    style:aspect-ratio={aspectRatio}
    style:width={fitContainer && fittedSurfaceWidth ? `${fittedSurfaceWidth}px` : undefined}
    style:height={fitContainer && fittedSurfaceHeight ? `${fittedSurfaceHeight}px` : undefined}
  >
  {#if !imageLoaded && !imageFailed}
    <div class="absolute inset-0 flex items-center justify-center bg-background/40 p-6 text-center text-sm text-muted-foreground">
      Ładowanie mapy...
    </div>
  {/if}

  {#if imageFailed}
    <div class="absolute inset-0 flex items-center justify-center bg-background/40 p-6 text-center text-sm text-destructive">
      Nie udało się załadować obrazu mapy.
    </div>
  {/if}

  <img
    class={[
      "absolute inset-0 h-full w-full object-contain transition-opacity",
      imageLoaded && !imageFailed ? "opacity-100" : "opacity-0"
    ]}
    src={map.asset.url}
    alt={map.name ?? "Mapa sesji"}
    onload={() => {
      imageLoaded = true;
      imageFailed = false;
    }}
    onerror={() => {
      imageFailed = true;
      imageLoaded = false;
    }}
  />

    <MapLayerStack
      {map}
      {canManageMap}
      {canDeleteMapTokens}
      {currentUserId}
      {hiddenTokenIds}
      {deletingTokenIds}
      {tokenPositions}
      {mapSurfaceElement}
      {mapDimensions}
      {onTokenDelete}
      {onTokenDragPreview}
      {onTokenDrop}
    />
  </div>
</div>

<style>
  .map-scroll-viewport {
    scrollbar-width: none;
    -ms-overflow-style: none;
    touch-action: none;
  }

  .map-scroll-viewport::-webkit-scrollbar {
    display: none;
  }
</style>
