import { SUIT_ORDER, cardText, compareScores, evaluateHand, type CardSuit, type PlayingCard } from "@brain-arena/shared";
import { PlayingCardFace } from "../../components/MemoryHoldemGame";
import type { GameGuide } from "../types";

// ── 족보 이름과 승패는 서버와 같은 evaluateHand·compareScores로 계산한다.
const SUIT_OF: Record<string, CardSuit> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
const RANK_OF: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11 };
const card = (text: string): PlayingCard => ({ rank: RANK_OF[text.slice(0, -1)] ?? Number(text.slice(0, -1)), suit: SUIT_OF[text.slice(-1)] });
const cards = (text: string) => text.split(" ").map(card);

// 예시 한 판: 나는 선공(1·4번째), 상대는 후공(2·3번째).
const COMMUNITY = cards("K♥ 7♦ 2♣");
const BOARD = cards("A♠ K♠ 3♦ 9♣ Q♥ 5♠ 7♥ J♦ 4♣ 7♣ 10♥ 8♠ 6♦ 2♠ K♦ Q♣");
const PICKS: Array<[number, "나" | "상대"]> = [[1, "나"], [6, "상대"], [9, "상대"], [14, "나"]];
const handOf = (who: "나" | "상대") => PICKS.filter(([, w]) => w === who).map(([i]) => BOARD[i]);
const MINE = evaluateHand([...COMMUNITY, ...handOf("나")]), THEIRS = evaluateHand([...COMMUNITY, ...handOf("상대")]);
const I_WIN = compareScores(MINE.score, THEIRS.score) > 0;
const texts = (list: PlayingCard[]) => list.map(cardText).join(" ");

const Card = ({ c, picked, mini }: { c: PlayingCard; picked?: boolean; mini?: boolean }) =>
  <span className={`holdem-card${picked ? " picked" : ""}${mini ? " mini" : ""}`}><PlayingCardFace text={cardText(c)} mini={mini}/></span>;

function Community({ extra = [] }: { extra?: PlayingCard[] }) {
  return <div className="holdem-community guide-holdem-community"><small>공용 카드{extra.length ? " + 내가 고른 2장" : ""}</small>
    <div className="holdem-row">{COMMUNITY.map((c, i) => <Card key={i} c={c}/>)}{extra.map((c, i) => <Card key={`p${i}`} c={c} picked/>)}</div>
  </div>;
}

/** MemoryCard와 같은 마크업. 실제 컴포넌트는 뒤집힐 때 소리를 내므로 그림에서는 정적으로 그린다. */
function Board({ faceUp, owners = false }: { faceUp: boolean; owners?: boolean }) {
  return <div className="memory-board guide-holdem-board">{BOARD.map((c, i) => {
    const owner = owners ? PICKS.find(([index]) => index === i)?.[1] : undefined, label = String.fromCharCode(65 + i);
    return <span key={i} className={`memory-card${faceUp ? " is-face-up" : ""}${owner ? owner === "나" ? " owned-mine" : " owned-opponent" : ""}`}>
      <span className="memory-card-inner">
        <span className="memory-card-face memory-card-back"><small>{label}</small><strong>{label}</strong></span>
        <span className="memory-card-face memory-card-front"><PlayingCardFace text={cardText(c)} position={label}/></span>
      </span>
      {owner && <em className="memory-card-badge">{owner}</em>}
    </span>;
  })}</div>;
}

function Hero() {
  return <div className="holdem-game guide-holdem"><Community extra={handOf("나")}/><p className="guide-holdem-label">{MINE.label}</p></div>;
}

function Coin() {
  return <section className="holdem-coin guide-holdem-coin"><p className="eyebrow">COIN TOSS</p><strong>동전 던지기에서 이겼습니다</strong>
    <p className="muted">선공은 첫 번째와 네 번째, 후공은 두 번째와 세 번째 카드를 고릅니다.</p>
    <div className="holdem-roles"><button className="primary">선공</button><button className="secondary">후공</button></div>
  </section>;
}

function PickOrder() {
  return <div className="holdem-game guide-holdem">
    <ol className="guide-holdem-order">{PICKS.map(([, who], n) => <li key={n} className={who === "나" ? "me" : ""}><small>{n + 1}번째</small><b>{who === "나" ? "선공" : "후공"}</b></li>)}</ol>
    <Board faceUp={false} owners/>
  </div>;
}

