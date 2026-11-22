import {
  ATLAS_COLORS, ATLAS_MAX_NUMBER, ATLAS_REFILL_ROUND, ATLAS_ROUNDS, ATLAS_TOKENS, atlasLimit,
  type AtlasColor, type AtlasHand, type AtlasPlacement, type AtlasRoundReview, type AtlasSubmission, type AtlasToken, type AtlasView,
} from "@brain-arena/shared";
import type { GameEngine, GameResult } from "./gameEngine.js";

// round는 화면이 보고 있던 라운드다. 시간 초과 자동 처리와 클릭이 겹쳐도 다음 라운드에 잘못 들어가지 않는다.
export type AtlasAction =
  | { type: "SUBMIT"; number: number; token: AtlasToken; round: number }
  | { type: "PLACE"; color?: AtlasColor; round: number }
  | { type: "PASS"; round: number };
interface Submission { number: number; token: AtlasToken; auto: boolean }

export interface AtlasState {
  playerIds: string[];
  phase: AtlasView["phase"];
  round: number;
  limit: number;
  /** 선 플레이어. 블록을 먹은(거인을 무너뜨린) 사람이 다음 선이 된다. */
  leadId: string;
  /** 이번 라운드를 시작할 때의 선. 기록용 */
  roundLeadId: string;
  giants: Record<AtlasColor, number[]>;
  hands: Record<string, AtlasHand>;
  submissions: Record<string, Submission>;
  /** 아직 올리지 않은 플레이어. 앞에서부터 올린다. */
  queue: string[];
  passes: number;
  passedIds: string[];
  placements: AtlasPlacement[];
  scores: Record<string, number>;
  history: AtlasRoundReview[];
  winnerId: string | null;
  isDraw: boolean;
  deadline: number | null;
}

export const ATLAS_TIMES = { SUBMIT: 30_000, DECIDE: 15_000, RESULT: 5_000 };
const freshHand = (): AtlasHand => ({
  numbers: Array.from({ length: ATLAS_MAX_NUMBER + 1 }, (_, index) => index),
  tokens: { RED: 2, GREEN: 2, BLUE: 2, RAINBOW: 1 },
});
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const pickRandom = <T>(values: T[]) => values[Math.floor(Math.random() * values.length)];
const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** 선부터 오른쪽(자리 순서)으로 센 거리. 같은 숫자끼리의 우선순위다. */
const seatFromLead = (state: AtlasState, id: string) => {
  const count = state.playerIds.length;
  return (state.playerIds.indexOf(id) - state.playerIds.indexOf(state.leadId) + count) % count;
};
function sortedOrder(state: AtlasState, ids: string[], direction: 1 | -1) {
  return [...ids].sort((a, b) => direction * (state.submissions[a].number - state.submissions[b].number) || seatFromLead(state, a) - seatFromLead(state, b));
}

/**
 * 패스했을 때의 새 순서. 기본은 큰 숫자부터.
 * 첫 패스: 다음으로 큰 사람부터 올리고 패스한 사람은 맨 뒤로. 두 번째 패스: 작은 숫자부터(오름차순).
 * 순서가 바뀌지 않는 패스(예: 2인전의 두 번째 패스)는 허용하지 않는다.
 */
function orderAfterPass(state: AtlasState) {
  if (state.phase !== "PLACE" || state.placements.length > 0 || state.passes >= 2 || state.queue.length < 2) return null;
  const next = state.passes === 0 ? [...state.queue.slice(1), state.queue[0]] : sortedOrder(state, state.queue, 1);
  return sameOrder(next, state.queue) ? null : next;
}
const needsDecision = (state: AtlasState) => orderAfterPass(state) !== null || state.submissions[state.queue[0]].token === "RAINBOW";

/** 무지개 블록의 자동 선택: 벌점이 가장 적은 거인 */
function safestColor(state: AtlasState, number: number): AtlasColor {
  const penalty = (color: AtlasColor) => sum(state.giants[color]) + number > state.limit ? state.giants[color].length + 1 : 0;
  const best = Math.min(...ATLAS_COLORS.map(penalty));
  return pickRandom(ATLAS_COLORS.filter(color => penalty(color) === best));
}

