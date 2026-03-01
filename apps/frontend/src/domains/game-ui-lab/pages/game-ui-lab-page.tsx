import { useState } from 'react';

import { LabBoard } from '@/domains/game-ui-lab/ui/lab-board';
import { VARIANTS } from '@/domains/game-ui-lab/variants';
import { frameData, boardStates } from '@/domains/game-ui-lab/data/load-lab-data';
import { useFrameNav } from '@/domains/game-ui-lab/hooks/use-frame-nav';

import '@/domains/game-ui-lab/variants/variant-dark.css';
import './game-ui-lab-page.css';

function GameUiLabPage() {
  const frames = frameData.frames;
  const { frameIndex, stepBack, stepForward } = useFrameNav(frames.length - 1);
  const [variantIndex, setVariantIndex] = useState(0);

  const frame = frames[frameIndex];
  const variant = VARIANTS[variantIndex];
  const boardState = boardStates[frame.tick];

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
          {frame.selectedTile && (
            <span className="lab-selected-coord">
              Selected: ({frame.selectedTile.x}, {frame.selectedTile.y})
            </span>
          )}
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
        <button onClick={stepForward} disabled={frameIndex === frames.length - 1}>
          Forward (D) →
        </button>
      </div>
    </div>
  );
}

export { GameUiLabPage };
