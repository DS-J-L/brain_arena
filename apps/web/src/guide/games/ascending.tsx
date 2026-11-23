import { AscendingBoard, longestAscendingRun } from "../../components/AscendingBoard";
import type { GameGuide } from "../types";

// ── 강조 칸과 길이는 결과 화면과 같은 longestAscendingRun으로 계산한다.
const MY_BOARD = [3, 5, 5, 8, 2, 4, 6, 7, 9, 1];
const OPP_BOARD = [6, 1, 4, 4, 9, 2, 3, 8, 5, 10];
const run = (board: number[]) => longestAscendingRun(board);
const runText = (board: number[]) => run(board).map(i => board[i]).join("→");

function FullBoard() {
  return <div className="guide-asc-board"><AscendingBoard title={`MY BOARD · 최장 ${run(MY_BOARD).length}`} board={MY_BOARD} highlightIndices={run(MY_BOARD)}/></div>;
}

// 공개된 7과 3 중 선택권자가 7을 가져가고, 3은 상대에게 간다.
const OFFER: [number, number] = [7, 3], TAKE = 0;
function CardChoice() {
  return <div className="card-choice guide-asc-choice"><p className="eyebrow">OPEN CARDS</p>
    <div>{OFFER.map((card, i) => <button key={i} className={i === TAKE ? "on" : ""}><small>{i === TAKE ? "내가 가져감" : "상대에게"}</small><strong>{card}</strong></button>)}</div>
  </div>;
}

// 받은 7을 빈칸 하나에 놓는다.
const PARTIAL: Array<number | null> = [3, 5, null, null, 2, null, null, null, null, 1], PLACE_AT = 7;
const PLACED = PARTIAL.map((v, i) => i === PLACE_AT ? OFFER[TAKE] : v);
function Placement() {
  return <div className="guide-asc-place">
    <div className="assigned-card"><small>YOUR CARD</small><strong>{OFFER[TAKE]}</strong><span>놓으면 옮길 수 없음</span></div>
    <AscendingBoard title="YOUR BOARD" board={PLACED} highlightIndices={[PLACE_AT]}/>
  </div>;
}

const TURNS = Array.from({ length: 10 }, (_, i) => i % 2 === 0 ? "나" : "상대");
function Turns() {
  return <ol className="guide-asc-turns">{TURNS.map((who, i) => <li key={i} className={who === "나" ? "me" : ""}><small>{i + 1}턴</small><b>{who}</b></li>)}</ol>;
}

const WINNER = run(MY_BOARD).length > run(OPP_BOARD).length ? "나" : "상대";
function Compare() {
  return <div className="guide-asc-board">
    <AscendingBoard title={`나 · 최장 ${run(MY_BOARD).length}`} board={MY_BOARD} highlightIndices={run(MY_BOARD)}/>
    <AscendingBoard title={`상대 · 최장 ${run(OPP_BOARD).length}`} board={OPP_BOARD} highlightIndices={run(OPP_BOARD)}/>
  </div>;
}

// 연결 판정: 오른쪽이 크거나 같으면 이어진다.
const CHAINS = [[2, 2, 5], [4, 5, 3, 6]];
function Chains() {
  return <div className="guide-asc-chains">{CHAINS.map(chain => <div key={chain.join()}>
    <span>{chain.map((n, i) => <span key={i}>{i > 0 && <i className={chain[i - 1] <= n ? "ok" : "cut"}>{chain[i - 1] <= n ? "→" : "✕"}</i>}<b>{n}</b></span>)}</span>
    <small>최장 {run(chain).length}</small>
  </div>)}</div>;
}
const chainLabel = (chain: number[]) => `${chain.join(", ")}: ${chain.slice(1).map((n, i) => `${chain[i]}${chain[i] <= n ? "→" : "에서 끊기고 "}${n}`).join(", ")}. 최장 ${run(chain).length}`;

