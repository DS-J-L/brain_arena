import { SCORE_CATEGORIES, secretDiceCount, type ScoreCategory } from "@brain-arena/shared";
import { categoryNames, categoryRules, previewDiceScore } from "../../components/secretDice";
import type { GameGuide } from "../types";

// ── 예시: 공개 4·4·2 중 4·4를 고정 → 공격자 1개, 수비자 2개. 점수는 게임과 같은 previewDiceScore로 계산한다.
type Source = "kept" | "attack" | "defend";
const SOURCE_LABEL: Record<Source, string> = { kept: "고정", attack: "공격", defend: "수비" };
const PUBLIC = [4, 4, 2], KEPT = [0, 1];
const FINAL: Array<[number, Source]> = [[4, "kept"], [4, "kept"], [4, "attack"], [1, "defend"], [6, "defend"]];
const FINAL_VALUES = FINAL.map(([value]) => value);
const KEPT_COUNTS = [1, 2, 3];
const COUNT_TEXT = `비공개로 내는 숫자 개수는 고정한 주사위 수로 정해집니다. ${KEPT_COUNTS.map(k => `${k}개 고정이면 ${secretDiceCount(k, true) === secretDiceCount(k, false) ? `각자 ${secretDiceCount(k, true)}개` : `공격자 ${secretDiceCount(k, true)}개·수비자 ${secretDiceCount(k, false)}개`}`).join(", ")}입니다.`;
const diceLabel = (dice: Array<[number, Source]>) => dice.map(([value, source]) => `${value}(${SOURCE_LABEL[source]})`).join(", ");
const scoreLabel = (categories: ScoreCategory[]) => categories.map(c => `${categoryNames[c]} ${previewDiceScore(FINAL_VALUES, c)}점`).join(", ");

function DiceRow({ dice }: { dice: Array<[number, Source]> }) {
  return <div className="guide-dice-row">{dice.map(([value, source], i) => <span key={i} className={source}>
    <span className={`die${source === "kept" ? " kept" : ""}`}>{value}</span><small>{SOURCE_LABEL[source]}</small>
  </span>)}</div>;
}

function ScoreRows({ categories, dice, compact }: { categories: readonly ScoreCategory[]; dice?: number[]; compact?: boolean }) {
  return <div className={`score-sheet guide-score-rows${compact ? " compact" : ""}`}>{categories.map(c => <button key={c}>
    <span>{categoryNames[c]}</span>{dice && <b>{previewDiceScore(dice, c)}점</b>}<small className="score-rule">{categoryRules[c]}</small>
  </button>)}</div>;
}

function FinalWithScores({ categories }: { categories: ScoreCategory[] }) {
  return <div className="guide-dice-final"><DiceRow dice={FINAL}/><ScoreRows categories={categories} dice={FINAL_VALUES}/></div>;
}

function Roles() {
  return <div className="guide-dice-roles">
    <div className="role-banner"><b>ATTACKER · 공격</b><span>주사위를 고정하고 점수를 기록</span></div>
    <div className="role-banner defend"><b>DEFENDER · 수비</b><span>숫자를 내서 조합을 방해</span></div>
    <p>점수를 기록하면 역할이 바뀝니다</p>
  </div>;
}

function KeepDice() {
  return <div className="dice-area guide-dice-area">
    <p className="eyebrow">PUBLIC DICE</p>
    <div className="dice-row">{PUBLIC.map((die, i) => <span key={i} className={`die${KEPT.includes(i) ? " kept" : ""}`}>{die}</span>)}</div>
    <button className="primary compact">이 주사위 고정</button>
  </div>;
}

function CountTable() {
  return <table className="guide-dice-counts">
    <thead><tr><th>고정</th><th>공격자</th><th>수비자</th><th>최종</th></tr></thead>
    <tbody>{KEPT_COUNTS.map(k => {
      const attack = secretDiceCount(k, true), defend = secretDiceCount(k, false);
      return <tr key={k} className={k === KEPT.length ? "on" : ""}><td>{k}개</td><td>{attack}개</td><td>{defend}개</td><td>{k + attack + defend}개</td></tr>;
    })}</tbody>
  </table>;
}

