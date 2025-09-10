import type { GridDimensions } from '@core/terrain-generation';

const BASE_SIZE = {
  width: 20,
  height: 20,
};

const MAP_VARIANCE = 0.2;

function applyVariance(value: number, variance: number): number {
  return Math.round(value * (1 + (Math.random() * 2 - 1) * variance));
}

function calcMapSizeForPlayers(numPlayers: number): GridDimensions {
  const extraPlayers = Math.max(0, numPlayers - 2);
  const raw = {
    width: BASE_SIZE.width + extraPlayers * 15,
    height: BASE_SIZE.height + extraPlayers * 15,
  };
  return {
    width: applyVariance(raw.width, MAP_VARIANCE),
    height: applyVariance(raw.height, MAP_VARIANCE),
  };
}

export { calcMapSizeForPlayers };
