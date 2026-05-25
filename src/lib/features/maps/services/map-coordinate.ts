import type { MapPosition } from "../types";

export type ClientPoint = {
  x: number;
  y: number;
};

export function clampNormalized(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function clientPointToMapPosition(
  point: ClientPoint,
  mapElement: HTMLElement
): MapPosition {
  const rect = mapElement.getBoundingClientRect();

  // Pozycja tokena jest liczona względem powierzchni mapy, nie viewportu,
  // bo backend przechowuje współrzędne 0..1 niezależne od ekranu gracza.
  return {
    x: clampNormalized((point.x - rect.left) / rect.width),
    y: clampNormalized((point.y - rect.top) / rect.height)
  };
}
