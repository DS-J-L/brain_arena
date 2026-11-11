import { describe, expect, it } from "vitest";
import type { CardSuit, PlayingCard } from "@brain-arena/shared";
import { advanceMemoryHoldemPhase, compareScores, evaluateHand, memoryHoldemEngine, type MemoryHoldemState } from "./memoryHoldemEngine.js";

const SUIT: Record<string, CardSuit> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
const RANK: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11 };
const cards = (text: string): PlayingCard[] => text.split(" ").map(token => ({ rank: RANK[token.slice(0, -1)] ?? Number(token.slice(0, -1)), suit: SUIT[token.slice(-1)] }));
const hand = (text: string) => evaluateHand(cards(text));

/** a가 보드 0·1번, b가 2·3번을 갖도록 한 판을 진행한다. a가 선공이다. */
function playHand(state: MemoryHoldemState, community: string, aCards: string, bCards: string) {
  state.chooserId = "a";
  state = memoryHoldemEngine.applyAction(state, "a", { type: "CHOOSE_ROLE", role: "FIRST" });
  state.community = cards(community);
  state.board = [...cards(aCards), ...cards(bCards), ...state.board.slice(4)];
  state = advanceMemoryHoldemPhase(state);
  const order: Array<[string, number]> = [["a", 0], ["b", 2], ["b", 3], ["a", 1]];
  order.forEach(([id, index], turn) => { state = memoryHoldemEngine.applyAction(state, id, { type: "PICK_CARD", index, hand: state.hand, pick: turn + 1 }); });
  return state;
}

describe("memoryHoldem 족보", () => {
  it("족보 순서대로 높은 패가 이긴다", () => {
    const ordered = ["A♠ 9♦ 7♣ 4♥ 2♠", "K♠ K♥ 9♦ 4♣ 2♠", "K♠ K♥ 9♦ 9♣ 4♠", "9♠ 9♥ 9♦ K♣ 4♠", "5♠ 6♥ 7♦ 8♣ 9♠", "A♠ 9♠ 7♠ 4♠ 2♠", "9♠ 9♥ 9♦ K♣ K♠", "9♠ 9♥ 9♦ 9♣ K♠", "5♠ 6♠ 7♠ 8♠ 9♠", "10♠ J♠ Q♠ K♠ A♠"].map(hand);
    for (let index = 1; index < ordered.length; index++) expect(compareScores(ordered[index].score, ordered[index - 1].score)).toBeGreaterThan(0);
    expect(ordered.at(-1)!.label).toBe("로열 플러시");
  });
  it("A-2-3-4-5는 5가 가장 높은 스트레이트다", () => {
    expect(hand("A♠ 2♥ 3♦ 4♣ 5♠").label).toBe("5 하이 스트레이트");
    expect(compareScores(hand("2♠ 3♥ 4♦ 5♣ 6♠").score, hand("A♠ 2♥ 3♦ 4♣ 5♠").score)).toBeGreaterThan(0);
  });
  it("같은 족보는 족보 숫자, 키커, 무늬(♠ > ♦ > ♥ > ♣) 순으로 비교한다", () => {
    expect(compareScores(hand("K♠ K♥ 4♦ 4♣ 9♠").score, hand("Q♠ Q♥ J♦ J♣ A♠").score)).toBeGreaterThan(0);
    expect(compareScores(hand("K♠ K♥ Q♦ 4♣ 2♠").score, hand("K♦ K♣ J♦ 4♥ 2♥").score)).toBeGreaterThan(0);
    // 숫자가 모두 같으면 족보를 이루는 카드부터 무늬를 본다: K♠ K♦ 대 K♠ K♥
    expect(compareScores(hand("K♠ K♦ Q♣ 4♣ 2♣").score, hand("K♠ K♥ Q♠ 4♣ 2♣").score)).toBeGreaterThan(0);
    expect(compareScores(hand("A♦ 9♣ 7♣ 4♣ 2♥").score, hand("A♥ 9♠ 7♣ 4♣ 2♥").score)).toBeGreaterThan(0);
    // A-2-3-4-5에서는 5의 무늬를 먼저 본다
    expect(compareScores(hand("A♣ 2♥ 3♦ 4♣ 5♠").score, hand("A♠ 2♥ 3♦ 4♣ 5♦").score)).toBeGreaterThan(0);
  });
});

