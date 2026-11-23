import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  WALL_GO_CELLS, WALL_GO_SIZE, WALL_SIDES, WALL_SIDE_NAMES, wallGoCellName, wallGoCol, wallGoMoves, wallGoRegions, wallGoRow, wallKey,
  type WallGoMove, type WallGoPiece, type WallGoView, type WallGoWalls, type WallSide,
} from "@brain-arena/shared";
import { GameIcon } from "./GameIcon";

const S = 60, BOARD = S * WALL_GO_SIZE;
const ARROWS: Record<WallSide, string> = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→" };
/** 자리 색: 선공 a(파랑), 후공 b(분홍). 두 사람 화면에서 같은 색이다. */
export const wallGoSeat = (playerIds: string[], id: string) => playerIds.indexOf(id) === 0 ? "a" : "b";

/** 벽 키를 칸 사이 홈 위의 막대로 */
function wallBar(key: string) {
  const [, kind, a, b] = key.match(/^([hv])(\d+)-(\d+)$/)!, row = Number(a), col = Number(b);
  return kind === "h" ? { x: col * S + 2, y: (row + 1) * S - 4, width: S - 4, height: 8 } : { x: (col + 1) * S - 4, y: row * S + 2, width: 8, height: S - 4 };
}
const center = (cell: number) => ({ cx: wallGoCol(cell) * S + S / 2, cy: wallGoRow(cell) * S + S / 2 });
const onKey = (handler: () => void) => (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handler(); } };

export interface WallGoBoardProps {
  playerIds: string[];
  pieces: WallGoPiece[];
  walls: WallGoWalls;
  myId?: string;
  /** 내 말만 있는(닫힌) 구역을 자리 색으로 칠한다 */
  shade?: boolean;
  movable?: number[];
  selected?: number | null;
  reachable?: number[];
  destination?: number | null;
  wallOptions?: WallSide[];
  placeable?: number[];
  lastMove?: WallGoMove | null;
  onCell?: (cell: number) => void;
  onWall?: (side: WallSide) => void;
  label: string;
}

