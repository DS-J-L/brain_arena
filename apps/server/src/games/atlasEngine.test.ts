import { describe, expect, it } from "vitest";
import type { AtlasToken } from "@brain-arena/shared";
import { ATLAS_TIMES, advanceAtlasPhase, atlasEngine, removeAtlasPlayer, type AtlasState } from "./atlasEngine.js";

const submit = (state: AtlasState, id: string, number: number, token: AtlasToken) =>
  atlasEngine.applyAction(state, id, { type: "SUBMIT", number, token, round: state.round });
const pass = (state: AtlasState, id: string) => atlasEngine.applyAction(state, id, { type: "PASS", round: state.round });
const placeAs = (state: AtlasState, id: string, color?: "RED" | "GREEN" | "BLUE") => atlasEngine.applyAction(state, id, { type: "PLACE", color, round: state.round });
const start = (ids = ["a", "b"], lead = ids[0]) => { const state = atlasEngine.createInitialState(ids); state.leadId = lead; state.roundLeadId = lead; return state; };
const order = (state: AtlasState) => state.placements.map(p => p.playerId);

describe("atlasEngine", () => {
  it("인원에 따라 거인의 한계가 다르다: 2인 9, 3인 11, 4인 13 이상이면 무너진다", () => {
    expect(start(["a", "b"]).limit).toBe(8);
    expect(start(["a", "b", "c"]).limit).toBe(10);
    expect(start(["a", "b", "c", "d"]).limit).toBe(12);
  });

  it("블록 1~7과 빨강·초록·파랑 2개, 무지개 1개로 시작한다", () => {
    expect(start().hands.a).toEqual({ numbers: [1, 2, 3, 4, 5, 6, 7], tokens: { RED: 2, GREEN: 2, BLUE: 2, RAINBOW: 1 } });
  });

  it("다른 사람의 손과 제출은 볼 수 없다", () => {
    let state = start();
    state = submit(state, "a", 3, "RED");
    const view = atlasEngine.getPlayerView(state, "b");
    expect(view.submittedIds).toEqual(["a"]);
    expect(view.submissions).toBeNull();
    expect(view.mySubmission).toBeNull();
    expect(view.myHand.numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(view).not.toHaveProperty("hands");
    expect(view.history).toEqual([]);
  });

  it("큰 숫자부터 올리고, 같은 숫자는 선부터 오른쪽 순서로 올린다", () => {
    let state = start(["a", "b", "c"], "b");
    state = submit(state, "a", 3, "RED");
    state = submit(state, "b", 3, "GREEN");
    state = submit(state, "c", 5, "BLUE");
    expect(state.phase).toBe("PLACE");
    expect(state.queue).toEqual(["c", "b", "a"]);
    expect(atlasEngine.getPlayerView(state, "c").canPass).toBe(true);
    state = placeAs(state, "c");
    expect(order(state)).toEqual(["c", "b", "a"]);
    expect(state.phase).toBe("RESULT");
  });

  it("첫 패스면 다음으로 큰 사람부터, 두 번째 패스면 작은 숫자부터 올린다", () => {
    let state = start(["a", "b", "c"]);
    state = submit(state, "a", 7, "RED");
    state = submit(state, "b", 5, "GREEN");
    state = submit(state, "c", 2, "BLUE");
    expect(atlasEngine.validateAction(state, "b", { type: "PASS", round: 1 })).toBe(false);
    state = pass(state, "a");
    expect(state.queue).toEqual(["b", "c", "a"]);
    let once = placeAs(structuredClone(state), "b");
    expect(order(once)).toEqual(["b", "c", "a"]);
    state = pass(state, "b");
    expect(order(state)).toEqual(["c", "b", "a"]);
    expect(state.history[0].passedIds).toEqual(["a", "b"]);
  });

  it("2인전에서는 순서가 바뀌지 않는 두 번째 패스를 주지 않는다", () => {
    let state = start();
    state = submit(state, "a", 7, "RED");
    state = submit(state, "b", 2, "GREEN");
    state = pass(state, "a");
    expect(order(state)).toEqual(["b", "a"]);
    expect(state.phase).toBe("RESULT");
  });

  it("한계를 넘긴 사람이 무너뜨린 블록까지 센 벌점을 받고, 무너뜨린 블록은 거인 위에 남으며, 다음 선이 된다", () => {
    let state = start(["a", "b"], "a");
    state.giants.RED = [3, 4];
    state = submit(state, "a", 1, "GREEN");
    state = submit(state, "b", 2, "RED");
    state = placeAs(state, "b");
    expect(state.placements[0]).toMatchObject({ playerId: "b", total: 9, collapsed: true, penalty: 3, blocks: [3, 4, 2] });
    expect(state.scores).toEqual({ a: 0, b: 3 });
    expect(state.giants.RED).toEqual([2]);
    expect(state.leadId).toBe("b");
  });

  it("합이 한계와 같으면 버틴다", () => {
    let state = start();
    state.giants.BLUE = [6];
    state = submit(state, "a", 2, "BLUE");
    state = submit(state, "b", 1, "GREEN");
    state = placeAs(state, "a");
    expect(state.giants.BLUE).toEqual([6, 2]);
    expect(state.scores.a).toBe(0);
  });

  it("무지개 블록은 올릴 차례에 거인을 고른다", () => {
    let state = start();
    state = submit(state, "a", 3, "GREEN");
    state = submit(state, "b", 6, "RAINBOW");
    expect(state.queue[0]).toBe("b");
    expect(atlasEngine.getPlayerView(state, "b").needsColor).toBe(true);
    expect(atlasEngine.validateAction(state, "b", { type: "PLACE", round: 1 })).toBe(false);
    state = placeAs(state, "b", "BLUE");
    expect(state.placements[0]).toMatchObject({ token: "RAINBOW", color: "BLUE" });
    expect(state.giants.BLUE).toEqual([6]);
  });

  it("시간이 지나면 미제출은 무작위 제출, 올리기 결정은 패스 없이 올린다", () => {
    let state = start();
    // b의 자동 제출이 무지개(추가 결정)나 같은 숫자로 나오지 않게 남은 손을 고정한다.
    state.hands.b = { numbers: [1], tokens: { RED: 0, GREEN: 1, BLUE: 0, RAINBOW: 0 } };
    state = submit(state, "a", 7, "RED");
    const timeout = state.deadline!;
    expect(advanceAtlasPhase(state, timeout - 1)).toBe(state);
    state = advanceAtlasPhase(state, timeout);
    expect(state.phase).toBe("PLACE");
    expect(state.queue[0]).toBe("a");
    state = advanceAtlasPhase(state, state.deadline!);
    expect(state.placements[0]).toMatchObject({ playerId: "a", auto: true });
    expect(state.passedIds).toEqual([]);
    expect(state.phase).toBe("RESULT");
    expect(state.deadline! - timeout).toBeGreaterThanOrEqual(ATLAS_TIMES.RESULT);
  });

  it("8라운드에 블록과 토큰을 다시 받고, 14라운드 후 벌점이 낮은 사람이 이긴다", () => {
    let state = start(["a", "b", "c"]);
    let rounds = 0;
    while (!state.winnerId && !state.isDraw) {
      const before = state.round;
      state = advanceAtlasPhase(state, state.deadline!);
      if (state.round !== before) {
        rounds++;
        if (state.round === 8) expect(state.hands.a.numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
      }
      if (state.round === 7 && state.phase === "RESULT") expect(state.hands.a.numbers).toEqual([]);
    }
    expect(rounds).toBe(13);
    expect(state.history).toHaveLength(14);
    const best = Math.min(...Object.values(state.scores));
    if (state.isDraw) expect(Object.values(state.scores).filter(v => v === best).length).toBeGreaterThan(1);
    else expect(state.scores[state.winnerId!]).toBe(best);
    expect(atlasEngine.getPlayerView(state, "a").history).toHaveLength(14);
  });

  it("4인전에서 올릴 차례인 사람이 나가면 다음 사람으로 넘어간다", () => {
    let state = start(["a", "b", "c", "d"]);
    state = submit(state, "a", 7, "RED");
    state = submit(state, "b", 1, "RED");
    state = submit(state, "c", 2, "GREEN");
    state = submit(state, "d", 3, "BLUE");
    expect(state.queue[0]).toBe("a");
    state = removeAtlasPlayer(state, "a");
    expect(state.queue[0]).toBe("d");
    expect(state.scores.a).toBeUndefined();
    state = removeAtlasPlayer(state, "b");
    state = removeAtlasPlayer(state, "c");
    expect(state.winnerId).toBe("d");
  });
});
