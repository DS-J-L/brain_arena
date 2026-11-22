import { findNumberTargetScore, type FindTheNumberView, type NumberCardValue, type NumberOperator } from "@brain-arena/shared";
import type { GameEngine, GameResult } from "./gameEngine.js";

type FindNumberAction = { type: "BUZZ" } | { type: "SELECT_CARDS"; indices: number[] };
type InternalPhase = FindTheNumberView["phase"];
interface Reveal { playerId: string | null; indices: number[]; values: NumberCardValue[]; expression: string; correct: boolean; target: number; reason: "ANSWER" | "NO_BUZZ" }
interface HistoryEntry { round: number; target: number; playerId: string | null; expression: string; correct: boolean }

export interface FindTheNumberState {
  playerIds: string[];
  phase: InternalPhase;
  round: number;
  board: NumberCardValue[];
  scores: Record<string, number>;
  target: number | null;
  usedTargets: number[];
  answererId: string | null;
  firstAnswererId: string | null;
  /** 이번 목표 숫자에서 이미 틀려 다시 답할 수 없는 플레이어 */
  lockedOutIds: string[];
  targetScore: number;
  reveal: Reveal | null;
  history: HistoryEntry[];
  afterReveal: "SECOND_ANSWER" | "NEXT_ROUND" | "FINISH" | null;
  pendingWinnerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  deadline: number | null;
  practiceSolo: boolean;
  mistakes: number;
}

const TARGETS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,27,28,30,32,33,35,36,40,42,44,45,48,50,54,55,56,60,63,66,70,72,77,80,84,88,90,96,99,108,110,120,132];
const OPERATORS: NumberOperator[] = ["+", "-", "×", "÷"];
const TIMES = { MEMORIZE: 20_000, BUZZER: 15_000, REBUZZ: 10_000, ANSWER_FIRST: 5_000, ANSWER_SECOND: 15_000, SOLO_ANSWER: 15_000, REVEAL: 2_000, SOLUTION: 3_000 };
const shuffle = <T>(values: T[]) => { const result = [...values]; for (let index = result.length - 1; index > 0; index--) { const target = Math.floor(Math.random() * (index + 1)); [result[index], result[target]] = [result[target], result[index]]; } return result; };
const newBoard = () => shuffle<NumberCardValue>([1,2,3,4,5,6,7,8,9,10,11,12,...OPERATORS]);

function calculate(first: number, operator: NumberOperator, second: number) {
  if (operator === "+") return first + second;
  if (operator === "-") return first - second;
  if (operator === "×") return first * second;
  if (second === 0 || first % second !== 0) return null;
  return first / second;
}

export function findNumberSolution(board: NumberCardValue[], target: number) {
  for (let first = 0; first < board.length; first++) {
    if (typeof board[first] !== "number") continue;
    for (let operator = 0; operator < board.length; operator++) {
      if (!OPERATORS.includes(board[operator] as NumberOperator)) continue;
      for (let second = 0; second < board.length; second++) {
        if (first === second || typeof board[second] !== "number") continue;
        if (calculate(board[first] as number, board[operator] as NumberOperator, board[second] as number) === target) return [first, operator, second];
      }
    }
  }
  throw new Error("목표 숫자의 정답 수식을 찾지 못했습니다.");
}

/** 출제할 목표 숫자가 남아 있으면 true. 대전에서 목록을 다 쓰면 false를 돌려준다. */
function chooseTarget(state: FindTheNumberState) {
  let remaining = TARGETS.filter(target => !state.usedTargets.includes(target));
  if (remaining.length === 0 && state.practiceSolo) {
    state.usedTargets = [];
    remaining = [...TARGETS];
  }
  const target = remaining[Math.floor(Math.random() * remaining.length)];
  if (target === undefined) return false;
  state.target = target;
  state.usedTargets.push(target);
  return true;
}

/** 목표 숫자를 모두 쓰면 최고 점수로 승부를 가르고, 공동 1위는 무승부다. */
function finishByScore(state: FindTheNumberState) {
  const best = Math.max(...state.playerIds.map(id => state.scores[id]));
  const leaders = state.playerIds.filter(id => state.scores[id] === best);
  state.isDraw = leaders.length > 1;
  state.winnerId = state.isDraw ? null : leaders[0];
  state.deadline = null;
}

