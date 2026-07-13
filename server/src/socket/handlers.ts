import type { Server, Socket } from "socket.io";
import type { Ack, CreateRoomPayload, GameActionPayload, JoinRoomPayload, PlayerRoomPayload } from "@brain-arena/shared";
import { RoomManager, type GameRoom } from "../rooms/roomManager.js";

export function registerHandlers(io: Server, socket: Socket, rooms: RoomManager) {
  const broadcast = (room: GameRoom, event = "room:updated", exceptSocketId?: string) => {
    for (const player of room.players) if (player.socketId !== exceptSocketId) io.to(player.socketId).emit(event, rooms.view(room, player.id));
  };
  const safely = <T>(ack: ((value: Ack<T>) => void) | undefined, fn: () => T) => {
    try { ack?.({ ok: true, data: fn() }); } catch (error) { const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다."; ack?.({ ok: false, error: message }); socket.emit("room:error", message); }
  };

  socket.on("room:create", (payload: CreateRoomPayload, ack?: (value: Ack<{ room: unknown; playerId: string }>) => void) => safely(ack, () => {
    const { room, player } = rooms.create(payload.nickname, payload.gameType, socket.id, payload.playerId);
    socket.join(room.code); console.log(`[room] ${room.code} created by ${player.nickname}`);
    return { room: rooms.view(room, player.id), playerId: player.id };
  }));

  socket.on("room:join", (payload: JoinRoomPayload, ack?: (value: Ack<{ room: unknown; playerId: string }>) => void) => safely(ack, () => {
    const { room, player } = rooms.join(payload.roomCode, payload.nickname, socket.id, payload.playerId);
    socket.join(room.code); broadcast(room, "room:updated", socket.id); console.log(`[room] ${player.nickname} joined ${room.code}`);
    return { room: rooms.view(room, player.id), playerId: player.id };
  }));

  socket.on("room:ready", (payload: PlayerRoomPayload, ack?: (value: Ack) => void) => safely(ack, () => {
    const room = rooms.ready(payload.roomCode, payload.playerId, socket.id); broadcast(room, room.status === "PLAYING" ? "game:started" : "room:updated");
    return undefined;
  }));

  socket.on("game:action", (action: GameActionPayload, ack?: (value: Ack) => void) => safely(ack, () => {
    const room = rooms.action(action.roomCode, action.playerId, socket.id, action.type, action.payload);
    broadcast(room, room.status === "FINISHED" ? "game:finished" : "game:updated"); return undefined;
  }));

  socket.on("room:restart", (payload: PlayerRoomPayload, ack?: (value: Ack) => void) => safely(ack, () => { const room = rooms.restart(payload.roomCode, payload.playerId, socket.id); broadcast(room); return undefined; }));

  socket.on("room:leave", (payload: PlayerRoomPayload, ack?: (value: Ack) => void) => safely(ack, () => {
    const result = rooms.leave(payload.roomCode.toUpperCase(), payload.playerId); socket.leave(payload.roomCode.toUpperCase());
    if (result?.closed) io.to(result.room.code).emit("room:error", "방장이 방을 종료했습니다."); else if (result) broadcast(result.room);
    return undefined;
  }));

  socket.on("player:reconnect", (payload: PlayerRoomPayload, ack?: (value: Ack<{ room: unknown }>) => void) => safely(ack, () => {
    const room = rooms.reconnect(payload.roomCode, payload.playerId, socket.id); socket.join(room.code); broadcast(room, "player:reconnected"); return { room: rooms.view(room, payload.playerId) };
  }));

  socket.on("disconnect", reason => { const room = rooms.disconnect(socket.id); if (room) broadcast(room, "player:disconnected"); console.log(`[socket] disconnected ${socket.id}: ${reason}`); });
}
