import { useEffect, useState } from 'react';
import type { Direction } from '../types';

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
};

export function useKeyboardInput(initial: Direction = 'right') {
  const [direction, setDirection] = useState<Direction>(initial);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const next = KEY_TO_DIR[ev.key];
      if (next) {
        setDirection(next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, []);

  return direction;
}
