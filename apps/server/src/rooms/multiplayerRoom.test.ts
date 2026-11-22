import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FindTheNumberView, GyeolHapView } from "@brain-arena/shared";
import { RoomManager } from "./roomManager.js";
import { advanceGyeolHapPhase, createGyeolHapState, gyeolHapEngine, type GyeolHapState } from "../games/gyeolHapEngine.js";
import { advanceFindTheNumberPhase, findNumberSolution, findTheNumberEngine, removeFindTheNumberPlayer } from "../games/findTheNumberEngine.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-23T00:00:00Z")); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function fullRoom(gameType: "GYEOL_HAP" | "FIND_THE_NUMBER", count = 4) {
  const manager = new RoomManager();
  const { room, player: host } = manager.create("플레이어1", gameType, "socket-1");
  const players = [host];
  for (let i = 2; i <= count; i++) players.push(manager.join(room.code, `플레이어${i}`, `socket-${i}`).player);
  return { manager, room, players };
}

describe("최대 4인 방", () => {
  it.each(["GYEOL_HAP", "FIND_THE_NUMBER"] as const)("%s는 4명까지 들어오고 모두 준비하면 시작한다", gameType => {
    const { manager, room, players } = fullRoom(gameType);
    expect(() => manager.join(room.code, "다섯째", "socket-5")).toThrow("가득 찬");
    players.slice(0, 3).forEach(p => manager.ready(room.code, p.id, p.socketId));
    expect(room.status).toBe("WAITING");
    manager.ready(room.code, players[3].id, players[3].socketId);
    expect(room.status).toBe("PLAYING");
    const view = manager.view(room, players[0].id).gameState as GyeolHapView | FindTheNumberView;
    expect(view.playerIds).toHaveLength(4);
  });
  it("2인 전용 게임은 세 번째 참가를 막는다", () => {
    const manager = new RoomManager();
    const { room } = manager.create("플레이어1", "BLACK_AND_WHITE", "socket-1");
    manager.join(room.code, "플레이어2", "socket-2");
    expect(() => manager.join(room.code, "플레이어3", "socket-3")).toThrow("가득 찬");
  });
  it("3명이 준비하면 2명을 기다리지 않고 시작한다", () => {
    const { manager, room, players } = fullRoom("FIND_THE_NUMBER", 3);
    players.forEach(p => manager.ready(room.code, p.id, p.socketId));
    expect(room.status).toBe("PLAYING");
    expect(() => manager.join(room.code, "늦은참가", "socket-9")).toThrow("진행 중");
  });
  it("3인 이상에서 한 명이 기권하면 남은 사람끼리 계속한다", () => {
    const { manager, room, players } = fullRoom("GYEOL_HAP", 3);
    players.forEach(p => manager.ready(room.code, p.id, p.socketId));
    const quitter = players.find(p => p.id === (room.gameState as GyeolHapState).currentPlayerId)!;
    manager.forfeit(room.code, quitter.id, quitter.socketId);
    manager.detachAfterForfeit(room, quitter.id);
    expect(room.status).toBe("PLAYING");
    const state = room.gameState as GyeolHapState;
    expect(state.playerIds).not.toContain(quitter.id);
    expect(state.playerIds).toContain(state.currentPlayerId);
    expect(room.players).toHaveLength(2);
    const next = players.find(p => p.id !== quitter.id)!;
    manager.forfeit(room.code, next.id, next.socketId);
    expect(room.status).toBe("FINISHED");
    expect(room.gameState!.winnerId).toBe(players.find(p => p.id !== quitter.id && p.id !== next.id)!.id);
  });
});

describe("결! 합! 다인전", () => {
  it("차례가 모든 플레이어를 순서대로 돈다", () => {
    let state = createGyeolHapState(["a", "b", "c", "d"]);
    const order = [state.currentPlayerId];
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(state.deadline!); state = advanceGyeolHapPhase(state); // 패스
      vi.setSystemTime(state.deadline!); state = advanceGyeolHapPhase(state); // 다음 차례
      order.push(state.currentPlayerId);
    }
    expect(new Set(order.slice(0, 4)).size).toBe(4);
    expect(order[4]).toBe(order[0]);
    const view = gyeolHapEngine.getPlayerView(state, "a");
    expect(view.totalRounds).toBe(4);
    expect(view.stallTurns).toBe(8);
  });
  it("최고 점수가 겹치면 무승부, 한 명이면 그 플레이어가 승리한다", () => {
    const state = createGyeolHapState(["a", "b", "c"]);
    state.round = 3; state.phase = "ROUND_END"; state.deadline = Date.now();
    state.scores = { a: 2, b: 5, c: 1 };
    expect(advanceGyeolHapPhase(state).winnerId).toBe("b");
    state.scores = { a: 5, b: 5, c: 1 };
    expect(advanceGyeolHapPhase(state).isDraw).toBe(true);
  });
});

describe("숫자를 찾아라 다인전", () => {
  it("3인 이상은 5점이 목표다", () => {
    expect(findTheNumberEngine.getPlayerView(findTheNumberEngine.createInitialState(["a", "b", "c"]), "a").targetScore).toBe(5);
    expect(findTheNumberEngine.getPlayerView(findTheNumberEngine.createInitialState(["a", "b"]), "a").targetScore).toBe(6);
  });
  it("첫 오답 뒤 두 명 이상 남으면 다시 부저 경쟁, 오답자는 부저를 못 누른다", () => {
    let state = advanceFindTheNumberPhase(findTheNumberEngine.createInitialState(["a", "b", "c"]));
    state.target = 999;
    state = findTheNumberEngine.applyAction(state, "a", { type: "BUZZ" });
    state = findTheNumberEngine.applyAction(state, "a", { type: "SELECT_CARDS", indices: [0, 1, 2] });
    state = advanceFindTheNumberPhase(state);
    expect(state.phase).toBe("BUZZER");
    expect(findTheNumberEngine.validateAction(state, "a", { type: "BUZZ" })).toBe(false);
    state = findTheNumberEngine.applyAction(state, "b", { type: "BUZZ" });
    state = advanceFindTheNumberPhase(state); // b 답변 시간 초과
    expect(state.phase).toBe("ANSWER_SECOND");
    expect(state.answererId).toBe("c");
  });
  it("답변 중인 플레이어가 나가도 게임이 멈추지 않는다", () => {
    let state = advanceFindTheNumberPhase(findTheNumberEngine.createInitialState(["a", "b", "c"]));
    state = findTheNumberEngine.applyAction(state, "a", { type: "BUZZ" });
    state = removeFindTheNumberPlayer(state, "a");
    expect(state.playerIds).toEqual(["b", "c"]);
    expect(state.phase).toBe("BUZZER");
    expect(state.answererId).toBeNull();
    state = removeFindTheNumberPlayer(state, "b");
    expect(state.winnerId).toBe("c");
  });
  it("정답을 맞힌 플레이어만 점수를 얻고 다음 목표로 넘어간다", () => {
    let state = advanceFindTheNumberPhase(findTheNumberEngine.createInitialState(["a", "b", "c", "d"]));
    state = findTheNumberEngine.applyAction(state, "d", { type: "BUZZ" });
    state = findTheNumberEngine.applyAction(state, "d", { type: "SELECT_CARDS", indices: findNumberSolution(state.board, state.target!) });
    state = advanceFindTheNumberPhase(state);
    expect(state.scores).toEqual({ a: 0, b: 0, c: 0, d: 1 });
    expect(state.round).toBe(2);
    expect(state.lockedOutIds).toEqual([]);
  });
});
