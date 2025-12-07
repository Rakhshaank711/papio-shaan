export type Direction = 'up' | 'down' | 'left' | 'right';

export type RoomStatus = 'waiting' | 'running' | 'finished';

export type RoomPlayer = {
  playerId: string;
  name: string;
  color: string;
  isReady: boolean;
};

export type RoomStateBroadcast = {
  type: 'room_state';
  roomId: string;
  entryCost: number;
  maxPlayers: number;
  matchTimerSeconds: number;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
};

export type PlayerNetState = {
  playerId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  dir: Direction;
  isAlive: boolean;
  territory: string[];
  trail: string[];
};

export type MatchStateMessage = {
  type: 'match_state';
  status: RoomStatus;
  timerSeconds: number;
  pool: number;
  winnerId?: string;
  payouts?: { playerId: string; coins: number }[];
  aliveIds: string[];
};

export type PlayerInputMessage = {
  type: 'input';
  playerId: string;
  dir: Direction;
};

export type GameState = {
  status: RoomStatus;
  timerSeconds: number;
  pool: number;
  winnerId?: string;
  payouts?: { playerId: string; coins: number }[];
  players: Record<string, PlayerNetState>;
  gridWidth: number;
  gridHeight: number;
};
