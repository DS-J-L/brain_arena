import { cardText, type HoldemHandReview, type MemoryHoldemView, type PlayingCard } from "@brain-arena/shared";
import { MemoryCard } from "./MemoryCard";

interface Props { game: MemoryHoldemView; playerId: string; opponentName: string; emit: (event: string, payload?: object) => void }

const isRed = (card: PlayingCard) => card.suit === "H" || card.suit === "D";
const Card = ({ card, mine }: { card: PlayingCard; mine?: boolean }) => <span className={`holdem-card${isRed(card) ? " red-suit" : ""}${mine ? " picked" : ""}`}>{cardText(card)}</span>;

function HandPanel({ review, playerId, opponentName }: { review: HoldemHandReview; playerId: string; opponentName: string }) {
  const opponentId = Object.keys(review.seats).find(id => id !== playerId);
  const outcome = review.winnerId === null ? "draw" : review.winnerId === playerId ? "win" : "lose";
  return <section className={`holdem-showdown ${outcome}`}>
    <p className="eyebrow">{review.hand}번째 판 · {outcome === "draw" ? "무승부" : outcome === "win" ? "승리" : "패배"}</p>
    <strong>{review.reason}</strong>
    <div className="holdem-hands">{[playerId, opponentId].map(id => {
      const seat = id ? review.seats[id] : undefined;
      if (!id || !seat) return null;
      return <article key={id} className={review.winnerId === id ? "won" : ""}>
        <small>{id === playerId ? "나" : opponentName} · {review.firstPlayerId === id ? "선공" : "후공"}</small>
        <div className="holdem-row">{review.community.map((card, index) => <Card key={index} card={card}/>)}{seat.cards.map((card, index) => <Card key={`p${index}`} card={card} mine/>)}</div>
        <b>{seat.label}</b>
      </article>;
    })}</div>
  </section>;
}

export function MemoryHoldemGame({ game, playerId, opponentName, emit }: Props) {
  const opponentId = Object.keys(game.wins).find(id => id !== playerId) ?? "";
  const iAmFirst = game.firstPlayerId === playerId, myTurn = game.phase === "PICK" && game.currentPlayerId === playerId, choosing = game.phase === "COIN" && game.chooserId === playerId;
  const count = (id: string) => game.owners.filter(owner => owner === id).length;
  const role = (id: string) => game.firstPlayerId === null ? "" : game.firstPlayerId === id ? "선공" : "후공";
  const phaseText = game.phase === "COIN" ? (choosing ? "선공과 후공 중 하나를 고르세요" : `${opponentName} 님이 순서를 고르는 중`)
    : game.phase === "MEMORIZE" ? `나는 ${role(playerId)} · 카드 16장의 위치를 기억하세요`
    : game.phase === "PICK" ? (myTurn ? (game.pickNumber === 3 ? "내 차례 · 두 번째 카드를 고르세요" : "내 차례 · 카드 한 장을 고르세요") : `상대 차례 · ${opponentName} 님이 고르는 중`)
    : game.winnerId ? "경기 종료" : "패 공개 · 곧 다음 판이 시작돼요";

  return <div className="holdem-game">
    <div className="find-score"><b>{game.wins[playerId] ?? 0}</b><span>먼저 {game.targetWins}승 · {phaseText}</span><b>{game.wins[opponentId] ?? 0}</b></div>

    {game.phase === "COIN" && <section className="holdem-coin">
      <p className="eyebrow">{game.hand === 1 ? "COIN TOSS" : `${game.hand}번째 판 · 선택권 교대`}</p>
      <strong>{game.hand === 1 ? (choosing ? "동전 던지기에서 이겼어요" : `${opponentName} 님이 동전 던지기에서 이겼어요`) : (choosing ? "이번 판은 내가 순서를 골라요" : `이번 판은 ${opponentName} 님이 순서를 골라요`)}</strong>
      <p className="muted">선공은 첫 번째와 네 번째, 후공은 두 번째와 세 번째 카드를 골라요.</p>
      {choosing && <div className="holdem-roles">
        <button className="primary" onClick={() => emit("game:action", { type: "CHOOSE_ROLE", payload: { role: "FIRST" } })}>선공</button>
        <button className="secondary" onClick={() => emit("game:action", { type: "CHOOSE_ROLE", payload: { role: "SECOND" } })}>후공</button>
      </div>}
    </section>}

    {game.phase !== "COIN" && <>
      <div className="holdem-community">
        <small>공용 카드</small>
        <div className="holdem-row">{game.community.length ? game.community.map((card, index) => <Card key={index} card={card}/>) : [0, 1, 2].map(index => <span key={index} className="holdem-card hidden">?</span>)}</div>
      </div>
      <div className={`memory-board ${game.phase === "MEMORIZE" ? "memorizing" : ""}`}>{game.board.map((card, index) => {
        const owner = game.owners[index];
        return <MemoryCard key={index} index={index} value={card ? cardText(card) : null} selectionOrder={0}
          tone={`${card && isRed(card) ? "red-suit" : ""}${owner ? owner === playerId ? " owned-mine" : " owned-opponent" : ""}`}
          badge={owner ? owner === playerId ? "나" : "상대" : undefined}
          disabled={!myTurn || owner !== null}
          onPick={() => emit("game:action", { type: "PICK_CARD", payload: { index, hand: game.hand, pick: game.pickNumber } })}/>;
      })}</div>
      {game.phase === "MEMORIZE" && <p className="memory-hint">30초 후 카드가 뒤집히고 공용 카드 3장이 공개됩니다.</p>}
      {game.phase === "PICK" && <p className="holdem-progress"><span>나 ({role(playerId)}) {count(playerId)} / 2장</span><span>{game.pickNumber} / 4번째 선택</span><span>{opponentName} ({role(opponentId)}) {count(opponentId)} / 2장</span></p>}
      {game.phase === "SHOWDOWN" && game.showdown && <HandPanel review={game.showdown} playerId={playerId} opponentName={opponentName}/>}
    </>}
    {game.phase !== "SHOWDOWN" && game.history.length > 0 && <p className="holdem-progress holdem-past">{game.history.map(review => <span key={review.hand}>{review.hand}판 {review.winnerId === null ? "무" : review.winnerId === playerId ? "승" : "패"}</span>)}</p>}
    {iAmFirst && game.phase === "PICK" && game.pickNumber === 1 && myTurn && <p className="memory-hint">첫 카드를 고른 뒤에는 상대가 두 장을 연속으로 골라요.</p>}
  </div>;
}

export function MemoryHoldemReview({ game, playerId, opponentName }: { game: MemoryHoldemView; playerId: string; opponentName: string }) {
  return <section className="match-review">
    <div className="review-heading"><div><p className="eyebrow">FULL MATCH REVIEW</p><h2>판별 기록</h2></div><p>공용 카드 3장과 각자 고른 2장(라임색 테두리)으로 만든 족보입니다.</p></div>
    {game.history.map(review => <HandPanel key={review.hand} review={review} playerId={playerId} opponentName={opponentName}/>)}
  </section>;
}
