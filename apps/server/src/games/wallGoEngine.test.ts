import { describe, expect, it } from "vitest";
import { WALL_GO_SIZE, wallGoCell as cell, wallGoMoves, wallGoReachable, wallGoScore, wallKey, type WallGoPiece, type WallGoWalls, type WallSide } from "@brain-arena/shared";
import { decidePracticeBot } from "../bots/practiceBot.js";
import { WALL_GO_TIMES, advanceWallGoPhase, wallGoEngine, type WallGoState } from "./wallGoEngine.js";

/** a가 선공인 상태로 시작한다. */
const start = () => {
  let state = wallGoEngine.createInitialState(["a", "b"]);
  if (state.playerIds[0] !== "a") {
    state = { ...state, playerIds: ["a", "b"], placeQueue: ["a", "b", "b", "a"], currentPlayerId: "a", pieces: state.pieces.map(p => ({ ...p, ownerId: p.ownerId === "a" ? "b" : "a" })) };
  }
  return state;
};
const placeAs = (state: WallGoState, id: string, at: number) => wallGoEngine.applyAction(state, id, { type: "PLACE", cell: at, turn: state.turn });
const moveAs = (state: WallGoState, id: string, pieceId: number, to: number, wall: WallSide) =>
  wallGoEngine.applyAction(state, id, { type: "MOVE", pieceId, to, wall, turn: state.turn });
const placed = () => {
  let state = start();
  state = placeAs(state, "a", cell(3, 3));
  state = placeAs(state, "b", cell(0, 3));
  state = placeAs(state, "b", cell(6, 3));
  return placeAs(state, "a", cell(3, 0));
};
/** 판 전체를 c열과 c+1열 사이 세로 벽으로 가른다. */
const column = (col: number, owner = "a"): WallGoWalls => Object.fromEntries(Array.from({ length: WALL_GO_SIZE }, (_, row) => [`v${row}-${col}`, owner]));