function Showdown() {
  const seats: Array<["나" | "상대", typeof MINE, boolean]> = [["나", MINE, I_WIN], ["상대", THEIRS, !I_WIN]];
  return <section className={`holdem-showdown guide-holdem-showdown ${I_WIN ? "win" : "lose"}`}>
    <p className="eyebrow">SHOWDOWN · {I_WIN ? "승리" : "패배"}</p>
    <strong>{I_WIN ? MINE.label : THEIRS.label} &gt; {I_WIN ? THEIRS.label : MINE.label}</strong>
    <div className="holdem-hands">{seats.map(([who, hand, won]) => <article key={who} className={won ? "won" : ""}>
      <small>{who} · {who === "나" ? "선공" : "후공"}</small>
      <div className="holdem-row">{COMMUNITY.map((c, i) => <Card key={i} c={c} mini/>)}{handOf(who).map((c, i) => <Card key={`p${i}`} c={c} picked mini/>)}</div>
      <b>{hand.label}</b>
    </article>)}</div>
  </section>;
}

// 족보 사다리: 실제 판정 점수로 정렬하므로 순서가 규칙과 어긋나면 그림에 그대로 드러난다.
const LADDER = ([
  ["스트레이트 플러시", "9♠ 8♠ 7♠ 6♠ 5♠"], ["포카드", "Q♠ Q♥ Q♦ Q♣ 3♠"], ["풀하우스", "J♠ J♥ J♦ 4♣ 4♠"],
  ["플러시", "A♦ J♦ 8♦ 6♦ 2♦"], ["스트레이트", "10♣ 9♦ 8♥ 7♠ 6♣"], ["트리플", "8♠ 8♥ 8♦ K♣ 3♠"],
  ["투페어", "10♠ 10♥ 5♦ 5♣ A♠"], ["원페어", "9♠ 9♥ A♦ 7♣ 4♠"], ["하이카드", "A♠ Q♦ 9♥ 6♣ 3♠"],
] as const).map(([name, text]) => ({ name, hand: cards(text), result: evaluateHand(cards(text)) }))
  .sort((a, b) => compareScores(b.result.score, a.result.score));
const SUIT_RANK = (Object.keys(SUIT_ORDER) as CardSuit[]).sort((a, b) => SUIT_ORDER[b] - SUIT_ORDER[a]).map(s => cardText({ rank: 2, suit: s }).slice(-1));
function HandRanking() {
  return <div className="guide-holdem-ladder">
    <ol>{LADDER.map(({ name, hand, result }) => <li key={name}>
      <span><b>{name}</b><small>{result.label}</small></span>
      <span className="holdem-row">{hand.map((c, i) => <Card key={i} c={c} mini/>)}</span>
    </li>)}</ol>
    <p>무늬 순위 <b>{SUIT_RANK.join(" > ")}</b></p>
  </div>;
}