export const ascendingGuide: GameGuide = {
  overview: {
    figure: <FullBoard/>, label: `완성된 10칸 보드 ${MY_BOARD.join(", ")}. 가장 긴 오름차순은 ${runText(MY_BOARD)}로 길이 ${run(MY_BOARD).length}.`,
    goal: "10칸 보드를 채워서 왼쪽에서 오른쪽으로 커지는 구간을 가장 길게 만듭니다.",
    win: "10턴 뒤 가장 긴 오름차순 구간이 더 긴 사람이 이깁니다.",
    essentials: [
      "매 턴 카드 두 장이 공개되고, 선택권자가 한 장을 고르면 남은 한 장은 상대가 받습니다.",
      "받은 카드는 내 빈칸 아무 데나 비공개로 놓습니다. 한 번 놓으면 옮길 수 없습니다.",
      "오른쪽 숫자가 왼쪽보다 크거나 같으면 이어지고, 작아지면 끊깁니다.",
    ],
  },
  steps: [
    { title: "카드 두 장 중 하나 고르기", body: "매 턴 1~10 중 서로 다른 카드 두 장이 공개됩니다. 선택권을 가진 사람이 한 장을 가져가고, 남은 한 장은 자동으로 상대에게 갑니다.",
      figure: <CardChoice/>, label: `공개된 카드 ${OFFER.join("과 ")}. 선택권자가 ${OFFER[TAKE]}을 가져가고 ${OFFER[1 - TAKE]}은 상대에게 간다.` },
    { title: "빈칸에 비공개로 놓기", body: "받은 카드를 내 보드의 빈칸 한 곳에 놓습니다. 상대는 내가 어디에 놓았는지 볼 수 없고, 한 번 놓은 카드는 옮길 수 없습니다.",
      figure: <Placement/>, label: `받은 카드 ${OFFER[TAKE]}을 ${PLACE_AT + 1}번 칸에 놓았다. 보드: ${PLACED.map(v => v ?? "빈칸").join(", ")}.` },
    { title: "선택권은 턴마다 교대", body: "카드를 고르는 사람은 매 턴 바뀝니다. 10턴이 지나면 두 사람의 보드가 모두 채워집니다.",
      figure: <Turns/>, label: `10턴 동안 선택권자: ${TURNS.map((who, i) => `${i + 1}턴 ${who}`).join(", ")}.` },
    { title: "보드 공개, 가장 긴 구간 비교", body: "게임이 끝나면 두 보드를 공개하고 가장 긴 오름차순 구간의 길이를 비교합니다. 길이가 같으면 규칙에 정한 순서대로 더 따집니다.",
      figure: <Compare/>, label: `내 최장 구간 ${runText(MY_BOARD)}(${run(MY_BOARD).length}), 상대 최장 구간 ${runText(OPP_BOARD)}(${run(OPP_BOARD).length}). ${WINNER === "나" ? "내가" : "상대가"} 이긴다.` },
  ],
  rules: [
    { title: "목표와 준비", items: ["각자 왼쪽부터 오른쪽으로 이어진 10칸 보드를 가집니다. 10턴 동안 보드를 채워 가장 긴 연속 오름차순 구간을 만드는 것이 목표입니다.", "오른쪽 숫자가 왼쪽 숫자보다 크거나 같으면 연결됩니다. 예를 들어 2→2→5는 길이 3이며, 숫자가 작아지는 지점에서 연결이 끊깁니다."],
      example: { title: "연결 판정", body: "같은 숫자끼리는 이어집니다. 숫자가 작아지는 곳에서 끊기고, 그다음 칸부터 새로 셉니다.",
        figure: <Chains/>, label: CHAINS.map(chainLabel).join(". ") } },
    { title: "턴 진행", items: ["매 턴 서로 다른 1~10 카드 두 장이 공개됩니다. 선택권을 가진 플레이어가 한 장을 고르고, 남은 한 장은 상대에게 자동으로 지급됩니다.", "두 플레이어는 받은 카드를 자신의 빈칸 한 곳에 비공개로 놓습니다. 한 번 놓은 카드는 옮길 수 없고, 상대의 배치 위치와 보드는 게임이 끝날 때 공개됩니다.", "카드 선택권은 턴마다 교대됩니다. 10턴이 끝나면 두 플레이어의 보드가 모두 완성됩니다."] },
    { title: "승패와 동점", items: ["서버가 각 보드에서 인접한 칸만 따라가며 가장 긴 오름차순 구간을 계산합니다. 더 긴 구간을 만든 플레이어가 승리합니다.", "최장 길이가 같으면 최장 구간 개수, 그 구간의 가장 큰 합, 오름차순 인접 쌍 개수 순으로 비교하며 모두 같으면 무승부입니다.", "시간이 끝나면 카드나 빈칸이 무작위로 선택됩니다."] },
  ],
};
