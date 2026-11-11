import { HOLDEM_TARGET_WINS, cardRankName, cardText, type CardSuit, type HoldemHandReview, type HoldemRole, type MemoryHoldemView, type PlayingCard } from "@brain-arena/shared";
import type { GameEngine, GameResult } from "./gameEngine.js";

// hand/pick는 화면이 보고 있던 순번이다. 시간 초과 자동 선택과 클릭이 겹쳐도 한 순번에 한 장만 확정한다.
type HoldemAction = { type: "CHOOSE_ROLE"; role: HoldemRole } | { type: "PICK_CARD"; index: number; hand: number; pick: number };

export interface MemoryHoldemState {
  playerIds: string[];
  phase: MemoryHoldemView["phase"];
  hand: number;
  wins: Record<string, number>;
  chooserId: string;
  firstPlayerId: string | null;
  board: PlayingCard[];
  community: PlayingCard[];
  owners: Array<string | null>;
  picks: number;
  showdown: HoldemHandReview | null;
  history: HoldemHandReview[];
  pendingWinnerId: string | null;
  winnerId: string | null;
  isDraw: boolean;
  deadline: number | null;
}

const TIMES = { COIN: 10_000, MEMORIZE: 30_000, PICK: 15_000, SHOWDOWN: 8_000 };
const SUITS: CardSuit[] = ["S", "H", "D", "C"];
const other = (state: MemoryHoldemState, playerId: string) => state.playerIds.find(id => id !== playerId)!;
const shuffle = <T>(values: T[]) => { const result = [...values]; for (let index = result.length - 1; index > 0; index--) { const target = Math.floor(Math.random() * (index + 1)); [result[index], result[target]] = [result[target], result[index]]; } return result; };
const hasBatchim = (text: string) => { const code = text.charCodeAt(text.length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0; };

const SUIT_ORDER: Record<CardSuit, number> = { S: 4, D: 3, H: 2, C: 1 };

/**
 * 5장의 족보. score는 앞에서부터 큰 쪽이 이기는 비교 값이다.
 * 앞쪽 rankLength개는 족보와 숫자, 그 뒤 5개는 ordered(족보 숫자 → 키커 순) 카드의 무늬 값이다.
 * 서로 다른 카드를 든 두 패는 숫자가 모두 같아도 무늬(♠ > ♦ > ♥ > ♣)에서 반드시 갈린다.
 */
export function evaluateHand(cards: PlayingCard[]): { score: number[]; label: string; rankLength: number; ordered: PlayingCard[] } {
  const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const order = groups.map(group => group[0]), shape = groups.map(group => group[1]).join("");
  const name = cardRankName;
  const flush = cards.every(card => card.suit === cards[0].suit);
  const wheel = ranks.join() === "14,5,4,3,2";
  const straight = groups.length === 5 && (ranks[0] - ranks[4] === 4 || wheel);
  const top = wheel ? 5 : ranks[0];
  // A-2-3-4-5에서는 A가 가장 낮은 카드다.
  const weight = (card: PlayingCard) => counts.get(card.rank)! * 100 + (wheel && card.rank === 14 ? 1 : card.rank);
  const ordered = [...cards].sort((a, b) => weight(b) - weight(a) || SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit]);
  const result = (rankScore: number[], label: string) => ({ score: [...rankScore, ...ordered.map(card => SUIT_ORDER[card.suit])], label, rankLength: rankScore.length, ordered });
  if (straight && flush) return result([8, top], top === 14 ? "로열 플러시" : `${name(top)} 하이 스트레이트 플러시`);
  if (shape === "41") return result([7, ...order], `${name(order[0])} 포카드`);
  if (shape === "32") return result([6, ...order], `${name(order[0])}·${name(order[1])} 풀하우스`);
  if (flush) return result([5, ...ranks], `${name(ranks[0])} 하이 플러시`);
  if (straight) return result([4, top], `${name(top)} 하이 스트레이트`);
  if (shape === "311") return result([3, ...order], `${name(order[0])} 트리플`);
  if (shape === "221") return result([2, ...order], `${name(order[0])}·${name(order[1])} 투페어`);
  if (shape === "2111") return result([1, ...order], `${name(order[0])} 원페어`);
  return result([0, ...ranks], `${name(ranks[0])} 하이카드`);
}

