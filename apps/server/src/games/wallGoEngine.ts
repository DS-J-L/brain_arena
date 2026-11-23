import {
  WALL_GO_CELLS, WALL_GO_PLACE_ORDER, WALL_GO_START_CELLS, WALL_SIDES, isWallGoCell, wallGoMoves, wallGoReachable, wallGoScore, wallKey,
  type WallGoMove, type WallGoPiece, type WallGoView, type WallGoWalls, type WallSide,
} from "@brain-arena/shared";
import type { GameEngine, GameResult } from "./gameEngine.js";

// turn은 화면이 보고 있던 차례 번호다. 시간 초과 자동 처리와 클릭이 겹쳐도 다음 차례에 잘못 들어가지 않는다.
export type WallGoAction =
  | { type: "PLACE"; cell: number; turn: number }
  | { type: "MOVE"; pieceId: number; to: number; wall: WallSide; turn: number };

export interface WallGoState {
  /** 자리 순서. 0번이 선공 */
  playerIds: string[];
  phase: WallGoView["phase"];
  turn: number;
  currentPlayerId: string;
  placeQueue: string[];
  pieces: WallGoPiece[];
  walls: WallGoWalls;
  moves: WallGoMove[];
  winnerId: string | null;
  isDraw: boolean;
  deadline: number | null;
}

export const WALL_GO_TIMES = { PLACE: 20_000, MOVE: 45_000 };
const pickRandom = <T>(values: T[]) => values[Math.floor(Math.random() * values.length)];
const emptyCells = (state: WallGoState) => {
  const taken = new Set(state.pieces.map(p => p.cell));
  return Array.from({ length: WALL_GO_CELLS }, (_, cell) => cell).filter(cell => !taken.has(cell));
};
const other = (state: WallGoState, id: string) => state.playerIds.find(p => p !== id)!;

function nextTurn(state: WallGoState, playerId: string, now: number) {
  state.turn++;
  state.currentPlayerId = playerId;
  state.deadline = now + (state.phase === "PLACE" ? WALL_GO_TIMES.PLACE : WALL_GO_TIMES.MOVE);
}

function place(state: WallGoState, cell: number, now: number) {
  state.pieces.push({ id: state.pieces.length, ownerId: state.currentPlayerId, cell });
  state.placeQueue.shift();
  if (state.placeQueue.length === 0) state.phase = "MOVE";
  // 배치가 끝나면 선공부터 움직인다.
  nextTurn(state, state.placeQueue[0] ?? state.playerIds[0], now);
}

/** 총영역이 넓은 쪽이 승리. 같으면 가장 큰 단일 영역을 비교하고, 그것도 같으면 무승부. */
function finish(state: WallGoState) {
  const { territory, largest } = wallGoScore(state.walls, state.pieces, state.playerIds);
  const [a, b] = state.playerIds;
  const diff = territory[a] - territory[b] || largest[a] - largest[b];
  state.winnerId = diff > 0 ? a : diff < 0 ? b : null;
  state.isDraw = diff === 0;
  state.deadline = null;
}

function move(state: WallGoState, pieceId: number, to: number, wall: WallSide, auto: boolean, now: number) {
  const piece = state.pieces.find(p => p.id === pieceId)!;
  state.moves.push({ turn: state.turn, playerId: state.currentPlayerId, pieceId, from: piece.cell, to, wall, auto });
  piece.cell = to;
  state.walls[wallKey(to, wall)!] = state.currentPlayerId;
  if (wallGoScore(state.walls, state.pieces, state.playerIds).separated) finish(state);
  else nextTurn(state, other(state, state.currentPlayerId), now);
}

/** 제한 시간이 지나면 남은 빈칸이나 가능한 수 가운데 무작위로 둔다. */
export function advanceWallGoPhase(state: WallGoState, now = Date.now()): WallGoState {
  if (state.winnerId || state.isDraw || state.deadline === null || now < state.deadline) return state;
  const next = structuredClone(state);
  if (next.phase === "PLACE") place(next, pickRandom(emptyCells(next)), now);
  else {
    const option = pickRandom(wallGoMoves(next.walls, next.pieces, next.currentPlayerId));
    move(next, option.pieceId, option.to, option.wall, true, now);
  }
  return next;
}

export const wallGoEngine: GameEngine<WallGoState, WallGoAction, WallGoView> = {
  createInitialState(ids) {
    if (ids.length !== 2 || new Set(ids).size !== 2) throw new Error("서로 다른 2명의 플레이어가 필요합니다.");
    // 선공은 무작위. 0번 자리가 선공이다.
    const seats = Math.random() < .5 ? [...ids] : [ids[1], ids[0]];
    const pieces = seats.flatMap((ownerId, seat) => WALL_GO_START_CELLS[seat].map(cell => ({ ownerId, cell }))).map((p, id) => ({ id, ...p }));
    const placeQueue = WALL_GO_PLACE_ORDER.map(seat => seats[seat]);
    return {
      playerIds: seats, phase: "PLACE", turn: 1, currentPlayerId: placeQueue[0], placeQueue, pieces, walls: {}, moves: [],
      winnerId: null, isDraw: false, deadline: Date.now() + WALL_GO_TIMES.PLACE,
    };
  },
  validateAction(state, playerId, action) {
    if (state.winnerId || state.isDraw || state.currentPlayerId !== playerId || action.turn !== state.turn) return false;
    if (state.deadline === null || Date.now() >= state.deadline) return false;
    if (action.type === "PLACE") return state.phase === "PLACE" && isWallGoCell(action.cell) && emptyCells(state).includes(action.cell);
    if (action.type !== "MOVE" || state.phase !== "MOVE") return false;
    const piece = state.pieces.find(p => p.id === action.pieceId);
    if (!piece || piece.ownerId !== playerId || !isWallGoCell(action.to) || !WALL_SIDES.includes(action.wall)) return false;
    if (!wallGoReachable(state.walls, state.pieces, piece.id).includes(action.to)) return false;
    const key = wallKey(action.to, action.wall);
    return key !== null && !(key in state.walls);
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state, playerId, action)) throw new Error("지금 둘 수 없는 수입니다. 차례와 이동 칸, 벽 위치를 확인해 주세요.");
    const next = structuredClone(state), now = Date.now();
    if (action.type === "PLACE") place(next, action.cell, now);
    else move(next, action.pieceId, action.to, action.wall, false, now);
    return next;
  },
  getPlayerView(state) {
    // 모든 정보가 공개된 게임이라 플레이어마다 같은 화면을 보낸다.
    const { territory, largest, contested } = wallGoScore(state.walls, state.pieces, state.playerIds);
    return structuredClone({
      kind: "WALL_GO", phase: state.phase, playerIds: state.playerIds, currentPlayerId: state.currentPlayerId, turn: state.turn,
      placeQueue: state.placeQueue, pieces: state.pieces, walls: state.walls, moves: state.moves, territory, largest, contested,
      winnerId: state.winnerId, isDraw: state.isDraw, deadline: state.deadline,
    } satisfies WallGoView);
  },
  getResult(state): GameResult | null { return state.winnerId || state.isDraw ? { winnerId: state.winnerId, isDraw: state.isDraw } : null; },
};
