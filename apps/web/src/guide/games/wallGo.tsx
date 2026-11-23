import { WALL_GO_PLACE_ORDER, WALL_GO_START_CELLS, openWallSides, wallGoCell as cell, wallGoCellName, wallGoReachable, wallGoScore, type WallGoPiece, type WallGoWalls } from "@brain-arena/shared";
import { WallGoBoard } from "../../components/WallGoGame";
import type { GameGuide } from "../types";

// 예시에서 나는 선공(파랑), 상대는 후공(분홍). 영역 색칠과 이동 칸은 실제 규칙 함수가 계산한다.
const IDS = ["me", "rival"];
const pieces = (mine: number[], theirs: number[]): WallGoPiece[] =>
  [...mine.map(c => ({ ownerId: "me", cell: c })), ...theirs.map(c => ({ ownerId: "rival", cell: c }))].map((p, id) => ({ id, ...p }));
const walls = (keys: string[], owner = "me"): WallGoWalls => Object.fromEntries(keys.map((key, i) => [key, i % 2 ? "rival" : owner]));
const Board = (props: { pieces: WallGoPiece[]; walls: WallGoWalls; selected?: number; reachable?: number[]; destination?: number; label: string }) =>
  <WallGoBoard playerIds={IDS} myId="me" {...props}/>;

// ── 시작: 지정 칸의 말 2개씩
const START = pieces(WALL_GO_START_CELLS[0], WALL_GO_START_CELLS[1]);
function StartFigure() {
  return <div className="guide-wallgo-stack">
    <Board pieces={START} walls={{}} label="시작 판"/>
    <ol className="guide-wallgo-order" aria-hidden="true">{WALL_GO_PLACE_ORDER.map((seat, i) => <li key={i}><span className={`wg-seat ${seat ? "b" : "a"}`}/>{seat ? "후공" : "선공"}</li>)}</ol>
  </div>;
}
const START_LABEL = `시작 판. 선공은 ${WALL_GO_START_CELLS[0].map(wallGoCellName).join("·")}, 후공은 ${WALL_GO_START_CELLS[1].map(wallGoCellName).join("·")}에 말이 있다. 남은 말은 선공, 후공, 후공, 선공 순서로 빈칸에 놓는다.`;

// ── 이동: D4의 내 말. 위는 벽, 오른쪽은 상대 말로 막혀 있다.
const MOVE_PIECES = pieces([cell(3, 3), cell(1, 1), cell(5, 5), cell(5, 2)], [cell(3, 4), cell(1, 5), cell(5, 1), cell(0, 3)]);
const MOVE_WALLS = walls(["h2-3", "v4-4"], "rival");
const REACH = wallGoReachable(MOVE_WALLS, MOVE_PIECES, 0);
const MOVE_LABEL = `D4의 내 말이 움직일 수 있는 칸 ${REACH.length}곳(제자리 포함). 위쪽은 벽, 오른쪽은 상대 말이 막고 있어 그 너머로는 갈 수 없지만, 왼쪽으로 돌아 위로 올라가는 것은 된다.`;

// ── 벽: C3으로 옮긴 뒤 그 칸의 네 변 중 하나
const DEST = cell(2, 2), SIDES = openWallSides(MOVE_WALLS, DEST);
const WALL_LABEL = `D4의 말을 C3으로 옮긴 모습. C3의 위·아래·왼쪽·오른쪽 ${SIDES.length}변 중 하나에 벽을 반드시 세운다.`;
function WallFigure() {
  return <WallGoBoard playerIds={IDS} myId="me" pieces={MOVE_PIECES} walls={MOVE_WALLS} selected={0} reachable={REACH} destination={DEST} wallOptions={SIDES} label={WALL_LABEL}/>;
}