function startRound(state: FindTheNumberState) {
  state.round++;
  if (!chooseTarget(state)) { state.round--; finishByScore(state); return; }
  state.answererId = state.practiceSolo ? state.playerIds[0] : null;
  state.firstAnswererId = null;
  state.lockedOutIds = [];
  state.reveal = null;
  state.afterReveal = null;
  state.phase = state.practiceSolo ? "SOLO_ANSWER" : "BUZZER";
  state.deadline = Date.now() + (state.practiceSolo ? TIMES.SOLO_ANSWER : TIMES.BUZZER);
}

function revealSolution(state: FindTheNumberState) {
  const indices = findNumberSolution(state.board, state.target!);
  const values = indices.map(index => state.board[index]);
  const expression = `${values[0]} ${values[1]} ${values[2]} = ${state.target}`;
  state.reveal = { playerId: null, indices, values, expression, correct: true, target: state.target!, reason: "NO_BUZZ" };
  state.history.push({ round: state.round, target: state.target!, playerId: null, expression, correct: true });
  state.phase = "SOLUTION";
  state.deadline = Date.now() + TIMES.SOLUTION;
}

/** 첫 답변이 틀린 뒤: 남은 한 명은 바로 15초 추가 답변, 두 명 이상이면 다시 부저 경쟁 */
function afterWrongFirstAnswer(state: FindTheNumberState) {
  const eligible = state.playerIds.filter(id => !state.lockedOutIds.includes(id));
  state.reveal = null;
  if (eligible.length === 0) return startRound(state);
  if (eligible.length === 1) {
    state.answererId = eligible[0];
    state.phase = "ANSWER_SECOND";
    state.deadline = Date.now() + TIMES.ANSWER_SECOND;
    return;
  }
  state.answererId = null;
  state.phase = "BUZZER";
  state.deadline = Date.now() + TIMES.REBUZZ;
}

function baseState(playerIds: string[], practiceSolo: boolean): FindTheNumberState {
  return {
    playerIds,
    phase: "MEMORIZE",
    round: 1,
    board: newBoard(),
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    target: null,
    usedTargets: [],
    answererId: null,
    firstAnswererId: null,
    lockedOutIds: [],
    targetScore: findNumberTargetScore(playerIds.length),
    reveal: null,
    history: [],
    afterReveal: null,
    pendingWinnerId: null,
    winnerId: null,
    isDraw: false,
    deadline: Date.now() + TIMES.MEMORIZE,
    practiceSolo,
    mistakes: 0,
  };
}

export function createFindTheNumberPracticeState(playerId: string) {
  return baseState([playerId], true);
}

/** 기권·장시간 연결 끊김으로 빠진 플레이어를 정리하고, 한 명만 남으면 그 플레이어가 승리한다. */
export function removeFindTheNumberPlayer(state: FindTheNumberState, playerId: string): FindTheNumberState {
  if (!state.playerIds.includes(playerId) || state.winnerId || state.isDraw) return state;
  const next = structuredClone(state);
  next.playerIds = next.playerIds.filter(id => id !== playerId);
  next.lockedOutIds = next.lockedOutIds.filter(id => id !== playerId);
  if (next.playerIds.length === 1) { next.winnerId = next.playerIds[0]; next.deadline = null; return next; }
  if (next.pendingWinnerId === playerId) { next.pendingWinnerId = null; next.afterReveal = "NEXT_ROUND"; }
  if (next.answererId === playerId) {
    if (next.phase === "ANSWER_FIRST") afterWrongFirstAnswer(next);
    else if (next.phase === "ANSWER_SECOND") startRound(next);
  }
  return next;
}

export function advanceFindTheNumberPhase(state: FindTheNumberState) {
  const next = structuredClone(state);
  if (next.phase === "MEMORIZE") {
    next.lockedOutIds = [];
    chooseTarget(next);
    next.answererId = next.practiceSolo ? next.playerIds[0] : null;
    next.phase = next.practiceSolo ? "SOLO_ANSWER" : "BUZZER";
    next.deadline = Date.now() + (next.practiceSolo ? TIMES.SOLO_ANSWER : TIMES.BUZZER);
  } else if (next.phase === "BUZZER") {
    revealSolution(next);
  } else if (next.phase === "SOLO_ANSWER") {
    next.mistakes++;
    next.history.push({ round: next.round, target: next.target!, playerId: next.playerIds[0], expression: "답변 시간 초과", correct: false });
    revealSolution(next);
  } else if (next.phase === "ANSWER_FIRST") {
    next.history.push({ round: next.round, target: next.target!, playerId: next.answererId, expression: "답변 시간 초과", correct: false });
    next.lockedOutIds.push(next.answererId!);
    afterWrongFirstAnswer(next);
  } else if (next.phase === "ANSWER_SECOND") {
    next.history.push({ round: next.round, target: next.target!, playerId: next.answererId, expression: "추가 답변 시간 초과", correct: false });
    startRound(next);
  } else if (next.phase === "SOLUTION") {
    if (next.practiceSolo && next.mistakes >= 3) { next.winnerId = "PRACTICE_FAILED"; next.deadline = null; }
    else startRound(next);
  } else if (next.phase === "REVEAL") {
    if (next.afterReveal === "FINISH") { next.winnerId = next.pendingWinnerId; next.pendingWinnerId = null; next.deadline = null; }
    else if (next.afterReveal === "SECOND_ANSWER") afterWrongFirstAnswer(next);
    else startRound(next);
  }
  return next;
}

