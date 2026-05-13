<script lang="ts">
  import { generateHexCells } from "../services/map-layout";
  import type { MapDimensions, MapGridSettings } from "../types";

  type Props = {
    dimensions?: MapDimensions | null;
    grid?: MapGridSettings | null;
  };

  let { dimensions = null, grid = null }: Props = $props();

  const resolvedColor = $derived(grid?.color ?? "rgba(255,255,255,0.45)");
  const resolvedOpacity = $derived(grid?.opacity ?? 0.45);
  const squarePatternId = $derived(`map-square-grid-${grid?.cellSize ?? 0}-${grid?.offsetX ?? 0}-${grid?.offsetY ?? 0}`);
  const hexCells = $derived(
    dimensions && grid?.enabled && grid.type !== "square" ? generateHexCells(dimensions, grid) : []
  );
</script>

{#if dimensions && grid?.enabled}
  <!-- Layout jest osobną warstwą, bo snapowanie, zasięgi i podświetlenia pól
    powinny rozwijać się niezależnie od renderowania tokenów. -->
  <svg
    class="absolute inset-0 h-full w-full"
    viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {#if grid.type === "square"}
      <defs>
        <pattern
          id={squarePatternId}
          width={grid.cellSize}
          height={grid.cellSize}
          patternUnits="userSpaceOnUse"
          x={grid.offsetX ?? 0}
          y={grid.offsetY ?? 0}
        >
          <path
            d={`M ${grid.cellSize} 0 L 0 0 0 ${grid.cellSize}`}
            fill="none"
            stroke={resolvedColor}
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
        </pattern>
      </defs>

      <rect
        width={dimensions.width}
        height={dimensions.height}
        fill={`url(#${squarePatternId})`}
        opacity={resolvedOpacity}
      />
    {:else}
      <g fill="none" stroke={resolvedColor} stroke-width="1" opacity={resolvedOpacity} vector-effect="non-scaling-stroke">
        {#each hexCells as cell, index (`${index}-${cell.center.x}-${cell.center.y}`)}
          <polygon points={cell.points.map((point) => `${point.x},${point.y}`).join(" ")} />
        {/each}
      </g>
    {/if}
  </svg>
{/if}