/** 7×7 판. 칸 사이 홈에 벽이 서고, 말은 칸 가운데에 놓인다. */
export function WallGoBoard({ playerIds, pieces, walls, myId, shade = true, movable = [], selected = null, reachable = [], destination = null, wallOptions = [], placeable = [], lastMove = null, onCell, onWall, label }: WallGoBoardProps) {
  const owner = useMemo(() => {
    const map = new Map<number, string>();
    if (shade) for (const region of wallGoRegions(walls, pieces)) if (region.ownerIds.length === 1) for (const cell of region.cells) map.set(cell, wallGoSeat(playerIds, region.ownerIds[0]));
    return map;
  }, [shade, walls, pieces, playerIds]);
  const freshWall = lastMove ? wallKey(lastMove.to, lastMove.wall) : null;
  const moved = selected !== null && destination !== null ? pieces.find(p => p.id === selected) : undefined;
  const clickable = (cell: number) => !!onCell && (reachable.includes(cell) || placeable.includes(cell) || pieces.some(p => p.cell === cell && movable.includes(p.id)));

  return <svg className="wg-board" viewBox={`-6 -6 ${BOARD + 12} ${BOARD + 12}`} role="group" aria-label={label}>
    <rect className="wg-frame" x={-6} y={-6} width={BOARD + 12} height={BOARD + 12} rx={14}/>
    {Array.from({ length: WALL_GO_CELLS }, (_, cell) => {
      const active = clickable(cell), seat = owner.get(cell);
      const cls = ["wg-cell", seat && `own-${seat}`, reachable.includes(cell) && "reach", placeable.includes(cell) && "place", cell === destination && "dest", active && "active"].filter(Boolean).join(" ");
      return <rect key={cell} className={cls} x={wallGoCol(cell) * S + 3} y={wallGoRow(cell) * S + 3} width={S - 6} height={S - 6} rx={8}
        {...(active ? { role: "button", tabIndex: 0, "aria-label": wallGoCellName(cell), onClick: () => onCell!(cell), onKeyDown: onKey(() => onCell!(cell)) } : {})}/>;
    })}
    {reachable.filter(cell => cell !== destination && !pieces.some(p => p.cell === cell)).map(cell => <circle key={`r${cell}`} className="wg-reach-dot" {...center(cell)} r={5}/>)}
    {lastMove && lastMove.from !== lastMove.to && <circle className="wg-trail" {...center(lastMove.from)} r={7}/>}
    {Object.entries(walls).map(([key, id]) => <rect key={key} className={`wg-wall ${wallGoSeat(playerIds, id)}${key === freshWall ? " fresh" : ""}`} rx={4} {...wallBar(key)}/>)}
    {pieces.map(piece => {
      const seat = wallGoSeat(playerIds, piece.ownerId), leaving = moved?.id === piece.id && destination !== piece.cell;
      const cls = ["wg-piece", seat, piece.ownerId === myId && "mine", movable.includes(piece.id) && "movable", piece.id === selected && "selected", leaving && "leaving"].filter(Boolean).join(" ");
      return <g key={piece.id} className={cls} pointerEvents="none"><circle {...center(piece.cell)} r={17}/>{piece.ownerId === myId && <circle className="wg-piece-core" {...center(piece.cell)} r={5}/>}</g>;
    })}
    {moved && destination !== moved.cell && <circle className={`wg-piece ghost ${wallGoSeat(playerIds, moved.ownerId)}`} {...center(destination!)} r={17} pointerEvents="none"/>}
    {destination !== null && wallOptions.map(side => {
      const bar = wallBar(wallKey(destination, side)!), hit = bar.width > bar.height ? { x: bar.x, y: bar.y - 8, width: bar.width, height: bar.height + 16 } : { x: bar.x - 8, y: bar.y, width: bar.width + 16, height: bar.height };
      return <g key={side} className="wg-wall-option" role="button" tabIndex={onWall ? 0 : -1} aria-label={`${WALL_SIDE_NAMES[side]}에 벽 세우기`}
        onClick={() => onWall?.(side)} onKeyDown={onKey(() => onWall?.(side))}>
        <rect className="hit" {...hit}/><rect className="bar" rx={4} {...bar}/>
      </g>;
    })}
  </svg>;
}

