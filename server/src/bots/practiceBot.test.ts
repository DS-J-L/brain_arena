import { describe, expect, it } from "vitest";
import type { AscendingView } from "@brain-arena/shared";
import { decidePracticeBot, rankAscendingPlacements, rankFitProbability } from "./practiceBot.js";

describe("ascending practice bot", () => {
  it("빈 보드의 숫자 5를 다섯 번째 칸에 가장 적합하다고 평가한다", () => {
    const board = Array<number | null>(10).fill(null);
    const ranked = rankAscendingPlacements(board, 5, 0);
    expect(ranked[0].position).toBe(4);
    expect(rankFitProbability(board, 5, 4)).toBeGreaterThan(rankFitProbability(board, 5, 0));
  });

  it("이미 놓인 3과 6 사이에는 숫자 5를 연결한다", () => {
    const board: Array<number | null> = [1, 3, null, 6, null, null, null, null, null, null];
    expect(rankAscendingPlacements(board, 5, 0)[0].position).toBe(2);
  });

  it("실제 미래 카드나 상대 비공개 보드 없이 플레이어 화면만으로 합법 배치를 고른다", () => {
    const view: AscendingView = {
      kind: "ASCENDING", round: 4, phase: "PLACE", chooserId: "human", offeredCards: [3, 8],
      myAssignedCard: 7, opponentAssignedCard: null,
      myBoard: [1, 2, null, 5, null, null, 8, null, null, null], opponentBoard: Array(10).fill(null),
      hasPlaced: false, opponentHasPlaced: false, history: [], results: null,
      winnerId: null, isDraw: false, deadline: Date.now() + 1_000,
    };
    const decision = decidePracticeBot(view, "bot");
    expect(decision?.type).toBe("PLACE_CARD");
    const position = decision?.payload?.position as number;
    expect(view.myBoard[position]).toBeNull();
  });
});
