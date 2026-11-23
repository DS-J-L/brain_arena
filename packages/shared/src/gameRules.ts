import { cardRankName, type CardSuit, type NumberOperator, type PlayingCard } from "./types.js";

// 서버 판정과 설명서 그림이 함께 쓰는 계산. 설명서의 예시 결과가 실제 규칙과 어긋나지 않게 한곳에 둔다.

export const SUIT_ORDER: Record<CardSuit, number> = { S: 4, D: 3, H: 2, C: 1 };

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

/** 숫자를 찾아라: 고른 순서대로 계산한다. 나머지가 남는 나눗셈은 null. */
export function calculateNumberCards(first: number, operator: NumberOperator, second: number) {
  if (operator === "+") return first + second;
  if (operator === "-") return first - second;
  if (operator === "×") return first * second;
  if (second === 0 || first % second !== 0) return null;
  return first / second;
}

/** 인디언 포커: 폴드할 때 추가로 잃는 칩. 높은 카드 페널티(이미 건 칩)와 10 페널티 중 큰 것 하나, 보유 칩까지만. */
export function pokerFoldPenalty(myCard: number, opponentCard: number, myBet: number, myChips: number) {
  const higherCard = myCard > opponentCard ? myBet : 0, ten = myCard === 10 ? 10 : 0;
  return Math.min(Math.max(higherCard, ten), myChips);
}
