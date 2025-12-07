import { useEffect, useRef } from 'react';
import { CELL_SIZE } from '../gameConfig';
import type { PlayerNetState } from '../types';

type Props = {
  players: PlayerNetState[];
  gridWidth: number;
  gridHeight: number;
};

export function GameCanvas({ players, gridWidth, gridHeight }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = gridWidth * CELL_SIZE;
    canvas.height = gridHeight * CELL_SIZE;

    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    players.forEach((player) => {
      ctx.fillStyle = `${player.color}33`;
      player.territory.forEach((cell) => {
        const [x, y] = cell.split(',').map(Number);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      });

      ctx.fillStyle = `${player.color}aa`;
      player.trail.forEach((cell) => {
        const [x, y] = cell.split(',').map(Number);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      });

      ctx.fillStyle = player.color;
      ctx.fillRect(player.x * CELL_SIZE, player.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });
  }, [players, gridHeight, gridWidth]);

  return (
    <div className="canvas-shell">
      <canvas ref={ref} />
    </div>
  );
}

export default GameCanvas;
