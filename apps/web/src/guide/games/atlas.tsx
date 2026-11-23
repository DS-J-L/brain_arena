import { ATLAS_COLOR_NAMES, ATLAS_MAX_NUMBER, ATLAS_TOKENS, atlasLimit, type AtlasPlacement, type AtlasToken } from "@brain-arena/shared";
import { Giant } from "../../components/AtlasGame";
import type { GameGuide } from "../types";

// ── 예시는 2인전(한계 7, 8 이상이면 무너짐) 기준. 무너짐 표시는 실제 Giant 컴포넌트가 계산한다.
const LIMIT = atlasLimit(2);
const LIMITS_TEXT = [2, 3, 4].map(n => `${n}인 ${atlasLimit(n) + 1}`).join(" · ");
const cls = (token: AtlasToken) => token.toLowerCase();

function HeroGiants() {
  return <div className="atlas-giants guide-atlas-giants">
    <Giant color="RED" blocks={[3, 2]} limit={LIMIT} preview={null}/>
    <Giant color="GREEN" blocks={[4, 1]} limit={LIMIT} preview={3}/>
    <Giant color="BLUE" blocks={[1]} limit={LIMIT} preview={null}/>
  </div>;
}

function HandFigure({ number, token }: { number?: number; token?: AtlasToken }) {
  return <div className="atlas-hand guide-atlas-hand">
    <p className="eyebrow">MY BLOCKS · 나만 볼 수 있습니다</p>
    <div className="atlas-numbers">{Array.from({ length: ATLAS_MAX_NUMBER + 1 }, (_, n) => <button key={n} className={n === number ? "selected" : ""}>{n}</button>)}</div>
    <p className="eyebrow">MY TOKENS</p>
    <div className="atlas-tokens">{ATLAS_TOKENS.map(t => <button key={t} className={`${cls(t)}${t === token ? " selected" : ""}`}>{ATLAS_COLOR_NAMES[t]} <small>×{t === "RAINBOW" ? 1 : 2}</small></button>)}</div>
    {number !== undefined && token && <button className="primary guide-atlas-submit">{number} · {ATLAS_COLOR_NAMES[token]} 제출 <small>· 30초</small></button>}
  </div>;
}

const REVEAL: Array<{ name: string; number: number; token: AtlasToken; note: string; mine?: boolean }> = [
  { name: "상대 A", number: 6, token: "RED", note: "가장 큰 수 · 먼저" },
  { name: "나", number: 5, token: "BLUE", note: "두 번째", mine: true },
  { name: "상대 B", number: 2, token: "RAINBOW", note: "올릴 때 거인 선택" },
];
function RevealOrder() {
  return <section className="atlas-reveal guide-atlas-reveal"><ol className="atlas-placements">{REVEAL.map((r, i) => <li key={r.name} className={`${cls(r.token)}${r.mine ? " mine" : ""}`}>
    <b>{i + 1}</b><span>{r.name}</span>
    <strong><i className="atlas-chip">{r.number}</i> <i className={`atlas-token-dot ${cls(r.token)}`}/> {ATLAS_COLOR_NAMES[r.token]}</strong>
    <small>{r.note}</small>
  </li>)}</ol></section>;
}

const COLLAPSE: AtlasPlacement = { playerId: "me", number: 2, token: "RED", color: "RED", order: 1, blocks: [3, 4, 2], total: 9, collapsed: true, penalty: 3, auto: false };
function CollapseFrames() {
  return <ol className="guide-atlas-frames">
    <li><Giant color="RED" blocks={[3, 4]} limit={LIMIT} preview={null}/><p>3·4를 든 거인</p></li>
    <li><Giant color="RED" blocks={[3, 4]} limit={LIMIT} preview={2}/><p>2를 올리면 합 9</p></li>
    <li><Giant color="RED" blocks={[2]} limit={LIMIT} preview={null} collapsed={COLLAPSE}/><p>벌점 3 · 2만 남음</p></li>
  </ol>;
}
const COLLAPSE_LABEL = "2인전 예시. 빨강 거인이 3과 4를 들고 합 7. 2를 올리면 합 9로 8 이상이라 무너지고, 올린 사람이 블록 3개만큼 벌점 3. 거인에는 2만 남는다.";

