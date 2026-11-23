import type { GameGuide } from "../types";

// ── 타일은 0~8, 짝수 검정 · 홀수 흰색. 예시 판단(후보·반드시 이기는 타일)은 이 목록에서 계산한다.
const TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
type Color = "black" | "white";
const colorOf = (tile: number): Color => tile % 2 === 0 ? "black" : "white";
const COLOR_NAME: Record<Color, string> = { black: "검정", white: "흰색" };
const ofColor = (color: Color) => TILES.filter(t => colorOf(t) === color);

function Tile({ value, used }: { value: number | "?"; used?: boolean }) {
  const color = value === "?" ? "white" : colorOf(value);
  return <span className={`tile ${color}${used ? " used" : ""}`}><span>{value}</span><small>{color.toUpperCase()}</small></span>;
}

function TileRow({ used = [] }: { used?: number[] }) {
  return <div className="tiles guide-bw-tiles"><p className="eyebrow">YOUR TILES · 0—8</p>
    <div className="tile-row">{TILES.map(t => <Tile key={t} value={t} used={used.includes(t)}/>)}</div>
  </div>;
}
const USED = [2, 7];

// 선공은 7(흰색)을 냈다. 후공 화면에는 색만 보인다.
const LEAD = 7;
function Perspective() {
  return <div className="guide-bw-view">
    <article><small>선공 화면</small><Tile value={LEAD}/><p>{LEAD}을 냄</p></article>
    <article><small>후공 화면</small><Tile value="?"/><p>“{COLOR_NAME[colorOf(LEAD)]}이네?”</p></article>
  </div>;
}

// 나 7(흰색) vs 상대 4(검정): 내가 1점. 상대 숫자는 공개되지 않는다.
const MINE = 7, THEIRS = 4;
const RESULT = MINE > THEIRS ? "win" : MINE < THEIRS ? "lose" : "draw";
const RESULT_NAME = { win: "승리", lose: "패배", draw: "무승부" }[RESULT];
function RoundReveal() {
  const theirs = colorOf(THEIRS);
  return <section className={`black-white-round-reveal guide-bw-reveal ${RESULT}`}>
    <p className="eyebrow">ROUND RESULT</p>
    <div>
      <article className={colorOf(MINE)}><small>MY TILE</small><strong>{MINE}</strong></article>
      <span><b>{RESULT_NAME}{RESULT === "win" ? " · +1점" : ""}</b><small>상대 {theirs === "black" ? "● 검정" : "○ 흰색"} · 숫자 비공개</small></span>
      <article className={theirs}><small>OPPONENT</small><strong>{theirs === "black" ? "●" : "○"}</strong></article>
    </div>
  </section>;
}

const LEAD_ROWS: Array<[string, string]> = [["이긴 사람", "다음 라운드 선공"], ["무승부", "직전 후공이 선공"]];
function LeadFlow() {
  return <ol className="guide-flow">{LEAD_ROWS.map(([from, to]) => <li key={from}><b>{from}</b><i aria-hidden="true">→</i><span>{to}</span></li>)}</ol>;
}

// 상대가 검정 2장, 흰색 1장을 썼다.
const SEEN: Record<Color, number> = { black: 2, white: 1 };
function Tracker() {
  return <div className="opponent-color-counter guide-bw-tracker"><p className="eyebrow">OPPONENT TILE TRACKER</p>
    {(["black", "white"] as const).map(color => { const total = ofColor(color).length;
      return <div key={color} className={`color-count ${color}-count`}><span>{color === "black" ? "●" : "○"} {COLOR_NAME[color]}</span><strong>{SEEN[color]}<small> / {total} 사용</small></strong><em>{total - SEEN[color]}장 남음</em></div>; })}
  </div>;
}
const TRACKER_LABEL = `상대 타일 기록: ${(["black", "white"] as const).map(c => `${COLOR_NAME[c]} ${ofColor(c).length}장 중 ${SEEN[c]}장 사용`).join(", ")}.`;

// 상대가 흰색을 냈을 때 후보와, 반드시 이기는 가장 작은 타일.
const CANDIDATES = ofColor("white");
const SURE = TILES.find(t => t > Math.max(...CANDIDATES))!;
function Deduce() {
  return <div className="guide-bw-deduce">
    <div><small>상대 후보 · 흰색</small><span>{CANDIDATES.map(t => <Tile key={t} value={t}/>)}</span></div>
    <i aria-hidden="true">→</i>
    <div><small>반드시 이김</small><span><Tile value={SURE}/></span></div>
  </div>;
}

