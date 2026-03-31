/*
  Equivalent Burst Chains — Double-Sided Corridor

  Model:
  - General at center, corridor extends left and right
  - Each burst chooses a direction (L or R) and a size
  - Re-traversal cost = that direction's frontier (walk back through owned tiles)
  - Army needed per burst = burstSize + 1 (captures + 1 left behind)
  - Total moves per burst = directionFrontier + burstSize
  - After burst: generalArmy = 1 + production ticks during burst

  State = (tick, generalArmy, leftFrontier, rightFrontier)
  Two chains are equivalent if they produce the same state.
*/

import * as fs from 'fs';
import * as path from 'path';

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import type { AlgoConfig } from '../abstract-moves';
import { countProductionTicks } from '../abstract-moves';
import { tickForGeneralArmy } from '../helpers';
import { MAX_TICK } from '../constants';
import { formatTable } from '@/utils/format';
import { writeJson } from '@/utils/json';

// ---- Types -----------------------------------------------------------------

type Direction = 'L' | 'R';

interface DoubleCorridorState {
  tick: number;
  generalArmy: number;
  leftFrontier: number;
  rightFrontier: number;
}

type BurstStep = { dir: Direction; size: number };
type BurstChain = BurstStep[];

interface EquivalenceGroup {
  state: DoubleCorridorState;
  chains: BurstChain[];
}

// ---- Core logic ------------------------------------------------------------

function corridorBurstDouble(
  state: DoubleCorridorState,
  dir: Direction,
  burstSize: number,
): DoubleCorridorState {
  const armyNeeded = burstSize + 1;
  const frontier = dir === 'L' ? state.leftFrontier : state.rightFrontier;

  let readyTick = state.tick;
  if (state.generalArmy < armyNeeded) {
    readyTick = tickForGeneralArmy(state.tick, state.generalArmy, armyNeeded);
  }

  const totalMoves = frontier + burstSize;
  const firstMoveTick = readyTick + 1;
  const endTick = firstMoveTick + totalMoves - 1;
  const newUnits = countProductionTicks(firstMoveTick, endTick);

  return {
    tick: endTick,
    generalArmy: 1 + newUnits,
    leftFrontier: state.leftFrontier + (dir === 'L' ? burstSize : 0),
    rightFrontier: state.rightFrontier + (dir === 'R' ? burstSize : 0),
  };
}

// ---- Enumeration -----------------------------------------------------------

function stateKey(s: DoubleCorridorState): string {
  return `${s.tick},${s.generalArmy},${s.leftFrontier},${s.rightFrontier}`;
}

function exploreDoubleCorridor(cfg: AlgoConfig) {
  const classesByKey = new Map<string, BurstChain[]>();
  const DIRECTIONS: Direction[] = ['L', 'R'];

  function recurse(state: DoubleCorridorState, chain: BurstStep[]): void {
    if (chain.length > 0) {
      const key = stateKey(state);
      let group = classesByKey.get(key);
      if (!group) {
        group = [];
        classesByKey.set(key, group);
      }
      group.push([...chain]);
    }

    for (const dir of DIRECTIONS) {
      const frontier = dir === 'L' ? state.leftFrontier : state.rightFrontier;

      for (let size = 1; size <= cfg.maxTick; size++) {
        const armyNeeded = size + 1;

        let readyTick = state.tick;
        if (state.generalArmy < armyNeeded) {
          readyTick = tickForGeneralArmy(state.tick, state.generalArmy, armyNeeded);
        }
        const totalMoves = frontier + size;
        const endTick = readyTick + 1 + totalMoves - 1;

        if (endTick > cfg.maxTick) break;

        const nextState = corridorBurstDouble(state, dir, size);
        chain.push({ dir, size });
        recurse(nextState, chain);
        chain.pop();
      }
    }
  }

  const initialState: DoubleCorridorState = {
    tick: 0,
    generalArmy: 1,
    leftFrontier: 0,
    rightFrontier: 0,
  };
  recurse(initialState, []);

  const allGroups: EquivalenceGroup[] = [];
  for (const [key, chains] of classesByKey) {
    const [tick, generalArmy, leftFrontier, rightFrontier] = key.split(',').map(Number);
    allGroups.push({
      state: { tick, generalArmy, leftFrontier, rightFrontier },
      chains,
    });
  }
  allGroups.sort(
    (a, b) =>
      totalFrontier(a.state) - totalFrontier(b.state) || a.state.tick - b.state.tick,
  );

  const equivalentGroups = allGroups.filter((g) => g.chains.length > 1);
  const totalChains = allGroups.reduce((sum, g) => sum + g.chains.length, 0);

  return { totalChains, allGroups, equivalentGroups };
}

// ---- Analysis helpers ------------------------------------------------------

