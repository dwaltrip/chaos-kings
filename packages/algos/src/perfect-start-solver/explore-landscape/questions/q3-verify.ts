/*
  Verify equivalence structure for the double-sided corridor (q3).

  Reproduces the key numerical claims from session-2-notes.md so they can be
  re-checked without re-running throwaway scripts.

  Part 1 — Free threshold (per-direction, from initial state):
    Runs all integer compositions of N (for N=1..8) as left-only burst chains
    from the initial state. Checks whether all compositions of N produce the
    same end state. Expects N≤3 to be "free" (single unique state), matching
    the single-sided q2 result.

  Part 2 — Suffix decomposition breakdown:
    For each multi-chain equivalence group, finds the longest common suffix.
    Checks whether the prefixes (chain minus suffix) form a complete
    equivalence group at a lower frontier. Reports the breakdown: no common
    suffix (trivial), clean decomposition, and failures.

  Part 3 — Collapse ratio comparison (single vs double):
    Runs both q2 (single-sided) and q3 (double-sided) at multiple maxTick
    values and compares reduction ratios side by side. Also computes single²
    to test whether double-sided collapse exceeds the independent-directions
    prediction.
*/

import * as fs from 'fs';
import * as path from 'path';

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import type { AlgoConfig } from '../abstract-moves';
import { MAX_TICK } from '../constants';
import { formatTable } from '@/utils/format';
import { heading, hr, sections, bulletList, kv } from '@/utils/md';
import { exploreEquivalentBurstChains } from './q2-equivalent-burst-chains-simple';
import {
  corridorBurstDouble,
  exploreDoubleCorridor,
} from './q3-equivalent-burst-chains-double';
import type {
  DoubleCorridorState,
  BurstStep,
  BurstChain,
} from './q3-equivalent-burst-chains-double';

// ---- Helpers ---------------------------------------------------------------

type Direction = 'L' | 'R';

const INITIAL_STATE: DoubleCorridorState = {
  tick: 0,
  generalArmy: 1,
  leftFrontier: 0,
  rightFrontier: 0,
};

function runChain(steps: BurstStep[]): DoubleCorridorState {
  let state = INITIAL_STATE;
  for (const s of steps) state = corridorBurstDouble(state, s.dir, s.size);
  return state;
}

function stateKey(s: DoubleCorridorState): string {
  return `${s.tick},${s.generalArmy},${s.leftFrontier},${s.rightFrontier}`;
}

function stepEq(a: BurstStep, b: BurstStep): boolean {
  return a.dir === b.dir && a.size === b.size;
}

function compositions(n: number): number[][] {
  if (n === 0) return [[]];
  const result: number[][] = [];
  for (let first = 1; first <= n; first++) {
    for (const rest of compositions(n - first)) {
      result.push([first, ...rest]);
    }
  }
  return result;
}

function longestCommonSuffix(chains: BurstChain[]): BurstStep[] {
  if (chains.length === 0) return [];
  const shortest = Math.min(...chains.map((c) => c.length));
  const suffix: BurstStep[] = [];
  for (let i = 1; i <= shortest; i++) {
    const ref = chains[0][chains[0].length - i];
    if (chains.every((c) => stepEq(c[c.length - i], ref))) {
      suffix.unshift(ref);
    } else {
      break;
    }
  }
  return suffix;
}

// ---- Part 1: Free threshold ------------------------------------------------

function verifyFreeThreshold(): string {
  const rows: string[][] = [];
  let freeThreshold = 0;

  for (let n = 1; n <= 8; n++) {
    const comps = compositions(n);
    const states = new Set(
      comps.map((c) => {
        const steps: BurstStep[] = c.map((s) => ({ dir: 'L' as Direction, size: s }));
        return stateKey(runChain(steps));
      }),
    );
    const allSame = states.size === 1;
    if (allSame) freeThreshold = n;

    rows.push([String(n), String(comps.length), String(states.size), allSame ? '✓' : '']);

    if (comps.length > 10000) break;
  }

  return sections(
    heading('Part 1: Free Threshold (per-direction, from initial state)'),
    'All compositions of N going left only — do they produce the same state?',
    formatTable(['N', 'compositions', 'distinct states', 'all same?'], rows),
    `**Result:** Free threshold is N ≤ ${freeThreshold} (same as single-sided q2)`,
  );
}

// ---- Part 2: Suffix decomposition -----------------------------------------