/** 1~6을 시계처럼 둘러 놓고, 1·2·4·5·6이 만드는 4→5→6→1→2 연속을 강조한다. */
const RUN = [4, 5, 6, 1, 2];
function CircularStraight() {
  const at = (face: number) => { const a = (-90 + (face - 1) * 60) * Math.PI / 180; return [100 + 68 * Math.cos(a), 100 + 68 * Math.sin(a)]; };
  const score = previewDiceScore(RUN, "LARGE_STRAIGHT");
  return <div className="guide-dice-circle">
    <svg viewBox="0 0 200 200" width="180" height="180" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map(face => { const next = face % 6 + 1, [x1, y1] = at(face), [x2, y2] = at(next), on = RUN.includes(face) && RUN.includes(next) && RUN.indexOf(next) === RUN.indexOf(face) + 1;
        return <line key={face} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? "#c8ff43" : "#3a3349"} strokeWidth={on ? 5 : 2} strokeLinecap="round"/>; })}
      {[1, 2, 3, 4, 5, 6].map(face => { const [x, y] = at(face), on = RUN.includes(face);
        return <g key={face}><rect x={x - 17} y={y - 17} width="34" height="34" rx="7" fill={on ? "#f6f2fb" : "#211b33"} stroke={on ? "#c8ff43" : "#463b5c"} strokeWidth="2"/>
          <text x={x} y={y + 6} textAnchor="middle" fontSize="17" fontFamily="DM Mono, monospace" fill={on ? "#17121e" : "#746985"}>{face}</text></g>; })}
    </svg>
    <p><b>1·2·4·5·6</b> → 4·5·6·1·2 · 5연속 {score}점</p>
  </div>;
}
const CIRCLE_LABEL = `1부터 6까지를 원으로 둘러 놓은 그림. 6 다음은 다시 1이라, 주사위 1·2·4·5·6은 4·5·6·1·2로 이어지는 5연속으로 ${previewDiceScore(RUN, "LARGE_STRAIGHT")}점입니다.`;

