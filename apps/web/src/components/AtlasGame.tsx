import { useEffect, useState } from "react";
import { ATLAS_COLORS, ATLAS_COLOR_NAMES, ATLAS_TOKENS, type AtlasColor, type AtlasPlacement, type AtlasRoundReview, type AtlasToken, type AtlasView } from "@brain-arena/shared";

interface Props { game: AtlasView; playerId: string; nameOf: (id: string) => string; emit: (event: string, payload?: object) => void }
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const tokenClass = (token: AtlasToken) => token.toLowerCase();

/** 판을 머리 위로 든 거인. 색은 currentColor를 따른다. */
function GiantFigure() {
  return <svg className="atlas-figure" viewBox="0 0 80 70" aria-hidden="true">
    <path d="M14 4 L22 28 M66 4 L58 28" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none"/>
    <circle cx="40" cy="20" r="10" fill="currentColor"/>
    <path d="M20 34 Q40 24 60 34 L54 70 L26 70 Z" fill="currentColor"/>
  </svg>;
}

export function Giant({ color, blocks, limit, preview, collapsed, onPick }: { color: AtlasColor; blocks: number[]; limit: number; preview: number | null; collapsed?: AtlasPlacement; onPick?: () => void }) {
  const total = sum(blocks), next = preview === null ? null : total + preview, breaks = next !== null && next > limit;
  const Tag = onPick ? "button" : "article";
  return <Tag className={`atlas-giant ${color.toLowerCase()}${breaks ? " danger" : ""}${collapsed ? " collapsed" : ""}${onPick ? " pickable" : ""}`} onClick={onPick}>
    <div className="atlas-stack" aria-label={`${ATLAS_COLOR_NAMES[color]} 거인 블록 ${blocks.join(", ") || "없음"}`}>
      {preview !== null && <span className="atlas-block ghost">{preview}</span>}
      {[...blocks].reverse().map((value, index) => <span key={blocks.length - index} className="atlas-block">{value}</span>)}
      {collapsed && <span className="atlas-rubble">무너짐 · {collapsed.blocks.join("+")}={collapsed.total}</span>}
    </div>
    <div className="atlas-plate"/>
    <GiantFigure/>
    <strong>{ATLAS_COLOR_NAMES[color]} 거인</strong>
    <div className="atlas-meter" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(total, limit)}>
      <i style={{ width: `${Math.min(total, limit) / limit * 100}%` }}/>
    </div>
    <small>{next === null ? `합 ${total} / ${limit} · 여유 ${limit - total}` : breaks ? `합 ${next} · 무너짐! 벌점 ${blocks.length + 1}` : `합 ${total} → ${next} / ${limit}`}</small>
    {onPick && <em className="atlas-pick">여기에 올리기</em>}
  </Tag>;
}

const Token = ({ token }: { token: AtlasToken }) => <i className={`atlas-token-dot ${tokenClass(token)}`} title={ATLAS_COLOR_NAMES[token]}/>;

/** 이번 라운드: 공개된 제출을 올리는 순서대로. 이미 올린 블록은 결과까지 보여준다. */
function RoundBoard({ game, playerId, nameOf }: { game: AtlasView; playerId: string; nameOf: (id: string) => string }) {
  const byId = new Map(game.submissions?.map(s => [s.playerId, s]));
  const rows = [...game.placements.map(p => ({ id: p.playerId, placement: p as AtlasPlacement | undefined })), ...game.queue.map(id => ({ id, placement: undefined }))];
  return <section className="atlas-reveal">
    <p className="eyebrow">ROUND {game.round} · 올리는 순서{game.passedIds.length ? ` · 패스: ${game.passedIds.map(nameOf).join(", ")}` : ""}</p>
    <ol className="atlas-placements">{rows.map(({ id, placement }, index) => {
      const submission = byId.get(id)!, current = id === game.currentPlacerId;
      return <li key={id} className={`${tokenClass(placement?.color ?? submission.token)}${placement?.collapsed ? " collapsed" : ""}${id === playerId ? " mine" : ""}${current ? " current" : ""}${!placement && !current ? " waiting" : ""}`}>
        <b>{index + 1}</b>
        <span>{nameOf(id)}{id === game.leadPlayerId && <em> · 선</em>}{placement?.auto && <em> · 시간 초과</em>}</span>
        <strong><i className="atlas-chip">{submission.number}</i> <Token token={submission.token}/> {placement ? `→ ${ATLAS_COLOR_NAMES[placement.color]}` : ATLAS_COLOR_NAMES[submission.token]}</strong>
        <small>{placement ? placement.collapsed ? `합 ${placement.total} · 무너짐 · 벌점 +${placement.penalty}` : `합 ${placement.total}` : current ? "결정 중" : "대기"}</small>
      </li>;
    })}</ol>
  </section>;
}

