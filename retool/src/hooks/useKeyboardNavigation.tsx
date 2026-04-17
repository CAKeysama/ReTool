import { useEffect, useRef, useState, KeyboardEvent } from 'react';

/**
 * Handle keyboard navigation inside a list or grid
 */
export function useKeyboardNavigation<T extends HTMLElement = HTMLDivElement>(itemCount: number, columns: number = 1) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current) {
      const items = containerRef.current.querySelectorAll('[data-navigable="true"]');
      if (items[activeIndex]) {
        (items[activeIndex] as HTMLElement).focus();
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: KeyboardEvent) => {
    let nextIndex = activeIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = Math.min(activeIndex + columns, itemCount - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = Math.max(activeIndex - columns, 0);
        break;
      case 'ArrowRight':
        if (columns > 1) {
          e.preventDefault();
          nextIndex = Math.min(activeIndex + 1, itemCount - 1);
        }
        break;
      case 'ArrowLeft':
        if (columns > 1) {
          e.preventDefault();
          nextIndex = Math.max(activeIndex - 1, 0);
        }
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = itemCount - 1;
        break;
    }

    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  return { activeIndex, setActiveIndex, containerRef, handleKeyDown };
}
