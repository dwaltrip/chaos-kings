import { runWithTiming } from '../helpers';

interface BeamSearchConfig<S, M> {
  generateMoves: (state: S) => M[];
  clone: (state: S) => S;
  step: (state: S, move: M) => void;
  score: (state: S) => number;
  // If provided, deduplicates candidates pre-score: only the first state with
  // each fingerprint is kept. This prevents the beam from filling with copies
  // of identical board positions that happen to have different move histories.
  fingerprint?: (state: S) => number;
  beamWidth: number;
  numSteps: number;
}

interface PerfTick {
  candidates: number;
  dedupedCandidates: number;
  genMs: number;
  cloneStepMs: number;
  dedupMs: number;
  scoreSortMs: number;
  scoreCalls: number;
}

interface PerfStats {
  perTick: PerfTick[];
  totalCandidates: number;
  totalScoreCalls: number;
  genMs: number;
  cloneStepMs: number;
  dedupMs: number;
  scoreSortMs: number;
  totalMs: number;
}

interface BeamSearchResult<S> {
  best: S;
  scorePerStep: number[];
  perf: PerfStats;
}

function beamSearch<S, M>(
  initial: S,
  config: BeamSearchConfig<S, M>,
): BeamSearchResult<S> {
  const { generateMoves, clone, step, score, fingerprint, beamWidth, numSteps } = config;

  let beam: S[] = [initial];
  const scorePerStep: number[] = [score(initial)];
  const perTick: PerfTick[] = [];

  const [, totalMs] = runWithTiming(() => {
    for (let i = 0; i < numSteps; i++) {
      // -- Move generation --
      const [expandedMoves, genMs] = runWithTiming(() => {
        const result: { state: S; move: M }[] = [];
        for (const state of beam) {
          const moves = generateMoves(state);
          for (const move of moves) {
            result.push({ state, move });
          }
        }
        return result;
      });

      // -- Clone + step --
      const [candidates, cloneStepMs] = runWithTiming(() => {
        const result: S[] = [];
        for (const { state, move } of expandedMoves) {
          const child = clone(state);
          step(child, move);
          result.push(child);
        }
        return result;
      });

      // -- Dedup (optional, pre-score to avoid wasted scoring work) --
      const [dedupedCandidates, dedupMs] = runWithTiming(() => {
        if (!fingerprint) return candidates;
        const seen = new Set<number>();
        const unique: S[] = [];
        for (const c of candidates) {
          const fp = fingerprint(c);
          if (!seen.has(fp)) {
            seen.add(fp);
            unique.push(c);
          }
        }
        return unique;
      });

      // -- Score + sort (scores cached to avoid redundant calls in comparator) --
      const [scoreCalls, scoreSortMs] = runWithTiming(() => {
        const scored = dedupedCandidates.map((c) => ({ state: c, score: score(c) }));
        scored.sort((a, b) => b.score - a.score);
        beam = scored.slice(0, beamWidth).map((s) => s.state);

        const bestScore = scored.length > 0 ? scored[0].score : 0;
        scorePerStep.push(bestScore);
        return dedupedCandidates.length;
      });

      perTick.push({
        candidates: candidates.length,
        dedupedCandidates: dedupedCandidates.length,
        genMs,
        cloneStepMs,
        dedupMs,
        scoreSortMs,
        scoreCalls,
      });
    }
  });

  const sumField = (field: keyof PerfTick) =>
    perTick.reduce((s, t) => s + (t[field] as number), 0);

  const perf: PerfStats = {
    perTick,
    totalCandidates: sumField('candidates'),
    totalScoreCalls: sumField('scoreCalls'),
    genMs: sumField('genMs'),
    cloneStepMs: sumField('cloneStepMs'),
    dedupMs: sumField('dedupMs'),
    scoreSortMs: sumField('scoreSortMs'),
    totalMs,
  };

  const best = beam[0];
  return { best, scorePerStep, perf };
}

export type { BeamSearchConfig, BeamSearchResult, PerfStats, PerfTick };
export { beamSearch };
