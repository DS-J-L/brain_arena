import { calculateNumberCards, findNumberTargetScore, type NumberCardValue, type NumberOperator } from "@brain-arena/shared";
import type { GameGuide } from "../types";

// ── 예시 보드와 정답 6 × 3. 목표 숫자와 계산 예시의 판정은 서버와 같은 calculateNumberCards로 계산한다.
const BOARD: NumberCardValue[] = [5, "+", 11, 2, 9, 6, "×", 12, "-", 1, 3, 8, 4, 10, "÷", 7];
const ANSWER = [5, 6, 10];
const [A, OP, B] = ANSWER.map(i => BOARD[i]) as [number, NumberOperator, number];
const TARGET = calculateNumberCards(A, OP, B)!;
const letter = (i: number) => String.fromCharCode(65 + i);
const EXPRESSION = `${A} ${OP} ${B} = ${TARGET}`;

/** MemoryCard와 같은 마크업. 실제 컴포넌트는 뒤집힐 때 소리를 내므로 그림에서는 정적으로 그린다. */
function Card({ index, faceUp, order }: { index: number; faceUp: boolean; order: number }) {
  return <span className={`memory-card${faceUp ? " is-face-up" : ""}${order ? " selected" : ""}`}>
    <span className="memory-card-inner">
      <span className="memory-card-face memory-card-back"><small>{letter(index)}</small><strong>{letter(index)}</strong></span>
      <span className="memory-card-face memory-card-front"><small>{letter(index)}</small><strong>{BOARD[index]}</strong></span>
    </span>
    {order > 0 && <em>{order}</em>}
  </span>;
}
function Board({ faceUp, picks = [] }: { faceUp: boolean; picks?: number[] }) {
  return <div className="memory-board guide-memory-board">{BOARD.map((_, i) => <Card key={i} index={i} faceUp={faceUp} order={picks.indexOf(i) + 1}/>)}</div>;
}
const Target = () => <div className="target-number guide-target"><small>TARGET NUMBER</small><strong>{TARGET}</strong></div>;

function Hero() {
  return <div className="guide-find"><Target/><Board faceUp picks={ANSWER}/></div>;
}
function Buzz() {
  return <div className="guide-find-buzz"><Target/><span className="buzzer"><span>BUZZ</span><small>정답 수식을 찾았습니다</small></span></div>;
}
function Answer() {
  return <div className="guide-find"><Board faceUp={false} picks={ANSWER}/>
    <div className="number-answer guide-find-answer"><div>{ANSWER.map(i => <span key={i}>{letter(i)}</span>)}</div><p>숫자 → 연산자 → 숫자</p></div>
  </div>;
}

const SECOND = findNumberTargetScore(2);
const MISS_ROWS: Array<[string, string]> = [["첫 답변 오답·시간 초과", "상대가 부저 없이 15초 동안 답함"], ["오답 감점", "없음"], ["정답", "+1점 · 다음 목표 숫자"]];
function Miss() {
  return <ol className="guide-flow">{MISS_ROWS.map(([from, to]) => <li key={from}><b>{from}</b><i aria-hidden="true">→</i><span>{to}</span></li>)}</ol>;
}

// 계산 규칙: 뺄셈은 양수, 나눗셈은 나누어떨어져야 정답이 될 수 있다.
const EXAMPLES: Array<[number, NumberOperator, number]> = [[9, "-", 4], [4, "-", 9], [8, "÷", 2], [7, "÷", 2]];
const verdict = ([a, op, b]: [number, NumberOperator, number]) => {
  const value = calculateNumberCards(a, op, b);
  return value === null ? { ok: false, text: `${a} ${op} ${b} ✕ 나머지가 남음` } : value <= 0 ? { ok: false, text: `${a} ${op} ${b} = ${value} ✕ 음수` } : { ok: true, text: `${a} ${op} ${b} = ${value} ✓` };
};
function CalcExamples() {
  return <ul className="guide-find-calc">{EXAMPLES.map(e => { const v = verdict(e); return <li key={e.join()} className={v.ok ? "ok" : "no"}>{v.text}</li>; })}</ul>;
}

