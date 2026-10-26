import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkHap, findAllHaps, hapKey, HAP_BACKGROUNDS, HAP_COLORS, HAP_SHAPES, isHap, type HapTile } from "@brain-arena/shared";
import { advanceGyeolHapPhase, createHapBoard, gyeolHapEngine as engine, type GyeolHapAction, type GyeolHapState } from "./gyeolHapEngine.js";

const tile = (shape = 0, color = 0, background = 0): HapTile => ({ shape: HAP_SHAPES[shape], shapeColor: HAP_COLORS[color], backgroundColor: HAP_BACKGROUNDS[background] });
// A deliberately simple legal board with known answers, including 1·2·3.
const board = () => [0, 1, 2].flatMap(s => [0, 1, 2].map(c => tile(s, c, 0)));
const initial = () => {
  const state = engine.createInitialState(["a", "b"]);
  state.board = board(); state.allHaps = findAllHaps(state.board);
  state.currentPlayerId = state.firstPlayerId = "a";
  return state;
};
function act(state: GyeolHapState, action: { type: "HAP" | "GYEOL" } | { type: "SUBMIT_HAP"; numbers: number[] }) {
  return engine.applyAction(state, state.currentPlayerId, { ...action, round: state.round, turnId: state.turnId });
}
function advance(state: GyeolHapState) {
  vi.setSystemTime(state.deadline!);
  return advanceGyeolHapPhase(state);
}
function finishRound(state: GyeolHapState) {
  state.foundHaps = state.allHaps.map(numbers => ({ numbers, playerId: "a" }));
  return act(state, { type: "GYEOL" });
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T00:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("합 판정", () => {
  it("각 속성의 27개 패턴 중 모두 1 또는 3인 8개만 통과한다", () => {
    let passed = 0;
    for (let shape = 1; shape <= 3; shape++) for (let color = 1; color <= 3; color++) for (let bg = 1; bg <= 3; bg++) {
      const values = (count: number) => count === 1 ? [0, 0, 0] : count === 2 ? [0, 0, 1] : [0, 1, 2];
      const tiles = [0, 1, 2].map(i => tile(values(shape)[i], values(color)[i], values(bg)[i]));
      const expected = ![shape, color, bg].includes(2);
      expect(isHap(tiles)).toBe(expected);
      if (expected) passed++;
    }
    expect(passed).toBe(8);
  });
  it("늘어난 모양 종류와 사용자 예시를 같은 규칙으로 판정한다", () => {
    expect(isHap([tile(0, 0, 0), tile(1, 0, 1), tile(4, 0, 2)])).toBe(true);
    const wrong = [tile(0, 0, 0), tile(1, 0, 1), tile(4, 1, 2)];
    expect(isHap(wrong)).toBe(false);
    expect(checkHap(wrong).shapeColor).toBe("TWO_SAME");
    expect(isHap([])).toBe(false);
  });
  it("9개 중 3개를 고르는 84가지 조합을 빠짐없이 열거한다", () => {
    const answers = findAllHaps(Array.from({ length: 9 }, () => tile()));
    expect(answers).toHaveLength(84);
    expect(new Set(answers.map(hapKey)).size).toBe(84);
    expect(answers.every(([a, b, c]) => a < b && b < c)).toBe(true);
  });
  it("60가지 중 중복 없는 9개를 뽑는다", () => {
    for (let i = 0; i < 30; i++) {
      const tiles = createHapBoard();
      expect(tiles).toHaveLength(9);
      expect(new Set(tiles.map(t => JSON.stringify(t))).size).toBe(9);
      expect(tiles.every(t => HAP_SHAPES.includes(t.shape) && HAP_COLORS.includes(t.shapeColor) && HAP_BACKGROUNDS.includes(t.backgroundColor))).toBe(true);
    }
  });
});

describe("점수와 차례", () => {
  it("처음부터 합이 없는 실제 9개 보드에서도 첫 결은 +3점이다", () => {
    const state = initial();
    state.board = [[1,0,0],[0,3,1],[4,3,2],[1,2,0],[0,0,2],[1,0,2],[4,0,0],[0,3,2],[4,3,0]].map(([s,c,b]) => tile(s,c,b));
    state.allHaps = findAllHaps(state.board);
    expect(state.allHaps).toEqual([]);
    const next = act(state, { type: "GYEOL" });
    expect(next.scores.a).toBe(3);
    expect(next.phase).toBe("ROUND_END");
  });
  it("새 합은 +1, 타일 유지, 상대 차례; 같은 타일의 다른 합도 허용한다", () => {
    const state = initial();
    const selected = act(state, { type: "HAP" });
    const answer = act(selected, { type: "SUBMIT_HAP", numbers: [3, 1, 2] });
    expect(answer.scores.a).toBe(1);
    expect(answer.foundHaps[0].numbers).toEqual([1, 2, 3]);
    expect(answer.board).toEqual(state.board);
    expect(state.foundHaps).toEqual([]);
    const next = advance(answer);
    expect(next.currentPlayerId).toBe("b");
    const reuse = act(act(next, { type: "HAP" }), { type: "SUBMIT_HAP", numbers: [1, 4, 7] });
    expect(reuse.scores.b).toBe(1);
    expect(reuse.foundHaps).toHaveLength(2);
  });
  it("순서를 바꾸거나 상대가 이미 찾은 합을 제출해도 -1이다", () => {
    const state = initial();
    state.foundHaps = [{ numbers: [1, 2, 3], playerId: "b" }];
    const next = act(act(state, { type: "HAP" }), { type: "SUBMIT_HAP", numbers: [3, 2, 1] });
    expect(next.lastResult?.reason).toBe("DUPLICATE");
    expect(next.scores.a).toBe(-1);
    expect(next.foundHaps).toHaveLength(1);
  });
  it("속성 하나라도 둘만 같으면 감점한다", () => {
    const next = act(act(initial(), { type: "HAP" }), { type: "SUBMIT_HAP", numbers: [1, 2, 4] });
    expect(next.lastResult?.reason).toBe("NOT_HAP");
    expect(next.scores.a).toBe(-1);
    expect(next.foundHaps).toEqual([]);
  });
  it("하나라도 남으면 결 오답; 전부 찾았으면 결 정답이다", () => {
    const state = initial();
    state.foundHaps = state.allHaps.slice(1).map(numbers => ({ numbers, playerId: "b" }));
    expect(act(state, { type: "GYEOL" }).lastResult?.reason).toBe("WRONG_GYEOL");
    const next = finishRound(state);
    expect(next.scores.a).toBe(3);
    expect(next.phase).toBe("ROUND_END");
    expect(next.history[0].missedHaps).toEqual([]);
  });
  it("마지막 합을 찾아도 결 선언까지 자동 종료하지 않는다", () => {
    const state = initial();
    state.foundHaps = state.allHaps.filter(n => hapKey(n) !== "1,2,3").map(numbers => ({ numbers, playerId: "b" }));
    const next = act(act(state, { type: "HAP" }), { type: "SUBMIT_HAP", numbers: [1, 2, 3] });
    expect(next.phase).toBe("RESULT");
    expect(next.scores.a).toBe(1);
    const end = act(advance(next), { type: "GYEOL" });
    expect(end.scores.b).toBe(3);
  });
});

describe("시간과 입력 검증", () => {
  it("합 승인부터 별도 5초이며 재선언으로 늘릴 수 없다", () => {
    const state = initial();
    vi.advanceTimersByTime(9_000);
    const next = act(state, { type: "HAP" });
    expect(next.deadline! - Date.now()).toBe(5_000);
    expect(() => act(next, { type: "HAP" })).toThrow();
    expect(() => act(next, { type: "GYEOL" })).toThrow();
  });
  it("10초 만료는 무감점 패스, 합 5초 만료는 -1이며 패스를 초기화한다", () => {
    const pass = advance(initial());
    expect(pass.lastResult?.reason).toBe("PASS");
    expect(pass.scores.a).toBe(0);
    expect(pass.consecutivePasses).toBe(1);
    const selected = act(advance(pass), { type: "HAP" });
    const timeout = advance(selected);
    expect(timeout.lastResult?.reason).toBe("TIMEOUT");
    expect(timeout.scores.b).toBe(-1);
    expect(timeout.consecutivePasses).toBe(0);
  });
  it("양쪽 합계 6회 연속 패스로만 라운드를 종료하고 복기 정보를 저장한다", () => {
    let state = initial();
    for (let i = 1; i <= 6; i++) {
      state = advance(state);
      expect(state.consecutivePasses).toBe(i);
      expect(state.phase).toBe(i === 6 ? "ROUND_END" : "RESULT");
      if (i < 6) state = advance(state);
    }
    expect(state.history[0].missedHaps.length).toBe(state.allHaps.length);
    expect(state.history[0].missedHaps[0].checks).toBeDefined();
  });
  it("잘못된 번호, 반복 번호, 차례 밖, 만료 및 오래된 요청을 차단한다", () => {
    const state = initial(), selected = act(state, { type: "HAP" });
    for (const numbers of [[1, 1, 2], [0, 1, 2], [1, 2, 10], [1, 2], [1, 2, 3.5], ["1", 2, 3], null]) {
      expect(() => act(selected, { type: "SUBMIT_HAP", numbers: numbers as number[] })).toThrow();
    }
    const action: GyeolHapAction = { type: "GYEOL", round: state.round, turnId: state.turnId };
    expect(engine.validateAction(state, "b", action)).toBe(false);
    expect(engine.validateAction(state, "a", { ...action, turnId: 0 })).toBe(false);
    expect(engine.validateAction(state, "a", { ...action, round: 0 })).toBe(false);
    vi.setSystemTime(state.deadline!);
    expect(engine.validateAction(state, "a", action)).toBe(false);
  });
  it("제출과 타이머가 겹쳐도 결과는 한 번만 적용된다", () => {
    const state = act(initial(), { type: "HAP" });
    const next = act(state, { type: "SUBMIT_HAP", numbers: [1, 2, 3] });
    expect(() => act(next, { type: "SUBMIT_HAP", numbers: [1, 2, 3] })).toThrow();
    expect(advanceGyeolHapPhase(next)).toBe(next);
    const turn = advance(next);
    expect(advanceGyeolHapPhase(turn)).toBe(turn);
    expect(turn.scores.a).toBe(1);
  });
});

describe("라운드와 공개 정보", () => {
  it("라운드마다 선공 교대 및 기록 초기화, 10라운드 종료 시 승리 판정", () => {
    let state = initial();
    state.round = 9;
    const next = advance(finishRound(state));
    expect(next.round).toBe(10);
    expect(next.currentPlayerId).toBe("b");
    expect(next.foundHaps).toEqual([]);
    expect(next.attempts).toEqual([]);
    // Prevent the second player's +3 from making the score tied.
    next.scores.a = 10;
    state = advance(finishRound(next));
    expect(state.winnerId).toBe("a");
    expect(state.deadline).toBeNull();
  });
  it("10라운드 동점은 연장, 연장 중이 아닌 종료 시 점수를 비교한다", () => {
    const state = initial(); state.round = 10; state.scores.b = 3;
    let next = advance(finishRound(state));
    expect(next.round).toBe(11);
    expect(next.currentPlayerId).toBe("b");
    expect(next.winnerId).toBeNull();
    next = finishRound(next);
    expect(next.winnerId).toBeNull();
    expect(advance(next).winnerId).toBe("b");
  });
  it("진행 중 정답·복기 목록 비공개, 종료 후 실패 속성과 놓친 합 공개", () => {
    let state = act(act(initial(), { type: "HAP" }), { type: "SUBMIT_HAP", numbers: [1, 2, 4] });
    const view = engine.getPlayerView(state, "a");
    expect(view.history).toEqual([]);
    expect(view).not.toHaveProperty("allHaps");
    state.winnerId = "b";
    const review = engine.getPlayerView(state, "a").history[0];
    expect(review.missedHaps).toHaveLength(state.allHaps.length);
    expect(Object.values(review.attempts[0].checks!)).toContain("TWO_SAME");
    expect(review.endReason).toBe("FORFEIT");
  });
});
