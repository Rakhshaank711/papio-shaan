import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BROADCAST_EVERY,
  GRID_HEIGHT,
  GRID_WIDTH,
  TICK_MS,
  TERRITORY_WIN_THRESHOLD,
} from '../gameConfig';
import type {
  Direction,
  GameState,
  MatchStateMessage,
  PlayerNetState,
  RoomPlayer,
  RoomStatus,
} from '../types';

const DIR_TO_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const cellKey = (x: number, y: number) => `${x},${y}`;

const spawnAt = (index: number): { x: number; y: number } => {
  const padding = 4;
  const spots = [
    { x: padding, y: padding },
    { x: GRID_WIDTH - padding - 1, y: padding },
    { x: padding, y: GRID_HEIGHT - padding - 1 },
    { x: GRID_WIDTH - padding - 1, y: GRID_HEIGHT - padding - 1 },
    { x: Math.floor(GRID_WIDTH / 2), y: padding },
    { x: Math.floor(GRID_WIDTH / 2), y: GRID_HEIGHT - padding - 1 },
  ];
  return spots[index] ?? { x: padding + index, y: padding + index };
};

type Params = {
  isHost: boolean;
  roster: RoomPlayer[];
  entryCost: number;
  matchTimerSeconds: number;
  localPlayerId: string;
  localDirection: Direction;
  remoteInputs: Record<string, Direction>;
  incomingPlayers: PlayerNetState[];
  incomingMatch: MatchStateMessage | null;
  sendPlayers: (players: PlayerNetState[]) => void;
  sendMatch: (match: MatchStateMessage) => void;
};

const createInitialState = (matchTimerSeconds: number): GameState => ({
  status: 'waiting',
  timerSeconds: matchTimerSeconds,
  pool: 0,
  payouts: undefined,
  winnerId: undefined,
  players: {},
  gridWidth: GRID_WIDTH,
  gridHeight: GRID_HEIGHT,
});

