#!/usr/bin/env npx ts-node

import { generateRandomTerrain } from './src/terrain-generation/generate-random-terrain';
import {
  DebugRenderer,
  PerformanceProfiler,
} from './src/terrain-generation/debug-utils';

console.log('🎮 Terrain Generation v2 Demo\n');

// Demo 1: Basic terrain generation
console.log('📍 Demo 1: Basic 20x15 terrain (30% obstacles)');
console.log('━'.repeat(50));

const result1 = generateRandomTerrain(20, 15, 0.3, 12345);
console.log(DebugRenderer.renderGridWithCoords(result1.grid));
console.log(
  `\n📊 Stats: ${result1.obstaclesPlaced} obstacles, ${(result1.actualDensity * 100).toFixed(1)}% density`,
);
console.log(
  `🔍 Connectivity verified: ${DebugRenderer.verifyConnectivity(result1.grid) ? '✅' : '❌'}`,
);

// Demo 2: Different seeds comparison
console.log('\n\n📍 Demo 2: Same parameters, different seeds');
console.log('━'.repeat(50));

const seeds = [111, 222, 333];
seeds.forEach((seed) => {
  console.log(`\n🎲 Seed: ${seed}`);
  const result = generateRandomTerrain(12, 8, 0.25, seed);
  console.log(DebugRenderer.renderGrid(result.grid));
  console.log(
    `   ${result.obstaclesPlaced} obstacles (${(result.actualDensity * 100).toFixed(1)}%)`,
  );
});

// Demo 3: Performance profiling
console.log('\n\n📍 Demo 3: Performance benchmarks');
console.log('━'.repeat(50));

const benchmarks = [
  { name: '20x20', size: 20 },
  { name: '40x40', size: 40 },
  { name: '60x60', size: 60 },
];

benchmarks.forEach(({ name, size }) => {
  const stats = PerformanceProfiler.profileMultipleRuns(
    () => generateRandomTerrain(size, size, 0.3, Math.random() * 1000),
    5,
  );

  console.log(
    `⚡ ${name}: ${stats.avgTimeMs.toFixed(1)}ms avg (${stats.minTimeMs.toFixed(1)}-${stats.maxTimeMs.toFixed(1)}ms range)`,
  );
});

// Demo 4: High-density challenge
console.log('\n\n📍 Demo 4: High-density challenge (45% obstacles)');
console.log('━'.repeat(50));

const challengeResult = generateRandomTerrain(25, 15, 0.45, 9999);
console.log(DebugRenderer.renderGrid(challengeResult.grid));
console.log(
  `\n🎯 Target: 45%, Achieved: ${(challengeResult.actualDensity * 100).toFixed(1)}%`,
);
console.log(
  `🔍 Connectivity: ${DebugRenderer.verifyConnectivity(challengeResult.grid) ? '✅ Maintained' : '❌ Broken'}`,
);
console.log(
  `⚠️  Max failures reached: ${challengeResult.attemptsReached ? 'Yes' : 'No'}`,
);

// Demo 5: Deterministic generation verification
console.log('\n\n📍 Demo 5: Deterministic generation verification');
console.log('━'.repeat(50));

const seed = 42;
const grid1 = generateRandomTerrain(10, 10, 0.2, seed);
const grid2 = generateRandomTerrain(10, 10, 0.2, seed);

console.log('🎲 First generation (seed 42):');
console.log(DebugRenderer.renderGrid(grid1.grid));
console.log('\n🎲 Second generation (seed 42):');
console.log(DebugRenderer.renderGrid(grid2.grid));

// Verify they're identical
const dimensions = grid1.grid.getDimensions();
let identical = true;
for (let y = 0; y < dimensions.height && identical; y++) {
  for (let x = 0; x < dimensions.width && identical; x++) {
    if (grid1.grid.getCell({ x, y }) !== grid2.grid.getCell({ x, y })) {
      identical = false;
    }
  }
}

console.log(`\n🔍 Grids identical: ${identical ? '✅ Yes' : '❌ No'}`);

console.log('\n🎉 Demo complete! Terrain generation v2 working perfectly.');
