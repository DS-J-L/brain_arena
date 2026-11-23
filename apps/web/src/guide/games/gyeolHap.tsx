import { HAP_MODES, checkHap, isHap, type HapTile } from "@brain-arena/shared";
import { Checks, HAP_NAMES, HapBoard, HapShape, backgroundFills } from "../../components/GyeolHapGame";
import { PlayerScores } from "../../components/PlayerScores";
import type { GameGuide, RuleSection } from "../types";

/** 결! 합! 1·2는 타일 구성만 다르고 규칙은 같다. */
const hapRules = (basic: boolean): RuleSection[] => [
    { title: "보드와 합 판정", items: [basic ? "결! 합! 1은 모양 3종(원·별·삼각형), 도형 색 3종(보라·녹색·주황), 배경 색 3종(검정·회색·하양)의 27가지 타일 중 서로 다른 9개를 사용합니다." : "결! 합! 2는 모양 5종(원·별·삼각형·사각형·해), 도형 색 4종(보라·녹색·주황·노랑), 배경 색 3종(검정·회색·하양)의 60가지 타일 중 서로 다른 9개를 사용합니다.", "타일 3개의 모양·도형 색·배경 색을 각각 검사합니다. 각 속성이 모두 같거나 모두 달라야 합입니다. 한 속성이라도 두 개만 같으면 오답입니다."] },
    { title: "결! 합!과 점수", items: ["자기 차례는 15초입니다. 합!을 누르면 그 시점부터 별도 10초 안에 서로 다른 타일 3개를 골라야 합니다. 세 번째 타일을 누르면 바로 자동 제출하여 판정합니다. 두 개까지는 선택한 타일을 다시 눌러 해제할 수 있습니다.", "새로운 합은 +1점, 오답이나 이미 찾은 합은 −1점입니다. 양쪽이 찾은 합은 함께 기록하며, 번호 순서를 바꿔도 같은 답입니다. 점수는 음수가 될 수 있습니다.", "맞힌 타일은 보드에 남고 다른 합에 다시 사용할 수 있습니다. 아직 찾지 않은 합이 없을 때 결!을 누르면 +3점과 함께 라운드가 종료됩니다. 남은 합이 있으면 −1점입니다. 처음부터 합이 없는 보드도 가능합니다."],
      example: { title: "이미 찾은 합", body: "상대가 2·5·7을 맞혔다면 내가 7·5·2를 골라도 같은 답이라 −1점입니다. 대신 2·5·7 중 한두 장을 다른 타일과 묶은 새 조합은 +1점이 될 수 있습니다." } },
    { title: "시간과 라운드", items: ["합 정답·오답, 결 오답 후 상대 차례가 됩니다. 합 선언 후에는 결로 바꾸거나 시간을 초기화할 수 없습니다. 15초 무응답은 감점 없는 패스, 합 선언 후 10초 초과는 −1점입니다.", "합이 남아 있는데 양쪽 합계 연속 4턴 동안 새 합을 찾지 못하면 보너스 없이 새 보드로 넘어갑니다. 오답·중복 답변·결 오답·시간 초과도 한 턴으로 세며, 새 합 정답만 횟수를 초기화합니다. 판정은 1.5초, 라운드 종료는 3초 표시합니다.", "서로 다른 보드로 총 3라운드를 진행합니다. 첫 선공은 무작위, 이후 라운드마다 교대하며 3라운드의 누적 점수가 높은 플레이어가 승리합니다. 동점이면 연장 없이 무승부입니다.", "연습 봇도 공개된 보드와 찾은 합 기록만 사용합니다. 경기 종료 후 각 라운드의 놓친 합과 제출 답변의 속성별 판정 이유를 확인할 수 있습니다."] },
    { title: "3~4인 대전", items: ["방에는 최대 4명까지 들어올 수 있으며 2명 이상이 모두 준비하면 시작합니다. 차례는 입장 순서대로 돌아가고, 라운드마다 선공이 다음 사람으로 넘어갑니다.", "모두가 한 번씩 선공하도록 라운드 수는 인원 수만큼(최소 3라운드) 진행합니다. 합이 남은 채 새 합이 안 나오는 정체 판정은 인원 × 2턴(최소 4턴)입니다.", "최종 점수 1위가 승리하며 공동 1위면 무승부입니다. 도중에 나간 플레이어는 차례에서 빠지고, 한 명만 남으면 그 플레이어가 승리합니다."] },
];

// ── 예시 데이터: 판정은 실제 checkHap/isHap으로 계산하므로 그림이 규칙과 어긋날 수 없다.
const t = (shape: HapTile["shape"], shapeColor: HapTile["shapeColor"], backgroundColor: HapTile["backgroundColor"]): HapTile => ({ shape, shapeColor, backgroundColor });

