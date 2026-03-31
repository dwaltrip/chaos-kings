/*
  Verify the "free prefix" theory for equivalent burst chains.

  Claims to verify:
  1. For frontier ≤ T (some threshold), ALL compositions produce the same state.
  2. For frontier > T, each equivalence group decomposes as:
     { prefix ++ suffix : prefix ∈ PrefixGroup } for some fixed suffix
     and PrefixGroup is itself a complete equivalence group at a lower frontier.
*/

import * as fs from 'fs';
import * as path from 'path';

import {
  exploreEquivalentBurstChains,
  corridorBurst,
} from './q2-equivalent-burst-chains-simple';
import { formatTable } from '@/utils/format';
import { heading, bulletList, kv, hr, sections, codeBlock } from '@/utils/md';

interface CorridorState {
  tick: number;
  generalArmy: number;
  frontier: number;
}

type Chain = number[];

const INITIAL_STATE: CorridorState = { tick: 0, generalArmy: 1, frontier: 0 };
const OUTPUT_DIR = path.resolve(__dirname, '../output/q2');

function runChain(chain: Chain): CorridorState {
  let state = INITIAL_STATE;
  for (const size of chain) {
    state = corridorBurst(state, size);
  }
  return state;
}

function stateKey(s: CorridorState): string {
  return `${s.tick},${s.generalArmy},${s.frontier}`;
}

function fmtState(s: CorridorState): string {
  return `tick=${s.tick} army=${s.generalArmy} f=${s.frontier}`;
}

function compositions(n: number): Chain[] {
  if (n === 0) return [[]];
  if (n === 1) return [[1]];
  const result: Chain[] = [];
  for (let first = 1; first <= n; first++) {
    for (const rest of compositions(n - first)) {
      result.push([first, ...rest]);
    }
  }
  return result;
}

function longestCommonSuffix(chains: Chain[]): Chain {
  if (chains.length === 0) return [];
  const shortest = Math.min(...chains.map((c) => c.length));
  const suffix: number[] = [];
  for (let i = 1; i <= shortest; i++) {
    const val = chains[0][chains[0].length - i];
    if (chains.every((c) => c[c.length - i] === val)) {
      suffix.unshift(val);
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

  for (let n = 1; n <= 16; n++) {
    const comps = compositions(n);
    const states = new Map<string, number>();
    for (const chain of comps) {
      const state = runChain(chain);
      const key = stateKey(state);
      states.set(key, (states.get(key) || 0) + 1);
    }
    const allSame = states.size === 1;
    if (allSame) freeThreshold = n;

    rows.push([String(n), String(comps.length), String(states.size), allSame ? '✓' : '']);

    if (comps.length > 10000) break;
  }

  return sections(
    heading('Part 1: Free Threshold'),
    'Do ALL compositions of N produce the same end state?',
    formatTable(['N', 'compositions', 'distinct states', 'all same?'], rows),
    `**Result:** Free threshold is N ≤ ${freeThreshold}`,
  );
}

// ---- Part 2: Group decomposition -------------------------------------------

interface DecompositionResult {
  ok: number;
  fail: number;
  total: number;
  mismatches: string[];
}

function verifyDecomposition(): { output: string; result: DecompositionResult } {
  const { allGroups } = exploreEquivalentBurstChains();

  const groupByState = new Map<string, Chain[]>();
  for (const g of allGroups) {
    groupByState.set(stateKey(g.state), g.chains);
  }

  const multiGroups = allGroups.filter((g) => g.chains.length > 1);
  const mismatches: string[] = [];
  let ok = 0;

  for (const group of multiGroups) {
    const { state, chains } = group;
    const suffix = longestCommonSuffix(chains);
    const suffixSum = suffix.reduce((a, b) => a + b, 0);
    const prefixFrontier = state.frontier - suffixSum;

    const prefixes = chains.map((c) => c.slice(0, c.length - suffix.length));
    const prefixStates = new Set(prefixes.map((p) => stateKey(runChain(p))));
    const prefixStateKey = stateKey(runChain(prefixes[0]));
    const expectedGroup = groupByState.get(prefixStateKey);

    const prefixesMatch =
      expectedGroup &&
      prefixStates.size === 1 &&
      expectedGroup.length === prefixes.length &&
      expectedGroup.every((c) => prefixes.some((p) => p.join(',') === c.join(',')));

    if (prefixesMatch) {
      ok++;
    } else {
      mismatches.push(
        `f=${state.frontier} tick=${state.tick} army=${state.generalArmy}` +
          ` — suffix=[${suffix.join(',')}] prefixN=${prefixFrontier}` +
          ` — prefixStates=${prefixStates.size} prefixes=${prefixes.length}` +
          ` expected=${expectedGroup?.length ?? 'none'}`,
      );
    }
  }

  const result: DecompositionResult = {
    ok,
    fail: mismatches.length,
    total: multiGroups.length,
    mismatches,
  };

  const output = sections(
    heading('Part 2: Group Decomposition'),
    'For each group: find longest common suffix, check that prefixes form a complete group.',
    bulletList([
      kv('Passed', `${ok} / ${result.total}`),
      kv('Failed', `${result.fail} / ${result.total}`),
    ]),
    mismatches.length > 0 ? sections('**Mismatches:**', bulletList(mismatches)) : '',
  );

  return { output, result };
}

// ---- Part 3: Suffix structure by frontier ----------------------------------

function verifySuffixStructure(): string {
  const { allGroups } = exploreEquivalentBurstChains();

  const byFrontier = new Map<number, typeof allGroups>();
  for (const g of allGroups) {
    const f = g.state.frontier;
    if (!byFrontier.has(f)) byFrontier.set(f, []);
    byFrontier.get(f)!.push(g);
  }

  const parts: string[] = [heading('Part 3: Suffix Structure by Frontier')];

  for (const [frontier, groups] of [...byFrontier].sort((a, b) => a[0] - b[0])) {
    if (frontier > 10) break;

    const rows = groups.map((g) => {
      const suffix = longestCommonSuffix(g.chains);
      const prefixN = g.state.frontier - suffix.reduce((a, b) => a + b, 0);
      return [
        String(g.state.tick),
        String(g.state.generalArmy),
        String(g.chains.length),
        suffix.length > 0 ? `[${suffix.join(', ')}]` : '(none)',
        String(prefixN),
      ];
    });

    parts.push(
      `### frontier = ${frontier} (${groups.length} group${groups.length > 1 ? 's' : ''})`,
    );
    parts.push(formatTable(['tick', 'army', 'chains', 'suffix', 'prefixN'], rows));
  }

  return parts.join('\n\n');
}

// ---- Main ------------------------------------------------------------------

function verify() {
  const part1 = verifyFreeThreshold();
  const { output: part2 } = verifyDecomposition();
  const part3 = verifySuffixStructure();

  const doc = sections(
    heading('Verification: Free Prefix Theory', 1),
    part1,
    hr(),
    part2,
    hr(),
    part3,
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, 'verification.md');
  fs.writeFileSync(outPath, doc + '\n');
  console.log(`  wrote ${outPath}`);
}

const isMain = process.argv[1]?.endsWith('q2-verify.ts');
if (isMain) verify();

export { verify };