export function AtlasGame({ game, playerId, nameOf, emit }: Props) {
  const [number, setNumber] = useState<number | null>(null), [token, setToken] = useState<AtlasToken | null>(null);
  useEffect(() => { setNumber(null); setToken(null); }, [game.round]);
  const hand = game.myHand, submitted = game.mySubmission, submitting = game.phase === "SUBMIT" && !submitted;
  const myTurn = game.phase === "PLACE" && game.currentPlacerId === playerId;
  const act = (type: string, extra: object = {}) => emit("game:action", { type, payload: { round: game.round, ...extra } });
  // 미리보기: 고르는 중이면 고른 블록, 내 올릴 차례면 내 블록. 무지개는 모든 거인에 보여 준다.
  const previewFor = (color: AtlasColor) => {
    const pending = submitting && number !== null && token !== null ? { number, token } : myTurn ? submitted : null;
    return pending && (pending.token === color || pending.token === "RAINBOW") ? pending.number : null;
  };
  const collapsedNow = (color: AtlasColor) => game.phase !== "SUBMIT" ? game.placements.filter(p => p.color === color && p.collapsed).at(-1) : undefined;
  const waiting = game.playerIds.length - game.submittedIds.length;
  const status = game.phase === "SUBMIT" ? submitted ? `제출 완료 · ${waiting}명을 기다리는 중` : "숫자 블록 하나와 토큰 하나를 고르세요"
    : game.phase === "PLACE" ? myTurn ? game.needsColor ? "내 차례 · 무지개 블록을 올릴 거인을 고르세요" : "내 차례 · 블록을 올리거나 패스하세요" : `${nameOf(game.currentPlacerId ?? "")} 님이 결정하는 중`
    : "라운드 결과";

  return <div className="atlas-game">
    <ol className="atlas-players" aria-label="플레이어 벌점">{game.playerIds.map(id => {
      const done = game.submittedIds.includes(id);
      return <li key={id} className={`${id === playerId ? "is-me" : ""}${(done && game.phase === "SUBMIT") || id === game.currentPlacerId ? " is-done" : ""}`}>
        <small>{nameOf(id)}{id === game.leadPlayerId && <em title="같은 숫자끼리는 선부터 오른쪽 순서로 올립니다"> · 선</em>}</small>
        <strong>{game.scores[id] ?? 0}<em>벌점</em></strong>
        {game.phase === "SUBMIT" && <b className="atlas-flag">{done ? "제출" : "고민 중"}</b>}
        {id === game.currentPlacerId && <b className="atlas-flag">차례</b>}
      </li>;
    })}</ol>
    <p className="multi-status" role="status">라운드 {game.round} / {game.totalRounds} · {game.limit + 1} 이상이면 무너짐 · {status}{game.round < game.refillRound ? ` · ${game.refillRound}라운드에 블록과 토큰을 새로 받습니다` : ""}</p>

    <div className="atlas-giants">{ATLAS_COLORS.map(color => <Giant key={color} color={color} blocks={game.giants[color]} limit={game.limit}
      preview={previewFor(color)} collapsed={collapsedNow(color)} onPick={myTurn && game.needsColor ? () => act("PLACE", { color }) : undefined}/>)}</div>

    {game.phase !== "SUBMIT" && <RoundBoard game={game} playerId={playerId} nameOf={nameOf}/>}

    {myTurn && <div className="atlas-decision">
      {!game.needsColor && <button className="primary" onClick={() => act("PLACE")}>{submitted ? `${submitted.number}을(를) ${ATLAS_COLOR_NAMES[submitted.token]} 거인에 올리기` : "올리기"}</button>}
      {game.canPass && <button className="secondary" onClick={() => act("PASS")}>패스 · {game.passedIds.length ? "작은 숫자부터 올리기" : "다음 사람부터 올리기"}</button>}
    </div>}

    {(game.phase === "SUBMIT" || game.phase === "PLACE") && <section className="atlas-hand">
      <p className="eyebrow">MY BLOCKS · 나만 볼 수 있습니다</p>
      <div className="atlas-numbers">{Array.from({ length: game.maxNumber + 1 }, (_, i) => i).map(n => {
        const chosen = number === n || submitted?.number === n;
        return <button key={n} aria-pressed={chosen} className={chosen ? "selected" : ""} disabled={!submitting || !hand.numbers.includes(n)} onClick={() => setNumber(n)}>{n}</button>;
      })}</div>
      <p className="eyebrow">MY TOKENS</p>
      <div className="atlas-tokens">{ATLAS_TOKENS.map(t => {
        const chosen = token === t || submitted?.token === t;
        return <button key={t} aria-pressed={chosen} className={`${tokenClass(t)}${chosen ? " selected" : ""}`} disabled={!submitting || hand.tokens[t] === 0} onClick={() => setToken(t)}>
          {ATLAS_COLOR_NAMES[t]} <small>×{hand.tokens[t]}</small></button>;
      })}</div>
      {game.phase === "SUBMIT" && <button className="primary full" disabled={!submitting || number === null || token === null} onClick={() => act("SUBMIT", { number, token })}>
        {submitted ? `${submitted.number} · ${ATLAS_COLOR_NAMES[submitted.token]} 제출 완료` : number !== null && token !== null ? `${number} · ${ATLAS_COLOR_NAMES[token]} 제출` : "블록과 토큰을 고르세요"}
      </button>}
      <p className="memory-hint">공개 후 큰 숫자부터 올립니다. 맨 먼저 올릴 사람은 패스할 수 있고, 두 번째로 패스하면 작은 숫자부터 올립니다. 무지개 토큰은 올릴 차례에 거인을 고릅니다.</p>
    </section>}
  </div>;
}

