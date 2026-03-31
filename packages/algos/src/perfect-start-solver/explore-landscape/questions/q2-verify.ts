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

interface CorridorState {
  tick: number;
  generalArmy: number;
  frontier: number;
}

type Chain = number[];

const INITIAL_STATE: CorridorState = { tick: 0, generalArmy: 1, frontier: 0 };
const OUTPUT_DIR = path.resolve(__dirname, '../output/q2');

// Run a full chain from initial state, return end state
function runChain(chain: Chain): CorridorState {
  let state = INITIAL_STATE;
  for (const size of chain) {
    state = corridorBurst(state, size);
  }
  return state;
}

function stateStr(s: CorridorState): string {
  return `(tick=${s.tick}, army=${s.generalArmy}, frontier=${s.frontier})`;
}

function stateKey(s: CorridorState): string {
  return `${s.tick},${s.generalArmy},${s.frontier}`;
}

// Generate all compositions of n (ordered sequences of positive ints summing to n)
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

// Find the longest common suffix of a set of chains
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

function verify() {
  const { allGroups } = exploreEquivalentBurstChains();
  const lines: string[] = [];

  function log(s: string = '') {
    lines.push(s);
  }

  log('# Verification: Free Prefix Theory');
  log('');

  // ---- Part 1: Find the "free threshold" ----
  // For each N, check if all compositions of N produce the same state.

  log('## Part 1: Free threshold');
  log('');
  log('For each N, do ALL compositions of N produce the same end state?');
  log('');

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

    const stateList = [...states.entries()]
      .map(([k, count]) => `${count}x → (${k})`)
      .join(', ');
    log(
      `  N=${String(n).padStart(2)}: ${String(comps.length).padStart(5)} compositions → ${states.size} distinct state${states.size > 1 ? 's' : ' '}${allSame ? ' ✓ ALL SAME' : ''}  [${stateList}]`,
    );

    // Stop once compositions get huge
    if (comps.length > 10000) {
      log(`  (stopping — compositions too large)`);
      break;
    }
  }
  log('');
  log(`Free threshold: N ≤ ${freeThreshold} (all compositions equivalent)`);
  log('');

  // ---- Part 2: Group decomposition ----
  // For each equivalence group, find common suffix and check prefix structure.

  log('## Part 2: Group decomposition');
  log('');

  // Build a lookup: stateKey → group
  const groupByState = new Map<string, Chain[]>();
  for (const g of allGroups) {
    groupByState.set(stateKey(g.state), g.chains);
  }

  const multiGroups = allGroups.filter((g) => g.chains.length > 1);
  let decompositionOk = 0;
  let decompositionFail = 0;

  for (const group of multiGroups) {
    const { state, chains } = group;
    const suffix = longestCommonSuffix(chains);
    const suffixSum = suffix.reduce((a, b) => a + b, 0);
    const prefixFrontier = state.frontier - suffixSum;

    // Extract prefixes
    const prefixes = chains.map((c) => c.slice(0, c.length - suffix.length));

    // All prefixes should produce the same state
    const prefixStates = new Set(prefixes.map((p) => stateKey(runChain(p))));

    // Check: do the prefixes form a complete group at prefixFrontier?
    const prefixStateKey = stateKey(runChain(prefixes[0]));
    const expectedGroup = groupByState.get(prefixStateKey);
    const prefixesMatch =
      expectedGroup &&
      prefixStates.size === 1 &&
      expectedGroup.length === prefixes.length &&
      expectedGroup.every((c) => prefixes.some((p) => p.join(',') === c.join(',')));

    if (prefixesMatch) {
      decompositionOk++;
    } else {
      decompositionFail++;
      log(
        `  MISMATCH: frontier=${state.frontier} tick=${state.tick} army=${state.generalArmy}` +
          `  suffix=[${suffix.join(',')}]  prefixFrontier=${prefixFrontier}` +
          `  prefixStates=${prefixStates.size}  prefixes=${prefixes.length}` +
          `  expectedGroup=${expectedGroup?.length ?? 'none'}`,
      );
    }
  }

  log(
    `Decomposition check: ${decompositionOk} OK, ${decompositionFail} FAIL (of ${multiGroups.length} groups)`,
  );
  log('');

  // ---- Part 3: What does the suffix structure look like? ----
  log('## Part 3: Suffix structure by frontier');
  log('');

  const byFrontier = new Map<number, typeof multiGroups>();
  for (const g of allGroups) {
    const f = g.state.frontier;
    if (!byFrontier.has(f)) byFrontier.set(f, []);
    byFrontier.get(f)!.push(g);
  }

  for (const [frontier, groups] of [...byFrontier].sort((a, b) => a[0] - b[0])) {
    if (frontier > 10) break;
    log(`  frontier=${frontier}: ${groups.length} group${groups.length > 1 ? 's' : ''}`);
    for (const g of groups) {
      const suffix = longestCommonSuffix(g.chains);
      const prefixFrontier = g.state.frontier - suffix.reduce((a, b) => a + b, 0);
      log(
        `    tick=${String(g.state.tick).padStart(2)}  army=${g.state.generalArmy}` +
          `  chains=${String(g.chains.length).padStart(3)}` +
          `  suffix=[${suffix.join(', ')}]` +
          `  prefixN=${prefixFrontier}`,
      );
    }
  }

  const outPath = path.join(OUTPUT_DIR, 'verification.md');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`  wrote ${outPath}`);
}

const isMain = process.argv[1]?.endsWith('q2-verify.ts');
if (isMain) verify();

export { verify };
