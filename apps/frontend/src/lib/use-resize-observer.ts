import { useRef, useCallback, useEffect, type RefObject } from 'react';

/**
 * React hook for observing element resize events using ResizeObserver.
 *
 * CONSTRAINTS & ASSUMPTIONS:
 * - Designed for observing a single element only (warns if multiple entries detected)
 * - No built-in debouncing - fires on every resize event for maximum responsiveness
 * - No internal React state to avoid unnecessary re-renders - uses callbacks only
 * - Returns exact decimal values from ResizeObserver (no rounding)
 * - Assumes modern browser support for ResizeObserver (warns if not available)
 * - Users should implement their own debouncing if needed for performance
 *
 * @param callback - Called when element resizes with box size data
 * @returns Ref to attach to the element you want to observe
 */

interface BoxSize {
  width: number;
  height: number;
}

export interface ResizeData {
  borderBox: BoxSize | null;
  contentBox: BoxSize | null;
  devicePixelContentBox: BoxSize | null;
}

type ResizeCallback = (data: ResizeData) => void;

function extractBoxSize(
  sizes: ReadonlyArray<ResizeObserverSize> | undefined,
  name: string,
): BoxSize | null {
  if (!sizes || sizes.length === 0) return null;

  if (sizes.length > 1) {
    console.warn(`useResizeObserver: Multiple ${name} entries detected, using first one`);
  }

  const { inlineSize, blockSize } = sizes[0];
  return { width: inlineSize, height: blockSize };
}

export function useResizeObserver<T extends HTMLElement = HTMLElement>(
  callback: ResizeCallback,
): RefObject<T> {
  const elementRef = useRef<T>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const callbackRef = useRef<ResizeCallback>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    requestAnimationFrame(() => {
      if (entries.length !== 1) {
        console.warn('useResizeObserver: Expected exactly 1 entry, got', entries.length);
        return;
      }

      const entry = entries[0];
      const { borderBoxSize, contentBoxSize, devicePixelContentBoxSize } = entry;

      const borderBox = extractBoxSize(borderBoxSize, 'borderBoxSize');
      const contentBox = extractBoxSize(contentBoxSize, 'contentBoxSize');
      const devicePixelContentBox = extractBoxSize(
        devicePixelContentBoxSize,
        'devicePixelContentBoxSize',
      );

      if (callbackRef.current) {
        callbackRef.current({
          borderBox,
          contentBox,
          devicePixelContentBox,
        });
      }
    });
  }, []);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    if (!window.ResizeObserver) {
      console.warn('useResizeObserver: ResizeObserver is not supported in this browser');
      return;
    }

    try {
      observerRef.current = new ResizeObserver(handleResize);
      observerRef.current.observe(element);
    } catch (error) {
      console.error('useResizeObserver: Failed to create ResizeObserver:', error);
      return;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [handleResize]);

  return elementRef as RefObject<T>;
}
