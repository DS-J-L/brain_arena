import { useEffect, useState, type ReactNode } from "react";
import { ATLAS_COLORS, ATLAS_COLOR_NAMES, ATLAS_TOKENS, type AtlasColor, type AtlasPlacement, type AtlasRoundReview, type AtlasToken, type AtlasView } from "@brain-arena/shared";
import { GameIcon } from "./GameIcon";

interface Props { game: AtlasView; playerId: string; nameOf: (id: string) => string; emit: (event: string, payload?: object) => void; remaining: number }
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const tokenClass = (token: AtlasToken) => token.toLowerCase();
const STEPS = ["선택", "공개", "배치"];

const Svg = ({ children, className }: { children: ReactNode; className?: string }) =>
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const ClockIcon = () => <Svg><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/></Svg>;
const LockIcon = () => <Svg><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Svg>;
const BotIcon = () => <Svg><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 13v1M15 13v1M2 14h2M20 14h2"/></Svg>;

/** 판을 머리 위로 든 거인. 색은 currentColor를 따른다. */
function GiantFigure() {
  return <svg className="atlas-figure" viewBox="0 0 80 70" aria-hidden="true">
    <path d="M14 4 L22 28 M66 4 L58 28" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none"/>
    <circle cx="40" cy="20" r="10" fill="currentColor"/>
    <path d="M20 34 Q40 24 60 34 L54 70 L26 70 Z" fill="currentColor"/>
  </svg>;
}

/** 거인 하나의 상태. preview가 있으면 그 블록을 올렸을 때의 합과 붕괴 여부를 미리 보여 준다. */
export function Giant({ color, blocks, limit, preview, collapsed, onPick }: { color: AtlasColor; blocks: number[]; limit: number; preview: number | null; collapsed?: AtlasPlacement; onPick?: () => void }) {
  const total = sum(blocks), next = preview === null ? null : total + preview, breaks = next !== null && next > limit;
  const room = limit - total, scale = (value: number) => `${Math.min(value, limit + 1) / (limit + 1) * 100}%`;
  const note = collapsed ? `붕괴 · ${collapsed.blocks.join("+")}=${collapsed.total} · 벌점 ${collapsed.penalty}`
    : next === null ? room === 0 ? "0만 더 버팀" : `추가 ${room}까지 버팀`
    : breaks ? `붕괴 예상 · 벌점 ${blocks.length + 1}` : `올린 뒤 추가 ${limit - next}까지 버팀`;
  const Tag = onPick ? "button" : "article";
  return <Tag className={`atlas-giant ${color.toLowerCase()}${preview !== null ? " targeted" : ""}${breaks ? " danger" : ""}${collapsed ? " collapsed" : ""}${onPick ? " pickable" : ""}`} onClick={onPick}>
    <header><i className="atlas-dot"/><strong>{ATLAS_COLOR_NAMES[color]} 거인</strong><small>블록 {blocks.length}개</small></header>
    <div className="atlas-stack" aria-label={`${ATLAS_COLOR_NAMES[color]} 거인 블록 ${blocks.join(", ") || "없음"}`}>
      {preview !== null && <span className="atlas-block ghost">+{preview}</span>}
      {[...blocks].reverse().map((value, index) => <span key={blocks.length - index} className="atlas-block">{value}</span>)}
      {!blocks.length && preview === null && <span className="atlas-empty">비어 있음</span>}
    </div>
    <div className="atlas-plate"/>
    <GiantFigure/>
    <div className="atlas-sum"><span>현재 합</span><b>{next !== null && <small>{total} →</small>}{next ?? total}</b></div>
    <div className="atlas-meter" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(total, limit)}>
      {next !== null && <i className="next" style={{ width: scale(next) }}/>}
      <i style={{ width: scale(total) }}/>
    </div>
    <p className="atlas-note">{note}</p>
    {onPick && <em className="atlas-pick">여기에 올리기</em>}
  </Tag>;
}

const Token = ({ token }: { token: AtlasToken }) => <i className={`atlas-token-dot ${tokenClass(token)}`} title={ATLAS_COLOR_NAMES[token]}/>;

