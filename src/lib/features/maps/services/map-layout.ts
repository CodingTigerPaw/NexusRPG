import type { MapDimensions, MapGridSettings, MapPosition } from "../types";
import { clampNormalized } from "./map-coordinate";

export type MapGridCell = {
  center: { x: number; y: number };
  points: { x: number; y: number }[];
};

type PixelPoint = {
  x: number;
  y: number;
};

const minimumCellSize = 8;
const maxGeneratedCells = 12000;

function normalizeCellSize(grid: MapGridSettings) {
  return Math.max(minimumCellSize, grid.cellSize);
}

function resolveOffset(grid: MapGridSettings): PixelPoint {
  return {
    x: grid.offsetX ?? 0,
    y: grid.offsetY ?? 0
  };
}

function mapPositionToPixel(position: MapPosition, dimensions: MapDimensions): PixelPoint {
  return {
    x: clampNormalized(position.x) * dimensions.width,
    y: clampNormalized(position.y) * dimensions.height
  };
}

function pixelToMapPosition(point: PixelPoint, dimensions: MapDimensions): MapPosition {
  return {
    x: clampNormalized(point.x / dimensions.width),
    y: clampNormalized(point.y / dimensions.height)
  };
}

function snapSquarePosition(point: PixelPoint, dimensions: MapDimensions, grid: MapGridSettings) {
  const cellSize = normalizeCellSize(grid);
  const offset = resolveOffset(grid);

  // Snapujemy do środka komórki, bo token reprezentuje pionek stojący na polu,
  // a nie narożnik pola. Ten sam wybór będzie pasował później do zasięgów i ruchu.
  return pixelToMapPosition(
    {
      x: offset.x + (Math.round((point.x - offset.x) / cellSize - 0.5) + 0.5) * cellSize,
      y: offset.y + (Math.round((point.y - offset.y) / cellSize - 0.5) + 0.5) * cellSize
    },
    dimensions
  );
}

function createHexPoints(center: PixelPoint, radius: number, startAngle: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = startAngle + (Math.PI / 3) * index;

    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function getHexMetrics(grid: MapGridSettings) {
  const cellSize = normalizeCellSize(grid);

  if (grid.type === "hex-horizontal") {
    return {
      radius: cellSize / 2,
      columnStep: cellSize,
      rowStep: (Math.sqrt(3) / 2) * cellSize,
      staggerAxis: "row" as const,
      startAngle: Math.PI / 6
    };
  }

  return {
    radius: cellSize / 2,
    columnStep: (Math.sqrt(3) / 2) * cellSize,
    rowStep: cellSize,
    staggerAxis: "column" as const,
    startAngle: 0
  };
}

export function generateHexCells(dimensions: MapDimensions, grid: MapGridSettings): MapGridCell[] {
  const metrics = getHexMetrics(grid);
  const offset = resolveOffset(grid);
  const cells: MapGridCell[] = [];
  const columnCount = Math.ceil(dimensions.width / metrics.columnStep) + 4;
  const rowCount = Math.ceil(dimensions.height / metrics.rowStep) + 4;

  for (let row = -2; row < rowCount; row += 1) {
    for (let column = -2; column < columnCount; column += 1) {
      if (cells.length >= maxGeneratedCells) {
        return cells;
      }

      const center = {
        x:
          offset.x +
          column * metrics.columnStep +
          (metrics.staggerAxis === "row" && Math.abs(row % 2) === 1 ? metrics.columnStep / 2 : 0),
        y:
          offset.y +
          row * metrics.rowStep +
          (metrics.staggerAxis === "column" && Math.abs(column % 2) === 1 ? metrics.rowStep / 2 : 0)
      };

      if (
        center.x < -metrics.radius ||
        center.y < -metrics.radius ||
        center.x > dimensions.width + metrics.radius ||
        center.y > dimensions.height + metrics.radius
      ) {
        continue;
      }

      cells.push({
        center,
        points: createHexPoints(center, metrics.radius, metrics.startAngle)
      });
    }
  }

  return cells;
}

function snapHexPosition(point: PixelPoint, dimensions: MapDimensions, grid: MapGridSettings) {
  const cells = generateHexCells(dimensions, grid);
  let closestCenter: PixelPoint | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const distance = (cell.center.x - point.x) ** 2 + (cell.center.y - point.y) ** 2;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCenter = cell.center;
    }
  }

  return pixelToMapPosition(closestCenter ?? point, dimensions);
}

export function snapMapPositionToGrid(
  position: MapPosition,
  dimensions: MapDimensions | null | undefined,
  grid: MapGridSettings | null | undefined
) {
  if (!dimensions || !grid?.enabled) {
    return position;
  }

  const point = mapPositionToPixel(position, dimensions);

  if (grid.type === "square") {
    return snapSquarePosition(point, dimensions, grid);
  }

  return snapHexPosition(point, dimensions, grid);
}

