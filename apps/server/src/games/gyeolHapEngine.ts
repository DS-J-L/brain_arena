import {
  HAP_BACKGROUNDS, HAP_COLORS, HAP_SHAPES, checkHap, findAllHaps, hapKey,
  type FoundHap, type GyeolHapView, type HapAttempt, type HapRoundReview, type HapTile,
} from "@brain-arena/shared";
import type { GameEngine } from "./gameEngine.js";

export type GyeolHapAction = { turnId: number; round: number } & (
  { type: "HAP" } | { type: "GYEOL" } | { type: "SUBMIT_HAP"; numbers: number[] }
);
export interface GyeolHapState {
  playerIds: string[];
  firstPlayerId: string;
  currentPlayerId: string;
  round: number;
  turnId: number;
  phase: GyeolHapView["phase"];
  board: HapTile[];
  allHaps: number[][];
  foundHaps: FoundHap[];
  scores: Record<string, number>;
  consecutivePasses: number;
  lastResult: HapAttempt | null;
  attempts: HapAttempt[];
  history: HapRoundReview[];
  winnerId: string | null;
  isDraw: boolean;
  deadline: number | null;
}

export function createHapBoard(): HapTile[] {
  const deck = HAP_SHAPES.flatMap(shape => HAP_COLORS.flatMap(shapeColor => HAP_BACKGROUNDS.map(backgroundColor => ({ shape, shapeColor, backgroundColor }))));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, 9);
}

const other = (state: GyeolHapState, id: string) => state.playerIds.find(playerId => playerId !== id)!;
const remainingHaps = (state: GyeolHapState) => {
  const found = new Set(state.foundHaps.map(answer => hapKey(answer.numbers)));
  return state.allHaps.filter(answer => !found.has(hapKey(answer)));
};

function roundReview(state: GyeolHapState, endReason: HapRoundReview["endReason"]): HapRoundReview {
  return structuredClone({
    round: state.round, board: state.board, foundHaps: state.foundHaps, attempts: state.attempts, endReason,
    missedHaps: remainingHaps(state).map(numbers => ({ numbers, checks: checkHap(numbers.map(n => state.board[n - 1])) })),
  });
}

function endRound(state: GyeolHapState, reason: "GYEOL" | "PASSES", now: number) {
  state.history.push(roundReview(state, reason));
  state.phase = "ROUND_END";
  state.deadline = now + 3_000;
}

function record(state: GyeolHapState, result: HapAttempt, now: number) {
  state.scores[result.playerId] += result.delta;
  state.lastResult = result;
  state.attempts.push(result);
  state.consecutivePasses = result.reason === "PASS" ? state.consecutivePasses + 1 : 0;
  if (result.reason === "GYEOL") endRound(state, "GYEOL", now);
  else if (state.consecutivePasses === 6) endRound(state, "PASSES", now);
  else { state.phase = "RESULT"; state.deadline = now + 1_500; }
}

export function advanceGyeolHapPhase(state: GyeolHapState, now = Date.now()): GyeolHapState {
  if (state.winnerId || state.deadline === null || now < state.deadline) return state;
  const next = structuredClone(state);
  if (next.phase === "TURN" || next.phase === "SELECT") {
    record(next, { playerId: next.currentPlayerId, reason: next.phase === "TURN" ? "PASS" : "TIMEOUT", numbers: [], delta: next.phase === "TURN" ? 0 : -1, checks: null }, now);
  } else if (next.phase === "RESULT") {
    next.currentPlayerId = other(next, next.currentPlayerId);
    next.turnId++;
    next.phase = "TURN";
    next.deadline = now + 10_000;
    next.lastResult = null;
  } else {
    const [a, b] = next.playerIds;
    if (next.round >= 10 && next.scores[a] !== next.scores[b]) {
      next.winnerId = next.scores[a] > next.scores[b] ? a : b;
      next.deadline = null;
      return next;
    }
    next.round++;
    next.turnId++;
    next.firstPlayerId = other(next, next.firstPlayerId);
    next.currentPlayerId = next.firstPlayerId;
    next.board = createHapBoard();
    next.allHaps = findAllHaps(next.board);
    next.foundHaps = [];
    next.consecutivePasses = 0;
    next.attempts = [];
    next.lastResult = null;
    next.phase = "TURN";
    next.deadline = now + 10_000;
  }
  return next;
}