/** 이번 라운드: 공개된 제출을 올리는 순서대로. 이미 올린 블록은 결과까지 보여준다. */
function RoundBoard({ game, playerId, nameOf }: { game: AtlasView; playerId: string; nameOf: (id: string) => string }) {
  const byId = new Map(game.submissions?.map(s => [s.playerId, s]));
  const rows = [...game.placements.map(p => ({ id: p.playerId, placement: p as AtlasPlacement | undefined })), ...game.queue.map(id => ({ id, placement: undefined }))];
  return <section className="atlas-panel atlas-reveal">
    <header className="atlas-panel-head"><h3>{game.phase === "RESULT" ? "라운드 결과" : "공개된 제출 · 올리는 순서"}</h3>{game.passedIds.length > 0 && <small>패스: {game.passedIds.map(nameOf).join(", ")}</small>}</header>
    <ol className="atlas-placements">{rows.map(({ id, placement }, index) => {
      const submission = byId.get(id)!, current = id === game.currentPlacerId;
      return <li key={id} className={`${tokenClass(placement?.color ?? submission.token)}${placement?.collapsed ? " collapsed" : ""}${id === playerId ? " mine" : ""}${current ? " current" : ""}${!placement && !current ? " waiting" : ""}`}>
        <b>{index + 1}</b>
        <span>{nameOf(id)}{id === game.leadPlayerId && <em> · 선</em>}{placement?.auto && <em> · 시간 초과</em>}</span>
        <strong><i className="atlas-chip">{submission.number}</i> <Token token={submission.token}/> {placement ? `→ ${ATLAS_COLOR_NAMES[placement.color]}` : ATLAS_COLOR_NAMES[submission.token]}</strong>
        <small>{placement ? placement.collapsed ? `합 ${placement.total} · 붕괴 · 벌점 +${placement.penalty}` : `합 ${placement.total}` : current ? "결정 중" : "대기"}</small>
      </li>;
    })}</ol>
  </section>;
}

