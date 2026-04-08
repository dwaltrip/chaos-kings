/*
  Quick analysis of N-corridor state-graph results:
  1. States per frontier config — how many (tick, army) pairs share the same frontier tuple?
  2. Free threshold — for what total frontier N do ALL frontier configs collapse to 1 state?
*/

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import type { AlgoConfig } from '../abstract-moves';
import { MAX_TICK } from '../constants';

import type { MultiCorridorState } from './q4-equiv-burst-multi-corridor-state-traverse';
import { exploreMultiCorridorStates } from './q4-equiv-burst-multi-corridor-state-traverse';

// ---- Helpers ---------------------------------------------------------------

function frontierKey(frontiers: number[]): string {
  return frontiers.join(',');
}

function totalFrontier(frontiers: number[]): number {
  return frontiers.reduce((a, b) => a + b, 0);
}

// ---- Analysis 1: States per frontier config --------------------------------

function analyzeStatesPerFrontier(stateMap: Map<string, MultiCorridorState>) {
  // Group states by frontier tuple
  const byFrontier = new Map<string, MultiCorridorState[]>();
  for (const state of stateMap.values()) {
    const fk = frontierKey(state.frontiers);
    let group = byFrontier.get(fk);
    if (!group) {
      group = [];
      byFrontier.set(fk, group);
    }
    group.push(state);
  }

  // Distribution of state counts per frontier config
  const countDist = new Map<number, number>();
  for (const states of byFrontier.values()) {
    const n = states.length;
    countDist.set(n, (countDist.get(n) || 0) + 1);
  }

  const maxStates = Math.max(...Array.from(countDist.keys()));
  const sortedCounts = Array.from(countDist.entries()).sort((a, b) => a[0] - b[0]);

  console.log('    States-per-frontier distribution:');
  for (const [stateCount, numConfigs] of sortedCounts) {
    console.log(`      ${stateCount} state(s): ${numConfigs} frontier configs`);
  }
  console.log(`    Max states for any frontier config: ${maxStates}`);

  return { byFrontier, maxStates };
}

// ---- Analysis 2: Free threshold --------------------------------------------

function analyzeFreeThreshold(
  stateMap: Map<string, MultiCorridorState>,
  byFrontier: Map<string, MultiCorridorState[]>,
) {
  // For each total frontier N, check if ALL frontier configs with that total
  // collapse to exactly 1 state
  const maxTotal = Math.max(
    ...Array.from(stateMap.values()).map((s) => totalFrontier(s.frontiers)),
  );

  let freeThreshold = 0;

  console.log(
    '    Free threshold analysis (total frontier → all configs have 1 state?):',
  );
  for (let n = 1; n <= maxTotal; n++) {
    let allSingle = true;
    let configCount = 0;

    for (const [fk, states] of byFrontier) {
      const frontiers = fk.split(',').map(Number);
      if (totalFrontier(frontiers) !== n) continue;
      configCount++;
      if (states.length > 1) {
        allSingle = false;
      }
    }

    if (configCount === 0) continue;

    if (allSingle && freeThreshold === n - 1) {
      freeThreshold = n;
    }

    if (n <= 8 || !allSingle) {
      const marker = allSingle ? '✓' : '✗';
      console.log(
        `      N=${n}: ${configCount} configs, all single=${allSingle} ${marker}`,
      );
    }
  }

  console.log(`    Free threshold (contiguous from 1): N <= ${freeThreshold}`);

  return { freeThreshold };
}

// ---- Main ------------------------------------------------------------------

interface Options {
  maxTick: string;
  corridors: string;
}

const isMain = process.argv[1]?.endsWith('q4-multi-corridor-analysis.ts');
if (isMain) {
  const { opts } = parseTypedCommand(
    createTypedCommand<Options>()
      .name('q4-multi-corridor-analysis')
      .description('Analyze N-corridor state-graph structure')
      .option('--max-tick <n>', 'Maximum tick', String(MAX_TICK))
      .option('--corridors <n>', 'Comma-separated corridor counts', '2,3,4'),
  );

  const cfg: AlgoConfig = { maxTick: Number(opts.maxTick) };
  const counts = opts.corridors.split(',').map(Number);

  console.log();
  for (const numCorridors of counts) {
    const { stateMap } = exploreMultiCorridorStates(numCorridors, cfg);

    console.log(`  === ${numCorridors}-corridor | MAX_TICK=${cfg.maxTick} ===`);
    console.log();

    const { byFrontier } = analyzeStatesPerFrontier(stateMap);
    console.log();

    analyzeFreeThreshold(stateMap, byFrontier);
    console.log();
  }
}
