import { useEffect, useRef, useState } from "react";
import { GAME_INFO, type GameType } from "@brain-arena/shared";
import { GUIDES } from "./index";
import type { GuideFigureSpec, GuideTab } from "./types";

const TAB_LABELS: Record<GuideTab, { full: string; short: string }> = {
  overview: { full: "한눈에 보기", short: "요약" },
  steps: { full: "진행 순서", short: "순서" },
  rules: { full: "전체 규칙", short: "규칙" },
};
const SWIPE_PX = 40;

/** 그림은 보여주기만 한다: 클릭·포커스를 막고, 내용은 label로 읽어 준다. */
function GuideFigure({ figure, label }: GuideFigureSpec) {
  return <figure className="guide-figure" role="img" aria-label={label}><div inert>{figure}</div></figure>;
}

interface Props { gameType: GameType; onClose: () => void; initialTab?: GuideTab }

export function GuideModal({ gameType, onClose, initialTab = "overview" }: Props) {
  const guide = GUIDES[gameType], info = GAME_INFO[gameType];
  const tabs = (["overview", "steps", "rules"] as const).filter(tab => tab === "rules" || (tab === "overview" ? guide.overview : guide.steps?.length));
  const [tab, setTab] = useState<GuideTab>(tabs.includes(initialTab) ? initialTab : tabs[0]);
  const [step, setStep] = useState(0);
  const [compact] = useState(() => window.matchMedia("(max-width: 480px)").matches);
  const swipeStart = useRef<number | null>(null);
  const steps = guide.steps ?? [];
  const go = (delta: number) => setStep(current => Math.min(steps.length - 1, Math.max(0, current + delta)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (tab === "steps" && event.key === "ArrowRight") go(1);
      else if (tab === "steps" && event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal rule-modal" role="dialog" aria-modal="true" aria-labelledby="rule-title" onClick={event => event.stopPropagation()}>
      <button className="modal-close" aria-label="규칙 닫기" onClick={onClose}>×</button>
      <p className="eyebrow">HOW TO PLAY</p>
      <div className="guide-title">
        <h2 id="rule-title">{info.name}</h2>
        <span>{info.maxPlayers > 2 ? `2~${info.maxPlayers}인` : "1:1"}</span><span>{info.duration}</span><span>{info.difficulty}</span>
      </div>

      {tabs.length > 1 && <div className="guide-tabs" role="tablist">{tabs.map(key => <button key={key} role="tab" id={`guide-tab-${key}`} aria-selected={tab === key} aria-controls="guide-panel" onClick={() => setTab(key)}>
        {compact ? TAB_LABELS[key].short : TAB_LABELS[key].full}
      </button>)}</div>}

      <div id="guide-panel" role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? `guide-tab-${tab}` : undefined}>
        {tab === "overview" && guide.overview && <div className="guide-overview">
          <GuideFigure figure={guide.overview.figure} label={guide.overview.label}/>
          <p><b>GOAL</b>{guide.overview.goal}</p>
          <p><b>WIN</b>{guide.overview.win}</p>
          <section className="guide-essentials"><h3>꼭 알아야 할 3가지</h3><ol>{guide.overview.essentials.map(item => <li key={item}>{item}</li>)}</ol></section>
        </div>}

        {tab === "steps" && steps[step] && <div className="guide-steps"
          onPointerDown={event => { swipeStart.current = event.clientX; }}
          onPointerUp={event => { if (swipeStart.current === null) return; const dx = event.clientX - swipeStart.current; swipeStart.current = null; if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1); }}>
          <GuideFigure figure={steps[step].figure} label={steps[step].label}/>
          <p className="guide-step-count">STEP {step + 1} / {steps.length}</p>
          <h3>{steps[step].title}</h3>
          <p>{steps[step].body}</p>
          <div className="guide-stepper">
            <button className="text-button" disabled={step === 0} onClick={() => go(-1)}>← 이전</button>
            <span>{steps.map((s, index) => <button key={s.title} className={index === step ? "on" : ""} aria-label={`${index + 1}단계 ${s.title}`} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}/>)}</span>
            <button className="text-button" disabled={step === steps.length - 1} onClick={() => go(1)}>다음 →</button>
          </div>
        </div>}

        {tab === "rules" && <div className="rule-sections">{guide.rules.map((section, index) => <details key={section.title} open={!compact || index === 0}>
          <summary><h3>{section.title}</h3></summary>
          <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
          {section.example && <aside className="guide-example">
            {section.example.figure && <GuideFigure figure={section.example.figure} label={section.example.label ?? section.example.title}/>}
            <strong>예시 · {section.example.title}</strong><p>{section.example.body}</p>
          </aside>}
        </details>)}</div>}
      </div>

      <button className="primary full" onClick={onClose}>규칙을 확인했습니다</button>
    </section>
  </div>;
}
