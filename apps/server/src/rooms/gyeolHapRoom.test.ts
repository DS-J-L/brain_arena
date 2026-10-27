import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findAllHaps, type GyeolHapView } from "@brain-arena/shared";
import { RoomManager } from "./roomManager.js";
import type { GyeolHapState } from "../games/gyeolHapEngine.js";
import { decidePracticeBot } from "../bots/practiceBot.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T00:00:00Z")); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function match() {
  const manager = new RoomManager();
  const { room, player: a } = manager.create("플레이어A", "GYEOL_HAP", "socket-a");
  const { player: b } = manager.join(room.code, "플레이어B", "socket-b");
  manager.ready(room.code, a.id, "socket-a"); manager.ready(room.code, b.id, "socket-b");
  return { manager, room, a, b };
}

describe("결! 합! 방 통합", () => {
  it.each(["GYEOL_HAP_1", "GYEOL_HAP"] as const)("%s의 대전·연습·재시작에 같은 모드를 적용한다", kind => {
    const manager = new RoomManager();
    const { room, player } = manager.createPractice("연습생", kind, "socket-a");
    expect(manager.view(room, player.id).gameState?.kind).toBe(kind);
    manager.forfeit(room.code, player.id, "socket-a");
    manager.restart(room.code, player.id, "socket-a");
    expect(manager.view(room, player.id).gameState?.kind).toBe(kind);
    const { room: duel, player: a } = manager.create("플레이어A", kind, "socket-c");
    const { player: b } = manager.join(duel.code, "플레이어B", "socket-d");
    manager.ready(duel.code, a.id, "socket-c"); manager.ready(duel.code, b.id, "socket-d");
    expect(manager.view(duel, a.id).gameState?.kind).toBe(kind);
  });
  it("3라운드 동점도 방 종료로 반영한다", () => {
    const { manager, room } = match();
    const state = room.gameState as GyeolHapState;
    state.round = 3;
    const player = room.players.find(p => p.id === state.currentPlayerId)!;
    const opponent = room.players.find(p => p.id !== player.id)!;
    state.scores[opponent.id] = 3;
    state.foundHaps = state.allHaps.map(numbers => ({ numbers, playerId: player.id }));
    manager.action(room.code, player.id, player.socketId, "GYEOL", { round: 3, turnId: state.turnId });
    vi.setSystemTime(room.gameState!.deadline!); manager.processDeadlines();
    expect(room.status).toBe("FINISHED");
    expect(manager.view(room, player.id).gameState?.isDraw).toBe(true);
  });
  it("준비 후 시작, 인증된 합 입력, 양쪽 공용 기록과 서버 시간 처리를 연결한다", () => {
    const { manager, room } = match();
    expect(room.status).toBe("PLAYING");
    const state = room.gameState as GyeolHapState;
    // A known answer guarantees this test does not depend on random board contents.
    state.board[0] = { shape: "CIRCLE", shapeColor: "PURPLE", backgroundColor: "BLACK" };
    state.board[1] = { shape: "STAR", shapeColor: "PURPLE", backgroundColor: "GRAY" };
    state.board[2] = { shape: "SUN", shapeColor: "PURPLE", backgroundColor: "WHITE" };
    state.allHaps = findAllHaps(state.board);
    const player = room.players.find(p => p.id === state.currentPlayerId)!;
    const context = { round: state.round, turnId: state.turnId };
    expect(() => manager.action(room.code, player.id, "wrong-socket", "HAP", context)).toThrow();
    manager.action(room.code, player.id, player.socketId, "HAP", context);
    manager.action(room.code, player.id, player.socketId, "SUBMIT_HAP", { ...context, numbers: [3, 1, 2] });
    for (const p of room.players) {
      const view = manager.view(room, p.id).gameState as GyeolHapView;
      expect(view.foundHaps).toEqual([{ numbers: [1, 2, 3], playerId: player.id }]);
      expect(view).not.toHaveProperty("allHaps");
      expect(view.history).toEqual([]);
    }
    vi.setSystemTime(room.gameState!.deadline!);
    expect(manager.processDeadlines()).toContain(room);
    expect((room.gameState as GyeolHapState).currentPlayerId).not.toBe(player.id);
    expect(() => manager.action(room.code, player.id, player.socketId, "GYEOL", context)).toThrow();
  });

  it("만료된 합 제출은 타이머 실행 전에도 차단한다", () => {
    const { manager, room } = match();
    const state = room.gameState as GyeolHapState, player = room.players.find(p => p.id === state.currentPlayerId)!;
    const context = { round: state.round, turnId: state.turnId };
    manager.action(room.code, player.id, player.socketId, "HAP", context);
    vi.setSystemTime(room.gameState!.deadline!);
    expect(() => manager.action(room.code, player.id, player.socketId, "SUBMIT_HAP", { ...context, numbers: [1, 2, 3] })).toThrow();
    manager.processDeadlines();
    expect((room.gameState as GyeolHapState).scores[player.id]).toBe(-1);
  });

  it("3라운드 승패를 방 종료로 반영하고 재대결할 수 있다", () => {
    const { manager, room, a } = match();
    const state = room.gameState as GyeolHapState;
    state.round = 3; state.scores[state.currentPlayerId] = 10;
    state.foundHaps = state.allHaps.map(numbers => ({ numbers, playerId: a.id }));
    const player = room.players.find(p => p.id === state.currentPlayerId)!;
    manager.action(room.code, player.id, player.socketId, "GYEOL", { round: state.round, turnId: state.turnId });
    vi.setSystemTime(room.gameState!.deadline!); manager.processDeadlines();
    expect(room.status).toBe("FINISHED");
    expect(manager.view(room, a.id).gameState?.winnerId).toBe(player.id);
    manager.restart(room.code, a.id, "socket-a");
    expect(room.status).toBe("WAITING");
    expect(room.gameState).toBeNull();
  });

  it("연습 봇은 공개 뷰만으로 결을 판단하고 연습 재시작을 지원한다", () => {
    const manager = new RoomManager();
    const { room, player } = manager.createPractice("연습생", "GYEOL_HAP", "socket-a");
    expect(room.players).toHaveLength(2);
    const state = room.gameState as GyeolHapState;
    state.currentPlayerId = room.botPlayerId!;
    state.foundHaps = state.allHaps.map(numbers => ({ numbers, playerId: player.id }));
    room.botActionAt = Date.now();
    vi.spyOn(Math, "random").mockReturnValue(.5);
    manager.processDeadlines();
    expect((room.gameState as GyeolHapState).scores[room.botPlayerId!]).toBe(3);
    manager.forfeit(room.code, player.id, "socket-a");
    expect((manager.view(room, player.id).gameState as GyeolHapView).history.length).toBeGreaterThan(0);
    manager.restart(room.code, player.id, "socket-a");
    expect(room.status).toBe("PLAYING");
    expect((room.gameState as GyeolHapState).round).toBe(1);
    expect((room.gameState as GyeolHapState).scores[player.id]).toBe(0);
  });

  it("봇도 합 선언 후 제출하고, 만료 시에는 봇 행동보다 타임아웃을 우선한다", () => {
    const manager = new RoomManager();
    const { room } = manager.createPractice("연습생", "GYEOL_HAP", "socket-a");
    const state = room.gameState as GyeolHapState;
    state.currentPlayerId = room.botPlayerId!;
    state.board[0] = { shape: "CIRCLE", shapeColor: "PURPLE", backgroundColor: "BLACK" };
    state.board[1] = { shape: "STAR", shapeColor: "PURPLE", backgroundColor: "GRAY" };
    state.board[2] = { shape: "SUN", shapeColor: "PURPLE", backgroundColor: "WHITE" };
    state.allHaps = findAllHaps(state.board);
    const publicView = manager.view(room, room.botPlayerId!).gameState as GyeolHapView;
    vi.spyOn(Math, "random").mockReturnValue(.5);
    const decision = decidePracticeBot(publicView, room.botPlayerId!)!;
    expect(decision.type).toBe("HAP");
    manager.action(room.code, room.botPlayerId!, "BOT", decision.type, decision.payload);
    const answer = decidePracticeBot(manager.view(room, room.botPlayerId!).gameState!, room.botPlayerId!)!;
    expect(answer.type).toBe("SUBMIT_HAP");
    // At the exact deadline the bot must lose the point, never submit a late answer.
    vi.setSystemTime(room.gameState!.deadline!); room.botActionAt = Date.now();
    manager.processDeadlines();
    expect((room.gameState as GyeolHapState).lastResult?.reason).toBe("TIMEOUT");
    expect((room.gameState as GyeolHapState).scores[room.botPlayerId!]).toBe(-1);
  });
});