function verifySuffixDecomposition(cfg: AlgoConfig): string {
  const { allGroups } = exploreDoubleCorridor(cfg);
  const groupByState = new Map<string, BurstChain[]>();
  for (const g of allGroups) groupByState.set(stateKey(g.state), g.chains);

  const multiGroups = allGroups.filter((g) => g.chains.length > 1);
  let ok = 0;
  let trivial = 0;
  let fail = 0;

  for (const group of multiGroups) {
    const suffix = longestCommonSuffix(group.chains);
    if (suffix.length === 0) {
      trivial++;
      continue;
    }
    const prefixes = group.chains.map((c) => c.slice(0, c.length - suffix.length));
    const prefixStates = new Set(prefixes.map((p) => stateKey(runChain(p))));
    const prefixStateKey = stateKey(runChain(prefixes[0]));
    const expectedGroup = groupByState.get(prefixStateKey);

    if (
      expectedGroup &&
      prefixStates.size === 1 &&
      expectedGroup.length === prefixes.length
    ) {
      ok++;
    } else {
      fail++;
    }
  }

  const total = multiGroups.length;
  const overallRate = total > 0 ? ((100 * ok) / total).toFixed(1) : 'n/a';

  return sections(
    heading(`Part 2: Suffix Decomposition (maxTick=${cfg.maxTick})`),
    bulletList([
      kv('Multi-chain groups', total),
      kv(
        'No common suffix (trivial)',
        `${trivial} (${((100 * trivial) / total).toFixed(0)}%)`,
      ),
      kv('Clean decomposition', `${ok}`),
      kv('Failed', `${fail}`),
      kv('Overall rate (clean / total)', `${overallRate}%`),
    ]),
  );
}

// ---- Part 3: Collapse ratio comparison ------------------------------------

function verifyCollapseRatio(maxTicks: number[]): string {
  const rows: string[][] = [];

  for (const maxTick of maxTicks) {
    const s = exploreEquivalentBurstChains(maxTick);
    const d = exploreDoubleCorridor({ maxTick });
    const sRatio = s.totalChains / s.allGroups.length;
    const dRatio = d.totalChains / d.allGroups.length;
    const sSquared = sRatio * sRatio;

    rows.push([
      String(maxTick),
      String(s.totalChains),
      String(s.allGroups.length),
      sRatio.toFixed(1),
      String(d.totalChains),
      String(d.allGroups.length),
      dRatio.toFixed(1),
      (dRatio / sRatio).toFixed(1),
      sSquared.toFixed(1),
    ]);
  }

  return sections(
    heading('Part 3: Collapse Ratio — Single vs Double'),
    formatTable(
      [
        'maxTick',
        's.chains',
        's.states',
        's.ratio',
        'd.chains',
        'd.states',
        'd.ratio',
        'd/s',
        's²',
      ],
      rows,
    ),
  );
}

// ---- Main ------------------------------------------------------------------

interface Q3VerifyOptions {
  maxTick: string;
}

function verify(cfg: AlgoConfig) {
  const OUTPUT_DIR = path.resolve(__dirname, '../output/q3');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const part1 = verifyFreeThreshold();
  const part2 = verifySuffixDecomposition(cfg);

  const comparisonTicks = [20, 30];
  if (cfg.maxTick >= 40) comparisonTicks.push(40);
  const part3 = verifyCollapseRatio(comparisonTicks);

  const doc = sections(
    heading('Verification: Double-Sided Corridor', 1),
    `maxTick=${cfg.maxTick}`,
    part1,
    hr(),
    part2,
    hr(),
    part3,
  );

  const tag = `max-tick-${cfg.maxTick}`;
  const outPath = path.join(OUTPUT_DIR, `verification-${tag}.md`);
  fs.writeFileSync(outPath, doc + '\n');
  console.log(`  wrote ${outPath}`);
}

const isMain = process.argv[1]?.endsWith('q3-verify.ts');
if (isMain) {
  const { opts } = parseTypedCommand(
    createTypedCommand<Q3VerifyOptions>()
      .name('q3-verify')
      .description('Verify equivalence structure for double-sided corridor')
      .option(
        '--max-tick <n>',
        'Maximum tick for suffix decomposition',
        String(MAX_TICK),
      ),
  );

  verify({ maxTick: Number(opts.maxTick) });
}

export { verify };