describe("wallGoEngine", () => {
  it("각자 말 2개는 대각선으로 마주 보는 지정 칸에서 시작한다", () => {
    const state = start();
    expect(state.pieces.filter(p => p.ownerId === "a").map(p => p.cell)).toEqual([cell(1, 1), cell(5, 5)]);
    expect(state.pieces.filter(p => p.ownerId === "b").map(p => p.cell)).toEqual([cell(1, 5), cell(5, 1)]);
    expect(state.phase).toBe("PLACE");
  });

  it("나머지 말은 선공 → 후공 → 후공 → 선공 순서로 빈칸에 놓고, 선공부터 움직인다", () => {
    let state = start();
    expect(state.currentPlayerId).toBe("a");
    expect(() => placeAs(state, "b", cell(3, 3))).toThrow();
    expect(() => placeAs(state, "a", cell(1, 1))).toThrow();
    state = placeAs(state, "a", cell(3, 3));
    expect(state.currentPlayerId).toBe("b");
    state = placeAs(state, "b", cell(0, 3));
    expect(state.currentPlayerId).toBe("b");
    state = placeAs(state, "b", cell(6, 3));
    expect(state.currentPlayerId).toBe("a");
    state = placeAs(state, "a", cell(3, 0));
    expect(state.phase).toBe("MOVE");
    expect(state.currentPlayerId).toBe("a");
    expect(state.pieces).toHaveLength(8);
  });

  it("최대 2칸, 꺾어서도 움직이며 제자리(0칸)도 가능하다", () => {
    const pieces: WallGoPiece[] = [{ id: 0, ownerId: "a", cell: cell(3, 3) }];
    const reach = wallGoReachable({}, pieces, 0);
    expect(reach).toHaveLength(13);
    expect(reach).toContain(cell(3, 3));
    expect(reach).toContain(cell(2, 4));
    expect(reach).toContain(cell(3, 5));
    expect(reach).not.toContain(cell(3, 6));
  });

  it("벽을 넘거나 다른 말을 지나거나 그 위에 멈출 수 없다", () => {
    const pieces: WallGoPiece[] = [{ id: 0, ownerId: "a", cell: cell(3, 3) }, { id: 1, ownerId: "b", cell: cell(3, 4) }];
    const walls = { [wallKey(cell(3, 3), "UP")!]: "a" };
    const reach = wallGoReachable(walls, pieces, 0);
    expect(reach).not.toContain(cell(3, 4));
    expect(reach).not.toContain(cell(3, 5));
    expect(reach).not.toContain(cell(2, 3));
    expect(reach).not.toContain(cell(1, 3));
    // 위는 벽으로 막혔지만 옆으로 돌아 올라갈 수는 있다.
    expect(reach).toContain(cell(2, 2));
  });

  it("이동한 말이 멈춘 칸의 변에만 벽을 세우며, 테두리와 이미 있는 벽에는 세울 수 없다", () => {
    let state = placed();
    const piece = state.pieces.find(p => p.cell === cell(3, 0))!;
    expect(() => moveAs(state, "a", piece.id, cell(3, 0), "LEFT")).toThrow();
    expect(() => moveAs(state, "b", piece.id, cell(3, 0), "UP")).toThrow();
    expect(() => moveAs(state, "a", piece.id, cell(3, 3), "UP")).toThrow();
    state = moveAs(state, "a", piece.id, cell(2, 0), "RIGHT");
    expect(state.walls).toEqual({ [wallKey(cell(2, 0), "RIGHT")!]: "a" });
    expect(state.pieces.find(p => p.id === piece.id)!.cell).toBe(cell(2, 0));
    expect(state.currentPlayerId).toBe("b");
    expect(state.moves.at(-1)).toMatchObject({ playerId: "a", from: cell(3, 0), to: cell(2, 0), wall: "RIGHT", auto: false });
    state = moveAs(state, "b", 5, cell(0, 3), "DOWN");
    expect(() => moveAs(state, "a", piece.id, cell(2, 0), "RIGHT")).toThrow();
  });

  it("지난 차례 번호로 보낸 수는 받지 않는다", () => {
    const state = placed(), piece = state.pieces.find(p => p.ownerId === "a")!;
    expect(() => wallGoEngine.applyAction(state, "a", { type: "MOVE", pieceId: piece.id, to: piece.cell, wall: "DOWN", turn: state.turn - 1 })).toThrow();
  });

  it("내 말만 있는 구역이 내 땅이고, 말이 없는 구역은 누구의 땅도 아니다", () => {
    const walls = { ...column(2), ...column(4) };
    const pieces: WallGoPiece[] = [{ id: 0, ownerId: "a", cell: cell(0, 0) }, { id: 1, ownerId: "a", cell: cell(6, 1) }, { id: 2, ownerId: "b", cell: cell(0, 6) }];
    const score = wallGoScore(walls, pieces, ["a", "b"]);
    expect(score.territory).toEqual({ a: 21, b: 14 });
    expect(score.largest).toEqual({ a: 21, b: 14 });
    expect(score.separated).toBe(true);
  });

  it("모든 구역이 한 사람의 말만 남으면 끝나고, 총영역이 넓은 쪽이 이긴다", () => {
    let state = placed();
    // 3열과 4열 사이를 한 칸만 남기고 막아 둔 판. a는 왼쪽, b는 오른쪽에 모은다.
    const walls = column(3);
    delete walls["v6-3"];
    state = {
      ...state, walls,
      pieces: [
        { id: 0, ownerId: "a", cell: cell(0, 0) }, { id: 1, ownerId: "a", cell: cell(1, 0) }, { id: 2, ownerId: "a", cell: cell(2, 0) }, { id: 3, ownerId: "a", cell: cell(6, 3) },
        { id: 4, ownerId: "b", cell: cell(0, 6) }, { id: 5, ownerId: "b", cell: cell(1, 6) }, { id: 6, ownerId: "b", cell: cell(2, 6) }, { id: 7, ownerId: "b", cell: cell(3, 6) },
      ],
    };
    expect(wallGoScore(state.walls, state.pieces, state.playerIds).separated).toBe(false);
    state = moveAs(state, "a", 3, cell(6, 3), "RIGHT");
    expect(state.winnerId).toBe("a");
    expect(state.deadline).toBeNull();
    expect(wallGoEngine.getResult(state)).toEqual({ winnerId: "a", isDraw: false });
    const view = wallGoEngine.getPlayerView(state, "b");
    expect(view.territory).toEqual({ a: 28, b: 21 });
  });

  it("총영역이 같으면 가장 큰 단일 영역이 큰 쪽이 이긴다", () => {
    // 0~1열(14칸)은 a, 2열(7칸)은 빈 구역, 3열(7칸)은 a, 4~6열(21칸)은 b. 3열과 4열 사이 맨 아래 한 칸만 열려 있다.
    const walls = { ...column(1), ...column(2), ...column(3) };
    delete walls["v6-3"];
    let state: WallGoState = {
      ...placed(), walls,
      pieces: [
        { id: 0, ownerId: "a", cell: cell(0, 0) }, { id: 1, ownerId: "a", cell: cell(3, 0) }, { id: 2, ownerId: "a", cell: cell(6, 1) }, { id: 3, ownerId: "a", cell: cell(6, 3) },
        { id: 4, ownerId: "b", cell: cell(0, 6) }, { id: 5, ownerId: "b", cell: cell(2, 6) }, { id: 6, ownerId: "b", cell: cell(4, 6) }, { id: 7, ownerId: "b", cell: cell(6, 6) },
      ],
    };
    state = moveAs(state, "a", 3, cell(6, 3), "RIGHT");
    expect(wallGoScore(state.walls, state.pieces, state.playerIds)).toMatchObject({ territory: { a: 21, b: 21 }, largest: { a: 14, b: 21 } });
    expect(state.winnerId).toBe("b");
    expect(state.isDraw).toBe(false);
  });

  it("시간이 지나면 가능한 수 가운데 하나를 자동으로 둔다", () => {
    let state = start();
    state = advanceWallGoPhase(state, state.deadline!);
    expect(state.pieces).toHaveLength(5);
    expect(state.currentPlayerId).toBe("b");
    state = placed();
    const now = state.deadline! + 1;
    state = advanceWallGoPhase(state, now);
    expect(state.moves).toHaveLength(1);
    expect(state.moves[0].auto).toBe(true);
    expect(Object.keys(state.walls)).toHaveLength(1);
    expect(state.deadline).toBe(now + WALL_GO_TIMES.MOVE);
  });

  it("끝나지 않은 동안에는 둘 수 있는 수가 항상 남아 있다", () => {
    let state = placed();
    for (let guard = 0; guard < 200 && !state.winnerId && !state.isDraw; guard++) {
      expect(wallGoMoves(state.walls, state.pieces, state.currentPlayerId).length).toBeGreaterThan(0);
      state = advanceWallGoPhase(state, state.deadline!);
    }
    expect(wallGoEngine.getResult(state)).not.toBeNull();
  });

  it("연습 봇끼리 두어도 모든 수가 규칙에 맞고 끝까지 진행된다", () => {
    let state = start();
    for (let guard = 0; guard < 200 && !wallGoEngine.getResult(state); guard++) {
      const id = state.currentPlayerId, decision = decidePracticeBot(wallGoEngine.getPlayerView(state, id), id)!;
      const payload = decision.payload as Record<string, unknown>;
      state = decision.type === "PLACE"
        ? wallGoEngine.applyAction(state, id, { type: "PLACE", cell: payload.cell as number, turn: payload.turn as number })
        : wallGoEngine.applyAction(state, id, { type: "MOVE", pieceId: payload.pieceId as number, to: payload.to as number, wall: payload.wall as WallSide, turn: payload.turn as number });
    }
    expect(wallGoEngine.getResult(state)).not.toBeNull();
  });
});