describe("memoryHoldemEngine", () => {
  it("단계에 맞는 카드만 화면에 보낸다", () => {
    let state = memoryHoldemEngine.createInitialState(["a", "b"]);
    let view = memoryHoldemEngine.getPlayerView(state, "a");
    expect(view.phase).toBe("COIN");
    expect(view.board.every(card => card === null)).toBe(true);
    expect(view.community).toEqual([]);
    expect(memoryHoldemEngine.validateAction(state, state.chooserId === "a" ? "b" : "a", { type: "CHOOSE_ROLE", role: "FIRST" })).toBe(false);
    state = memoryHoldemEngine.applyAction(state, state.chooserId, { type: "CHOOSE_ROLE", role: "SECOND" });
    view = memoryHoldemEngine.getPlayerView(state, "a");
    expect(view.firstPlayerId).not.toBe(state.chooserId);
    expect(view.board.every(card => card !== null)).toBe(true);
    expect(view.community).toEqual([]);
    state = advanceMemoryHoldemPhase(state);
    view = memoryHoldemEngine.getPlayerView(state, "a");
    expect(view.phase).toBe("PICK");
    expect(view.board.every(card => card === null)).toBe(true);
    expect(view.community).toHaveLength(3);
    expect(new Set([...state.board, ...state.community].map(card => `${card.rank}${card.suit}`)).size).toBe(19);
  });

  it("선공 1장 → 후공 2장 → 선공 1장 순서로만 한 장씩 확정한다", () => {
    let state = memoryHoldemEngine.createInitialState(["a", "b"]);
    state.chooserId = "a";
    state = advanceMemoryHoldemPhase(memoryHoldemEngine.applyAction(state, "a", { type: "CHOOSE_ROLE", role: "FIRST" }));
    const pick = (id: string, index: number, pickNumber: number) => ({ id, action: { type: "PICK_CARD" as const, index, hand: 1, pick: pickNumber } });
    const tryPick = (id: string, index: number, pickNumber: number) => memoryHoldemEngine.validateAction(state, id, pick(id, index, pickNumber).action);
    expect(tryPick("b", 0, 1)).toBe(false);
    state = memoryHoldemEngine.applyAction(state, "a", pick("a", 0, 1).action);
    expect(tryPick("a", 1, 2)).toBe(false);
    expect(tryPick("b", 0, 2)).toBe(false); // 이미 잠긴 칸
    state = memoryHoldemEngine.applyAction(state, "b", pick("b", 5, 2).action);
    expect(tryPick("b", 6, 2)).toBe(false); // 지난 순번으로 온 중복·지연 요청
    expect(memoryHoldemEngine.getPlayerView(state, "a").currentPlayerId).toBe("b");
    state = memoryHoldemEngine.applyAction(state, "b", pick("b", 6, 3).action);
    expect(memoryHoldemEngine.getPlayerView(state, "b").currentPlayerId).toBe("a");
    state = memoryHoldemEngine.applyAction(state, "a", pick("a", 1, 4).action);
    expect(state.phase).toBe("SHOWDOWN");
    expect(memoryHoldemEngine.getPlayerView(state, "b").board.every(card => card !== null)).toBe(true);
  });

  it("시간이 끝나면 남은 카드 중 한 장을 자동으로 고른다", () => {
    let state = memoryHoldemEngine.createInitialState(["a", "b"]);
    for (let step = 0; step < 6; step++) state = advanceMemoryHoldemPhase(state);
    expect(state.phase).toBe("SHOWDOWN");
    expect(state.playerIds.map(id => state.owners.filter(owner => owner === id).length)).toEqual([2, 2]);
  });

  it("공용 카드 3장과 고른 2장으로 승패와 이유를 정한다", () => {
    const state = playHand(memoryHoldemEngine.createInitialState(["a", "b"]), "K♠ 9♦ 4♣", "K♥ 9♣", "9♠ 9♥");
    expect(state.showdown?.winnerId).toBe("b");
    expect(state.showdown?.reason).toBe("9 트리플이 K·9 투페어를 이겼어요");
    expect(state.wins).toEqual({ a: 0, b: 1 });
  });

  it("세 판을 먼저 이기면 마지막 결과 공개 뒤에 승자가 확정된다", () => {
    let state = memoryHoldemEngine.createInitialState(["a", "b"]);
    for (let won = 1; won <= 3; won++) {
      state = playHand(state, "K♠ 9♦ 4♣", "K♥ K♦", "2♠ 3♥");
      expect(state.wins.a).toBe(won);
      expect(state.winnerId).toBeNull();
      state = advanceMemoryHoldemPhase(state);
      // 직전 판에서 진 b가 다음 판의 순서를 고른다.
      if (won < 3) { expect(state.phase).toBe("COIN"); expect(state.hand).toBe(won + 1); expect(state.chooserId).toBe("b"); }
    }
    expect(memoryHoldemEngine.getResult(state)).toEqual({ winnerId: "a", isDraw: false });
    expect(state.history).toHaveLength(3);
  });

  it("숫자가 모두 같으면 무늬로 승패를 정해 무승부가 없다", () => {
    const state = playHand(memoryHoldemEngine.createInitialState(["a", "b"]), "K♠ 9♦ 4♣", "A♥ Q♦", "A♠ Q♣");
    expect(state.showdown?.winnerId).toBe("b");
    expect(state.showdown?.reason).toBe("숫자가 모두 같은 A 하이카드 · 무늬 A♠ > A♥");
    expect(state.wins).toEqual({ a: 0, b: 1 });
  });
});