const PASS_ROWS: Array<[string, number[], string]> = [
  ["처음", [6, 5, 2], "큰 숫자부터"],
  ["6이 패스", [5, 2, 6], "패스한 사람은 맨 끝"],
  ["5도 패스", [2, 5, 6], "작은 숫자부터 · 이후 패스 불가"],
];
function PassFlow() {
  return <ol className="guide-atlas-pass">{PASS_ROWS.map(([title, order, note]) => <li key={title}>
    <b>{title}</b>
    <span>{order.map((n, i) => <span key={n}>{i > 0 && <i aria-hidden="true">→</i>}<em className="atlas-chip">{n}</em></span>)}</span>
    <small>{note}</small>
  </li>)}</ol>;
}
const PASS_LABEL = `6, 5, 2를 냈을 때 올리는 순서. ${PASS_ROWS.map(([title, order, note]) => `${title}: ${order.join(", ")} (${note})`).join(". ")}.`;

export const atlasGuide: GameGuide = {
  overview: {
    figure: <HeroGiants/>, label: `빨강·초록·파랑 거인 셋. 빨강은 3과 2, 초록은 4와 1, 파랑은 1을 들고 있다. 초록 거인에 3을 올리면 합 8로 무너지고 벌점 3.`,
    goal: "세 거인 위에 숫자 블록을 쌓되, 내 블록으로 거인을 무너뜨리지 않게 피합니다.",
    win: "14라운드 뒤 벌점이 가장 적은 사람이 이깁니다. 공동 최저면 무승부입니다.",
    essentials: [
      "매 라운드 블록 하나와 토큰 하나를 비공개로 내고, 공개 후 큰 숫자부터 토큰 색 거인에 올립니다.",
      `거인이 든 합이 ${LIMITS_TEXT} 이상이 되면 무너지고, 올린 사람이 거인이 든 블록 수만큼 벌점을 받습니다.`,
      "맨 먼저 올릴 사람은 패스해서 올리는 순서를 바꿀 수 있습니다.",
    ],
  },
  steps: [
    { title: "내 블록과 토큰", body: "각자 숫자 블록 0~6과 토큰(빨강·초록·파랑 2개씩, 무지개 1개)을 가집니다. 7라운드면 다 쓰고, 8라운드에 처음처럼 다시 받습니다. 내 손은 나만 볼 수 있습니다.",
      figure: <HandFigure/>, label: "내 손: 숫자 블록 0부터 6까지, 빨강·초록·파랑 토큰 2개씩, 무지개 토큰 1개." },
    { title: "블록 하나 + 토큰 하나를 비공개로", body: "라운드마다 30초 안에 블록과 토큰을 하나씩 고릅니다. 토큰 색이 블록을 올릴 거인입니다. 시간이 지나면 남은 것 중 무작위로 제출됩니다.",
      figure: <HandFigure number={5} token="BLUE"/>, label: "블록 5와 파랑 토큰을 골라 제출." },
    { title: "공개 후 큰 숫자부터", body: "모두 내면 동시에 공개하고 큰 숫자부터 올립니다. 같은 숫자끼리는 선부터 자리 순서대로 올리고, 무지개는 올릴 차례에 거인을 고릅니다.",
      figure: <RevealOrder/>, label: `올리는 순서: ${REVEAL.map((r, i) => `${i + 1}. ${r.name} ${r.number} ${ATLAS_COLOR_NAMES[r.token]}`).join(", ")}.` },
    { title: "무너뜨리면 벌점", body: `합이 ${LIMITS_TEXT} 이상이면 무너집니다. 올린 사람이 거인이 든 블록 수(내 블록 포함)만큼 벌점을 받고, 내 블록만 남습니다.`,
      figure: <CollapseFrames/>, label: COLLAPSE_LABEL },
    { title: "패스로 순서 바꾸기", body: "맨 먼저 올릴 사람은 패스할 수 있습니다. 첫 패스는 그 사람을 맨 뒤로 보내고, 두 번째 패스는 작은 숫자부터로 바꿉니다. 그 뒤로는 패스할 수 없습니다.",
      figure: <PassFlow/>, label: PASS_LABEL },
  ],
  rules: [
    { title: "목표와 준비", items: ["빨강·초록·파랑 판을 든 거인 셋이 있습니다. 14라운드 동안 거인 위에 숫자 블록을 쌓고, 벌점을 가장 적게 받은 플레이어가 승리합니다. 공동 최저 벌점이면 무승부입니다.", "각자 숫자 블록 0~6을 하나씩, 빨강·초록·파랑 토큰 2개씩과 무지개 토큰 1개를 가지고 시작합니다. 7라운드가 끝나면 모두 다 쓰게 되며, 8라운드 시작 때 블록과 토큰을 처음처럼 새로 받습니다.", "2~4명이 함께합니다. 내 블록과 토큰만 볼 수 있고, 다른 사람이 무엇을 남겼는지는 알 수 없습니다. 모두의 벌점은 공개됩니다."] },
    { title: "제출과 올리는 순서", items: ["라운드마다 30초 안에 숫자 블록 하나와 토큰 하나를 비공개로 고릅니다. 시간 안에 내지 않으면 남은 것 중에서 무작위로 제출됩니다.", "모두 제출하면 동시에 공개하고, 큰 숫자부터 토큰 색의 거인 위에 차례로 올립니다. 같은 숫자끼리는 선 플레이어부터 오른쪽(자리 순서)으로 올립니다.", "첫 선은 무작위이고, 이후에는 블록을 먹은(거인을 무너뜨린) 사람이 선이 됩니다. 한 라운드에 여러 번 무너지면 마지막으로 먹은 사람이 선입니다.", "무지개 토큰은 아무 거인에나 쓸 수 있습니다. 블록을 올릴 차례가 오면 거인을 고릅니다."] },
    { title: "패스", example: { title: "6·5·2를 냈을 때", body: "6을 낸 사람이 패스하면 5→2→6 순서가 됩니다. 이어서 5를 낸 사람도 패스하면 작은 숫자부터 2→5→6 순서로 올리고, 더는 패스할 수 없습니다.", figure: <PassFlow/>, label: PASS_LABEL }, items: ["맨 먼저 올릴 사람은 패스할 수 있습니다. 패스하면 다음으로 큰 숫자를 낸 사람부터 올리고, 패스한 사람은 맨 마지막에 올립니다.", "새로 맨 먼저 올리게 된 사람도 패스하면, 그때는 작은 숫자부터(오름차순) 올립니다. 그 뒤로는 패스할 수 없습니다.", "패스는 횟수 제한이 없습니다. 올릴 차례의 결정 시간은 15초이며, 시간이 지나면 패스하지 않고 올립니다(무지개는 가장 안전한 거인)."] },
    { title: "거인이 무너질 때", example: { title: "2인전에서 3·4를 든 거인에 2를 올리면", body: "합 9로 무너집니다. 거인이 든 블록 3개(3·4·2)만큼 벌점 3을 받고, 3과 4는 치워지고 2만 남습니다.", figure: <CollapseFrames/>, label: COLLAPSE_LABEL }, items: ["거인이 버티는 합은 인원에 따라 다릅니다. 2인은 8 이상, 3인은 10 이상, 4인은 12 이상이 되면 무너집니다.", "무너뜨린 블록을 올린 플레이어가 거인이 들고 있던 블록 수(무너뜨린 블록 포함)만큼 벌점을 받습니다. 원래 있던 블록은 치워지고, 무너뜨린 블록은 거인 위에 그대로 남습니다. 예: 2인전에서 3·4를 든 거인에 2를 올리면 합 9로 무너지고 벌점 3, 거인에는 2만 남습니다.", "같은 라운드에 남은 블록은 그 위에 이어서 올라갑니다. 무너지지 않은 블록은 다음 라운드에도 그대로 남습니다."] },
  ],
};