// ── 영역: 왼쪽 위 9칸을 닫은 판과 닫기 직전
const AREA_WALLS_KEYS = ["h2-0", "h2-1", "h2-2", "v0-2", "v1-2", "v2-2", "h3-4", "h3-5", "h3-6", "v4-3", "v5-3", "v6-3"];
const AREA_PIECES = pieces([cell(1, 1), cell(3, 2), cell(2, 4), cell(4, 2)], [cell(5, 5), cell(1, 5), cell(4, 1), cell(3, 4)]);
const AREA_WALLS = walls(AREA_WALLS_KEYS);
const OPEN_WALLS = walls(AREA_WALLS_KEYS.filter(key => key !== "v2-2"));
const AREA = wallGoScore(AREA_WALLS, AREA_PIECES, IDS);
function AreaFigure() {
  return <div className="guide-wallgo-pair">
    <figure><Board pieces={AREA_PIECES} walls={OPEN_WALLS} label="닫기 전"/><figcaption>한 변이 열려 있음</figcaption></figure>
    <figure><Board pieces={AREA_PIECES} walls={AREA_WALLS} label="닫은 뒤"/><figcaption>내 땅 {AREA.territory.me}칸 · 상대 {AREA.territory.rival}칸</figcaption></figure>
  </div>;
}
const AREA_LABEL = `왼쪽 위 3×3 구역에 내 말만 있다. 마지막 한 변을 막으면 그 ${AREA.territory.me}칸이 내 땅이 된다. 오른쪽 아래 ${AREA.territory.rival}칸은 상대 땅이다. 가운데는 아직 두 사람의 말이 함께 있어 누구의 땅도 아니다.`;

// ── 종료: 모든 구역이 나뉜 판. 왼쪽 A4 한 칸은 말이 없는 구역
const END_WALLS = walls([...Array.from({ length: 7 }, (_, r) => `v${r}-3`), "h2-0", "v3-0", "h3-0", "h1-5", "v5-4"]);
const END_PIECES = pieces([cell(0, 1), cell(2, 2), cell(5, 1), cell(6, 3)], [cell(0, 5), cell(3, 6), cell(5, 4), cell(6, 6)]);
const END = wallGoScore(END_WALLS, END_PIECES, IDS);
const END_LABEL = `세로벽으로 판이 완전히 나뉜 끝 판. 왼쪽 구역들은 내 말만, 오른쪽은 상대 말만 있다. 말이 없는 칸은 누구의 점수도 아니다. 내 땅 ${END.territory.me}칸, 상대 ${END.territory.rival}칸으로 내가 이긴다.`;

