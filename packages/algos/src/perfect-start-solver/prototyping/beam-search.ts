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

  const totalStart = performance.now();

  for (let i = 0; i < numSteps; i++) {
    let scoreCalls = 0;

    // -- Move generation --
    const genStart = performance.now();
    const expandedMoves: { state: S; move: M }[] = [];
    for (const state of beam) {
      const moves = generateMoves(state);
      for (const move of moves) {
        expandedMoves.push({ state, move });
      }
    }
    const genMs = performance.now() - genStart;

    // -- Clone + step --
    const cloneStepStart = performance.now();
    const candidates: S[] = [];
    for (const { state, move } of expandedMoves) {
      const child = clone(state);
      step(child, move);
      candidates.push(child);
    }
    const cloneStepMs = performance.now() - cloneStepStart;

    // -- Score + sort (scores cached to avoid redundant calls in comparator) --
    const scoreSortStart = performance.now();
    const scored = candidates.map((c) => ({ state: c, score: score(c) }));
    scoreCalls += candidates.length;
    scored.sort((a, b) => b.score - a.score);
    beam = scored.slice(0, beamWidth).map((s) => s.state);

    const bestScore = scored.length > 0 ? scored[0].score : 0;
    scorePerStep.push(bestScore);
    const scoreSortMs = performance.now() - scoreSortStart;

    perTick.push({
      candidates: candidates.length,
      genMs,
      cloneStepMs,
      scoreSortMs,
      scoreCalls,
    });
  }

  const totalMs = performance.now() - totalStart;

  const perf: PerfStats = {
    perTick,
    totalCandidates: perTick.reduce((s, t) => s + t.candidates, 0),
    totalScoreCalls: perTick.reduce((s, t) => s + t.scoreCalls, 0),
    genMs: perTick.reduce((s, t) => s + t.genMs, 0),
    cloneStepMs: perTick.reduce((s, t) => s + t.cloneStepMs, 0),
    scoreSortMs: perTick.reduce((s, t) => s + t.scoreSortMs, 0),
    totalMs,
  };

  const best = beam[0];
  return { best, scorePerStep, perf };
}

export type { BeamSearchConfig, BeamSearchResult, PerfStats, PerfTick };
export { beamSearch };
