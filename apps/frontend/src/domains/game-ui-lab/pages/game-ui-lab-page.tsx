import { useState, useEffect, useCallback } from 'react';

import type { BoardState, Coord, Movement } from '@core/types';

import { LabBoard } from '@/domains/game-ui-lab/ui/lab-board';
import { VARIANTS } from '@/domains/game-ui-lab/variants';
import rawFrameData from '@/domains/game-ui-lab/data/lab-frames.json';
import rawBoardStates from '@/domains/game-ui-lab/data/lab-board-states.json';

interface LabFrame {
  tick: number;
  queuedMoves: Movement[];
  selectedTile: Coord | null;
}

interface LabFrameData {
  frames: LabFrame[];
  playerIndex: number;
  config: { size: { width: number; height: number }; numPlayers: number };
}

const frameData = rawFrameData as unknown as LabFrameData;
const boardStates = rawBoardStates as unknown as Record<string, BoardState>;

import '@/domains/game-ui-lab/variants/variant-dark.css';
import './game-ui-lab-page.css';

function GameUiLabPage() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);

  const frames = frameData.frames;
  const maxIndex = frames.length - 1;
  const frame = frames[frameIndex];
  const variant = VARIANTS[variantIndex];

  const boardState = boardStates[frame.tick];

  const stepBack = useCallback(() => {
    setFrameIndex((i) => Math.max(0, i - 1));
  }, []);

  const stepForward = useCallback(() => {
    setFrameIndex((i) => Math.min(maxIndex, i + 1));
  }, [maxIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        stepBack();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        stepForward();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [stepBack, stepForward]);

  return (
    <div className="lab-page">
      <div className="lab-header">
        <h1>Game UI Lab</h1>
        <div className="lab-controls">
          <label>
            Variant:{' '}
            <select
              value={variantIndex}
              onChange={(e) => setVariantIndex(Number(e.target.value))}
            >
              {VARIANTS.map((v, i) => (
                <option key={v.name} value={i}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <span className="lab-tick-info">
            Tick {frame.tick}
            {frame.selectedTile && !frame.queuedMoves.length && ' (selecting)'} (
            {frameIndex + 1} / {frames.length})
            {frame.queuedMoves.length > 0 && (
              <span className="lab-queue-badge">{frame.queuedMoves.length} queued</span>
            )}
          </span>
        </div>
      </div>

      <main className="lab-main">
        <LabBoard
          boardState={boardState}
          playerIndex={frameData.playerIndex}
          queuedMoves={frame.queuedMoves}
          selectedTile={frame.selectedTile}
          variantClassName={variant.cssClass}
        />
      </main>

      <div className="lab-footer">
        <button onClick={stepBack} disabled={frameIndex === 0}>
          ← Back (A)
        </button>
        <button onClick={stepForward} disabled={frameIndex === maxIndex}>
          Forward (D) →
        </button>
      </div>
    </div>
  );
}

export { GameUiLabPage };
