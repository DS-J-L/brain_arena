import { randomBytes, randomUUID } from "node:crypto";
import type { GameType, RoomView } from "@brain-arena/shared";
import { blackAndWhiteEngine, type BlackAndWhiteState } from "../games/blackAndWhiteEngine.js";

interface InternalPlayer { id: string; socketId: string; nickname: string; isReady: boolean; isConnected: boolean }
export interface GameRoom { code: string; hostId: string; gameType: GameType; players: InternalPlayer[]; status: "WAITING"|"PLAYING"|"FINISHED"; gameState: BlackAndWhiteState | null; createdAt: number }

export class RoomManager {
  readonly rooms = new Map<string, GameRoom>();
  private code() { let value = ""; do { value = randomBytes(5).toString("base64url").replace(/[-_]/g, "A").slice(0, 6).toUpperCase(); } while (this.rooms.has(value)); return value; }
  create(nickname: string, gameType: GameType, socketId: string, requestedId?: string) {
    if (gameType !== "BLACK_AND_WHITE") throw new Error("이 게임은 준비 중입니다.");
    const player = { id: requestedId || randomUUID(), socketId, nickname: cleanName(nickname), isReady: false, isConnected: true };
    const room: GameRoom = { code: this.code(), hostId: player.id, gameType, players: [player], status: "WAITING", gameState: null, createdAt: Date.now() };
    this.rooms.set(room.code, room); return { room, player };
  }
  join(code: string, nickname: string, socketId: string, requestedId?: string) {
    const room = this.require(code); if (room.players.length >= 2) throw new Error("이미 가득 찬 방입니다.");
    const name = cleanName(nickname); if (room.players.some(p => p.nickname.toLowerCase() === name.toLowerCase())) throw new Error("같은 닉네임을 사용할 수 없습니다.");
    const player = { id: requestedId || randomUUID(), socketId, nickname: name, isReady: false, isConnected: true };
    room.players.push(player); return { room, player };
  }
  require(code: string) { const room = this.rooms.get(code.trim().toUpperCase()); if (!room) throw new Error("존재하지 않는 방입니다."); return room; }
  authenticate(room: GameRoom, playerId: string, socketId?: string) { const player = room.players.find(p => p.id === playerId); if (!player || (socketId && player.socketId !== socketId)) throw new Error("플레이어를 확인할 수 없습니다."); return player; }
  ready(code: string, playerId: string, socketId: string) { const room = this.require(code); const player = this.authenticate(room, playerId, socketId); if (room.status !== "WAITING") throw new Error("준비 상태를 변경할 수 없습니다."); player.isReady = !player.isReady; if (room.players.length === 2 && room.players.every(p => p.isReady)) { room.gameState = blackAndWhiteEngine.createInitialState(room.players.map(p => p.id)); room.status = "PLAYING"; } return room; }
  action(code: string, playerId: string, socketId: string, type: string, payload: unknown) { const room = this.require(code); this.authenticate(room, playerId, socketId); if (room.status !== "PLAYING" || !room.gameState) throw new Error("진행 중인 게임이 아닙니다."); if (type !== "SELECT_TILE") throw new Error("지원하지 않는 행동입니다."); const tile = Number((payload as { tile?: unknown })?.tile); room.gameState = blackAndWhiteEngine.applyAction(room.gameState, playerId, { type, tile }); if (blackAndWhiteEngine.getResult(room.gameState)) room.status = "FINISHED"; return room; }
  restart(code: string, playerId: string, socketId: string) { const room = this.require(code); this.authenticate(room, playerId, socketId); if (room.status !== "FINISHED") throw new Error("아직 게임이 끝나지 않았습니다."); room.status = "WAITING"; room.gameState = null; room.players.forEach(p => p.isReady = false); return room; }
  leave(code: string, playerId: string) { const room = this.rooms.get(code); if (!room) return null; if (playerId === room.hostId) { this.rooms.delete(code); return { closed: true, room }; } room.players = room.players.filter(p => p.id !== playerId); room.players.forEach(p => p.isReady = false); room.status = "WAITING"; room.gameState = null; return { closed: false, room }; }
  disconnect(socketId: string) { for (const room of this.rooms.values()) { const p = room.players.find(x => x.socketId === socketId); if (p) { p.isConnected = false; return room; } } return null; }
  reconnect(code: string, playerId: string, socketId: string) { const room = this.require(code); const player = this.authenticate(room, playerId); player.socketId = socketId; player.isConnected = true; return room; }
  processDeadlines(now = Date.now()) {
    const changed: GameRoom[] = [];
    for (const room of this.rooms.values()) {
      const state = room.gameState;
      if (room.status !== "PLAYING" || !state?.deadline || state.deadline > now) continue;
      const missingPlayers = state.playerIds.filter(playerId => state.selections[playerId] === null);
      for (const playerId of missingPlayers) {
        const tiles = room.gameState!.remainingTiles[playerId];
        const tile = tiles[Math.floor(Math.random() * tiles.length)];
        room.gameState = blackAndWhiteEngine.applyAction(room.gameState!, playerId, { type: "SELECT_TILE", tile });
      }
      if (blackAndWhiteEngine.getResult(room.gameState!)) room.status = "FINISHED";
      changed.push(room);
    }
    return changed;
  }
  view(room: GameRoom, playerId: string): RoomView { return { code: room.code, hostId: room.hostId, gameType: room.gameType, status: room.status, players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isReady: p.isReady, isConnected: p.isConnected, isHost: p.id === room.hostId })), gameState: room.gameState ? blackAndWhiteEngine.getPlayerView(room.gameState, playerId) : null }; }
}

function cleanName(value: string) { const name = value?.trim().slice(0, 12); if (!name || name.length < 2) throw new Error("닉네임은 2~12자로 입력해 주세요."); return name; }
