import { useState } from 'react';
import { useResizeObserver, type ResizeData } from '@/lib/use-resize-observer';

function calcTileSize(
  rows: number,
  cols: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (containerWidth === 0 || containerHeight === 0) {
    console.warn('Container dimensions are zero');
    return 0;
  }
  const maxWidth = containerWidth / cols;
  const maxHeight = containerHeight / rows;
  const rawTileSize = Math.max(1, Math.min(maxWidth, maxHeight));
  return rawTileSize;
}

function useGridLayout(rows: number, cols: number) {
  const [tileSize, setTileSize] = useState<number>(50);

  const containerRef = useResizeObserver<HTMLDivElement>((data: ResizeData) => {
    if (data.contentBox) {
      const rawTileSize = calcTileSize(
        rows,
        cols,
        data.contentBox.width,
        data.contentBox.height,
      );
      setTileSize(rawTileSize);
    }
  });

  const gridStyle: React.CSSProperties = {
    gridTemplateRows: `repeat(${rows}, ${tileSize}px)`,
    gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
    '--game-tile-size': `${tileSize}px`,
  } as React.CSSProperties;

  return { containerRef, tileSize, gridStyle };
}

export { calcTileSize, useGridLayout };