export const findTheNumberEngine: GameEngine<FindTheNumberState, FindNumberAction, FindTheNumberView> = {
  createInitialState(ids) {
    if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error("서로 다른 2~4명의 플레이어가 필요합니다.");
    return baseState(ids, false);
  },
  validateAction(state, playerId, action) {
    if (state.winnerId || state.isDraw || !state.playerIds.includes(playerId)) return false;
    if (action.type === "BUZZ") return state.phase === "BUZZER" && state.answererId === null && !state.lockedOutIds.includes(playerId);
    return ["ANSWER_FIRST", "ANSWER_SECOND", "SOLO_ANSWER"].includes(state.phase) && state.answererId === playerId && Array.isArray(action.indices) && action.indices.length === 3 && action.indices.every(index => Number.isInteger(index) && index >= 0 && index < 16);
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state, playerId, action)) throw new Error("현재 단계에서 허용되지 않는 행동입니다.");
    const next = structuredClone(state);
    if (action.type === "BUZZ") { next.answererId = playerId; next.firstAnswererId = playerId; next.phase = "ANSWER_FIRST"; next.deadline = Date.now() + TIMES.ANSWER_FIRST; return next; }
    const answerPhase = next.phase;
    const indices = action.indices;
    const values = indices.map(index => next.board[index]);
    const distinct = new Set(indices).size === 3;
    const validOrder = typeof values[0] === "number" && OPERATORS.includes(values[1] as NumberOperator) && typeof values[2] === "number";
    const result = distinct && validOrder && values[0] !== values[2] ? calculate(values[0] as number, values[1] as NumberOperator, values[2] as number) : null;
    const correct = result !== null && result > 0 && Number.isInteger(result) && result === next.target;
    const expression = validOrder ? `${values[0]} ${values[1]} ${values[2]} = ${result ?? "계산 불가"}` : `${values.join(" → ")} · 잘못된 순서`;
    next.reveal = { playerId, indices: [...indices], values, expression, correct, target: next.target!, reason: "ANSWER" };
    next.history.push({ round: next.round, target: next.target!, playerId, expression, correct });
    if (correct) {
      next.scores[playerId]++;
      if (!next.practiceSolo && next.scores[playerId] >= next.targetScore) { next.pendingWinnerId = playerId; next.afterReveal = "FINISH"; }
      else next.afterReveal = "NEXT_ROUND";
    } else if (next.practiceSolo) {
      next.mistakes++;
      if (next.mistakes >= 3) { next.pendingWinnerId = "PRACTICE_FAILED"; next.afterReveal = "FINISH"; }
      else next.afterReveal = "NEXT_ROUND";
    } else {
      next.lockedOutIds.push(playerId);
      next.afterReveal = answerPhase === "ANSWER_FIRST" ? "SECOND_ANSWER" : "NEXT_ROUND";
    }
    next.phase = "REVEAL";
    next.deadline = Date.now() + TIMES.REVEAL;
    return next;
  },
  getPlayerView(state) {
    const finished = state.winnerId !== null || state.isDraw;
    const showBoard = state.phase === "MEMORIZE" || finished;
    const revealed = new Set(state.reveal?.indices ?? []);
    return { kind: "FIND_THE_NUMBER", phase: state.phase, playerIds: state.playerIds, targetScore: state.targetScore, lockedOutIds: state.lockedOutIds, round: state.round, scores: state.scores, target: state.target, answererId: state.answererId, board: state.board.map((value, index) => showBoard || revealed.has(index) ? value : null), reveal: state.reveal, history: finished ? state.history : [], winnerId: state.winnerId, isDraw: state.isDraw, deadline: state.deadline, practiceSolo: state.practiceSolo, mistakes: state.mistakes, maxMistakes: 3 };
  },
  getResult(state): GameResult | null { return state.winnerId || state.isDraw ? { winnerId: state.winnerId, isDraw: state.isDraw } : null; },
};
