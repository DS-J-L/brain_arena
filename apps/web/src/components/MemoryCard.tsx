import { useEffect, useState, type ReactNode } from "react";
import type { NumberCardValue } from "@brain-arena/shared";

interface Props {
  index: number;
  value: NumberCardValue | string | null;
  selectionOrder: number;
  disabled: boolean;
  onPick: () => void;
  /** 카드에 덧붙일 클래스 */
  tone?: string;
  /** 선택 순번 대신 보여줄 표시 (예: 누가 가져간 칸인지) */
  badge?: string;
  /** 앞면을 직접 그릴 때 사용한다. 뒤집히는 동안에는 직전 값이 넘어온다. */
  renderFace?: (value: NumberCardValue | string, label: string) => ReactNode;
}

// Keep the outgoing face until its 600 ms CSS rotation has finished.
const FLIP_DURATION_MS = 600;

export function MemoryCard({ index, value, selectionOrder, disabled, onPick, tone = "", badge, renderFace }: Props) {
  const [outgoingValue, setOutgoingValue] = useState(value);
  const faceUp = value !== null;
  const label = String.fromCharCode(65 + index);

  useEffect(() => {
    if (value !== null) {
      setOutgoingValue(value);
      return;
    }
    const timeout = window.setTimeout(() => setOutgoingValue(null), FLIP_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <button
      className={`memory-card ${faceUp ? "is-face-up" : ""} ${selectionOrder > 0 ? "selected" : ""} ${tone}`}
      disabled={disabled}
      onClick={onPick}
      aria-label={`${label} 카드${faceUp ? `: ${value}` : ""}${selectionOrder > 0 ? `, ${selectionOrder}번째 선택` : ""}${badge ? `, ${badge}가 고른 카드` : ""}`}
      aria-pressed={selectionOrder > 0}
    >
      <span className="memory-card-inner" aria-hidden="true">
        <span className="memory-card-face memory-card-back">
          <small>{label}</small>
          <strong>{label}</strong>
        </span>
        <span className="memory-card-face memory-card-front">
          {renderFace
            ? (value ?? outgoingValue) !== null && renderFace((value ?? outgoingValue)!, label)
            : <><small>{label}</small><strong>{value ?? outgoingValue}</strong></>}
        </span>
      </span>
      {selectionOrder > 0 && <em aria-hidden="true">{selectionOrder}</em>}
      {badge && <em className="memory-card-badge" aria-hidden="true">{badge}</em>}
    </button>
  );
}
