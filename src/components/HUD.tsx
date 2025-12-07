import type { GameState, PlayerNetState, RoomStatus } from '../types';

type Props = {
  status: RoomStatus;
  timerSeconds: number;
  pool: number;
  players: PlayerNetState[];
  localPlayerId: string;
  payouts?: GameState['payouts'];
};

export function HUD({ status, timerSeconds, pool, players, localPlayerId, payouts }: Props) {
  const yourPlayer = players.find((p) => p.playerId === localPlayerId);
  const territorySize = yourPlayer?.territory.length ?? 0;

  return (
    <div className="hud">
      <div>
        <p className="eyebrow">Timer</p>
        <h3>{timerSeconds.toFixed(1)}s</h3>
      </div>
      <div>
        <p className="eyebrow">Pool</p>
        <h3>{pool} coins</h3>
      </div>
      <div>
        <p className="eyebrow">You</p>
        <h3>{territorySize} cells</h3>
      </div>
      <div className="hud-right">
        <p className="eyebrow">Status</p>
        <h3>{status}</h3>
        {status === 'finished' && payouts && (
          <p className="muted small">
            Payouts: {payouts.map((p) => `${p.playerId.slice(0, 4)}: ${p.coins}`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

export default HUD;