function place(state: AtlasState, playerId: string, color: AtlasColor, auto: boolean) {
  const { number, token } = state.submissions[playerId];
  const held = state.giants[color], stack = [...held, number], total = sum(stack), collapsed = total > state.limit;
  // 무너지면 무너뜨린 블록까지 센 수만큼 벌점을 받는다. 무너뜨린 블록은 빈 판 위에 그대로 남는다.
  const penalty = collapsed ? stack.length : 0;
  state.giants[color] = collapsed ? [number] : stack;
  state.scores[playerId] += penalty;
  // 블록을 먹은 사람이 다음 선이 된다. 한 라운드에 여러 번 무너지면 마지막 사람.
  if (collapsed) state.leadId = playerId;
  state.placements.push({ playerId, number, token, color, order: state.placements.length + 1, blocks: stack, total, collapsed, penalty, auto });
  state.queue.shift();
}

const publicSubmissions = (state: AtlasState): AtlasSubmission[] =>
  state.playerIds.filter(id => state.submissions[id]).map(id => ({ playerId: id, number: state.submissions[id].number, token: state.submissions[id].token }));

/** 결정이 필요한 사람(패스할 수 있는 첫 사람, 무지개 블록)이 나올 때까지 차례대로 올린다. */
function runQueue(state: AtlasState, now: number) {
  while (state.queue.length) {
    if (needsDecision(state)) { state.deadline = now + ATLAS_TIMES.DECIDE; return; }
    const id = state.queue[0];
    place(state, id, state.submissions[id].token as AtlasColor, false);
  }
  state.history.push(structuredClone({ round: state.round, leadPlayerId: state.roundLeadId, submissions: publicSubmissions(state), passedIds: state.passedIds, placements: state.placements }));
  state.phase = "RESULT";
  state.deadline = now + ATLAS_TIMES.RESULT;
}

function reveal(state: AtlasState, now: number) {
  state.phase = "PLACE";
  state.queue = sortedOrder(state, state.playerIds, -1);
  runQueue(state, now);
}

function submitFor(state: AtlasState, playerId: string, number: number, token: AtlasToken, auto: boolean) {
  const hand = state.hands[playerId];
  hand.numbers = hand.numbers.filter(value => value !== number);
  hand.tokens[token]--;
  state.submissions[playerId] = { number, token, auto };
}
const allSubmitted = (state: AtlasState) => state.playerIds.every(id => state.submissions[id]);

/** 벌점이 가장 낮은 한 명이 승리, 여러 명이면 무승부 */
function finishByScore(state: AtlasState) {
  const best = Math.min(...state.playerIds.map(id => state.scores[id]));
  const leaders = state.playerIds.filter(id => state.scores[id] === best);
  state.isDraw = leaders.length > 1;
  state.winnerId = state.isDraw ? null : leaders[0];
  state.deadline = null;
}

/** 제한 시간이 끝났을 때의 자동 진행. */
export function advanceAtlasPhase(state: AtlasState, now = Date.now()): AtlasState {
  if (state.winnerId || state.isDraw || state.deadline === null || now < state.deadline) return state;
  const next = structuredClone(state);
  if (next.phase === "SUBMIT") {
    // 미제출자는 남은 블록과 토큰에서 무작위로 낸다.
    for (const id of next.playerIds) {
      if (next.submissions[id]) continue;
      const hand = next.hands[id];
      submitFor(next, id, pickRandom(hand.numbers), pickRandom(ATLAS_TOKENS.filter(token => hand.tokens[token] > 0)), true);
    }
    reveal(next, now);
  } else if (next.phase === "PLACE") {
    // 결정 시간이 지나면 패스하지 않고 올린다. 무지개는 가장 안전한 거인에.
    const id = next.queue[0], { number, token } = next.submissions[id];
    place(next, id, token === "RAINBOW" ? safestColor(next, number) : token, true);
    runQueue(next, now);
  } else if (next.round >= ATLAS_ROUNDS) finishByScore(next);
  else {
    next.round++;
    if (next.round === ATLAS_REFILL_ROUND) for (const id of next.playerIds) next.hands[id] = freshHand();
    Object.assign(next, { phase: "SUBMIT", roundLeadId: next.leadId, submissions: {}, queue: [], passes: 0, passedIds: [], placements: [], deadline: now + ATLAS_TIMES.SUBMIT });
  }
  return next;
}

/** 기권·장시간 연결 끊김으로 빠진 플레이어를 정리한다. 한 명만 남으면 그 플레이어가 승리한다. */
export function removeAtlasPlayer(state: AtlasState, playerId: string, now = Date.now()): AtlasState {
  if (!state.playerIds.includes(playerId) || state.winnerId || state.isDraw) return state;
  const next = structuredClone(state);
  const index = next.playerIds.indexOf(playerId), wasCurrent = next.phase === "PLACE" && next.queue[0] === playerId;
  if (next.leadId === playerId) next.leadId = next.playerIds[(index + 1) % next.playerIds.length];
  if (next.roundLeadId === playerId) next.roundLeadId = next.leadId;
  next.playerIds = next.playerIds.filter(id => id !== playerId);
  next.queue = next.queue.filter(id => id !== playerId);
  delete next.submissions[playerId];
  delete next.scores[playerId];
  delete next.hands[playerId];
  if (next.playerIds.length === 1) {
    next.winnerId = next.playerIds[0];
    next.deadline = null;
    return next;
  }
  if (next.phase === "SUBMIT" && allSubmitted(next)) reveal(next, now);
  else if (next.phase === "PLACE" && (wasCurrent || next.queue.length === 0)) runQueue(next, now);
  return next;
}