export const gyeolHapEngine: GameEngine<GyeolHapState, GyeolHapAction, GyeolHapView> = {
  createInitialState(playerIds) {
    if (playerIds.length !== 2 || new Set(playerIds).size !== 2) throw new Error("서로 다른 두 명의 플레이어가 필요합니다.");
    const board = createHapBoard(), firstPlayerId = playerIds[Math.floor(Math.random() * 2)];
    return { playerIds: [...playerIds], firstPlayerId, currentPlayerId: firstPlayerId, round: 1, turnId: 1, phase: "TURN", board, allHaps: findAllHaps(board), foundHaps: [], scores: Object.fromEntries(playerIds.map(id => [id, 0])), consecutivePasses: 0, lastResult: null, attempts: [], history: [], winnerId: null, isDraw: false, deadline: Date.now() + 10_000 };
  },
  validateAction(state, playerId, action) {
    if (state.winnerId || state.currentPlayerId !== playerId || !state.playerIds.includes(playerId)
      || state.deadline === null || Date.now() >= state.deadline || action.turnId !== state.turnId || action.round !== state.round) return false;
    if (action.type === "HAP" || action.type === "GYEOL") return state.phase === "TURN";
    return action.type === "SUBMIT_HAP" && state.phase === "SELECT" && Array.isArray(action.numbers)
      && action.numbers.length === 3 && new Set(action.numbers).size === 3
      && action.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 9);
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state, playerId, action)) throw new Error("차례, 제한시간 또는 선택한 타일을 확인해 주세요.");
    const next = structuredClone(state), now = Date.now();
    if (action.type === "HAP") {
      next.phase = "SELECT";
      next.deadline = now + 5_000;
      return next;
    }
    if (action.type === "GYEOL") {
      const correct = remainingHaps(next).length === 0;
      record(next, { playerId, reason: correct ? "GYEOL" : "WRONG_GYEOL", numbers: [], delta: correct ? 3 : -1, checks: null }, now);
    } else {
      const numbers = [...action.numbers].sort((a, b) => a - b);
      const checks = checkHap(numbers.map(n => next.board[n - 1]));
      const valid = Object.values(checks).every(value => value !== "TWO_SAME");
      const duplicate = next.foundHaps.some(found => hapKey(found.numbers) === hapKey(numbers));
      const reason = !valid ? "NOT_HAP" : duplicate ? "DUPLICATE" : "NEW_HAP";
      if (reason === "NEW_HAP") next.foundHaps.push({ numbers, playerId });
      record(next, { playerId, numbers, checks, reason, delta: reason === "NEW_HAP" ? 1 : -1 }, now);
    }
    return next;
  },
  getPlayerView(state) {
    const history = state.winnerId ? [...state.history] : [];
    // Include the interrupted round when the shared room system awards a forfeit.
    if (state.winnerId && !history.some(review => review.round === state.round)) history.push(roundReview(state, "FORFEIT"));
    return structuredClone({ kind: "GYEOL_HAP", phase: state.phase, round: state.round, turnId: state.turnId, currentPlayerId: state.currentPlayerId, board: state.board, scores: state.scores, foundHaps: state.foundHaps, consecutivePasses: state.consecutivePasses, lastResult: state.lastResult, history, winnerId: state.winnerId, isDraw: false, deadline: state.deadline });
  },
  getResult(state) { return state.winnerId ? { winnerId: state.winnerId, isDraw: false } : null; },
};
