import { pokerFoldPenalty } from "@brain-arena/shared";
import type { GameGuide } from "../types";

// ── 덱은 1~10이 두 장씩(20장). 폴드 페널티는 서버와 같은 pokerFoldPenalty로 계산한다.
const START_CHIPS = 20, ANTE = 1, MAX_CARD = 10;

function Table({ opponent, chips, pot }: { opponent: number; chips: number; pot: number }) {
  return <div className="poker-table guide-poker-table">
    <div className="poker-player"><small>상대 · {chips}칩</small><div className="poker-card face">{opponent}</div><span>상대 카드는 보임</span></div>
    <div className="pot"><small>POT</small><strong>{pot}</strong></div>
    <div className="poker-player"><small>YOU · {chips}칩</small><div className="poker-card back">?</div><span>내 카드는 못 봄</span></div>
  </div>;
}
const AFTER_ANTE = START_CHIPS - ANTE, POT = ANTE * 2;

// 새 덱에서 상대 카드를 뺀 19장 중 내 카드가 더 높을·같을·낮을 장 수.
const odds = (opponent: number) => ({ higher: (MAX_CARD - opponent) * 2, same: 1, lower: (opponent - 1) * 2 });
const READS = [2, 9];
function Reads() {
  return <div className="guide-poker-reads">{READS.map(card => { const o = odds(card);
    return <article key={card}><div className="poker-card face">{card}</div>
      <p>상대가 {card}면<br/>내가 더 높을 카드 <b>{o.higher}장</b><br/><small>같음 {o.same} · 낮음 {o.lower} (남은 {o.higher + o.same + o.lower}장)</small></p></article>; })}
  </div>;
}
const READS_LABEL = READS.map(card => { const o = odds(card); return `상대 카드가 ${card}일 때 새 덱의 남은 ${o.higher + o.same + o.lower}장 중 내 카드가 더 높은 경우 ${o.higher}장, 같은 경우 ${o.same}장, 낮은 경우 ${o.lower}장`; }).join(". ");

const ACTIONS: Array<[string, string, string]> = [
  ["콜 / 승부", "primary", "상대와 같은 칩을 걸고 바로 카드 공개"],
  ["레이즈 +1", "primary", "현재 베팅보다 1칩 더"],
  ["올인", "primary", "남은 칩을 모두 건다"],
  ["폴드", "secondary", "포기하고 판돈을 상대에게"],
];
function Actions() {
  return <div className="guide-poker-actions">{ACTIONS.map(([name, tone, note]) => <div key={name}><button className={tone}>{name}</button><small>{note}</small></div>)}</div>;
}

// 내 8 vs 상대 5로 콜 → 판돈 6칩을 가져간다.
const SHOW = { mine: 8, theirs: 5, pot: 6 };
function Showdown() {
  const result = SHOW.mine > SHOW.theirs ? "win" : SHOW.mine < SHOW.theirs ? "lose" : "draw";
  return <section className={`poker-round-reveal guide-poker-reveal ${result}`}>
    <p className="eyebrow">CARDS OPEN</p>
    <div><article><small>MY CARD</small><strong>{SHOW.mine}</strong></article>
      <span><b>{SHOW.mine} : {SHOW.theirs}</b><em>{result === "win" ? "내가 더 높은 카드로 승리" : result === "lose" ? "상대가 더 높은 카드로 승리" : "같은 숫자 · 판돈 이월"}</em><small>판돈 {SHOW.pot}칩</small></span>
      <article><small>상대</small><strong>{SHOW.theirs}</strong></article></div>
  </section>;
}

// 폴드 페널티 두 장면. 보유 칩은 넉넉하다고 본다.
const FOLDS = [
  { mine: 9, theirs: 6, bet: 3 },
  { mine: 10, theirs: 7, bet: 2 },
].map(f => ({ ...f, penalty: pokerFoldPenalty(f.mine, f.theirs, f.bet, START_CHIPS), higher: f.mine > f.theirs ? f.bet : 0, ten: f.mine === MAX_CARD ? MAX_CARD : 0 }));
const foldWhy = (f: typeof FOLDS[number]) => f.higher && f.ten ? `높은 카드 ${f.higher}칩 · 10 페널티 ${f.ten}칩 중 큰 쪽` : f.ten ? "10으로 폴드" : `건 칩 ${f.bet}만큼`;
function FoldScenes() {
  return <div className="guide-poker-folds">{FOLDS.map(f => <article key={f.mine}>
    <p><b>{f.mine}</b><span>vs</span><b>{f.theirs}</b></p>
    <small>{f.bet}칩 걸고 폴드</small>
    <strong>추가 {f.penalty}칩</strong>
    <small>{foldWhy(f)} · 총 {f.bet + f.penalty}칩 잃음</small>
  </article>)}</div>;
}
const FOLD_LABEL = FOLDS.map(f => `내 ${f.mine}, 상대 ${f.theirs}, ${f.bet}칩을 걸고 폴드하면 추가 ${f.penalty}칩(${foldWhy(f)}), 총 ${f.bet + f.penalty}칩을 잃는다`).join(". ");