export function AtlasGame({ game, playerId, nameOf, emit, remaining }: Props) {
  const [number, setNumber] = useState<number | null>(null), [token, setToken] = useState<AtlasToken | null>(null);
  useEffect(() => { setNumber(null); setToken(null); }, [game.round]);
  const hand = game.myHand, submitted = game.mySubmission, submitting = game.phase === "SUBMIT" && !submitted;
  const myTurn = game.phase === "PLACE" && game.currentPlacerId === playerId;
  const act = (type: string, extra: object = {}) => emit("game:action", { type, payload: { round: game.round, ...extra } });
  // 미리보기: 고르는 중이면 고른 블록, 내 올릴 차례면 내 블록. 무지개는 모든 거인에 보여 준다.
  const pending = submitting && number !== null && token !== null ? { number, token } : myTurn ? submitted : null;
  const previewFor = (color: AtlasColor) => pending && (pending.token === color || pending.token === "RAINBOW") ? pending.number : null;
  const collapsedNow = (color: AtlasColor) => game.phase !== "SUBMIT" ? game.placements.filter(p => p.color === color && p.collapsed).at(-1) : undefined;
  const waiting = game.playerIds.length - game.submittedIds.length;
  const step = game.phase === "SUBMIT" ? 0 : game.phase === "PLACE" ? game.placements.length ? 2 : 1 : 3;
  const placedIds = new Set(game.placements.map(p => p.playerId));

  // 내 선택 패널 아래쪽 한 줄 예상.
  const forecast = (pick: { number: number; token: AtlasToken }) => {
    if (pick.token === "RAINBOW") {
      const safe = ATLAS_COLORS.filter(c => sum(game.giants[c]) + pick.number <= game.limit).map(c => ATLAS_COLOR_NAMES[c]);
      return { line: `무지개 ${pick.number} · 배치 차례에 거인을 고릅니다`, sub: safe.length ? `지금 기준 버티는 거인: ${safe.join(", ")}` : "지금 기준 어느 거인에 올려도 붕괴합니다", danger: !safe.length };
    }
    const blocks = game.giants[pick.token], total = sum(blocks), next = total + pick.number, breaks = next > game.limit;
    return { line: `${ATLAS_COLOR_NAMES[pick.token]} ${total} + ${pick.number} = ${next} · ${breaks ? `붕괴 시 ${blocks.length + 1}벌점` : `추가 ${game.limit - next}까지 버팀`}`, sub: "현재 상태 기준 예상 · 공개 후 배치 순서에 따라 달라집니다", danger: breaks };
  };
  const info = game.phase === "SUBMIT"
    ? submitted ? { line: `${submitted.number} · ${ATLAS_COLOR_NAMES[submitted.token]} 제출 완료`, sub: waiting ? `${waiting}명을 기다리는 중` : "곧 공개됩니다", danger: false }
      : number !== null && token !== null ? forecast({ number, token })
      : { line: number === null && token === null ? "숫자 블록 하나와 색 토큰 하나를 고르세요" : number === null ? "숫자 블록도 고르세요" : "색 토큰도 고르세요", sub: "공개 후 큰 숫자부터 거인에 올립니다", danger: false }
    : myTurn ? game.needsColor ? { line: `내 차례 · 무지개 ${submitted?.number ?? ""} 블록을 올릴 거인을 위에서 고르세요`, sub: "점선 블록이 올렸을 때의 모습입니다", danger: false } : { ...forecast(submitted!), sub: game.canPass ? "올리거나, 패스해서 순서를 바꿀 수 있습니다" : "블록을 올리세요" }
    : { line: placedIds.has(playerId) ? "내 블록을 올렸습니다" : `${nameOf(game.currentPlacerId ?? "")} 님이 결정하는 중`, sub: submitted ? `내 제출 ${submitted.number} · ${ATLAS_COLOR_NAMES[submitted.token]}` : "", danger: false };

  const clock = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  return <div className="atlas-game">
    <header className="atlas-title"><GameIcon type="ATLAS"/><div><small>{game.playerIds.length}인전</small><h2>아틀라스의 형벌</h2></div></header>

    <div className="atlas-roundbar">
      <div className="atlas-round"><strong>라운드 {game.round}</strong><span>/ {game.totalRounds}</span>{game.round < game.refillRound && <em title="이 라운드에 블록과 토큰을 새로 받습니다">{game.refillRound}R 보충</em>}</div>
      <ol className="atlas-steps" aria-label="진행 단계">{STEPS.map((label, i) => <li key={label} className={i < step ? "done" : i === step ? "active" : ""} aria-current={i === step ? "step" : undefined}>{label}</li>)}</ol>
      <div className={`atlas-timer${game.phase !== "RESULT" && remaining <= 5 ? " urgent" : ""}`}><ClockIcon/>{game.phase === "RESULT" ? "결과" : clock}</div>
    </div>

    <ol className="atlas-players" aria-label="플레이어 벌점">{game.playerIds.map(id => {
      const done = game.submittedIds.includes(id), current = id === game.currentPlacerId;
      const flag = game.phase === "SUBMIT" ? done ? "✓ 제출 완료" : "고르는 중" : current ? "결정 중" : game.phase === "PLACE" && placedIds.has(id) ? "올림" : "";
      return <li key={id} className={`${id === playerId ? "is-me" : ""}${(done && game.phase === "SUBMIT") || current ? " is-done" : ""}`}>
        <span className="atlas-avatar">{id.startsWith("bot-") ? <BotIcon/> : id === playerId ? "나" : nameOf(id).slice(0, 1)}</span>
        <span className="atlas-player-name">{nameOf(id)}{id === game.leadPlayerId && <em title="같은 숫자끼리는 선부터 오른쪽 순서로 올립니다">선</em>}</span>
        <span className="atlas-player-score"><strong>{game.scores[id] ?? 0}</strong>벌점</span>
        {flag && <b className="atlas-flag">{flag}</b>}
      </li>;
    })}</ol>

    <div className="atlas-section-head"><h3>거인 상태</h3><p>{game.playerIds.length}인전 · 합이 <b>{game.limit + 1} 이상</b>이면 붕괴</p></div>
    <div className="atlas-giants">{ATLAS_COLORS.map(color => <Giant key={color} color={color} blocks={game.giants[color]} limit={game.limit}
      preview={previewFor(color)} collapsed={collapsedNow(color)} onPick={myTurn && game.needsColor ? () => act("PLACE", { color }) : undefined}/>)}</div>

    {game.phase !== "SUBMIT" && <RoundBoard game={game} playerId={playerId} nameOf={nameOf}/>}

    {game.phase !== "RESULT" && <section className="atlas-panel atlas-hand">
      <header className="atlas-panel-head"><h3>내 선택</h3><small className="atlas-private"><LockIcon/>나만 볼 수 있어요</small></header>
      <div className="atlas-hand-grid">
        <div><p className="atlas-label">숫자 블록</p>
          <div className="atlas-numbers">{Array.from({ length: game.maxNumber + 1 }, (_, i) => i).map(n => {
            const chosen = number === n || submitted?.number === n;
            return <button key={n} aria-pressed={chosen} className={chosen ? "selected" : ""} disabled={!submitting || !hand.numbers.includes(n)} onClick={() => setNumber(n)}>{n}</button>;
          })}</div></div>
        <div><p className="atlas-label">색 토큰</p>
          <div className="atlas-tokens">{ATLAS_TOKENS.map(t => {
            const chosen = token === t || submitted?.token === t;
            return <button key={t} aria-pressed={chosen} className={`${tokenClass(t)}${chosen ? " selected" : ""}`} disabled={!submitting || hand.tokens[t] === 0} onClick={() => setToken(t)}>
              {ATLAS_COLOR_NAMES[t]} <small>×{hand.tokens[t]}</small></button>;
          })}</div></div>
      </div>
      <footer className="atlas-hand-foot">
        <div className="atlas-forecast" role="status"><strong className={info.danger ? "danger" : ""}>{info.line}</strong>{info.sub && <small>{info.sub}</small>}</div>
        {game.phase === "SUBMIT" && <button className="primary atlas-submit" disabled={!submitting || number === null || token === null} onClick={() => act("SUBMIT", { number, token })}>
          {submitted ? "제출 완료" : number !== null && token !== null ? <>{number} · {ATLAS_COLOR_NAMES[token]} 제출 <span aria-hidden="true">→</span></> : "제출"}
        </button>}
        {myTurn && <div className="atlas-decision">
          {game.canPass && <button className="secondary" onClick={() => act("PASS")}>패스 · {game.passedIds.length ? "작은 숫자부터" : "다음 사람부터"}</button>}
          {!game.needsColor && <button className="primary" onClick={() => act("PLACE")}>{submitted ? `${submitted.number} · ${ATLAS_COLOR_NAMES[submitted.token]} 올리기` : "올리기"} <span aria-hidden="true">→</span></button>}
        </div>}
      </footer>
    </section>}

    <details className="atlas-guide">
      <summary>진행 안내</summary>
      <ul>
        <li>모두 숫자 블록 하나와 색 토큰 하나를 몰래 고릅니다.</li>
        <li>공개 후 큰 숫자부터 토큰 색의 거인에 올립니다. 같은 숫자는 선부터 오른쪽 순서입니다.</li>
        <li>맨 먼저 올릴 사람은 패스할 수 있고, 두 번째로 패스하면 작은 숫자부터 올립니다.</li>
        <li>무지개 토큰은 올릴 차례에 거인을 고릅니다.</li>
        <li>합이 {game.limit + 1} 이상이 되면 거인이 무너지고, 무너뜨린 사람이 든 블록 수만큼 벌점을 받습니다.</li>
        <li>{game.refillRound}라운드가 시작될 때 블록과 토큰을 새로 받습니다.</li>
      </ul>
    </details>
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
        <small>{p.collapsed ? `합 ${p.total} · 붕괴 · 벌점 +${p.penalty}` : `합 ${p.total}`}</small>
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
