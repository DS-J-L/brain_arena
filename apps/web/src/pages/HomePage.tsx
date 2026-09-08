import { useState } from "react";
import { GAME_INFO, GAME_TYPES, type GameType } from "@brain-arena/shared";
import { Logo } from "../components/Logo";
import { RuleModal } from "../components/RuleModal";

interface Props { nickname: string; setNickname: (v: string) => void; onCreate: (g: GameType) => void; onPractice: (g: GameType) => void; onJoin: (code: string) => void; busy: boolean; error: string }

export function HomePage({ nickname, setNickname, onCreate, onPractice, onJoin, busy, error }: Props) {
  const pathCode = location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i)?.[1];
  const [code, setCode] = useState((new URLSearchParams(location.search).get("code") ?? pathCode ?? "").toUpperCase());
  const [selected, setSelected] = useState<GameType>("BLACK_AND_WHITE");
  const [showRules, setShowRules] = useState(false);

  return <main>
    <nav><Logo /></nav>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">OUTSMART. OUTPLAY. WIN.</p><h1>친구와 펼치는<br/><em>두뇌의 승부</em></h1><p>회원가입 없이 방을 만들고, 단 하나의 선택으로 상대의 생각을 읽어보세요.</p></div>
      <div className="start-card">
        <p className="step">01 — ENTER THE ARENA</p>
        <label>닉네임</label><input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={12} placeholder="2~12자로 입력"/>
        <label>방 코드로 참가</label>
        <div className="join-row"><input className="code-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6자리 코드"/><button className="secondary" disabled={busy} onClick={() => onJoin(code)}>참가</button></div>
        {error && <p className="error">{error}</p>}
        <button className="primary full" disabled={busy || !GAME_INFO[selected].available} onClick={() => onCreate(selected)}>{busy ? "연결 중..." : GAME_INFO[selected].available ? `${gameName(selected)} 방 만들기` : "규칙 준비 중"}<span>→</span></button>
        <button className="secondary full practice-button" disabled={busy || !GAME_INFO[selected].available} onClick={() => onPractice(selected)}>{selected === "FIND_THE_NUMBER" ? "혼자 연습하기 · 목숨 3개 무한 모드" : "연습 봇과 대전하기"}</button>
        <button className="secondary full rules-button" onClick={() => setShowRules(true)}>{gameName(selected)} 규칙 자세히 보기</button>
      </div>
    </section>
    <section className="games">
      <div className="section-head"><div><p className="eyebrow">CHOOSE YOUR GAME</p><h2>오늘의 게임</h2></div><p>게임을 선택한 뒤 규칙을 읽거나 새 방을 만드세요.</p></div>
      <div className="game-grid">{GAME_TYPES.map((type, index) => {
        const game = GAME_INFO[type];
        return <button key={type} className={`game-card ${selected === type ? "selected" : ""}`} onClick={() => setSelected(type)}><span className="game-number">0{index + 1}</span><div className={`game-symbol symbol-${index}`}>{["◐", "↗", "⚄", "◇", "#"][index]}</div><h3>{game.name}</h3><p>{game.description}</p><footer><span>{game.duration}</span><span>{game.difficulty}</span></footer>{!game.available && <span className="soon">RULES TBD</span>}</button>;
      })}</div>
    </section>
    {showRules && <RuleModal gameType={selected} onClose={() => setShowRules(false)}/>}
  </main>;
}

const gameName = (type: GameType) => GAME_INFO[type].name;
