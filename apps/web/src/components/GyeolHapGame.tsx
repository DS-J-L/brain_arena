import { useEffect, useRef, useState } from "react";
import { HAP_ROUNDS, HAP_STALL_TURNS, type GyeolHapView, type HapAttempt, type HapCheck, type HapTile } from "@brain-arena/shared";

const shapes = { CIRCLE: "원", STAR: "별", TRIANGLE: "삼각형", SQUARE: "사각형", SUN: "해" };
const colors = { PURPLE: "보라", GREEN: "녹색", ORANGE: "주황", YELLOW: "노랑" };
const backgrounds = { BLACK: "검정", GRAY: "회색", WHITE: "하양" };
const fills = { PURPLE: "#b969f5", GREEN: "#38ce84", ORANGE: "#ff8a32", YELLOW: "#ffe345" };
const backgroundFills = { BLACK: "#111116", GRAY: "#777984", WHITE: "#faf9fc" };
const reasons: Record<HapAttempt["reason"], string> = {
  NEW_HAP: "새로운 합", NOT_HAP: "합이 아닙니다", DUPLICATE: "이미 찾은 합",
  GYEOL: "결 정답 · 남은 합 없음", WRONG_GYEOL: "결 오답 · 아직 남은 합이 있습니다",
  PASS: "시간 초과 · 패스", TIMEOUT: "합 제출 시간 초과",
};

function HapShape({ tile }: { tile: HapTile }) {
  const stroke = tile.backgroundColor === "BLACK" ? "#f8f4ff" : "#24212a";
  return <svg viewBox="0 0 80 80" aria-hidden="true" fill={fills[tile.shapeColor]} stroke={stroke} strokeWidth="1.7" strokeLinejoin="round">
    {tile.shape === "CIRCLE" && <circle cx="40" cy="40" r="23" />}
    {tile.shape === "STAR" && <polygon points="40,10 47,30 69,31 52,45 58,67 40,54 22,67 28,45 11,31 33,30" />}
    {tile.shape === "TRIANGLE" && <polygon points="40,12 69,65 11,65" />}
    {tile.shape === "SQUARE" && <rect x="17" y="17" width="46" height="46" rx="1" />}
    {tile.shape === "SUN" && <>
      {Array.from({ length: 12 }, (_, i) => <path key={i} d="M40 10 L40 20" transform={`rotate(${i * 30} 40 40)`} stroke={fills[tile.shapeColor]} strokeWidth="4" strokeLinecap="round" />)}
      <circle cx="40" cy="40" r="14" />
    </>}
  </svg>;
}

function HapBoard({ board, selected = [], interactive = false, onPick }: { board: HapTile[]; selected?: number[]; interactive?: boolean; onPick?: (n: number) => void }) {
  return <div className="hap-board" role="group" aria-label="결! 합! 타일 보드">
    {board.map((tile, index) => {
      const number = index + 1, chosen = selected.includes(number);
      return <button key={number} className={`hap-tile ${chosen ? "is-selected" : ""}`} style={{ background: backgroundFills[tile.backgroundColor], color: tile.backgroundColor === "WHITE" ? "#17121e" : "#fff" }}
        disabled={!interactive || (!chosen && selected.length === 3)} aria-pressed={chosen}
        aria-label={`${number}번 · ${shapes[tile.shape]} · ${colors[tile.shapeColor]} · ${backgrounds[tile.backgroundColor]} 배경`}
        onClick={() => onPick?.(number)}>
        <span className="hap-tile-number">{number}</span><HapShape tile={tile} />
        {chosen && <span className="hap-selected" aria-hidden="true">✓</span>}
      </button>;
    })}
  </div>;
}

function Checks({ checks }: { checks: HapCheck }) {
  const labels = { shape: "모양", shapeColor: "도형 색", backgroundColor: "배경 색" };
  return <div className="hap-checks">{(Object.keys(labels) as Array<keyof HapCheck>).map(key => <span key={key} className={checks[key] === "TWO_SAME" ? "failed" : "passed"}>
    {labels[key]}: {checks[key] === "SAME" ? "모두 같음 ✓" : checks[key] === "DIFFERENT" ? "모두 다름 ✓" : "두 개만 같음 ✕"}
  </span>)}</div>;
}

