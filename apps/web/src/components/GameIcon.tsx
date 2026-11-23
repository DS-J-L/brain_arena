import type { ReactNode } from "react";
import type { GameType } from "@brain-arena/shared";

/** 게임 카드에 쓰는 선 아이콘과 색조, 한 줄 태그. */
const ICONS: Record<GameType, { tone: string; tags: string; paths: ReactNode }> = {
  BLACK_AND_WHITE: { tone: "blue", tags: "추리 · 심리전", paths: <><circle cx="12" cy="12" r="9"/><path d="M12 6.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/><path d="M12 6.5v11"/></> },
  ASCENDING: { tone: "violet", tags: "선택 · 순서", paths: <path d="M6 19v-4M12 19v-8M18 19V5"/> },
  SECRET_DICE: { tone: "orange", tags: "확률 · 수 싸움", paths: <><rect x="3" y="9" width="11" height="11" rx="2.2"/><path d="M10.5 6.2 12 3.9a1.7 1.7 0 0 1 2.3-.5l5.3 3.4a1.7 1.7 0 0 1 .5 2.3L17 14"/><circle cx="6.6" cy="12.6" r=".9" fill="currentColor"/><circle cx="10.4" cy="16.4" r=".9" fill="currentColor"/><circle cx="15.6" cy="7.6" r=".9" fill="currentColor"/></> },
  INDIAN_POKER: { tone: "violet", tags: "베팅 · 심리전", paths: <><rect x="6" y="3" width="12" height="18" rx="2.2"/><path d="m12 8.5 3 3.5-3 3.5-3-3.5z"/></> },
  FIND_THE_NUMBER: { tone: "blue", tags: "기억 · 수식", paths: <><rect x="5" y="3" width="14" height="18" rx="2.2"/><rect x="8" y="6" width="8" height="3" rx=".6"/>{[9, 12, 15].flatMap(x => [13, 17].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r=".9" fill="currentColor"/>))}</> },
  GYEOL_HAP_1: { tone: "teal", tags: "기본 · 패턴 찾기", paths: <><path d="m12 3 4 6.5H8z"/><circle cx="7.5" cy="16.5" r="3.5"/><rect x="13.5" y="13" width="7" height="7" rx="1.2"/></> },
  GYEOL_HAP: { tone: "teal", tags: "확장 · 패턴 찾기", paths: <><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/><path d="M14 6.5h6m-2.2-2.2 2.2 2.2-2.2 2.2M10 17.5H4m2.2-2.2L4 17.5l2.2 2.2"/></> },
  MEMORY_HOLDEM: { tone: "blue", tags: "기억 · 카드 조합", paths: <><rect x="10" y="4" width="10" height="16" rx="2"/><path d="M6.5 6.5v11M3 9v6"/></> },
  ATLAS: { tone: "amber", tags: "블록 · 한계 읽기", paths: <><path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/></> },
};

export const gameTags = (type: GameType) => ICONS[type].tags;

export function GameIcon({ type, className = "" }: { type: GameType; className?: string }) {
  const icon = ICONS[type];
  return <span className={`game-icon tone-${icon.tone} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon.paths}</svg>
  </span>;
}