export const findTheNumberGuide: GameGuide = {
  overview: {
    figure: <Hero/>, label: `목표 숫자 ${TARGET}. 4×4 보드에서 ${letter(ANSWER[0])}(${A}), ${letter(ANSWER[1])}(${OP}), ${letter(ANSWER[2])}(${B}) 순서로 골라 ${EXPRESSION}.`,
    goal: "외워 둔 카드 위치를 떠올려, 목표 숫자를 만드는 카드 세 장을 먼저 찾습니다.",
    win: `먼저 ${SECOND}점을 얻으면 이깁니다. 3인 이상은 ${findNumberTargetScore(3)}점입니다.`,
    essentials: [
      "숫자 1~12와 기호 4개가 섞인 16장을 20초 동안 외웁니다. 그 뒤 카드는 A~P 면으로 뒤집힙니다.",
      "목표 숫자가 나오면 부저를 먼저 누른 사람이 5초 안에 숫자 → 연산자 → 숫자 순서로 세 장을 고릅니다.",
      "틀려도 감점은 없고, 상대에게 답할 기회가 넘어갑니다.",
    ],
  },
  steps: [
    { title: "20초 동안 외우기", body: "숫자 1~12와 사칙연산 기호 4개가 섞인 16장이 펼쳐집니다. 모두 같은 보드를 보며 20초 동안 위치를 외웁니다.",
      figure: <Board faceUp/>, label: `앞면이 보이는 4×4 보드: ${BOARD.map((v, i) => `${letter(i)} ${v}`).join(", ")}.` },
    { title: "알파벳 면으로 뒤집힘", body: "20초가 지나면 모든 카드가 A부터 P까지 알파벳 면으로 뒤집힙니다. 이제 위치는 기억으로만 찾아야 합니다.",
      figure: <Board faceUp={false}/>, label: "뒤집힌 4×4 보드. 카드마다 A부터 P까지 알파벳만 보인다." },
    { title: "목표 숫자가 나오면 부저", body: "목표 숫자가 공개되면 15초 동안 부저를 누를 수 있습니다. 서버에 먼저 도착한 부저만 인정됩니다.",
      figure: <Buzz/>, label: `목표 숫자 ${TARGET}과 부저 버튼.` },
    { title: "숫자 → 연산자 → 숫자", body: "부저를 누른 사람은 5초 안에 카드 세 장을 이 순서로 고릅니다. 같은 카드는 두 번 쓸 수 없고, 세 장을 다 고른 뒤 한꺼번에 공개합니다.",
      figure: <Answer/>, label: `뒤집힌 보드에서 ${ANSWER.map(letter).join(", ")}를 차례로 골랐다. 공개하면 ${EXPRESSION}.` },
    { title: "틀리면 상대에게 기회", body: "첫 답변이 틀리거나 시간을 넘기면 상대가 부저 없이 15초 동안 답할 수 있습니다. 틀려도 점수는 깎이지 않습니다.",
      figure: <Miss/>, label: MISS_ROWS.map(([from, to]) => `${from}: ${to}`).join(". ") },
  ],
  rules: [
    { title: "혼자 연습 모드", items: ["연습 대전에서는 상대와 부저 없이 혼자 계속 문제를 풉니다. 정답 개수에는 제한이 없는 무한 모드입니다.", "목숨 3개로 시작하며 오답을 제출하거나 15초의 답변 시간을 넘길 때마다 목숨을 1개 잃습니다. 목숨이 0개가 되면 연습이 종료되고 최종 정답 개수와 전체 기록을 확인할 수 있습니다."] },
    { title: "목표와 암기", items: ["숫자 1~12와 사칙연산 기호 4개가 섞인 4×4 보드를 두 플레이어가 20초 동안 함께 암기합니다.", "20초 뒤 카드는 A~P 알파벳 면으로 뒤집힙니다. 공개된 목표 숫자를 만드는 카드 위치를 먼저 찾아 6점을 얻으면 승리합니다."] },
    { title: "부저와 답변", items: ["목표 숫자가 나오면 15초 동안 부저를 누를 수 있습니다. 서버에 먼저 도착한 부저만 인정되며 첫 답변자는 5초 안에 카드 세 장을 선택합니다.", "카드는 반드시 숫자 → 연산자 → 숫자 순서로 골라야 하고 같은 카드를 두 번 쓸 수 없습니다. 세 장을 모두 고른 뒤 한꺼번에 공개합니다.", "첫 답변이 틀리거나 시간을 넘기면 상대가 별도 부저 없이 15초 동안 답할 수 있습니다. 오답 감점은 없습니다."] },
    { title: "계산과 시간 초과", items: ["덧셈·뺄셈·곱셈·나눗셈을 선택 순서대로 계산합니다. 뺄셈은 양수여야 하고 나눗셈은 나머지가 없는 정수여야 정답입니다.", "정답은 1점이며 선택한 카드와 수식을 2초 동안 공개합니다. 15초 동안 아무도 부저를 누르지 않으면 가능한 정답 하나를 3초 동안 보여준 뒤 다음 목표로 넘어갑니다."],
      example: { title: "고르는 순서가 곧 계산 순서", body: "같은 두 숫자라도 고른 순서에 따라 결과가 달라집니다. 큰 수를 먼저 골라야 뺄셈과 나눗셈이 성립합니다.",
        figure: <CalcExamples/>, label: EXAMPLES.map(e => verdict(e).text.replace("✓", "정답").replace(/✕/, "오답,")).join(". ") } },
    { title: "3~4인 대전", items: ["방에는 최대 4명까지 들어올 수 있으며 2명 이상이 모두 준비하면 시작합니다. 3인 이상은 먼저 5점을 얻으면 승리합니다.", "첫 답변이 틀리면 그 플레이어는 이번 목표 숫자에서 빠지고, 남은 사람이 두 명 이상이면 10초 동안 다시 부저를 겨룹니다. 한 명만 남으면 그 사람이 부저 없이 15초 동안 답합니다.", "목표 숫자를 모두 출제할 때까지 승자가 없으면 최고 점수가 승리하고, 공동 1위면 무승부입니다. 도중에 나간 플레이어는 빠지고 남은 사람끼리 계속합니다."] },
  ],
};
