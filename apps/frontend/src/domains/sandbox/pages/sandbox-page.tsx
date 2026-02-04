import { useEffect } from 'react';

import type { Direction } from '@core/types';

import { useKeyboardControls } from '@/domains/gameplay/hooks/use-keyboard-controls';
import {
  useBoardSessionStore,
  boardSessionActions,
  selectBoard,
  selectSelectedTile,
} from '@/domains/games/stores/board-session-store';
import {
  useSandboxMetaStore,
  selectStatus,
  selectIsPaused,
} from '@/domains/sandbox/stores/sandbox-meta-store';
import {
  startSandbox,
  endSandbox,
  queueMove,
  undoMove,
  clearMoves,
} from '@/domains/sandbox/actions';
import { SandboxBoard } from '@/domains/sandbox/ui/sandbox-board';
import { SandboxControlBar } from '@/domains/sandbox/ui/sandbox-control-bar';
import { useSandboxPlaybackControls } from '@/domains/sandbox/hooks/use-sandbox-playback-controls';

import './sandbox-page.css';

function SandboxPage() {
  const status = useSandboxMetaStore(selectStatus);
  const isPaused = useSandboxMetaStore(selectIsPaused);
  const board = useBoardSessionStore(selectBoard);
  const selectedTile = useBoardSessionStore(selectSelectedTile);

  const isActive = status === 'active';

  useEffect(() => {
    startSandbox();

    return () => {
      endSandbox();
    };
  }, []);

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => {
      if (selectedTile) {
        queueMove(selectedTile, dir);
      }
    },
    onUndoMove: undoMove,
    onCancelMoves: clearMoves,
    disabled: !isActive,
  });

  useSandboxPlaybackControls({ disabled: !isActive });

  const handlePageClick = () => {
    boardSessionActions().clearSelectedTile();
  };

  return (
    <div className="sandbox-page" onClick={handlePageClick}>
      <div className="sandbox-header">
        <h1>Sandbox Mode</h1>
        <span className="sandbox-status">{isPaused ? 'Paused' : 'Playing'}</span>
      </div>

      <main className="sandbox-main">
        {board ? (
          <>
            <SandboxBoard boardState={board} />
            <SandboxControlBar />
          </>
        ) : (
          <div className="sandbox-loading">Loading...</div>
        )}
      </main>
    </div>
  );
}

export { SandboxPage };