export const indianPokerGuide: GameGuide = {
  overview: {
    figure: <Table opponent={7} chips={AFTER_ANTE} pot={POT}/>, label: "포커 테이블. 상대 카드 7은 보이고, 내 카드는 뒷면이라 볼 수 없다.",
    goal: "내 카드는 못 보고 상대 카드만 보면서, 베팅으로 상대의 칩을 가져옵니다.",
    win: `각자 칩 ${START_CHIPS}개로 시작해 상대 칩을 모두 가져오면 이깁니다.`,
    essentials: [
      "내 카드는 나만 못 봅니다. 상대 카드와 상대의 베팅을 보고 내 카드를 추리하세요.",
      "콜하면 바로 카드를 공개해 높은 쪽이 판돈을 가져갑니다. 같으면 판돈은 다음 라운드로 넘어갑니다.",
      "내 카드가 더 높거나 10인데 폴드하면 칩을 추가로 잃습니다.",
    ],
  },
  steps: [
    { title: `기본 베팅 ${ANTE}칩씩`, body: `라운드마다 두 사람이 칩 ${ANTE}개씩 판돈에 넣고 시작합니다. 카드는 1~10이 두 장씩 든 덱에서 한 장씩 받습니다.`,
      figure: <Table opponent={4} chips={AFTER_ANTE} pot={POT}/>, label: `두 사람 모두 칩 ${ANTE}개를 내서 ${AFTER_ANTE}칩씩 남고 판돈은 ${POT}칩.` },
    { title: "상대 카드로 내 카드 추리", body: "상대 카드가 낮으면 내가 이길 가능성이 크고, 높으면 작습니다. 상대도 내 카드를 보고 베팅하니, 상대의 행동도 힌트입니다.",
      figure: <Reads/>, label: READS_LABEL },
    { title: "행동 네 가지", body: "내 차례에 콜, 레이즈, 올인, 폴드 중 하나를 합니다. 레이즈는 상대가 맞출 수 있는 칩까지만 올릴 수 있습니다.",
      figure: <Actions/>, label: ACTIONS.map(([name, , note]) => `${name}: ${note}`).join(". ") },
    { title: "공개하고 판돈 가져가기", body: "콜이나 폴드로 라운드가 끝나면 두 카드를 모두 공개합니다. 더 높은 카드가 판돈을 가져가고, 같은 숫자면 판돈은 다음 라운드로 넘어갑니다.",
      figure: <Showdown/>, label: `내 카드 ${SHOW.mine}, 상대 카드 ${SHOW.theirs}. 내가 이겨 판돈 ${SHOW.pot}칩을 가져간다.` },
  ],
  rules: [
    { title: "목표와 준비", items: ["각자 칩 20개로 시작하며 1~10 카드가 두 장씩 든 덱을 사용합니다. 상대의 칩을 모두 가져오면 승리합니다.", "라운드마다 기본 베팅으로 칩 1개씩 냅니다. 자신의 카드는 볼 수 없고 상대 카드만 볼 수 있으므로, 상대의 숫자와 행동으로 내 카드의 강도를 추리해야 합니다."] },
    { title: "베팅과 카드 공개", items: ["콜은 상대와 같은 수의 칩을 걸고 카드를 비교하는 행동입니다. 레이즈는 현재 베팅보다 1개 더 올리며, 상대가 맞출 수 있는 칩까지만 걸 수 있습니다.", "폴드하면 현재 판돈을 상대에게 주고, 올인은 남은 칩을 모두 겁니다. 콜이나 폴드로 라운드가 끝나는 즉시 양쪽 카드를 모두 공개하고 1.5초 동안 비교 결과를 보여줍니다.", "결과 공개가 끝나야 다음 라운드와 행동 시간이 시작됩니다. 더 높은 카드가 판돈을 가져가며, 같은 숫자라면 판돈을 다음 라운드로 이월합니다."] },
    { title: "폴드 페널티", items: ["내 카드가 상대 카드보다 높은데 폴드하면, 이번 라운드에 내가 이미 건 칩만큼 추가로 잃습니다. 예를 들어 3칩을 건 뒤 폴드하면 기존 3칩과 추가 3칩으로 총 6칩을 잃습니다.", "내 카드가 10인데 폴드했다면 10칩 추가 페널티가 적용됩니다. 높은 카드 페널티와 동시에 해당되면 둘을 더하지 않고 더 큰 페널티 하나만 적용하며, 보유 칩이 부족하면 남은 칩까지만 잃습니다.", "상대의 레이즈가 없을 때 시간이 끝나면 자동 콜, 레이즈를 받은 상태에서 시간이 끝나면 자동 폴드합니다."],
      example: { title: "폴드하면 얼마나 잃을까", body: "폴드하는 순간에는 내 카드를 모릅니다. 상대 카드가 낮을수록 내 카드가 더 높을 가능성이 커서 폴드가 위험합니다. 두 페널티가 겹치면 더하지 않고 큰 쪽 하나만 받습니다.",
        figure: <FoldScenes/>, label: FOLD_LABEL } },
  ],
};
