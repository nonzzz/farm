import React, { useCallback, useRef, useState } from 'react';

interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number;
}

interface UseVirtualListResult<T> {
  containerProps: {
    ref: (el: HTMLElement | null) => void;
    onScroll: (e: React.UIEvent) => void;
    style: React.CSSProperties;
  };
  wrapperProps: {
    style: React.CSSProperties;
  };
  virtualItems: Array<{
    index: number;
    start: number;
    item: T;
  }>;
}

export function useVirtualList<T>(
  list: T[],
  options: UseVirtualListOptions
): UseVirtualListResult<T> {
  const { itemHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);
  const containerRef = useRef<HTMLElement | null>(null);

  const visibleCount = Math.ceil(clientHeight / itemHeight);
  const totalHeight = list.length * itemHeight;

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(list.length, start + visibleCount + 2 * overscan);

  const containerRefCallback = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
    if (el) {
      setClientHeight(el.clientHeight);
    }
  }, []);

  const onScroll = useCallback((e: React.UIEvent) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  const virtualItems = list.slice(start, end).map((item, index) => ({
    index: start + index,
    start: (start + index) * itemHeight,
    item
  }));

  return {
    containerProps: {
      ref: containerRefCallback,
      onScroll,
      style: {
        height: '100%',
        overflow: 'auto'
      }
    },
    wrapperProps: {
      style: {
        height: totalHeight,
        position: 'relative'
      }
    },
    virtualItems
  };
}