export function compareScores(a: number[], b: number[]) {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function deal(state: MemoryHoldemState) {
  const deck = shuffle(SUITS.flatMap(suit => Array.from({ length: 13 }, (_, index) => ({ rank: index + 2, suit }))));
  state.board = deck.slice(0, 16);
  state.community = deck.slice(16, 19);
  state.owners = Array(16).fill(null);
  state.picks = 0;
  state.firstPlayerId = null;
  state.showdown = null;
  state.phase = "COIN";
  state.deadline = Date.now() + TIMES.COIN;
}

// 선공 1장 → 후공 2장 → 선공 1장
const picker = (state: MemoryHoldemState) => state.picks === 0 || state.picks === 3 ? state.firstPlayerId! : other(state, state.firstPlayerId!);

function chooseRole(state: MemoryHoldemState, role: HoldemRole) {
  state.firstPlayerId = role === "FIRST" ? state.chooserId : other(state, state.chooserId);
  state.phase = "MEMORIZE";
  state.deadline = Date.now() + TIMES.MEMORIZE;
}

function resolve(state: MemoryHoldemState) {
  const evaluated = state.playerIds.map(id => {
    const indices = state.owners.flatMap((owner, index) => owner === id ? [index] : []);
    const cards = indices.map(index => state.board[index]);
    return { id, indices, cards, ...evaluateHand([...state.community, ...cards]) };
  });
  // 두 사람의 카드가 다르므로 무늬 비교까지 가면 승자가 반드시 정해진다.
  const [a, b] = evaluated, winner = compareScores(a.score, b.score) > 0 ? a : b, loser = winner === a ? b : a;
  const at = winner.score.findIndex((value, index) => value !== loser.score[index]), suitAt = at - winner.rankLength;
  const reason = winner.label !== loser.label ? `${winner.label}${hasBatchim(winner.label) ? "이" : "가"} ${loser.label}${hasBatchim(loser.label) ? "을" : "를"} 이겼어요`
    : suitAt < 0 ? `같은 ${winner.label} · 키커 ${cardRankName(winner.score[at])} > ${cardRankName(loser.score[at])}`
    : `숫자가 모두 같은 ${winner.label} · 무늬 ${cardText(winner.ordered[suitAt])} > ${cardText(loser.ordered[suitAt])}`;
  const review: HoldemHandReview = {
    hand: state.hand, board: state.board, community: state.community, firstPlayerId: state.firstPlayerId!,
    seats: Object.fromEntries(evaluated.map(seat => [seat.id, { indices: seat.indices, cards: seat.cards, label: seat.label }])),
    winnerId: winner.id, reason,
  };
  state.showdown = review;
  state.history.push(review);
  if (++state.wins[winner.id] >= HOLDEM_TARGET_WINS) state.pendingWinnerId = winner.id;
  state.phase = "SHOWDOWN";
  state.deadline = Date.now() + TIMES.SHOWDOWN;
}

function pick(state: MemoryHoldemState, index: number) {
  state.owners[index] = picker(state);
  state.picks++;
  if (state.picks === 4) resolve(state);
  else state.deadline = Date.now() + TIMES.PICK;
}

/** 단계 제한 시간이 끝났을 때의 자동 진행. */
export function advanceMemoryHoldemPhase(state: MemoryHoldemState) {
  const next = structuredClone(state);
  if (next.phase === "COIN") chooseRole(next, Math.random() < .5 ? "FIRST" : "SECOND");
  else if (next.phase === "MEMORIZE") { next.phase = "PICK"; next.deadline = Date.now() + TIMES.PICK; }
  else if (next.phase === "PICK") {
    const free = next.owners.flatMap((owner, index) => owner === null ? [index] : []);
    pick(next, free[Math.floor(Math.random() * free.length)]);
  } else if (next.pendingWinnerId) { next.winnerId = next.pendingWinnerId; next.pendingWinnerId = null; next.deadline = null; }
  else { next.hand++; next.chooserId = other(next, next.chooserId); deal(next); }
  return next;
}

export const memoryHoldemEngine: GameEngine<MemoryHoldemState, HoldemAction, MemoryHoldemView> = {
  createInitialState(ids) {
    if (ids.length !== 2) throw new Error("두 명의 플레이어가 필요합니다.");
    const state: MemoryHoldemState = {
      playerIds: ids, phase: "COIN", hand: 1, wins: Object.fromEntries(ids.map(id => [id, 0])),
      // 첫 판은 동전 던지기, 이후에는 판마다 선택권을 교대한다.
      chooserId: ids[Math.floor(Math.random() * 2)], firstPlayerId: null, board: [], community: [], owners: [], picks: 0,
      showdown: null, history: [], pendingWinnerId: null, winnerId: null, isDraw: false, deadline: null,
    };
    deal(state);
    return state;
  },
  validateAction(state, playerId, action) {
    if (state.winnerId || !state.playerIds.includes(playerId)) return false;
    if (action.type === "CHOOSE_ROLE") return state.phase === "COIN" && state.chooserId === playerId && (action.role === "FIRST" || action.role === "SECOND");
    return state.phase === "PICK" && picker(state) === playerId && action.hand === state.hand && action.pick === state.picks + 1
      && Number.isInteger(action.index) && action.index >= 0 && action.index < 16 && state.owners[action.index] === null;
  },
  applyAction(state, playerId, action) {
    if (!this.validateAction(state, playerId, action)) throw new Error("현재 단계에서 허용되지 않는 행동입니다.");
    const next = structuredClone(state);
    if (action.type === "CHOOSE_ROLE") chooseRole(next, action.role);
    else pick(next, action.index);
    return next;
  },
  getPlayerView(state) {
    // 단계에 맞는 카드만 보낸다: 암기 중에는 보드 앞면, 선택 중에는 공용 카드와 칸 주인만, 공개 후에는 전부.
    const faceUp = state.phase === "MEMORIZE" || state.phase === "SHOWDOWN";
    const dealt = state.phase === "PICK" || state.phase === "SHOWDOWN";
    return {
      kind: "MEMORY_HOLDEM", phase: state.phase, hand: state.hand, wins: state.wins, targetWins: HOLDEM_TARGET_WINS,
      chooserId: state.chooserId, firstPlayerId: state.firstPlayerId, currentPlayerId: state.phase === "PICK" ? picker(state) : null,
      pickNumber: Math.min(state.picks + 1, 4), board: state.board.map(card => faceUp ? card : null), owners: state.owners,
      community: dealt ? state.community : [], showdown: state.showdown, history: state.history,
      winnerId: state.winnerId, isDraw: false, deadline: state.deadline,
    };
  },
  getResult(state): GameResult | null { return state.winnerId ? { winnerId: state.winnerId, isDraw: false } : null; },
};