function totalFrontier(s: DoubleCorridorState): number {
  return s.leftFrontier + s.rightFrontier;
}

function fmtChain(chain: BurstChain): string {
  return '[' + chain.map((b) => `${b.dir}${b.size}`).join(', ') + ']';
}

function mirrorChain(chain: BurstChain): BurstChain {
  return chain.map((b) => ({
    dir: (b.dir === 'L' ? 'R' : 'L') as Direction,
    size: b.size,
  }));
}

function mirrorStateKey(s: DoubleCorridorState): string {
  return stateKey({
    tick: s.tick,
    generalArmy: s.generalArmy,
    leftFrontier: s.rightFrontier,
    rightFrontier: s.leftFrontier,
  });
}

function chainKey(chain: BurstChain): string {
  return chain.map((b) => `${b.dir}${b.size}`).join(',');
}

// Check if two chains have the same sizes but different direction orderings
function samesSizesOnly(a: BurstChain, b: BurstChain): boolean {
  if (a.length !== b.length) return false;
  return a.every((step, i) => step.size === b[i].size);
}

// ---- Direction ordering analysis -------------------------------------------

function analyzeDirectionOrdering(allGroups: EquivalenceGroup[]): string[] {
  // For each equivalence group, check how many chains differ only in direction ordering
  let groupsWithReorderings = 0;
  let totalReorderingPairs = 0;

  for (const group of allGroups) {
    if (group.chains.length < 2) continue;

    let hasReordering = false;
    for (let i = 0; i < group.chains.length; i++) {
      for (let j = i + 1; j < group.chains.length; j++) {
        const a = group.chains[i];
        const b = group.chains[j];
        if (samesSizesOnly(a, b) && a.some((step, k) => step.dir !== b[k].dir)) {
          totalReorderingPairs++;
          hasReordering = true;
        }
      }
    }
    if (hasReordering) groupsWithReorderings++;
  }

  return [
    '## Direction Ordering',
    '',
    'Chains with same burst sizes but different L/R orderings that land in the same state:',
    '',
    `- Groups containing direction reorderings: ${groupsWithReorderings}`,
    `- Total reordering pairs: ${totalReorderingPairs}`,
  ];
}

// ---- Symmetry analysis -----------------------------------------------------

function analyzeSymmetry(allGroups: EquivalenceGroup[]): string[] {
  const stateKeys = new Set(allGroups.map((g) => stateKey(g.state)));

  let selfSymmetric = 0;
  let hasMirrorTwin = 0;
  let noMirrorTwin = 0;

  for (const group of allGroups) {
    const s = group.state;
    const isSelfSym = s.leftFrontier === s.rightFrontier;
    const mirrorKey = mirrorStateKey(s);

    if (isSelfSym) {
      selfSymmetric++;
    } else if (stateKeys.has(mirrorKey)) {
      hasMirrorTwin++;
    } else {
      noMirrorTwin++;
    }
  }

  // hasMirrorTwin counts each side of the pair, so pairs = hasMirrorTwin / 2
  return [
    '## Symmetry (L ↔ R)',
    '',
    `- Self-symmetric states (leftF = rightF): ${selfSymmetric}`,
    `- States with a mirror twin: ${hasMirrorTwin} (${hasMirrorTwin / 2} pairs)`,
    `- States with no mirror twin: ${noMirrorTwin}`,
  ];
}

// ---- Output ----------------------------------------------------------------

function writeSummary(
  cfg: AlgoConfig,
  totalChains: number,
  allGroups: EquivalenceGroup[],
  equivalentGroups: EquivalenceGroup[],
) {
  const lines: string[] = [
    '# Equivalent Burst Chains — Double-Sided Corridor',
    '',
    `MAX_TICK=${cfg.maxTick}`,
    '\n---\n',
    `Total chains:    ${totalChains}`,
    `Unique states:   ${allGroups.length}`,
    `  - with 1 chain:   ${allGroups.length - equivalentGroups.length}`,
    `  - with 2+ chains: ${equivalentGroups.length}`,
    `Reduction ratio: ${(totalChains / allGroups.length).toFixed(1)}x`,
    '',
  ];

  // Equivalence group table
  const rows = equivalentGroups.map(({ state, chains }) => {
    const shortest = chains.reduce((a, b) => (a.length <= b.length ? a : b));
    const longest = chains.reduce((a, b) => (a.length >= b.length ? a : b));
    return [
      String(totalFrontier(state)),
      `${state.leftFrontier},${state.rightFrontier}`,
      String(state.tick),
      String(state.generalArmy),
      String(chains.length),
      fmtChain(shortest),
      fmtChain(longest),
    ];
  });
  lines.push(
    formatTable(['totalF', 'L,R', 'tick', 'army', 'chains', 'shortest', 'longest'], rows),
  );

  lines.push('');
  lines.push(...analyzeDirectionOrdering(allGroups));
  lines.push('');
  lines.push(...analyzeSymmetry(allGroups));

  return lines.join('\n') + '\n';
}

