import { supabase, supabaseEnabled } from './supabaseClient';
import type { MatchStateMessage, PlayerNetState, RoomPlayer } from './types';

const DEFAULT_COINS = 1000;

export async function ensureUser(userId: string, username?: string) {
  if (!supabaseEnabled || !supabase) return null;
  await supabase
    .from('users')
    .upsert({ id: userId, username, coins: DEFAULT_COINS }, { onConflict: 'id' });
  return fetchBalance(userId);
}

export async function fetchBalance(userId: string) {
  if (!supabaseEnabled || !supabase) return null;
  const { data, error } = await supabase.from('users').select('coins').eq('id', userId).single();
  if (error) {
    return null;
  }
  return data?.coins ?? null;
}

export async function adjustBalance(userId: string, delta: number) {
  if (!supabaseEnabled || !supabase) return null;
  await supabase.rpc('increment_user_coins', { user_uuid: userId, amount: delta });
  return fetchBalance(userId);
}

type RecordMatchParams = {
  roomId: string;
  entryCost: number;
  totalPool: number;
  roster: RoomPlayer[];
  players: PlayerNetState[];
  match: MatchStateMessage;
};

export async function recordMatchResult({
  roomId,
  entryCost,
  totalPool,
  roster,
  players,
  match,
}: RecordMatchParams) {
  if (!supabaseEnabled || !supabase) return;

  const payoutMap = new Map<string, number>();
  match.payouts?.forEach((p) => payoutMap.set(p.playerId, p.coins));

  // Ensure all users exist before adjusting balances.
  await Promise.all(roster.map((p) => ensureUser(p.playerId, p.name)));

  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .insert({
      room_id: roomId,
      status: match.status,
      entry_cost: entryCost,
      total_pool: totalPool,
    })
    .select('id')
    .single();

  if (matchError || !matchRow?.id) return;
  const matchId = matchRow.id as string;

  const matchPlayerRows = roster.map((player) => {
    const netState = players.find((p) => p.playerId === player.playerId);
    const finalReward = payoutMap.get(player.playerId) ?? 0;
    const territoryCells = netState?.territory.length ?? 0;
    const isWinner = match.winnerId === player.playerId;
    return {
      match_id: matchId,
      user_id: player.playerId,
      player_id: player.playerId,
      final_territory_cells: territoryCells,
      final_reward: finalReward,
      is_winner: isWinner,
    };
  });

  await supabase.from('match_players').insert(matchPlayerRows);

  // Adjust balances: everyone pays entry cost; rewards are added.
  await Promise.all(
    matchPlayerRows.map((row) => {
      const delta = (row.final_reward ?? 0) - entryCost;
      return adjustBalance(row.user_id as string, delta);
    }),
  );
}
