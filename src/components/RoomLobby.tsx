import type { ChangeEvent } from 'react';
import type { RoomPlayer, RoomStatus } from '../types';

type Props = {
  roomId: string;
  players: RoomPlayer[];
  isHost: boolean;
  status: RoomStatus;
  entryCost: number;
  maxPlayers: number;
  matchTimerSeconds: number;
  isReady: boolean;
  onReadyToggle: () => void;
  onStart: () => void;
  onSettingsChange: (settings: { entryCost?: number; maxPlayers?: number; matchTimerSeconds?: number }) => void;
};

export function RoomLobby({
  roomId,
  players,
  isHost,
  status,
  entryCost,
  maxPlayers,
  matchTimerSeconds,
  isReady,
  onReadyToggle,
  onStart,
  onSettingsChange,
}: Props) {
  const handleNumberChange =
    (key: 'entryCost' | 'maxPlayers' | 'matchTimerSeconds') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10);
      if (Number.isNaN(value)) return;
      onSettingsChange({ [key]: value });
    };

  return (
    <div className="panel">
      <div className="lobby-head">
        <div>
          <p className="eyebrow">Room</p>
          <h2>{roomId}</h2>
          <p className="muted">
            Status: <strong>{status}</strong> • Players: {players.length}/{maxPlayers}
          </p>
        </div>
        <div className="inline-actions">
          <button className={isReady ? 'secondary' : ''} onClick={onReadyToggle}>
            {isReady ? 'Ready ✓' : 'Ready up'}
          </button>
          {isHost && (
            <button disabled={players.length < 1 || status === 'running'} onClick={onStart}>
              Start match
            </button>
          )}
        </div>
      </div>

      <div className="settings">
        <div>
          <label className="muted">Entry cost (coins)</label>
          <input
            type="number"
            min={0}
            value={entryCost}
            onChange={handleNumberChange('entryCost')}
            className="input"
            disabled={!isHost}
          />
        </div>
        <div>
          <label className="muted">Max players</label>
          <input
            type="number"
            min={2}
            max={12}
            value={maxPlayers}
            onChange={handleNumberChange('maxPlayers')}
            className="input"
            disabled={!isHost}
          />
        </div>
        <div>
          <label className="muted">Match timer (sec)</label>
          <input
            type="number"
            min={30}
            value={matchTimerSeconds}
            onChange={handleNumberChange('matchTimerSeconds')}
            className="input"
            disabled={!isHost}
          />
        </div>
      </div>

      <div className="players">
        {players.map((player) => (
          <div key={player.playerId} className="player-row">
            <span className="player-swatch" style={{ backgroundColor: player.color }} />
            <div className="player-meta">
              <strong>{player.name}</strong>
              <p className="muted">{player.playerId.slice(0, 6)}</p>
            </div>
            <span className={`pill ${player.isReady ? 'pill-live' : ''}`}>
              {player.isReady ? 'Ready' : 'Waiting'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoomLobby;