export const atlasEngine: GameEngine<AtlasState, AtlasAction, AtlasView> = {
  createInitialState(ids) {
    if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error("서로 다른 2~4명의 플레이어가 필요합니다.");
    const leadId = pickRandom(ids);
    return {
      playerIds: [...ids], phase: "SUBMIT", round: 1, limit: atlasLimit(ids.length), leadId, roundLeadId: leadId,
      giants: { RED: [], GREEN: [], BLUE: [] }, hands: Object.fromEntries(ids.map(id => [id, freshHand()])), submissions: {},
      queue: [], passes: 0, passedIds: [], placements: [], scores: Object.fromEntries(ids.map(id => [id, 0])), history: [],
      winnerId: null, isDraw: false, deadline: Date.now() + ATLAS_TIMES.SUBMIT,
    };
  },
  validateAction(state, playerId, action) {
    if (state.winnerId || state.isDraw || !state.playerIds.includes(playerId) || action.round !== state.round) return false;
    if (state.deadline === null || Date.now() >= state.deadline) return false;
    if (action.type === "SUBMIT") {
      const hand = state.hands[playerId];
      return state.phase === "SUBMIT" && !state.submissions[playerId] && Number.isInteger(action.number) && hand.numbers.includes(action.number)
        && ATLAS_TOKENS.includes(action.token) && hand.tokens[action.token] > 0;
    }
    if (state.phase !== "PLACE" || state.queue[0] !== playerId) return false;
    if (action.type === "PASS") return orderAfterPass(state) !== null;
    if (action.type !== "PLACE") return false;
    return state.submissions[playerId].token !== "RAINBOW" || (action.color !== undefined && ATLAS_COLORS.includes(action.color));
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state, playerId, action)) throw new Error("지금 할 수 없는 행동입니다. 차례와 남은 블록·토큰을 확인해 주세요.");
    const next = structuredClone(state), now = Date.now();
    if (action.type === "SUBMIT") {
      submitFor(next, playerId, action.number, action.token, false);
      if (allSubmitted(next)) reveal(next, now);
    } else if (action.type === "PASS") {
      next.queue = orderAfterPass(next)!;
      next.passes++;
      next.passedIds.push(playerId);
      runQueue(next, now);
    } else {
      const token = next.submissions[playerId].token;
      place(next, playerId, token === "RAINBOW" ? action.color! : token, false);
      runQueue(next, now);
    }
    return next;
  },
  getPlayerView(state, playerId) {
    const mine = state.submissions[playerId], finished = state.winnerId !== null || state.isDraw;
    const placing = state.phase === "PLACE" && state.queue.length > 0;
    return structuredClone({
      kind: "ATLAS", phase: state.phase, playerIds: state.playerIds, round: state.round, totalRounds: ATLAS_ROUNDS,
      limit: state.limit, maxNumber: ATLAS_MAX_NUMBER, refillRound: ATLAS_REFILL_ROUND, leadPlayerId: state.leadId,
      giants: state.giants, myHand: state.hands[playerId] ?? freshHand(), scores: state.scores,
      // 다른 사람이 낸 블록은 공개 전까지 숨기고, 냈는지 여부만 보여준다.
      submittedIds: state.playerIds.filter(id => state.submissions[id]),
      mySubmission: mine ? { number: mine.number, token: mine.token } : null,
      submissions: state.phase === "SUBMIT" ? null : publicSubmissions(state),
      queue: state.queue, currentPlacerId: placing ? state.queue[0] : null,
      canPass: placing && orderAfterPass(state) !== null,
      needsColor: placing && state.submissions[state.queue[0]].token === "RAINBOW",
      passedIds: state.passedIds, placements: state.placements,
      history: finished ? state.history : [],
      winnerId: state.winnerId, isDraw: state.isDraw, deadline: state.deadline,
    } satisfies AtlasView);
  },
  getResult(state): GameResult | null { return state.winnerId || state.isDraw ? { winnerId: state.winnerId, isDraw: state.isDraw } : null; },
};
