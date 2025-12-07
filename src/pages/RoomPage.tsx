import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import GameCanvas from '../components/GameCanvas';
import HUD from '../components/HUD';
import RoomLobby from '../components/RoomLobby';
import { useGameHostLoop } from '../hooks/useGameHostLoop';
import { useKeyboardInput } from '../hooks/useKeyboardInput';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { GRID_HEIGHT, GRID_WIDTH } from '../gameConfig';
import { supabaseEnabled } from '../supabaseClient';
import { ensureUser, fetchBalance, recordMatchResult } from '../supabaseService';
import type { Direction, MatchStateMessage, PlayerNetState, RoomPlayer } from '../types';

const COLORS = ['#5ccfe6', '#ffa8a8', '#b5f34f', '#ffdd57', '#c792ea', '#e06c75'];

const randomName = () => `Player-${Math.random().toString(36).slice(2, 6)}`;
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const [playerId] = useState(() => {
    const existing = localStorage.getItem('vibe_player_id');
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem('vibe_player_id', id);
    return id;
  });
  const [name, setName] = useState(randomName);
  const [color] = useState(randomColor);
  const [isReady, setIsReady] = useState(false);
  const [entryCost, setEntryCost] = useState(100);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [matchTimerSeconds, setMatchTimerSeconds] = useState(180);
  const [status, setStatus] = useState<'waiting' | 'running' | 'finished'>('waiting');
  const [roster, setRoster] = useState<Record<string, RoomPlayer>>(() => ({
    [playerId]: { playerId, name, color, isReady: false },
  }));
  const [coins, setCoins] = useState<number | null>(null);
  const [hostIdOverride, setHostIdOverride] = useState<string | null>(playerId);
  const [incomingPlayers, setIncomingPlayers] = useState<PlayerNetState[]>([]);
  const [incomingMatch, setIncomingMatch] = useState<MatchStateMessage | null>(null);
  const [remoteInputs, setRemoteInputs] = useState<Record<string, Direction>>({});

  const direction = useKeyboardInput();

  const rosterList = useMemo(() => Object.values(roster), [roster]);
  const hostId = hostIdOverride ?? rosterList[0]?.playerId ?? playerId;
  const isHost = hostId === playerId;

  const { connectionState, sendPlayerState, sendMatchState, sendRoomState, sendInput } =
    useSupabaseRealtime(roomId, {
      onPlayers: setIncomingPlayers,
      onMatch: (match) => {
        setIncomingMatch(match);
        setStatus(match.status);
      },
      onRoom: (room) => {
        setEntryCost(room.entryCost);
        setMaxPlayers(room.maxPlayers);
        setMatchTimerSeconds(room.matchTimerSeconds);
        setStatus(room.status);
        setHostIdOverride(room.hostId);
        setRoster((prev) => {
          const updated: Record<string, RoomPlayer> = { ...prev };
          room.players.forEach((p) => {
            updated[p.playerId] = p;
          });
          return updated;
        });
      },
      onInput: (input) => {
        setRemoteInputs((prev) => ({ ...prev, [input.playerId]: input.dir }));
      },
    });

  useEffect(() => {
    setRoster((prev) => ({
      ...prev,
      [playerId]: { playerId, name, color, isReady },
    }));
  }, [name, color, playerId, isReady]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setCoins((prev) => prev ?? 1000);
      return;
    }
    ensureUser(playerId, name).then((balance) => {
      if (balance !== null) setCoins(balance);
    });
  }, [playerId, name]);

  useEffect(() => {
    if (!isHost) return;
    sendRoomState({
      type: 'room_state',
      roomId,
      entryCost,
      maxPlayers,
      matchTimerSeconds,
      status,
      hostId,
      players: rosterList,
    });
  }, [roomId, entryCost, maxPlayers, matchTimerSeconds, status, hostId, rosterList, isHost, sendRoomState]);

  useEffect(() => {
    if (isHost) return;
    if (status === 'running') {
      sendInput({ type: 'input', playerId, dir: direction });
    }
  }, [direction, isHost, playerId, sendInput, status]);

  const { gameState, startMatch, resetToLobby } = useGameHostLoop({
    isHost,
    roster: rosterList,
    entryCost,
    matchTimerSeconds,
    localPlayerId: playerId,
    localDirection: direction,
    remoteInputs,
    incomingPlayers,
    incomingMatch,
    sendPlayers: sendPlayerState,
    sendMatch: (match) => {
      setStatus(match.status);
      sendMatchState(match);
    },
  });

  useEffect(() => {
    setStatus(gameState.status);
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.status !== 'finished') return;
    if (supabaseEnabled) {
      fetchBalance(playerId).then((bal) => {
        if (bal !== null) setCoins(bal);
      });
    } else if (gameState.payouts) {
      const payout = gameState.payouts.find((p) => p.playerId === playerId)?.coins ?? 0;
      setCoins((prev) => (prev ?? 1000) + payout - entryCost);
    }
  }, [gameState.status, gameState.payouts, playerId, entryCost]);

  const handleReadyToggle = () => setIsReady((prev) => !prev);

  const handleSettingsChange = (settings: {
    entryCost?: number;
    maxPlayers?: number;
    matchTimerSeconds?: number;
  }) => {
    if (settings.entryCost !== undefined) setEntryCost(settings.entryCost);
    if (settings.maxPlayers !== undefined) setMaxPlayers(settings.maxPlayers);
    if (settings.matchTimerSeconds !== undefined) setMatchTimerSeconds(settings.matchTimerSeconds);
  };

  const playersForRender = useMemo(
    () => Object.values(gameState.players),
    [gameState.players],
  );

  const persistedRef = useRef(false);
  useEffect(() => {
    if (gameState.status === 'running') {
      persistedRef.current = false;
      return;
    }
    if (gameState.status === 'finished' && !persistedRef.current && isHost && gameState.payouts) {
      persistedRef.current = true;
      recordMatchResult({
        roomId,
        entryCost,
        totalPool: gameState.pool,
        roster: rosterList,
        players: playersForRender,
        match: {
          type: 'match_state',
          status: gameState.status,
          timerSeconds: gameState.timerSeconds,
          pool: gameState.pool,
          winnerId: gameState.winnerId,
          payouts: gameState.payouts,
          aliveIds: [],
        },
      }).then(() => {
        if (supabaseEnabled) {
          fetchBalance(playerId).then((bal) => {
            if (bal !== null) setCoins(bal);
          });
        }
      });
    }
  }, [
    gameState.status,
    gameState.pool,
    gameState.timerSeconds,
    gameState.winnerId,
    gameState.payouts,
    isHost,
    entryCost,
    rosterList,
    playersForRender,
    roomId,
    playerId,
  ]);

  return (
    <div className="page">
      <div className="sidebar">
        <div className="panel">
          <p className="eyebrow">You</p>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
          />
          <p className="muted small">
            Player ID: <code>{playerId}</code>
          </p>
          <p className="muted small">
            Connection: <strong>{connectionState}</strong> {hostId === playerId ? '(host)' : '(client)'}
          </p>
          <p className="muted small">
            Coins: {coins ?? '…'}
          </p>
        </div>

        <RoomLobby
          roomId={roomId}
          players={rosterList}
          isHost={isHost}
          status={status}
          entryCost={entryCost}
          maxPlayers={maxPlayers}
          matchTimerSeconds={matchTimerSeconds}
          isReady={isReady}
          onReadyToggle={handleReadyToggle}
          onStart={() => {
            setIsReady(false);
            startMatch();
          }}
          onSettingsChange={handleSettingsChange}
        />
      </div>

      <div className="main">
        <HUD
          status={gameState.status}
          timerSeconds={gameState.timerSeconds}
          pool={gameState.pool}
          players={playersForRender}
          localPlayerId={playerId}
          payouts={gameState.payouts}
        />
        <GameCanvas players={playersForRender} gridWidth={GRID_WIDTH} gridHeight={GRID_HEIGHT} />
        {gameState.status === 'finished' && (
          <div className="overlay">
            <div className="card">
              <h3>Match finished</h3>
              {gameState.winnerId ? (
                <p className="muted">
                  Winner: <strong>{gameState.winnerId.slice(0, 6)}</strong>
                </p>
              ) : (
                <p className="muted">No survivors</p>
              )}
              {gameState.payouts && (
                <ul className="muted small">
                  {gameState.payouts.map((payout) => (
                    <li key={payout.playerId}>
                      {payout.playerId.slice(0, 6)}: {payout.coins} coins
                    </li>
                  ))}
                </ul>
              )}
              <div className="inline-actions">
                <button className="secondary" onClick={resetToLobby}>
                  Back to lobby
                </button>
                {isHost && <button onClick={startMatch}>Replay</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomPage;