// ---- Aggregate stats -------------------------------------------------------

const CHAIN_TRUNCATION_THRESHOLD = 20;
const REPRESENTATIVE_COUNT = 5;

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function fmtChainCompact(chain: BurstChain): string[] {
  return chain.map((b) => `${b.dir}${b.size}`);
}

function computeGroupStats(chains: BurstChain[]) {
  const lengths = chains.map((c) => c.length).sort((a, b) => a - b);
  const allBurstSizes = chains.flatMap((c) => c.map((b) => b.size));
  const leftCounts = chains.map((c) => c.filter((b) => b.dir === 'L').length);
  const rightCounts = chains.map((c) => c.filter((b) => b.dir === 'R').length);
  const avgLeft = leftCounts.reduce((a, b) => a + b, 0) / chains.length;
  const avgRight = rightCounts.reduce((a, b) => a + b, 0) / chains.length;

  return {
    chainLengths: {
      min: lengths[0],
      p10: percentile(lengths, 10),
      median: percentile(lengths, 50),
      p90: percentile(lengths, 90),
      max: lengths[lengths.length - 1],
    },
    burstSizes: {
      min: Math.min(...allBurstSizes),
      max: Math.max(...allBurstSizes),
    },
    directionSplit: {
      avgLeft: Math.round(avgLeft * 100) / 100,
      avgRight: Math.round(avgRight * 100) / 100,
    },
  };
}

function writeFullData(allGroups: EquivalenceGroup[]) {
  return allGroups.map(({ state, chains }) => {
    const stats = computeGroupStats(chains);
    const sorted = [...chains].sort((a, b) => a.length - b.length);

    let chainsData: string[][];
    let truncated = false;
    if (chains.length <= CHAIN_TRUNCATION_THRESHOLD) {
      chainsData = sorted.map(fmtChainCompact);
    } else {
      truncated = true;
      const shortest = sorted.slice(0, REPRESENTATIVE_COUNT);
      const longest = sorted.slice(-REPRESENTATIVE_COUNT);
      chainsData = [...shortest, ...longest].map(fmtChainCompact);
    }

    return {
      totalFrontier: totalFrontier(state),
      leftFrontier: state.leftFrontier,
      rightFrontier: state.rightFrontier,
      tick: state.tick,
      army: state.generalArmy,
      chainCount: chains.length,
      truncated,
      stats,
      chains: chainsData,
    };
  });
}

// ---- CLI + Main ------------------------------------------------------------

interface Q3Options {
  maxTick: string;
}

function run(cfg: AlgoConfig) {
  const OUTPUT_DIR = path.resolve(__dirname, '../output/q3');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const { totalChains, allGroups, equivalentGroups } = exploreDoubleCorridor(cfg);
  const tag = `max-tick-${cfg.maxTick}`;

  console.log(`\n  MAX_TICK=${cfg.maxTick}`);
  console.log(`  Total chains: ${totalChains}`);
  console.log(`  Unique states: ${allGroups.length}`);
  console.log(`  States with equivalent chains: ${equivalentGroups.length}`);
  console.log(`  Reduction ratio: ${(totalChains / allGroups.length).toFixed(1)}x\n`);

  const summaryContent = writeSummary(cfg, totalChains, allGroups, equivalentGroups);
  const summaryPath = path.join(OUTPUT_DIR, `summary-${tag}.md`);
  fs.writeFileSync(summaryPath, summaryContent);
  console.log(`  wrote ${summaryPath}`);

  const fullData = writeFullData(allGroups);
  const dataPath = path.join(OUTPUT_DIR, `full-data-${tag}.json`);
  try {
    writeJson(dataPath, fullData);
    console.log(`  wrote ${dataPath}\n`);
  } catch {
    console.log(`  skipped ${dataPath} (too large to serialize)\n`);
  }
}

const isMain = process.argv[1]?.endsWith('q3-equivalent-burst-chains-double.ts');
if (isMain) {
  const { opts } = parseTypedCommand(
    createTypedCommand<Q3Options>()
      .name('q3-equivalent-burst-chains-double')
      .description('Explore equivalent burst chains in a double-sided corridor')
      .option('--max-tick <n>', 'Maximum tick to explore', String(MAX_TICK)),
  );

  run({ maxTick: Number(opts.maxTick) });
}

export type { DoubleCorridorState, BurstStep, BurstChain };
export { corridorBurstDouble, exploreDoubleCorridor, run };