function ReviewRound({ round, nameOf, playerId }: { round: AtlasRoundReview; nameOf: (id: string) => string; playerId: string }) {
  return <div className="atlas-review-round">
    <small>R{round.round}</small>
    <div>
      <p className="atlas-review-meta">선 {nameOf(round.leadPlayerId)}{round.passedIds.length ? ` · 패스 ${round.passedIds.map(nameOf).join(", ")}` : ""}</p>
      <ol className="atlas-placements">{round.placements.map(p => <li key={p.order} className={`${p.color.toLowerCase()}${p.collapsed ? " collapsed" : ""}${p.playerId === playerId ? " mine" : ""}`}>
        <b>{p.order}</b>
        <span>{nameOf(p.playerId)}{p.auto && <em> · 시간 초과</em>}</span>
        <strong><i className="atlas-chip">{p.number}</i> <Token token={p.token}/> → {ATLAS_COLOR_NAMES[p.color]}</strong>
        <small>{p.collapsed ? `합 ${p.total} · 무너짐 · 벌점 +${p.penalty}` : `합 ${p.total}`}</small>
      </li>)}</ol>
    </div>
  </div>;
}

export function AtlasReview({ game, playerId, nameOf }: { game: AtlasView; playerId: string; nameOf: (id: string) => string }) {
  return <section className="match-review">
    <div className="review-heading"><div><p className="eyebrow">FULL MATCH REVIEW</p><h2>라운드 기록</h2></div><p>게임 중 볼 수 없던 모든 제출과 올린 순서, 거인을 무너뜨린 블록(붉은 테두리)입니다.</p></div>
    {game.history.map(round => <ReviewRound key={round.round} round={round} nameOf={nameOf} playerId={playerId}/>)}
  </section>;
}