export const wallGoGuide: GameGuide = {
  overview: {
    figure: <Board pieces={AREA_PIECES} walls={AREA_WALLS} label="진행 중인 판"/>, label: AREA_LABEL,
    goal: "말을 옮기고 그 옆에 벽을 세워, 내 말만 들어 있는 땅을 상대보다 넓게 만듭니다.",
    win: "어느 구역에도 두 사람의 말이 함께 있지 않게 되면 끝나고, 땅이 넓은 쪽이 이깁니다. 같으면 가장 큰 땅 하나를 비교하고, 그것도 같으면 무승부입니다.",
    essentials: [
      "7×7 판에서 각자 말 4개. 2개는 지정 칸에서 시작하고 2개는 빈칸에 놓습니다.",
      "내 차례에는 말 하나를 최대 2칸 옮기고, 그 말이 선 칸의 한 변에 벽을 꼭 세웁니다.",
      "벽으로 나뉜 구역에 내 말만 있으면 그 구역 칸 전체가 내 점수입니다.",
    ],
  },
  steps: [
    { title: "말 배치", body: "각자 말 2개는 정해진 칸에서 시작합니다. 남은 2개씩은 선공 → 후공 → 후공 → 선공 순서로 원하는 빈칸에 놓습니다(차례마다 20초).",
      figure: <StartFigure/>, label: START_LABEL },
    { title: "말 하나를 최대 2칸", body: "상하좌우로 최대 2칸 움직입니다. 꺾어서 가도 되고, 제자리(0칸)도 됩니다. 벽·판 테두리를 넘거나 다른 말을 지나가거나 그 위에 멈출 수는 없습니다.",
      figure: <Board pieces={MOVE_PIECES} walls={MOVE_WALLS} selected={0} reachable={REACH} label={MOVE_LABEL}/>, label: MOVE_LABEL },
    { title: "그 말 옆에 벽 하나", body: "옮긴 말이 선 칸의 위·아래·왼쪽·오른쪽 중 한 변에 벽을 반드시 세웁니다. 이미 벽이 있거나 판 테두리인 변에는 세울 수 없습니다. 이동 + 벽까지 45초입니다.",
      figure: <WallFigure/>, label: WALL_LABEL },
    { title: "내 말만 있는 구역이 내 땅", body: "벽은 두 사람 모두를 막습니다. 판 테두리도 벽이므로 가장자리와 이어서 구역을 닫을 수 있습니다. 닫힌 구역에 내 말만 있으면 그 칸이 모두 내 땅입니다.",
      figure: <AreaFigure/>, label: AREA_LABEL },
    { title: "모두 나뉘면 끝", body: "어느 구역에도 두 사람의 말이 함께 있지 않으면, 움직일 공간이 남아 있어도 바로 끝납니다. 내 땅을 모두 더해 넓은 쪽이 이깁니다.",
      figure: <Board pieces={END_PIECES} walls={END_WALLS} label={END_LABEL}/>, label: END_LABEL },
  ],
  rules: [
    { title: "목표와 준비", items: [
      "벽으로 내 말이 있는 공간을 나눠, 상대보다 넓은 땅을 확보하는 1대1 게임입니다.",
      `7×7 판에서 각자 말 4개를 씁니다. 선공은 ${WALL_GO_START_CELLS[0].map(wallGoCellName).join("·")}, 후공은 ${WALL_GO_START_CELLS[1].map(wallGoCellName).join("·")}에서 2개씩 시작합니다. 선공은 무작위로 정합니다.`,
      "나머지 2개씩은 선공 → 후공 → 후공 → 선공 순서로 빈칸에 놓습니다. 배치가 끝나면 선공부터 움직입니다.",
    ] },
    { title: "한 차례: 이동 → 벽", example: { title: "D4의 말을 C3으로", body: "왼쪽으로 1칸, 위로 1칸 꺾어 C3에 멈춘 뒤 C3의 네 변 중 하나에 벽을 세웁니다.", figure: <WallFigure/>, label: WALL_LABEL }, items: [
      "말 하나를 상하좌우로 최대 2칸 옮깁니다. '오른쪽 2칸'도, '오른쪽 1칸 → 위 1칸'처럼 꺾는 것도 됩니다. 움직일 수 있다면 제자리에 머무르는 0칸 이동도 허용합니다.",
      "이동 중 벽을 통과하거나, 다른 말이 있는 칸을 지나가거나 그 위에 멈출 수 없습니다.",
      "이동을 마친 말이 있는 칸의 위·아래·왼쪽·오른쪽 중 한 변에 벽을 반드시 하나 세웁니다. 판의 다른 곳에 세울 수는 없고, 이미 벽이 있는 곳이나 판 테두리에는 겹쳐 놓을 수 없습니다.",
      "제한 시간은 배치 20초, 이동과 벽 45초입니다. 시간이 지나면 둘 수 있는 수 가운데 하나가 무작위로 놓입니다.",
    ] },
    { title: "벽과 영역", example: { title: "마지막 한 변을 막으면", body: `왼쪽 위 3×3 구역에 내 말만 있을 때 열린 변 하나를 막으면 ${AREA.territory.me}칸이 내 땅이 됩니다.`, figure: <AreaFigure/>, label: AREA_LABEL }, items: [
      "벽은 양쪽 말의 이동을 모두 막습니다. 내가 세운 벽도 내 말을 막습니다. 벽을 부수는 행동은 없습니다.",
      "판의 바깥 테두리도 벽 역할을 하므로, 가장자리와 새 벽을 이어 영역을 만들 수 있습니다.",
      "벽으로 나뉜 구역 안에 내 말만 있으면 그 구역의 칸 전체가 내 점수입니다. 말이 차지한 칸도 포함하고, 같은 구역에 내 말이 여러 개 있어도 중복해서 세지 않습니다.",
      "아무 말도 없는 구역은 누구의 점수도 되지 않습니다.",
    ] },
    { title: "종료와 승패", items: [
      "어느 구역에도 두 사람의 말이 함께 남아 있지 않게 되면 끝납니다. 각자의 영역 안에서 움직일 공간이 남아 있어도 게임은 끝납니다.",
      "내 말이 있는 구역들의 칸 수를 더해 더 넓은 쪽이 이깁니다. 예를 들어 내 영역이 12칸과 8칸이면 20점입니다.",
      "총영역이 같으면 가장 큰 단일 영역이 큰 쪽이 이기고, 그것도 같으면 무승부입니다.",
    ] },
  ],
};
