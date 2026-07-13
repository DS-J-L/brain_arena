import type { BlackAndWhiteView, TileColor } from "@brain-arena/shared";
import type { GameEngine, GameResult } from "./gameEngine.js";

export interface BlackAndWhiteRound { set: number; round: number; tiles: Record<string, number>; winnerId: string | null; leaderId: string }
export interface BlackAndWhiteState {
  playerIds: [string, string]; set: number; round: number; phase: "SELECT" | "ROUND_RESULT";
  scores: Record<string, number>; remainingTiles: Record<string, number[]>; selections: Record<string, number | null>;
  history: BlackAndWhiteRound[]; leaderId: string; currentPlayerId: string;
  pendingWinnerId: string | null; winnerId: string | null; isDraw: boolean; deadline: number | null;
}
export interface SelectTileAction { type: "SELECT_TILE"; tile: number }
export const tileColor = (tile: number): TileColor => tile % 2 === 0 ? "BLACK" : "WHITE";
const freshTiles = () => [0,1,2,3,4,5,6,7,8];
const ACTION_TIME_MS = 40_000;
const ROUND_RESULT_TIME_MS = 1_500;

export function advanceBlackAndWhiteRound(state: BlackAndWhiteState) {
  if (state.phase !== "ROUND_RESULT") return state;
  const next = structuredClone(state); const [a,b] = next.playerIds;
  if (next.pendingWinnerId) {
    next.winnerId = next.pendingWinnerId; next.pendingWinnerId = null; next.deadline = null;
    return next;
  }
  if (next.round === 9) {
    next.set += 1; next.round = 1; next.remainingTiles = {[a]:freshTiles(),[b]:freshTiles()};
  } else next.round += 1;
  next.selections = {[a]:null,[b]:null}; next.currentPlayerId = next.leaderId;
  next.phase = "SELECT"; next.deadline = Date.now()+ACTION_TIME_MS;
  return next;
}

export const blackAndWhiteEngine: GameEngine<BlackAndWhiteState, SelectTileAction, BlackAndWhiteView> = {
  createInitialState(ids) {
    if (ids.length !== 2) throw new Error("두 명의 플레이어가 필요합니다.");
    const [a,b] = ids as [string,string]; const leaderId = ids[Math.floor(Math.random()*2)];
    return { playerIds:[a,b], set:1, round:1, phase:"SELECT", scores:{[a]:0,[b]:0}, remainingTiles:{[a]:freshTiles(),[b]:freshTiles()}, selections:{[a]:null,[b]:null}, history:[], leaderId, currentPlayerId:leaderId, pendingWinnerId:null, winnerId:null, isDraw:false, deadline:Date.now()+ACTION_TIME_MS };
  },
  validateAction(state, playerId, action) {
    return state.phase === "SELECT" && !state.winnerId && state.currentPlayerId === playerId && action.type === "SELECT_TILE" && Number.isInteger(action.tile) && action.tile >= 0 && action.tile <= 8 && state.selections[playerId] === null && state.remainingTiles[playerId].includes(action.tile);
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state,playerId,action)) throw new Error("현재 차례에 보유한 타일만 선택할 수 있습니다.");
    const next = structuredClone(state); next.selections[playerId] = action.tile;
    const followerId = next.playerIds.find(id => id !== next.leaderId)!;
    if (playerId === next.leaderId) { next.currentPlayerId = followerId; next.deadline = Date.now()+ACTION_TIME_MS; return next; }
    const [a,b] = next.playerIds; const aTile=next.selections[a]!; const bTile=next.selections[b]!;
    const roundWinner = aTile === bTile ? null : aTile > bTile ? a : b;
    if (roundWinner) next.scores[roundWinner] += 1;
    next.history.push({set:next.set,round:next.round,tiles:{[a]:aTile,[b]:bTile},winnerId:roundWinner,leaderId:next.leaderId});
    next.remainingTiles[a] = next.remainingTiles[a].filter(tile=>tile!==aTile); next.remainingTiles[b] = next.remainingTiles[b].filter(tile=>tile!==bTile);
    next.leaderId = roundWinner ?? followerId;
    if (roundWinner && next.scores[roundWinner] >= 5) next.pendingWinnerId = roundWinner;
    else if (next.round === 9 && next.scores[a] !== next.scores[b]) next.pendingWinnerId = next.scores[a] > next.scores[b] ? a : b;
    next.phase = "ROUND_RESULT"; next.deadline = Date.now()+ROUND_RESULT_TIME_MS;
    return next;
  },
  getPlayerView(state,playerId) {
    const opponent=state.playerIds.find(id=>id!==playerId)!; const finished=state.winnerId!==null; const latestIndex=state.history.length-1;
    return { kind:"BLACK_AND_WHITE", set:state.set, round:state.round, phase:state.phase, scores:state.scores, myRemainingTiles:state.remainingTiles[playerId], opponentRemainingCount:state.remainingTiles[opponent].length, leaderId:state.leaderId, currentPlayerId:state.currentPlayerId,
      leadColor: state.phase === "SELECT" && state.selections[state.leaderId] !== null ? tileColor(state.selections[state.leaderId]!) : null, hasSelected:state.selections[playerId]!==null,
      history:state.history.map((round,index)=>({set:round.set,round:round.round,myTile:round.tiles[playerId],myColor:tileColor(round.tiles[playerId]),opponentColor:tileColor(round.tiles[opponent]),result:round.winnerId===null?"DRAW":round.winnerId===playerId?"WIN":"LOSE",...((finished||(state.phase==="ROUND_RESULT"&&index===latestIndex))?{opponentTile:round.tiles[opponent]}:{})})),
      winnerId:state.winnerId,isDraw:false,deadline:state.deadline };
  },
  getResult(state):GameResult|null { return state.winnerId ? {winnerId:state.winnerId,isDraw:false}:null; }
};