export const secretDiceGuide: GameGuide = {
  overview: {
    figure: <FinalWithScores categories={["FULL_HOUSE", "FOURS"]}/>,
    label: `최종 주사위 ${diceLabel(FINAL)}. 수비자가 1과 6을 내서 ${scoreLabel(["FULL_HOUSE", "FOURS"])}.`,
    goal: "공격할 때 주사위 5개로 좋은 족보를 만들고, 수비할 때는 상대의 족보를 망칩니다.",
    win: "각자 점수판 12칸을 모두 채운 뒤 총점이 높은 사람이 이깁니다.",
    essentials: [
      "공격자가 공개 주사위 1~3개를 고정하고, 남은 칸은 두 사람이 비공개 숫자로 채웁니다.",
      "점수는 공격자만 기록합니다. 수비자는 조합이 안 되도록 숫자를 내고, 매 턴 역할을 바꿉니다.",
      "1과 6은 이어진 숫자라 5·6·1·2도 연속으로 칩니다.",
    ],
  },
  steps: [
    { title: "공격과 수비", body: "매 턴 공격자만 자기 점수판에 점수를 기록하고, 수비자는 공격자의 조합을 방해합니다. 점수를 기록하면 역할이 바뀝니다.",
      figure: <Roles/>, label: "공격자: 주사위를 고정하고 점수를 기록. 수비자: 숫자를 내서 조합을 방해. 점수를 기록하면 역할이 바뀐다." },
    { title: "공개 주사위 고정", body: "공개 주사위 3개 중 공격자가 1~3개를 고정합니다. 고정한 주사위는 그대로 최종 결과에 들어갑니다. 3개 고정은 게임당 한 번만 쓸 수 있습니다.",
      figure: <KeepDice/>, label: `공개 주사위 ${PUBLIC.join(", ")} 중 ${KEPT.map(i => PUBLIC[i]).join("·")}를 고정.` },
    { title: "남은 칸은 둘이 비공개로", body: "최종 주사위가 5개가 되도록 두 사람이 1~6 숫자를 비공개로 냅니다. 몇 개씩 내는지는 고정한 수로 정해지고, 같은 숫자를 여러 번 골라도 됩니다.",
      figure: <CountTable/>, label: COUNT_TEXT },
    { title: "공개하고 점수 기록", body: "모든 숫자를 함께 공개하면 공격자가 아직 쓰지 않은 점수 칸 하나를 골라 기록합니다. 조건이 안 맞는 칸을 고르면 0점이 됩니다.",
      figure: <FinalWithScores categories={["FOURS", "FULL_HOUSE", "JOKER"]}/>, label: `최종 주사위 ${diceLabel(FINAL)}. 기록할 수 있는 점수: ${scoreLabel(["FOURS", "FULL_HOUSE", "JOKER"])}.` },
    { title: "12칸을 다 채우면 끝", body: "숫자 칸 6개와 조합 칸 6개를 모두 채우면 총점이 높은 사람이 이깁니다. 칸마다 한 번만 쓸 수 있으니 어디에 기록할지가 승부입니다.",
      figure: <ScoreRows categories={SCORE_CATEGORIES} compact/>, label: `점수판 12칸: ${SCORE_CATEGORIES.map(c => `${categoryNames[c]}(${categoryRules[c]})`).join(", ")}.` },
  ],
  rules: [
    { title: "목표와 역할", items: ["매 턴 공격자만 자신의 점수판에 점수를 기록하고, 수비자는 공격자의 조합을 방해합니다. 점수를 기록한 뒤 두 역할을 교대합니다.", "각자 숫자 칸 6개와 조합 칸 6개, 총 12칸을 모두 사용합니다. 모든 칸을 채운 뒤 총점이 높은 플레이어가 승리합니다."] },
    { title: "한 턴의 진행", items: ["공개 주사위 3개가 나오면 공격자가 그중 1~3개를 고정합니다. 3개 고정은 각 플레이어가 게임당 한 번만 사용할 수 있습니다.", "최종 결과가 5개가 되도록 두 플레이어가 1~6 숫자를 비공개로 제출합니다. 같은 숫자를 여러 번 골라도 되며, 양쪽 제출이 끝난 뒤 모든 숫자가 함께 공개됩니다.", "공격자는 아직 쓰지 않은 점수 칸 하나를 반드시 선택합니다. 조건을 만족하지 못한 조합 칸을 선택하면 그 칸에는 0점이 기록됩니다.", COUNT_TEXT] },
    { title: "점수와 순환 연속", example: { title: "1과 6이 이어지는 연속", body: "1·2·4·5·6은 숫자만 보면 끊겨 보이지만, 6 다음이 1이라 4·5·6·1·2의 5연속입니다. 1·2·5·6도 5·6·1·2로 4연속이 됩니다.", figure: <CircularStraight/>, label: CIRCLE_LABEL }, items: ["Ones~Sixes는 해당 숫자의 합입니다. 2·3 다이스 15점, 4다이스 25점, 5다이스 50점이며 조커는 주사위 5개의 총합입니다.", "4연속은 20점, 5연속은 30점입니다. 1과 6은 서로 이어진 숫자로 보므로 1·2·4·5·6은 4→5→6→1→2의 5연속, 1·2·5·6은 5→6→1→2의 4연속입니다.", "시간이 끝나면 고정 주사위와 비공개 숫자는 무작위로 선택되고, 점수 칸은 현재 얻을 수 있는 최고 점수 칸으로 자동 기록됩니다."] },
  ],
};
