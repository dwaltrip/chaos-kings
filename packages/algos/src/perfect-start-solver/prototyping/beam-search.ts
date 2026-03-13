interface BeamSearchConfig<S, M> {
  generateMoves: (state: S) => M[];
  clone: (state: S) => S;
  step: (state: S, move: M) => void;
  score: (state: S) => number;
  beamWidth: number;
  numSteps: number;
}

interface BeamSearchResult<S> {
  best: S;
  scorePerStep: number[];
}

function beamSearch<S, M>(
  initial: S,
  config: BeamSearchConfig<S, M>,
): BeamSearchResult<S> {
  const { generateMoves, clone, step, score, beamWidth, numSteps } = config;

  let beam: S[] = [initial];
  const scorePerStep: number[] = [score(initial)];

  for (let i = 0; i < numSteps; i++) {
    const candidates: S[] = [];

    for (const state of beam) {
      const moves = generateMoves(state);
      for (const move of moves) {
        const child = clone(state);
        step(child, move);
        candidates.push(child);
      }
    }

    candidates.sort((a, b) => score(b) - score(a));
    beam = candidates.slice(0, beamWidth);

    const bestScore = beam.length > 0 ? score(beam[0]) : 0;
    scorePerStep.push(bestScore);
  }

  const best = beam[0];
  return { best, scorePerStep };
}

export type { BeamSearchConfig, BeamSearchResult };
export { beamSearch };
