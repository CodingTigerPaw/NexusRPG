<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { Minus, Wrench } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import type { ToolboxPosition } from '../types';

  type Props = {
    title?: string;
    initialPosition?: ToolboxPosition;
    initialCollapsed?: boolean;
    children?: import('svelte').Snippet;
  };

  let {
    title = 'Narzędzia',
    initialPosition,
    initialCollapsed = false,
    children
  }: Props = $props();

  let position = $state<ToolboxPosition>({ x: 24, y: 96 });
  let isCollapsed = $state(false);
  let isDragging = $state(false);
  let dragOffset = $state<ToolboxPosition>({ x: 0, y: 0 });
  let windowElement = $state<HTMLElement | null>(null);

  onMount(() => {
    isCollapsed = initialCollapsed;
    // Domyślna prawa strona omija kompaktowy pasek karty postaci i główne kontrolki mapy.
    position = initialPosition ?? {
      x: window.innerWidth - (initialCollapsed ? 208 : 384),
      y: Math.max(readTopOffset() + 128, Math.round(window.innerHeight * 0.22))
    };
    void tick().then(clampToViewport);
    window.addEventListener('resize', clampToViewport);
  });

  onDestroy(() => {
    window.removeEventListener('resize', clampToViewport);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDragging);
  });

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function readTopOffset() {
    return Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--app-navigation-height')
    ) || 0;
  }

  function clampToViewport() {
    const rect = windowElement?.getBoundingClientRect();
    const width = rect?.width ?? (isCollapsed ? 176 : 360);
    const height = rect?.height ?? (isCollapsed ? 44 : 320);
    // Respektujemy wysokość globalnej nawigacji, żeby toolbox nie znikał pod stałymi elementami aplikacji.
    const topOffset = readTopOffset();

    position = {
      x: clamp(position.x, 8, window.innerWidth - width - 8),
      y: clamp(position.y, topOffset + 8, window.innerHeight - height - 8)
    };
  }

  function startDragging(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const rect = windowElement?.getBoundingClientRect();

    isDragging = true;
    dragOffset = {
      x: event.clientX - (rect?.left ?? position.x),
      y: event.clientY - (rect?.top ?? position.y)
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging) {
      return;
    }

    position = {
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y
    };
    clampToViewport();
  }

  function stopDragging() {
    isDragging = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDragging);
    clampToViewport();
  }

  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
    void tick().then(clampToViewport);
  }
</script>

<div
  bind:this={windowElement}
  class={[
    'pointer-events-auto fixed left-0 top-0 z-[95] rounded-md border border-primary/50 bg-card/95 text-card-foreground shadow-2xl shadow-black/40 ring-1 ring-primary/30 backdrop-blur',
    isCollapsed ? 'w-44' : 'w-[min(22rem,calc(100vw-1rem))]',
    isDragging ? 'select-none' : ''
  ]}
  style={`transform: translate3d(${position.x}px, ${position.y}px, 0);`}
>
  <div
    class={[
      'flex cursor-grab touch-none items-center justify-between gap-2 border-b px-3 py-2',
      isDragging ? 'cursor-grabbing' : ''
    ]}
    role="presentation"
    aria-label={`Przeciągnij okno: ${title}`}
    onpointerdown={startDragging}
  >
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <Wrench class="size-4 shrink-0 text-primary" />
      <span class="truncate text-sm font-medium">{title}</span>
    </div>

    <Button
      type="button"
      size="icon"
      variant="ghost"
      class="size-7"
      onclick={toggleCollapsed}
      aria-label={isCollapsed ? 'Rozwiń toolbox' : 'Zwiń toolbox'}
    >
      <Minus class={`size-4 transition-transform ${isCollapsed ? 'rotate-90' : ''}`} />
    </Button>
  </div>

  {#if !isCollapsed}
    <div class="max-h-[min(32rem,calc(100vh-8rem))] overflow-y-auto p-3">
      {@render children?.()}
    </div>
  {/if}
</div>