const SAMPLES = {
  basic: {
    hap: [t("CIRCLE", "PURPLE", "BLACK"), t("STAR", "PURPLE", "GRAY"), t("TRIANGLE", "PURPLE", "WHITE")],
    notHap: [t("CIRCLE", "GREEN", "BLACK"), t("STAR", "ORANGE", "BLACK"), t("TRIANGLE", "PURPLE", "WHITE")],
    board: [t("CIRCLE", "GREEN", "WHITE"), t("STAR", "PURPLE", "BLACK"), t("TRIANGLE", "ORANGE", "GRAY"), t("CIRCLE", "ORANGE", "BLACK"), t("STAR", "GREEN", "GRAY"), t("TRIANGLE", "GREEN", "WHITE"), t("STAR", "ORANGE", "WHITE"), t("CIRCLE", "PURPLE", "GRAY"), t("TRIANGLE", "PURPLE", "BLACK")],
  },
  expanded: {
    hap: [t("SQUARE", "YELLOW", "BLACK"), t("SUN", "YELLOW", "GRAY"), t("CIRCLE", "YELLOW", "WHITE")],
    notHap: [t("SUN", "GREEN", "GRAY"), t("SQUARE", "ORANGE", "GRAY"), t("STAR", "PURPLE", "WHITE")],
    board: [t("SUN", "YELLOW", "BLACK"), t("SQUARE", "PURPLE", "GRAY"), t("CIRCLE", "GREEN", "WHITE"), t("STAR", "ORANGE", "GRAY"), t("SQUARE", "YELLOW", "GRAY"), t("TRIANGLE", "PURPLE", "BLACK"), t("SQUARE", "GREEN", "GRAY"), t("SUN", "ORANGE", "WHITE"), t("STAR", "YELLOW", "BLACK")],
  },
};
const PICK = [2, 5, 7];

const describe = (tile: HapTile) => `${HAP_NAMES.backgroundColor[tile.backgroundColor]} 배경의 ${HAP_NAMES.shapeColor[tile.shapeColor]} ${HAP_NAMES.shape[tile.shape]}`;
const verdict = (tiles: HapTile[]) => isHap(tiles) ? "합" : "합 아님";
const trioLabel = (tiles: HapTile[]) => `${verdict(tiles)}: ${tiles.map(describe).join(", ")}`;

// ── 그림
function HapTrio({ tiles }: { tiles: HapTile[] }) {
  const ok = isHap(tiles);
  return <div className="guide-hap-trio">
    <strong className={ok ? "passed" : "failed"}>{ok ? "합 ✓" : "합 아님 ✕"}</strong>
    <HapBoard board={tiles}/>
    <Checks checks={checkHap(tiles)}/>
  </div>;
}

function HapLegend({ basic }: { basic: boolean }) {
  const mode = HAP_MODES[basic ? "GYEOL_HAP_1" : "GYEOL_HAP"];
  const rows: Array<[string, HapTile[], string[]]> = [
    ["모양", mode.shapes.map(shape => t(shape, "PURPLE", "WHITE")), mode.shapes.map(shape => HAP_NAMES.shape[shape])],
    ["도형 색", mode.colors.map(color => t("CIRCLE", color, "WHITE")), mode.colors.map(color => HAP_NAMES.shapeColor[color])],
    ["배경 색", mode.backgrounds.map(background => t("CIRCLE", "PURPLE", background)), mode.backgrounds.map(background => HAP_NAMES.backgroundColor[background])],
  ];
  return <div className="guide-hap-legend">{rows.map(([title, tiles, names]) => <div key={title}>
    <b>{title}</b>
    {tiles.map((tile, i) => <span key={names[i]}><span className="hap-tile" style={{ background: backgroundFills[tile.backgroundColor] }}><HapShape tile={tile}/></span><small>{names[i]}</small></span>)}
  </div>)}</div>;
}
const legendLabel = (basic: boolean) => {
  const mode = HAP_MODES[basic ? "GYEOL_HAP_1" : "GYEOL_HAP"];
  return `모양 ${mode.shapes.length}종(${mode.shapes.map(s => HAP_NAMES.shape[s]).join("·")}), 도형 색 ${mode.colors.length}종(${mode.colors.map(c => HAP_NAMES.shapeColor[c]).join("·")}), 배경 색 ${mode.backgrounds.length}종(${mode.backgrounds.map(b => HAP_NAMES.backgroundColor[b]).join("·")})`;
};

function TurnButtons() {
  return <div className="guide-hap-turn">
    <div className="hap-actions"><button className="secondary">결!<small>남은 합이 없다면 +3점</small></button><button className="primary">합!<small>새로운 합을 찾았다면 +1점</small></button></div>
    <p>내 차례 <b>15초</b> · 합! 누른 뒤 <b>10초</b> 안에 3장</p>
  </div>;
}

