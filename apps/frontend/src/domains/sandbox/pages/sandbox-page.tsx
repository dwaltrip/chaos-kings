import { useEffect } from 'react';

import type { Direction } from '@core/types';

import { useKeyboardControls } from '@/domains/gameplay/hooks/use-keyboard-controls';
import { boardStore, setSelectedTile } from '@/domains/games/board-store';
import { useBoardState } from '@/domains/games/board-store/hooks';
import {
  useSandboxMetaStore,
  selectStatus,
  selectIsPaused,
} from '@/domains/sandbox/stores/sandbox-meta-store';
import {
  startSandbox,
  endSandboxLocal,
  queueMove,
  undoMove,
  cancelQueuedMoves,
} from '@/domains/sandbox/actions';
import { SandboxBoard } from '@/domains/sandbox/ui/sandbox-board';
import { SandboxControlBar } from '@/domains/sandbox/ui/sandbox-control-bar';
import { useSandboxPlaybackControls } from '@/domains/sandbox/hooks/use-sandbox-playback-controls';

import './sandbox-page.css';

function SandboxPage() {
  const status = useSandboxMetaStore(selectStatus);
  const isPaused = useSandboxMetaStore(selectIsPaused);
  const boardState = useBoardState(boardStore);
  const board = boardState.game.board;
  const selectedTile = boardState.ui.selectedTile;

  const isActive = status === 'active';

  useEffect(() => {
    startSandbox();
    // No WS end-session on unmount — backend handles cleanup via disconnect
    // handler and via startSession replacing any existing session.
    return () => {
      endSandboxLocal();
    };
  }, []);

  useKeyboardControls({
    onMoveRequest: (dir: Direction) => {
      if (selectedTile) {
        queueMove(selectedTile, dir);
      }
    },
    onUndoMove: undoMove,
    onCancelMoves: cancelQueuedMoves,
    disabled: !isActive,
  });

  useSandboxPlaybackControls({ disabled: !isActive });

  const handlePageClick = () => {
    setSelectedTile(null);
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
