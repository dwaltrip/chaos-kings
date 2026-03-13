import { runWithTiming } from './helpers';

interface BeamSearchConfig<S, M> {
  generateMoves: (state: S) => M[];
  clone: (state: S) => S;
  step: (state: S, move: M) => void;
  score: (state: S) => number;
  beamWidth: number;
  numSteps: number;
}

interface PerfTick {
  candidates: number;
  genMs: number;
  cloneStepMs: number;
  scoreSortMs: number;
  scoreCalls: number;
}

interface PerfStats {
  perTick: PerfTick[];
  totalCandidates: number;
  totalScoreCalls: number;
  genMs: number;
  cloneStepMs: number;
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
  const { generateMoves, clone, step, score, beamWidth, numSteps } = config;

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

      // -- Score + sort (scores cached to avoid redundant calls in comparator) --
      const [scoreCalls, scoreSortMs] = runWithTiming(() => {
        const scored = candidates.map((c) => ({ state: c, score: score(c) }));
        scored.sort((a, b) => b.score - a.score);
        beam = scored.slice(0, beamWidth).map((s) => s.state);

        const bestScore = scored.length > 0 ? scored[0].score : 0;
        scorePerStep.push(bestScore);
        return candidates.length;
      });

      perTick.push({
        candidates: candidates.length,
        genMs,
        cloneStepMs,
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
    scoreSortMs: sumField('scoreSortMs'),
    totalMs,
  };

  const best = beam[0];
  return { best, scorePerStep, perf };
}

export type { BeamSearchConfig, BeamSearchResult, PerfStats, PerfTick };
export { beamSearch };