export function GyeolHapGame({ game, playerId, opponentName, emit }: { game: GyeolHapView; playerId: string; opponentName: string; emit: (event: string, payload?: object) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const submitted = useRef(false);
  useEffect(() => { setSelected([]); submitted.current = false; }, [game.round, game.turnId, game.phase]);
  const mine = game.currentPlayerId === playerId;
  const live = game.deadline !== null && Date.now() < game.deadline && !game.winnerId;
  const choosing = mine && game.phase === "SELECT" && live;
  const deciding = mine && game.phase === "TURN" && live;
  const opponentId = Object.keys(game.scores).find(id => id !== playerId)!;
  const status = game.phase === "ROUND_END" ? game.round === HAP_ROUNDS ? "3라운드 종료 · 최종 점수 집계 중" : game.lastResult?.reason === "GYEOL" ? "결 성공 · 다음 보드 준비 중" : "4턴 동안 새 합을 못 찾았습니다 · 다음 보드 준비 중" : game.phase === "RESULT" ? "판정 결과 확인 중"
    : game.phase === "SELECT" ? mine ? selected.length === 3 ? "판정 중입니다" : "5초 안에 타일 3개를 고르면 바로 판정합니다" : `${opponentName}님이 합을 선택 중입니다`
      : mine ? "내 차례 · 합을 찾거나 결을 선언하세요" : `${opponentName}님의 차례`;
  const send = (type: string, numbers?: number[]) => emit("game:action", { type, payload: { round: game.round, turnId: game.turnId, ...(numbers ? { numbers } : {}) } });
  const pick = (number: number) => {
    if (!choosing || submitted.current) return;
    const next = selected.includes(number) ? selected.filter(n => n !== number) : [...selected, number];
    setSelected(next);
    if (next.length === 3) {
      submitted.current = true;
      send("SUBMIT_HAP", next);
    }
  };
  return <div className="hap-game">
    <div className="hap-scores"><div><small>나</small><strong>{game.scores[playerId]}<em>점</em></strong></div><p role="status">{status}</p><div><small>{opponentName}</small><strong>{game.scores[opponentId]}<em>점</em></strong></div></div>
    <HapBoard board={game.board} selected={selected} interactive={choosing && selected.length < 3} onPick={pick} />
    <div className="hap-actions"><button className="secondary" disabled={!deciding} onClick={() => send("GYEOL")}>결!<small>남은 합이 없다면 +3점</small></button><button className="primary" disabled={!deciding} onClick={() => send("HAP")}>합!<small>새로운 합을 찾았다면 +1점</small></button></div>
    {game.phase === "SELECT" && mine && <div className="hap-submit"><p>선택한 타일 <b>{selected.length ? [...selected].sort((a, b) => a - b).join(" · ") : "없음"}</b><span>{selected.length}/3</span></p></div>}
    {game.lastResult && <div className={`hap-result ${game.lastResult.delta < 0 ? "wrong" : "correct"}`} role="status">
      <strong>{game.lastResult.playerId === playerId ? "나" : opponentName} · {reasons[game.lastResult.reason]} · {game.lastResult.delta > 0 ? "+" : ""}{game.lastResult.delta}점</strong>
      {game.lastResult.numbers.length > 0 && <p>{game.lastResult.numbers.join(" · ")}</p>}
      {game.lastResult.checks && <Checks checks={game.lastResult.checks} />}
    </div>}
    <section className="hap-found"><h3>이번 라운드에서 찾은 합 <span>{game.foundHaps.length}개</span></h3>
      {game.foundHaps.length === 0 ? <p className="muted">아직 찾은 합이 없습니다.</p> : <ul>{game.foundHaps.map(found => <li key={found.numbers.join(",")}><b>{found.numbers.join(" · ")}</b><span>{found.playerId === playerId ? "나" : opponentName}</span></li>)}</ul>}
      <p className="hap-hint">속성마다 모두 같거나 모두 달라야 합입니다. 찾은 타일도 다시 사용할 수 있습니다.</p><p className="hap-hint">새 합을 못 찾은 차례 {game.unsuccessfulTurns}/{HAP_STALL_TURNS} · 합이 남아 있으면 4턴 후 새 보드로 넘어갑니다.</p><p className="hap-hint">총 3라운드 누적 점수 대결 · 10초 무응답은 패스, 합 선언 후 5초 초과는 −1점</p>
    </section>
  </div>;
}

export function GyeolHapReview({ game, playerId, opponentName }: { game: GyeolHapView; playerId: string; opponentName: string }) {
  return <section className="match-review hap-review"><div className="review-heading"><div><p className="eyebrow">MATCH REVIEW</p><h2>놓친 합과 판정 복기</h2></div><p>라운드를 열어 보드와 답변의 속성별 판정 이유를 확인하세요.</p></div>
    {game.history.map(round => <details key={round.round}><summary>{round.round}라운드 · 찾은 합 {round.foundHaps.length}개 · 놓친 합 {round.missedHaps.length}개 · {round.endReason === "GYEOL" ? "결 성공" : round.endReason === "STALLED" ? "4턴 동안 새 합 없음" : "기권 종료"}</summary>
      <HapBoard board={round.board} />
      <h3>놓친 합</h3>{round.missedHaps.length === 0 ? <p>모든 합을 찾았습니다.</p> : round.missedHaps.map(answer => <div className="hap-review-answer" key={answer.numbers.join(",")}><strong>{answer.numbers.join(" · ")}</strong><Checks checks={answer.checks} /></div>)}
      <h3>제출과 진행 기록</h3>{round.attempts.map((attempt, index) => <div className="hap-review-answer" key={index}><p>{attempt.playerId === playerId ? "나" : opponentName} · {attempt.numbers.join(" · ")} {reasons[attempt.reason]} · {attempt.delta > 0 ? "+" : ""}{attempt.delta}점</p>{attempt.checks && <Checks checks={attempt.checks} />}</div>)}
    </details>)}
  </section>;
}