function PickResult({ board }: { board: HapTile[] }) {
  const tiles = PICK.map(n => board[n - 1]), ok = isHap(tiles);
  return <div className="guide-hap-pick">
    <HapBoard board={board} selected={PICK}/>
    <div className={`hap-result ${ok ? "correct" : "wrong"}`}><strong>{PICK.join(" · ")} — {ok ? "새로운 합 +1점" : "오답 −1점"}</strong><Checks checks={checkHap(tiles)}/></div>
  </div>;
}

const ROUNDS: Array<[number, number]> = [[4, 2], [1, 3], [5, 2]];
function RoundsFigure() {
  const total = ROUNDS.reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
  return <div className="guide-hap-rounds">
    <ol>{ROUNDS.map(([me, rival], i) => <li key={i}><small>{i + 1}라운드</small><span>나 +{me}</span><span>상대 +{rival}</span></li>)}</ol>
    <PlayerScores playerIds={["me", "rival"]} scores={{ me: total[0], rival: total[1] }} playerId="me" nameOf={id => id === "me" ? "나" : "상대"}/>
  </div>;
}

// ── 설명서
function hapGuide(basic: boolean): GameGuide {
  const sample = SAMPLES[basic ? "basic" : "expanded"];
  return {
    overview: {
      figure: <HapTrio tiles={sample.hap}/>, label: trioLabel(sample.hap),
      goal: "보드의 타일 9장 중에서 합이 되는 3장을 찾아 점수를 얻습니다.",
      win: "3라운드 누적 점수가 가장 높은 사람이 이깁니다. (3~4인은 인원 수만큼 라운드)",
      essentials: [
        "모양·도형 색·배경 색이 각각 모두 같거나 모두 달라야 합입니다.",
        "새로운 합은 +1점, 오답이나 이미 찾은 합은 −1점입니다.",
        "남은 합이 없다고 생각되면 결! — 맞으면 +3점, 틀리면 −1점입니다.",
      ],
    },
    steps: [
      { title: "타일의 세 가지 속성", body: `모든 타일은 모양·도형 색·배경 색을 가집니다. ${basic ? "결! 합! 1은 3·3·3종" : "결! 합! 2는 5·4·3종"}이고, 보드에는 서로 다른 타일 9장이 깔립니다.`, figure: <HapLegend basic={basic}/>, label: legendLabel(basic) },
      { title: "합 판정: 모두 같거나, 모두 다르거나", body: "세 속성을 하나씩 봅니다. 모두 같거나 모두 다르면 통과, 두 개만 같으면 오답입니다. 한 속성만 걸려도 합이 아닙니다.",
        figure: <div className="guide-hap-compare"><HapTrio tiles={sample.hap}/><HapTrio tiles={sample.notHap}/></div>, label: `왼쪽 ${trioLabel(sample.hap)}. 오른쪽 ${trioLabel(sample.notHap)}, 배경 색이 두 개만 같음.` },
      { title: "내 차례: 합! 또는 결!", body: "15초 안에 고릅니다. 합!을 누르면 10초 안에 타일 3장을 고르고, 세 번째 타일을 누르는 순간 제출됩니다. 아무것도 안 누르면 감점 없이 패스입니다.", figure: <TurnButtons/>, label: "결! 버튼: 남은 합이 없다면 +3점. 합! 버튼: 새로운 합을 찾았다면 +1점. 내 차례 15초, 합! 누른 뒤 10초 안에 3장." },
      { title: "3장 고르기", body: "맞힌 타일은 보드에 그대로 남아 다른 합에 또 쓸 수 있습니다. 이미 누군가 찾은 합은 순서를 바꿔 골라도 −1점입니다.", figure: <PickResult board={sample.board}/>, label: `보드 9장 중 ${PICK.join("·")}번을 골라 ${verdict(PICK.map(n => sample.board[n - 1]))}, 새로운 합 +1점.` },
      { title: "라운드와 승패", body: "결!이 맞거나 한동안 새 합이 안 나오면 새 보드로 넘어갑니다. 3라운드(3~4인은 인원 수만큼)의 점수를 더해 가장 높은 사람이 이깁니다.", figure: <RoundsFigure/>, label: `라운드별 점수 ${ROUNDS.map(([a, b], i) => `${i + 1}라운드 나 ${a}점 상대 ${b}점`).join(", ")}. 누적 나 10점, 상대 7점.` },
    ],
    rules: hapRules(basic),
  };
}

export const gyeolHap1Guide = hapGuide(true);
export const gyeolHap2Guide = hapGuide(false);