export const memoryHoldemGuide: GameGuide = {
  overview: {
    figure: <Hero/>, label: `공용 카드 ${texts(COMMUNITY)}에 내가 고른 ${texts(handOf("나"))}를 더해 ${MINE.label}.`,
    goal: "16장의 위치를 외워 두었다가, 공용 카드 3장과 어울리는 카드 2장을 골라 더 높은 족보를 만듭니다.",
    win: "한 판을 이기면 1승, 먼저 3승을 거두면 이깁니다. 무승부는 없습니다.",
    essentials: [
      "카드 16장을 30초 동안 외운 뒤, 뒤집힌 카드 중에서 기억으로 골라야 합니다.",
      "선공 1장 → 후공 2장 → 선공 1장 순서로 고르고, 앞면은 네 장을 다 고른 뒤 함께 공개합니다.",
      "족보가 같으면 숫자, 숫자도 같으면 무늬(♠ > ♦ > ♥ > ♣)로 승부가 갈립니다.",
    ],
  },
  steps: [
    { title: "순서 정하기", body: "첫 판은 동전 던지기에서 이긴 사람이, 다음 판부터는 직전 판에서 진 사람이 선공과 후공 중 하나를 고릅니다.",
      figure: <Coin/>, label: "동전 던지기에서 이긴 사람이 선공 또는 후공을 고른다. 선공은 첫 번째와 네 번째, 후공은 두 번째와 세 번째 카드를 고른다." },
    { title: "30초 동안 16장 외우기", body: "카드 16장이 30초 동안 공개됩니다. 두 사람이 같은 위치에서 같은 카드를 봅니다.",
      figure: <div className="holdem-game guide-holdem"><Board faceUp/></div>, label: `앞면이 보이는 4×4 카드: ${BOARD.map((c, i) => `${String.fromCharCode(65 + i)} ${cardText(c)}`).join(", ")}.` },
    { title: "뒤집히고 공용 카드 공개", body: "30초가 지나면 카드가 제자리에서 뒤집히고, 남은 카드 중 공용 카드 3장이 공개됩니다. 공용 카드와 어울릴 카드가 어디 있었는지 떠올리세요.",
      figure: <div className="holdem-game guide-holdem"><Community/><Board faceUp={false}/></div>, label: `공용 카드 ${texts(COMMUNITY)}가 공개되고 16장은 A부터 P까지 뒷면으로 뒤집혔다.` },
    { title: "선 1장 → 후 2장 → 선 1장", body: "한 장당 15초 안에 고릅니다. 고른 칸은 바로 잠기고 누가 가져갔는지 표시되지만, 앞면은 네 번째 선택이 끝날 때까지 보이지 않습니다.",
      figure: <PickOrder/>, label: `고르는 순서: ${PICKS.map(([i, who], n) => `${n + 1}번째 ${who === "나" ? "선공" : "후공"}이 ${String.fromCharCode(65 + i)}`).join(", ")}.` },
    { title: "앞면 공개, 족보 비교", body: "네 장을 다 고르면 앞면을 공개하고 공용 카드 3장과 각자 고른 2장으로 족보를 비교합니다. 이긴 사람이 1승을 얻습니다.",
      figure: <Showdown/>, label: `나: ${texts(handOf("나"))}로 ${MINE.label}. 상대: ${texts(handOf("상대"))}로 ${THEIRS.label}. ${I_WIN ? "내가" : "상대가"} 이긴다.` },
  ],
  rules: [
    { title: "목표와 5판 3선승", items: ["4×4로 펼친 카드 16장의 위치를 기억한 뒤, 공용 카드 3장에 내가 고른 2장을 더해 상대보다 높은 포커 족보를 만드세요.", "한 판을 이기면 1승이며 먼저 3승을 거둔 플레이어가 경기에서 승리합니다. 무승부는 없어 최대 5판 안에 승부가 납니다."] },
    { title: "한 판의 진행", items: ["첫 판은 동전 던지기에서 이긴 플레이어가 선공과 후공 중 하나를 고릅니다. 다음 판부터는 직전 판에서 진 플레이어가 선공과 후공 중 하나를 고릅니다. 10초 안에 고르지 않으면 무작위로 정해집니다.", "조커를 뺀 52장을 새로 섞어 16장을 30초 동안 공개합니다. 두 플레이어는 같은 위치에서 같은 카드를 봅니다.", "30초 뒤 카드가 제자리에서 뒤집히고, 남은 36장 중 공용 카드 3장이 공개됩니다.", "선공 1장 → 후공 2장 연속 → 선공 1장 순서로 카드를 고릅니다. 한 장당 15초이며 시간이 끝나면 남은 카드 중 한 장이 무작위로 선택됩니다. 고른 칸은 바로 잠기고 누가 가져갔는지 표시되지만 앞면은 네 번째 선택이 끝난 뒤 함께 공개됩니다."] },
    { title: "족보와 승패", items: ["높은 순서대로 스트레이트 플러시 → 포카드 → 풀하우스 → 플러시 → 스트레이트 → 트리플 → 투페어 → 원페어 → 하이카드입니다. 로열 플러시는 가장 높은 스트레이트 플러시입니다.", "같은 족보끼리는 족보를 이루는 숫자, 그다음 남은 카드(키커)를 높은 순서대로 비교합니다. 투페어는 높은 페어 → 낮은 페어 → 키커, 풀하우스는 트리플 → 페어 순서입니다.", "A-2-3-4-5는 5가 가장 높은 스트레이트입니다.", "숫자가 모두 같으면 무늬로 승패를 정합니다. 무늬는 스페이드 → 다이아 → 하트 → 클로버 순으로 높고, 족보를 이루는 카드부터 키커까지 높은 순서대로 한 장씩 비교해 처음으로 무늬가 다른 카드에서 승부가 갈립니다.", "연습 봇은 카드를 기억하지 않고 남은 칸에서 무작위로 고릅니다."],
      example: { title: "족보 사다리", body: "위에 있을수록 높은 족보입니다. 같은 족보끼리는 숫자, 그다음 무늬 순서로 비교합니다.",
        figure: <HandRanking/>, label: `높은 순서: ${LADDER.map(({ name, hand }) => `${name}(${texts(hand)})`).join(", ")}. 무늬 순위 ${SUIT_RANK.join(", ")}.` } },
  ],
};
