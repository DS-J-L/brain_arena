import type { BlackAndWhiteView, RoundView } from "@brain-arena/shared";
import type { GameEngine, GameResult } from "./gameEngine.js";

export interface BlackAndWhiteRound {
  round: number;
  tiles: Record<string, number>;
  winnerId: string | null;
}
export interface BlackAndWhiteState {
  playerIds: [string, string];
  round: number;
  scores: Record<string, number>;
  remainingTiles: Record<string, number[]>;
  selections: Record<string, number | null>;
  history: BlackAndWhiteRound[];
  winnerId: string | null;
  deadline: number | null;
}
export interface SelectTileAction { type: "SELECT_TILE"; tile: number }

const color = (tile: number): "BLACK" | "WHITE" => tile % 2 === 0 ? "WHITE" : "BLACK";

export const blackAndWhiteEngine: GameEngine<BlackAndWhiteState, SelectTileAction, BlackAndWhiteView> = {
  createInitialState(ids) {
    if (ids.length !== 2) throw new Error("두 명의 플레이어가 필요합니다.");
    const [a, b] = ids as [string, string];
    return { playerIds: [a, b], round: 1, scores: { [a]: 0, [b]: 0 },
      remainingTiles: { [a]: [1,2,3,4,5,6,7,8,9], [b]: [1,2,3,4,5,6,7,8,9] },
      selections: { [a]: null, [b]: null }, history: [], winnerId: null, deadline: Date.now() + 20_000 };
  },
  validateAction(state, playerId, action) {
    return state.winnerId === null && state.playerIds.includes(playerId) && action.type === "SELECT_TILE" &&
      Number.isInteger(action.tile) && state.selections[playerId] === null && state.remainingTiles[playerId].includes(action.tile);
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state, playerId, action)) throw new Error("선택할 수 없는 타일입니다.");
    const next = structuredClone(state);
    next.selections[playerId] = action.tile;
    const [a, b] = next.playerIds;
    const aTile = next.selections[a]; const bTile = next.selections[b];
    if (aTile === null || bTile === null) return next;
    let roundWinner: string | null = null;
    if (aTile > bTile) roundWinner = a;
    if (bTile > aTile) roundWinner = b;
    if (roundWinner) next.scores[roundWinner] += 1;
    next.remainingTiles[a] = next.remainingTiles[a].filter(t => t !== aTile);
    next.remainingTiles[b] = next.remainingTiles[b].filter(t => t !== bTile);
    next.history.push({ round: next.round, tiles: { [a]: aTile, [b]: bTile }, winnerId: roundWinner });
    if (roundWinner && next.scores[roundWinner] >= 5) next.winnerId = roundWinner;
    else if (next.round >= 9) next.winnerId = next.scores[a] === next.scores[b] ? "DRAW" : (next.scores[a] > next.scores[b] ? a : b);
    next.round += next.winnerId ? 0 : 1;
    next.selections = { [a]: null, [b]: null };
    next.deadline = next.winnerId ? null : Date.now() + 20_000;
    return next;
  },
  getPlayerView(state, playerId) {
    const opponent = state.playerIds.find(id => id !== playerId)!;
    const finished = state.winnerId !== null;
    const history: RoundView[] = state.history.map(r => ({
      round: r.round, myTile: r.tiles[playerId], opponentColor: color(r.tiles[opponent]),
      result: r.winnerId === null ? "DRAW" : r.winnerId === playerId ? "WIN" : "LOSE",
      ...(finished ? { opponentTile: r.tiles[opponent] } : {})
    }));
    return { kind: "BLACK_AND_WHITE", round: state.round, scores: state.scores,
      myRemainingTiles: state.remainingTiles[playerId], opponentRemainingCount: state.remainingTiles[opponent].length,
      opponentUsedColors: state.history.map(r => color(r.tiles[opponent])), hasSelected: state.selections[playerId] !== null,
      opponentHasSelected: state.selections[opponent] !== null, history, winnerId: state.winnerId, deadline: state.deadline };
  },
  getResult(state): GameResult | null {
    if (!state.winnerId) return null;
    return { winnerId: state.winnerId === "DRAW" ? null : state.winnerId, isDraw: state.winnerId === "DRAW" };
  }
};
