import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseEnabled } from '../supabaseClient';
import type {
  MatchStateMessage,
  PlayerInputMessage,
  PlayerNetState,
  RoomStateBroadcast,
} from '../types';

type HandlerPayloads = {
  onPlayers?: (players: PlayerNetState[]) => void;
  onMatch?: (match: MatchStateMessage) => void;
  onRoom?: (room: RoomStateBroadcast) => void;
  onInput?: (input: PlayerInputMessage) => void;
};

type ConnectionState = 'idle' | 'connecting' | 'joined' | 'error';

export function useSupabaseRealtime(roomId: string, handlers: HandlerPayloads) {
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    supabaseEnabled ? 'connecting' : 'idle',
  );
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!roomId) return;

    if (!supabaseEnabled) {
      setConnectionState('idle');
      return;
    }

    const channel = supabase!.channel(`room_${roomId}`, {
      config: {
        broadcast: { self: true },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'player_state' }, (payload) => {
        const players = (payload.payload as { players: PlayerNetState[] }).players;
        handlersRef.current.onPlayers?.(players ?? []);
      })
      .on('broadcast', { event: 'match_state' }, (payload) => {
        handlersRef.current.onMatch?.(payload.payload as MatchStateMessage);
      })
      .on('broadcast', { event: 'room_state' }, (payload) => {
        handlersRef.current.onRoom?.(payload.payload as RoomStateBroadcast);
      })
      .on('broadcast', { event: 'input' }, (payload) => {
        handlersRef.current.onInput?.(payload.payload as PlayerInputMessage);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('joined');
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [roomId]);

  const sendPlayerState = (players: PlayerNetState[]) => {
    if (!supabaseEnabled || !channelRef.current) {
      // In local/offline mode, just echo back to the handlers.
      handlersRef.current.onPlayers?.(players);
      return;
    }
    return channelRef.current.send({
      type: 'broadcast',
      event: 'player_state',
      payload: { players },
    });
  };

  const sendMatchState = (state: MatchStateMessage) => {
    if (!supabaseEnabled || !channelRef.current) {
      handlersRef.current.onMatch?.(state);
      return;
    }
    return channelRef.current.send({
      type: 'broadcast',
      event: 'match_state',
      payload: state,
    });
  };

  const sendRoomState = (state: RoomStateBroadcast) => {
    if (!supabaseEnabled || !channelRef.current) {
      handlersRef.current.onRoom?.(state);
      return;
    }
    return channelRef.current.send({
      type: 'broadcast',
      event: 'room_state',
      payload: state,
    });
  };

  const sendInput = (input: PlayerInputMessage) => {
    if (!supabaseEnabled || !channelRef.current) {
      handlersRef.current.onInput?.(input);
      return;
    }
    return channelRef.current.send({
      type: 'broadcast',
      event: 'input',
      payload: input,
    });
  };

  return {
    connectionState,
    sendPlayerState,
    sendMatchState,
    sendRoomState,
    sendInput,
  };
}