export function useGameHostLoop({
  isHost,
  roster,
  entryCost,
  matchTimerSeconds,
  localPlayerId,
  localDirection,
  remoteInputs,
  incomingPlayers,
  incomingMatch,
  sendPlayers,
  sendMatch,
}: Params) {
  const [gameState, setGameState] = useState<GameState>(createInitialState(matchTimerSeconds));
  const inputsRef = useRef<Record<string, Direction>>({});
  const tickRef = useRef(0);

  useEffect(() => {
    inputsRef.current = { ...remoteInputs, [localPlayerId]: localDirection };
  }, [remoteInputs, localDirection, localPlayerId]);

  // Sync timer reset when leaving finished state.
  useEffect(() => {
    if (gameState.status === 'waiting') {
      setGameState((prev) => ({
        ...prev,
        timerSeconds: matchTimerSeconds,
        pool: entryCost * Math.max(roster.length, 1),
      }));
    }
  }, [matchTimerSeconds, entryCost, roster.length, gameState.status]);

  // Non-hosts follow incoming snapshots.
  useEffect(() => {
    if (isHost) return;
    if (incomingMatch) {
      setGameState((prev) => ({
        ...prev,
        status: incomingMatch.status,
        timerSeconds: incomingMatch.timerSeconds,
        pool: incomingMatch.pool,
        winnerId: incomingMatch.winnerId,
        payouts: incomingMatch.payouts,
      }));
    }
  }, [incomingMatch, isHost]);

  useEffect(() => {
    if (isHost) return;
    if (incomingPlayers.length) {
      setGameState((prev) => ({
        ...prev,
        players: Object.fromEntries(incomingPlayers.map((p) => [p.playerId, p])),
      }));
    }
  }, [incomingPlayers, isHost]);

  const startMatch = () => {
    if (!isHost) return;
    const pool = entryCost * Math.max(roster.length, 1);
    const players = roster.map((player, idx) => {
      const spawn = spawnAt(idx);
      const baseTerritory = [cellKey(spawn.x, spawn.y)];
      const dir: Direction = idx % 2 === 0 ? 'right' : 'left';
      const netState: PlayerNetState = {
        playerId: player.playerId,
        name: player.name,
        color: player.color,
        x: spawn.x,
        y: spawn.y,
        dir,
        isAlive: true,
        territory: baseTerritory,
        trail: [],
      };
      return netState;
    });

    tickRef.current = 0;
    const nextState: GameState = {
      status: 'running',
      timerSeconds: matchTimerSeconds,
      pool,
      winnerId: undefined,
      payouts: undefined,
      players: Object.fromEntries(players.map((p) => [p.playerId, p])),
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
    };
    setGameState(nextState);
    sendMatch(buildMatchPayload(nextState));
    sendPlayers(players);
  };

  const resetToLobby = () => {
    setGameState(createInitialState(matchTimerSeconds));
  };

  useEffect(() => {
    if (!isHost) return;
    const interval = window.setInterval(() => {
      setGameState((prev) => {
        if (prev.status !== 'running') return prev;
        const next = tickGame(prev, inputsRef.current, entryCost);
        tickRef.current += 1;

        if (tickRef.current % BROADCAST_EVERY === 0) {
          sendPlayers(Object.values(next.players));
          sendMatch(buildMatchPayload(next));
        }
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [isHost, entryCost, matchTimerSeconds, sendPlayers, sendMatch]);

  const aliveCount = useMemo(
    () => Object.values(gameState.players).filter((p) => p.isAlive).length,
    [gameState.players],
  );

  return { gameState, startMatch, resetToLobby, aliveCount };
}

function tickGame(state: GameState, inputs: Record<string, Direction>, entryCost: number): GameState {
  const nextPlayers: Record<string, PlayerNetState> = {};
  const globalTrail = new Set<string>();
  Object.values(state.players).forEach((p) => p.trail.forEach((cell) => globalTrail.add(cell)));

  Object.values(state.players).forEach((player) => {
    const updated = { ...player, territory: [...player.territory], trail: [...player.trail] };
    if (!updated.isAlive) {
      nextPlayers[updated.playerId] = updated;
      return;
    }

    const dir = inputs[updated.playerId] ?? updated.dir;
    const delta = DIR_TO_DELTA[dir];
    const nextX = updated.x + delta.dx;
    const nextY = updated.y + delta.dy;
    const nextKey = cellKey(nextX, nextY);

    if (nextX < 0 || nextX >= GRID_WIDTH || nextY < 0 || nextY >= GRID_HEIGHT) {
      updated.isAlive = false;
      nextPlayers[updated.playerId] = updated;
      return;
    }

    if (globalTrail.has(nextKey)) {
      updated.isAlive = false;
      nextPlayers[updated.playerId] = updated;
      return;
    }

    const territorySet = new Set(updated.territory);
    const inOwnTerritory = territorySet.has(nextKey);

    if (!inOwnTerritory) {
      updated.trail.push(nextKey);
      globalTrail.add(nextKey);
    } else if (updated.trail.length > 0) {
      updated.territory = Array.from(new Set([...updated.territory, ...updated.trail]));
      updated.trail = [];
    }

    updated.x = nextX;
    updated.y = nextY;
    updated.dir = dir;

    nextPlayers[updated.playerId] = updated;
  });

  const alive = Object.values(nextPlayers).filter((p) => p.isAlive);
  const timerSeconds = Math.max(0, state.timerSeconds - TICK_MS / 1000);
  let status: RoomStatus = state.status;
  let winnerId = state.winnerId;
  let payouts = state.payouts;
  const totalPool = entryCost * Math.max(Object.keys(state.players).length, 1);

  const topTerritory = Math.max(...alive.map((p) => p.territory.length), 0);
  const coverage = topTerritory / (GRID_WIDTH * GRID_HEIGHT);

  if (alive.length <= 1 || coverage >= TERRITORY_WIN_THRESHOLD) {
    status = 'finished';
    winnerId = alive[0]?.playerId;
    payouts = winnerId ? [{ playerId: winnerId, coins: totalPool }] : [];
  } else if (timerSeconds <= 0) {
    status = 'finished';
    const rewards = computeSplit(totalPool, alive);
    payouts = rewards;
    winnerId = rewards[0]?.playerId;
  }

  return {
    ...state,
    players: nextPlayers,
    status,
    timerSeconds,
    winnerId,
    payouts,
    pool: totalPool,
  };
}

function computeSplit(totalPool: number, alivePlayers: PlayerNetState[]) {
  if (alivePlayers.length === 0) return [];
  const territoryTotals = alivePlayers.reduce((sum, p) => sum + p.territory.length, 0);
  if (territoryTotals === 0) {
    const even = Math.floor(totalPool / Math.max(alivePlayers.length, 1));
    const payouts = alivePlayers.map((p) => ({ playerId: p.playerId, coins: even }));
    const distributed = payouts.reduce((sum, p) => sum + p.coins, 0);
    const leftover = totalPool - distributed;
    if (leftover > 0 && payouts[0]) payouts[0].coins += leftover;
    return payouts;
  }

  const rawRewards = alivePlayers.map((p) => ({
    playerId: p.playerId,
    raw: totalPool * (p.territory.length / territoryTotals),
  }));

  const floored = rawRewards.map((r) => ({ playerId: r.playerId, coins: Math.floor(r.raw) }));
  const distributed = floored.reduce((sum, r) => sum + r.coins, 0);
  const leftover = totalPool - distributed;

  if (leftover > 0) {
    const maxPlayer = alivePlayers.reduce(
      (acc, curr) =>
        curr.territory.length > acc.territory.length ? curr : acc,
      alivePlayers[0],
    );
    const target = floored.find((p) => p.playerId === maxPlayer.playerId);
    if (target) target.coins += leftover;
  }

  return floored;
}

function buildMatchPayload(state: GameState): MatchStateMessage {
  return {
    type: 'match_state',
    status: state.status,
    timerSeconds: state.timerSeconds,
    pool: state.pool,
    winnerId: state.winnerId,
    payouts: state.payouts,
    aliveIds: Object.values(state.players)
      .filter((p) => p.isAlive)
      .map((p) => p.playerId),
  };
}