export function WallGoGame({ game, playerId, nameOf, emit, remaining }: { game: WallGoView; playerId: string; nameOf: (id: string) => string; emit: (event: string, payload?: object) => void; remaining: number }) {
  const [selected, setSelected] = useState<number | null>(null), [destination, setDestination] = useState<number | null>(null);
  useEffect(() => { setSelected(null); setDestination(null); }, [game.turn]);
  const myTurn = game.currentPlayerId === playerId && !game.winnerId && !game.isDraw;
  const act = (type: string, extra: object) => emit("game:action", { type, payload: { turn: game.turn, ...extra } });

  const options = useMemo(() => myTurn && game.phase === "MOVE" ? wallGoMoves(game.walls, game.pieces, playerId) : [], [myTurn, game.phase, game.walls, game.pieces, playerId]);
  const movable = [...new Set(options.map(o => o.pieceId))];
  const reachable = selected === null ? [] : [...new Set(options.filter(o => o.pieceId === selected).map(o => o.to))];
  const wallOptions = selected === null || destination === null ? [] : options.filter(o => o.pieceId === selected && o.to === destination).map(o => o.wall);
  const taken = new Set(game.pieces.map(p => p.cell));
  const placeable = myTurn && game.phase === "PLACE" ? Array.from({ length: WALL_GO_CELLS }, (_, cell) => cell).filter(cell => !taken.has(cell)) : [];

  const onCell = (cell: number) => {
    if (game.phase === "PLACE") { if (placeable.includes(cell)) act("PLACE", { cell }); return; }
    const piece = game.pieces.find(p => p.cell === cell && p.ownerId === playerId);
    if (piece && movable.includes(piece.id) && piece.id !== selected) { setSelected(piece.id); setDestination(null); }
    else if (selected !== null && reachable.includes(cell)) setDestination(cell);
  };
  const build = (side: WallSide) => { if (selected !== null && destination !== null && wallOptions.includes(side)) act("MOVE", { pieceId: selected, to: destination, wall: side }); };

  const opponentId = game.playerIds.find(id => id !== playerId) ?? "";
  const placing = game.phase === "PLACE";
  const steps = placing ? ["말 배치", "이동", "벽"] : ["말 고르기", "이동", "벽"];
  const step = placing ? 0 : !myTurn ? -1 : selected === null ? 0 : destination === null ? 1 : 2;
  const myPlacesLeft = game.placeQueue.filter(id => id === playerId).length;
  const info = !myTurn
    ? { line: `${nameOf(game.currentPlayerId)} 님이 ${placing ? "말을 놓는" : "두는"} 중`, sub: placing ? `배치 순서: 선공 → 후공 → 후공 → 선공 · 남은 배치 ${game.placeQueue.length}개` : "상대가 말을 옮기고 벽을 세우면 내 차례입니다" }
    : placing ? { line: "빈칸을 눌러 말을 놓으세요", sub: `내 남은 배치 ${myPlacesLeft}개 · 누르는 즉시 놓입니다` }
    : selected === null ? { line: "움직일 내 말을 고르세요", sub: "테두리가 빛나는 말을 움직일 수 있습니다" }
    : destination === null ? { line: "멈출 칸을 고르세요", sub: "최대 2칸, 꺾어도 됩니다 · 말을 다시 누르면 제자리(0칸)" }
    : { line: `${wallGoCellName(destination)}에 멈춤 · 벽을 세울 변을 고르세요`, sub: "판의 점선 막대를 누르거나 아래 방향 버튼을 누르세요" };
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const lastMove = game.moves.at(-1) ?? null;

  return <div className="atlas-game wallgo-game">
    <header className="atlas-title"><GameIcon type="WALL_GO"/><div><small>2인전</small><h2>벽바둑</h2></div></header>

    <div className="atlas-roundbar">
      <div className="atlas-round">{placing ? <><strong>말 배치</strong><span>{4 - game.placeQueue.length + 1} / 4</span></> : <><strong>{game.moves.length + 1}수째</strong><span>· 벽 {Object.keys(game.walls).length}개</span></>}</div>
      <ol className="atlas-steps" aria-label="진행 단계">{steps.map((label, i) => <li key={label} className={i < step ? "done" : i === step ? "active" : ""} aria-current={i === step ? "step" : undefined}>{label}</li>)}</ol>
      <div className={`atlas-timer${remaining <= 5 ? " urgent" : ""}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/></svg>{clock}</div>
    </div>

    <ol className="atlas-players wallgo-players" aria-label="플레이어 영역">{game.playerIds.map((id, seat) => <li key={id} className={`${id === playerId ? "is-me" : ""}${id === game.currentPlayerId ? " is-done" : ""}`}>
      <span className={`wg-seat ${seat === 0 ? "a" : "b"}`} aria-hidden="true"/>
      <span className="atlas-player-name">{nameOf(id)}<em>{seat === 0 ? "선공" : "후공"}</em></span>
      <span className="atlas-player-score"><strong>{game.territory[id] ?? 0}</strong>칸 확보</span>
      {id === game.currentPlayerId && <b className="atlas-flag">차례</b>}
    </li>)}</ol>

    <div className="wallgo-layout">
      <div className="wallgo-board-wrap">
        <WallGoBoard playerIds={game.playerIds} pieces={game.pieces} walls={game.walls} myId={playerId} movable={movable} selected={selected} reachable={reachable}
          destination={destination} wallOptions={wallOptions} placeable={placeable} lastMove={lastMove} onCell={onCell} onWall={build} label="벽바둑 판"/>
        <p className="wallgo-status">색칠된 칸은 한 사람의 말만 남은 확정 영역 · 아직 나뉘지 않은 칸 <b>{game.contested}</b></p>
      </div>

      <section className="atlas-panel wallgo-panel">
        <header className="atlas-panel-head"><h3>{myTurn ? "내 차례" : "상대 차례"}</h3><small>{lastMove ? `직전: ${nameOf(lastMove.playerId)} ${wallGoCellName(lastMove.from)}→${wallGoCellName(lastMove.to)} · ${WALL_SIDE_NAMES[lastMove.wall]} 벽${lastMove.auto ? " · 시간 초과" : ""}` : "첫 수 전"}</small></header>
        <div className="atlas-forecast" role="status"><strong>{info.line}</strong><small>{info.sub}</small></div>
        {myTurn && !placing && <div className="wallgo-sides" aria-label="벽 방향">{WALL_SIDES.map(side => <button key={side} className="secondary" disabled={!wallOptions.includes(side)} onClick={() => build(side)}>
          <span aria-hidden="true">{ARROWS[side]}</span> {WALL_SIDE_NAMES[side]}</button>)}</div>}
        {myTurn && selected !== null && <button className="text-button wallgo-reset" onClick={() => { setSelected(null); setDestination(null); }}>다시 고르기</button>}
        <dl className="wallgo-tally">
          <div><dt>나</dt><dd>{game.territory[playerId] ?? 0}칸</dd></div>
          <div><dt>{nameOf(opponentId)}</dt><dd>{game.territory[opponentId] ?? 0}칸</dd></div>
        </dl>
      </section>
    </div>

    <details className="atlas-guide">
      <summary>진행 안내</summary>
      <ul>
        <li>내 차례에는 말 하나를 상하좌우로 최대 2칸(꺾기 가능, 0칸 가능) 옮깁니다.</li>
        <li>옮긴 말이 선 칸의 위·아래·왼쪽·오른쪽 중 한 변에 벽을 반드시 하나 세웁니다.</li>
        <li>벽·판 테두리·다른 말은 지나갈 수 없습니다. 내가 세운 벽도 내 말을 막습니다.</li>
        <li>내 말만 있는 구역의 칸이 내 땅입니다. 어느 구역에도 두 사람의 말이 함께 있지 않으면 끝나고, 땅이 넓은 쪽이 이깁니다.</li>
      </ul>
    </details>
  </div>;
}

export function WallGoReview({ game, playerId, nameOf }: { game: WallGoView; playerId: string; nameOf: (id: string) => string }) {
  const tied = game.playerIds.every(id => game.territory[id] === game.territory[game.playerIds[0]]);
  return <section className="match-review wallgo-review">
    <div className="review-heading"><div><p className="eyebrow">FINAL BOARD</p><h2>최종 영역</h2></div><p>색칠된 칸이 각자 확보한 땅입니다. 회색 칸은 말이 없는 구역이라 누구의 점수도 아닙니다. 모두 {game.moves.length}수를 두었습니다.</p></div>
    <div className="wallgo-review-body">
      <WallGoBoard playerIds={game.playerIds} pieces={game.pieces} walls={game.walls} myId={playerId} lastMove={game.moves.at(-1)} label="최종 판"/>
      <ol className="wallgo-review-scores">{game.playerIds.map((id, seat) => <li key={id} className={id === game.winnerId ? "win" : ""}>
        <span className={`wg-seat ${seat === 0 ? "a" : "b"}`} aria-hidden="true"/>
        <b>{nameOf(id)}</b>
        <span>총 {game.territory[id]}칸{tied && ` · 가장 큰 땅 ${game.largest[id]}칸`}</span>
      </li>)}</ol>
      {tied && <p className="muted wallgo-tie">총영역이 같아 가장 큰 단일 영역으로 비교했습니다.</p>}
    </div>
  </section>;
}