export const blackAndWhiteGuide: GameGuide = {
  overview: {
    figure: <TileRow/>, label: `내 타일 0부터 8까지 9장. 짝수(${ofColor("black").join("·")})는 검정, 홀수(${ofColor("white").join("·")})는 흰색.`,
    goal: "0~8 숫자 타일을 한 장씩 내서 상대보다 큰 숫자로 라운드를 이깁니다.",
    win: "먼저 5점을 얻거나 9라운드 뒤 점수가 높은 사람이 이깁니다. 동점이면 연장전을 합니다.",
    essentials: [
      "짝수는 검정, 홀수는 흰색입니다. 타일은 한 번씩만 낼 수 있습니다.",
      "후공은 선공이 낸 타일의 색만 보고 자기 타일을 냅니다. 더 큰 숫자가 1점입니다.",
      "상대가 낸 숫자는 게임이 끝날 때까지 공개되지 않습니다. 색과 승패로 추리하세요.",
    ],
  },
  steps: [
    { title: "내 타일 9장", body: "0부터 8까지 한 장씩 가집니다. 짝수는 검정, 홀수는 흰색이고, 한 번 낸 타일은 다시 쓸 수 없습니다.",
      figure: <TileRow used={USED}/>, label: `내 타일 0부터 8까지. 이미 낸 타일(${USED.join(", ")})은 흐리게 표시된다.` },
    { title: "선공이 먼저, 몰래", body: "선공이 타일 하나를 비공개로 냅니다. 후공에게는 숫자 없이 검정인지 흰색인지만 보입니다.",
      figure: <Perspective/>, label: `선공은 ${LEAD}을 냈다. 후공 화면에는 숫자 없이 ${COLOR_NAME[colorOf(LEAD)]} 타일만 보인다.` },
    { title: "후공이 내고 비교", body: "후공이 타일을 내면 더 큰 숫자를 낸 사람이 1점을 얻습니다. 같으면 아무도 점수를 얻지 않습니다. 상대가 낸 숫자는 보이지 않고 색과 승패만 남습니다.",
      figure: <RoundReveal/>, label: `내 타일 ${MINE}, 상대는 ${COLOR_NAME[colorOf(THEIRS)]} 타일. 결과는 ${RESULT_NAME}. 상대 숫자는 공개되지 않는다.` },
    { title: "이긴 사람이 다음 선공", body: "라운드를 이긴 사람이 다음 라운드의 선공이 됩니다. 무승부라면 직전 후공이 선공을 맡습니다.",
      figure: <LeadFlow/>, label: LEAD_ROWS.map(([from, to]) => `${from}: ${to}`).join(". ") },
    { title: "색 기록으로 추리", body: "상대가 검정과 흰색을 몇 장 썼는지는 화면에 기록됩니다. 남은 색과 지금까지의 승패로 상대가 낼 숫자를 좁혀 가세요.",
      figure: <Tracker/>, label: TRACKER_LABEL },
  ],
  rules: [
    { title: "목표와 준비", items: ["각자 0~8 숫자 타일을 한 장씩 받습니다. 짝수(0·2·4·6·8)는 검정, 홀수(1·3·5·7)는 흰색이며 각 타일은 한 번만 사용할 수 있습니다.", "상대보다 높은 숫자를 내 라운드 점수를 얻으세요. 먼저 5점을 얻거나 9라운드 종료 시 더 높은 점수를 가진 플레이어가 승리합니다."] },
    { title: "라운드 진행", items: ["선공이 타일 하나를 비공개로 냅니다. 후공은 그 타일의 숫자는 볼 수 없고 검정인지 흰색인지만 확인한 뒤 자신의 타일을 냅니다.", "두 숫자를 비교해 더 큰 숫자를 낸 플레이어가 1점을 얻습니다. 같은 숫자라면 아무도 점수를 얻지 않습니다. 비교 결과는 1.5초 동안 표시된 뒤 다음 라운드로 넘어갑니다.", "라운드 승자가 다음 라운드의 선공이 됩니다. 무승부라면 직전 후공이 다음 선공이 됩니다."] },
    { title: "기억할 점", items: ["게임 중에는 상대가 실제로 낸 숫자와 남은 숫자가 공개되지 않습니다. 공개된 색, 승패, 사용 횟수를 바탕으로 상대 숫자를 추리해야 합니다.", "9라운드 뒤 동점이면 새 0~8 타일 세트로 연장전을 진행합니다. 행동 시간이 끝나면 남은 타일 중 하나가 무작위로 제출됩니다."],
      example: { title: "추리해 보기", body: `상대가 흰색을 냈다면 ${CANDIDATES.join("·")} 중 하나입니다. ${SURE}을 내면 반드시 이기지만 가장 센 타일을 써 버립니다. 이기는 것과 센 타일을 아끼는 것 사이에서 고르세요.`,
        figure: <Deduce/>, label: `상대가 흰색을 냈을 때 후보는 ${CANDIDATES.join(", ")}. 내 ${SURE}은 모든 후보보다 크다.` } },
  ],
};
